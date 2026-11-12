/**
 * ============================================================================
 * EEE Fest 2026 - Wire Buzz Robust Web Serial Driver
 * Organized by IEEE PES DIU SBC
 * 
 * Bulletproof Features:
 * - Direct WHATWG Stream Reader & Writer (NO pipeTo stream locking / closing bugs)
 * - Auto-reconnects on page load & on USB plug-in events
 * - Safe DTR/RTS signal assertion (prevents ESP32-S3 from being held in reset)
 * - Friendly diagnostics for Windows COM port exclusive lock conflicts
 * - Periodic keepalive heartbeat & robust JSON / plaintext packet parser
 * ============================================================================
 */

class WebSerialController {
  constructor() {
    this.port = null;
    this.reader = null;
    this.isReading = false;
    this.isConnected = false;
    this.isConnecting = false;
    this.baudRate = 115200;
    this.incomingBuffer = "";
    this.listeners = [];
    this.lastHeartbeat = 0;
    this.heartbeatTimer = null;

    // Supported in Chromium browsers (Chrome, Edge, Opera)
    this.isSupported = ('serial' in navigator);

    // Bind USB plug / unplug events
    if (this.isSupported) {
      navigator.serial.addEventListener('connect', (e) => {
        console.log("USB Serial device connected:", e.port);
        this.emit('device_attached', { port: e.port });
        if (!this.isConnected) {
          this.connect(e.port, true);
        }
      });

      navigator.serial.addEventListener('disconnect', (e) => {
        console.log("USB Serial device disconnected:", e.port);
        if (this.port === e.port) {
          this.handleUnexpectedDisconnect();
        }
      });
    }
  }

  on(event, callback) {
    this.listeners.push({ event, callback });
  }

  emit(event, data = {}) {
    this.listeners
      .filter(l => l.event === event || l.event === '*')
      .forEach(l => {
        try {
          l.callback(data, event);
        } catch (e) {
          console.error(`Error in serial listener [${event}]:`, e);
        }
      });
  }

  /**
   * Attempt auto-connection silently without showing popup dialog
   */
  async autoConnect() {
    if (!this.isSupported || this.isConnected || this.isConnecting) return false;

    try {
      const authorizedPorts = await navigator.serial.getPorts();
      if (authorizedPorts && authorizedPorts.length > 0) {
        console.log(`Found ${authorizedPorts.length} pre-authorized COM port(s). Auto-connecting...`);
        return await this.connect(authorizedPorts[0], true);
      }
    } catch (e) {
      console.warn("Auto-connect check failed:", e);
    }
    return false;
  }

  /**
   * Connect to ESP32-S3 COM Port
   * @param {SerialPort|null} targetPort Optional pre-selected port
   * @param {boolean} silent If true, do not show alert on user cancellation
   */
  async connect(targetPort = null, silent = false) {
    if (!this.isSupported) {
      if (!silent) {
        alert("Web Serial API is not supported in this browser.\nPlease open this arena screen in Google Chrome or Microsoft Edge.");
      }
      return false;
    }

    if (this.isConnected) {
      return true;
    }

    if (this.isConnecting) {
      return false;
    }

    this.isConnecting = true;
    this.emit('connection_state', { state: 'CONNECTING' });

    try {
      // 1. Select Port
      let port = targetPort;
      if (!port) {
        const preAuthorized = await navigator.serial.getPorts().catch(() => []);
        if (preAuthorized.length === 1 && silent) {
          port = preAuthorized[0];
        } else {
          // Open native browser COM port picker dialog
          port = await navigator.serial.requestPort();
        }
      }

      if (!port) {
        this.isConnecting = false;
        return false;
      }

      // 2. Open Port (115200 Baud)
      try {
        await port.open({ baudRate: this.baudRate });
      } catch (openErr) {
        // If already open in this context, ignore InvalidStateError
        if (openErr.name !== 'InvalidStateError') {
          let userMsg = openErr.message || "Unknown error";
          if (openErr.name === 'NetworkError' || userMsg.includes('Failed to open') || userMsg.includes('Access is denied')) {
            userMsg = "COM Port Access Denied: The ESP32 COM port is currently open in another program (e.g. Arduino IDE, PlatformIO Serial Monitor, or another browser tab). Please close them and click Connect COM again.";
          }
          throw new Error(userMsg);
        }
      }

      // 3. Set DTR/RTS signals to ensure ESP32-S3 is running (not held in reset or bootloader)
      try {
        await port.setSignals({ dataTerminalReady: false, requestToSend: false });
      } catch (sigErr) {
        // Ignore if virtual driver does not implement setSignals
      }

      this.port = port;
      this.isConnected = true;
      this.isConnecting = false;

      // 4. Start asynchronous stream reader loop
      this.readLoop();

      // 5. Brief stabilization delay before handshake
      await new Promise(res => setTimeout(res, 180));

      // 6. Handshake with ESP32
      await this.sendCommand('PING');

      // 7. Start periodic keepalive heartbeat (every 5 seconds)
      this.startHeartbeat();

      this.emit('connection_changed', { connected: true, port: this.port });
      return true;

    } catch (err) {
      console.warn("Serial connection failed:", err);
      this.isConnected = false;
      this.isConnecting = false;
      this.port = null;

      this.emit('connection_changed', {
        connected: false,
        error: err.message,
        isUserCancel: (err.name === 'NotFoundError')
      });

      if (!silent && err.name !== 'NotFoundError') {
        alert(err.message || "Failed to connect to COM port.");
      }

      return false;
    }
  }

  /**
   * Cleanly disconnects and releases all streams
   */
  async disconnect() {
    this.isReading = false;
    this.isConnected = false;
    this.isConnecting = false;

    this.stopHeartbeat();

    // 1. Cancel and release reader lock
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch (e) {}
      try {
        this.reader.releaseLock();
      } catch (e) {}
      this.reader = null;
    }

    // 2. Close physical port
    if (this.port) {
      try {
        await this.port.close();
      } catch (e) {
        console.warn("Error closing port:", e);
      }
      this.port = null;
    }

    this.emit('connection_changed', { connected: false });
  }

  handleUnexpectedDisconnect() {
    console.warn("ESP32 was physically unplugged from USB!");
    this.isReading = false;
    this.isConnected = false;
    this.isConnecting = false;
    this.stopHeartbeat();
    this.reader = null;
    this.port = null;
    this.emit('connection_changed', { connected: false, reason: 'UNPLUGGED' });
  }

  /**
   * Continuous Direct Reader Loop
   */
  async readLoop() {
    this.isReading = true;
    const decoder = new TextDecoder();

    while (this.port && this.port.readable && this.isReading) {
      try {
        this.reader = this.port.readable.getReader();
        while (this.isReading) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            this.processRawChunk(chunk);
          }
        }
      } catch (err) {
        if (this.isReading) {
          console.warn("Serial read loop encounter:", err);
        }
        break;
      } finally {
        if (this.reader) {
          try {
            this.reader.releaseLock();
          } catch (e) {}
          this.reader = null;
        }
      }
    }
  }

  /**
   * Incoming buffer parser
   */
  processRawChunk(chunk) {
    this.incomingBuffer += chunk;
    const lines = this.incomingBuffer.split('\n');
    // Keep incomplete trailing fragment in buffer
    this.incomingBuffer = lines.pop();

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      this.emit('raw_line', line);

      // 1. JSON Packet Parsing
      if (line.startsWith('{') && line.endsWith('}')) {
        try {
          const json = JSON.parse(line);
          if (json.event) {
            this.handleParsedEvent(json.event, json);
            continue;
          }
        } catch (e) {
          // Fall through to plain text parsing if JSON parse failed
        }
      }

      // 2. Plain Text Event Parsing Fallbacks
      if (line.includes('FINISH')) {
        this.emit('FINISH', {});
      } else if (line.includes('GAMEOVER')) {
        this.emit('GAMEOVER', { reason: "TOUCH" });
      } else if (line.includes('TOUCH')) {
        this.emit('TOUCH', {});
      } else if (line.includes('PONG')) {
        this.lastHeartbeat = Date.now();
        this.emit('PONG', {});
      } else if (line.includes('READY')) {
        this.emit('READY', {});
      }
    }
  }

  handleParsedEvent(eventName, payload) {
    if (eventName === 'PONG' || eventName === 'HEARTBEAT' || eventName === 'STATUS') {
      this.lastHeartbeat = Date.now();
    }
    this.emit(eventName, payload);
  }

  /**
   * Send Command with immediate writer lock acquisition & release
   * Eliminates WHATWG pipeTo locking bugs completely
   */
  async sendCommand(cmdStr) {
    if (!this.isConnected || !this.port || !this.port.writable) {
      return false;
    }

    let writer = null;
    try {
      writer = this.port.writable.getWriter();
      const encoder = new TextEncoder();
      const bytes = encoder.encode(cmdStr.trim() + '\n');
      await writer.write(bytes);
      return true;
    } catch (err) {
      console.error("Serial command send error:", err);
      return false;
    } finally {
      if (writer) {
        try {
          writer.releaseLock();
        } catch (e) {}
      }
    }
  }

  // Keepalive Heartbeat
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(async () => {
      if (this.isConnected) {
        await this.sendCommand('PING');
      }
    }, 6000);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ========================== HIGH-LEVEL CONTROLS ==========================

  async startHardwareGame(mode, playerName, studentId) {
    const payload = JSON.stringify({
      cmd: "START",
      mode: mode,
      player: playerName || "Contestant",
      student_id: studentId || "231"
    });
    return await this.sendCommand(payload);
  }

  async resetHardwareGame() {
    return await this.sendCommand('RESET');
  }

  async stopHardwareGame() {
    return await this.sendCommand('STOP');
  }

  async setHardwareMode(mode) {
    return await this.sendCommand(`SET_MODE ${mode}`);
  }

  async testHardwareBuzzer(durationMs = 250) {
    return await this.sendCommand(`BUZZ ${durationMs}`);
  }
}

// Global Singleton
window.serialController = new WebSerialController();
