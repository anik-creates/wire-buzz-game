/**
 * ============================================================================
 * EEE Fest 2026 - Wire Buzz Web Serial Driver
 * Web Serial API (Chrome/Edge COM Port) + Fallback Simulation
 * ============================================================================
 */

class WebSerialController {
  constructor() {
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.isConnected = false;
    this.baudRate = 115200;
    this.incomingBuffer = "";
    this.listeners = [];
    this.lastHeartbeat = 0;

    // Supported in Chrome, Edge, Opera
    this.isSupported = 'serial' in navigator;
  }

  on(event, callback) {
    this.listeners.push({ event, callback });
  }

  emit(event, data) {
    this.listeners
      .filter(l => l.event === event || l.event === '*')
      .forEach(l => l.callback(data, event));
  }

  async connect() {
    if (!this.isSupported) {
      alert("Web Serial API is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Opera.");
      return false;
    }

    try {
      // Prompt user to select COM port (e.g. COM16 CH343 / ESP32-S3)
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: this.baudRate });

      this.isConnected = true;
      this.emit('connection_changed', { connected: true, port: this.port });

      // Start asynchronous read loop
      this.readLoop();

      // Handshake with ESP32
      await this.sendCommand('PING');
      return true;
    } catch (err) {
      console.warn("Serial connection error / cancelled:", err);
      this.isConnected = false;
      this.emit('connection_changed', { connected: false, error: err.message });
      return false;
    }
  }

  async disconnect() {
    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader = null;
      }
      if (this.writer) {
        await this.writer.close();
        this.writer = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
      this.isConnected = false;
      this.emit('connection_changed', { connected: false });
    } catch (err) {
      console.error("Disconnect error:", err);
    }
  }

  async readLoop() {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
    this.reader = textDecoder.readable.getReader();

    try {
      while (true) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          this.processRawChunk(value);
        }
      }
    } catch (err) {
      console.warn("Serial read loop error:", err);
    } finally {
      this.reader.releaseLock();
    }
  }

  processRawChunk(chunk) {
    this.incomingBuffer += chunk;
    const lines = this.incomingBuffer.split('\n');
    // Keep incomplete trailing fragment in buffer
    this.incomingBuffer = lines.pop();

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      this.emit('raw_line', line);

      // Attempt to parse JSON event
      if (line.startsWith('{') && line.endsWith('}')) {
        try {
          const json = JSON.parse(line);
          if (json.event) {
            this.handleParsedEvent(json.event, json);
          }
        } catch (e) {
          console.warn("JSON parse warning:", line);
        }
      }
    }
  }

  handleParsedEvent(eventName, payload) {
    if (eventName === 'HEARTBEAT') {
      this.lastHeartbeat = Date.now();
    }
    this.emit(eventName, payload);
  }

  async sendCommand(cmdStr) {
    if (!this.isConnected || !this.port || !this.port.writable) {
      // Offline / Simulation fallback
      return false;
    }

    try {
      const textEncoder = new TextEncoderStream();
      const writableStreamClosed = textEncoder.readable.pipeTo(this.port.writable);
      const writer = textEncoder.writable.getWriter();
      await writer.write(cmdStr + '\n');
      await writer.close();
      await writableStreamClosed;
      return true;
    } catch (err) {
      console.error("Serial write error:", err);
      return false;
    }
  }

  // High-level Hardware Commands
  async startHardwareGame(mode, playerName, studentId) {
    const payload = JSON.stringify({
      cmd: "START",
      mode: mode,
      player: playerName,
      student_id: studentId
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
