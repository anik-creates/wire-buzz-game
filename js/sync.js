/**
 * ============================================================================
 * EEE Fest 2026 - Wire Buzz Real-Time Cloud & Local Synchronizer
 * Organized by IEEE PES DIU SBC
 * 
 * Multi-layer sync:
 * 1. MQTT over WebSockets (EMQX primary, HiveMQ fallback) -> Syncs mobile QR registrations to laptop projector screen across campus WiFi / mobile data.
 * 2. BroadcastChannel -> Instant 0ms sync across tabs/windows on the same computer.
 * 3. LocalStorage Event Listener -> Fallback local sync.
 * ============================================================================
 */

class CloudQueueSync {
  constructor() {
    this.primaryBroker = 'wss://broker.emqx.io:8084/mqtt';
    this.fallbackBroker = 'wss://broker.hivemq.com:8884/mqtt';
    this.topicQueue = 'diu_eee_fest_2026/wire_buzz/live_queue';
    this.topicStatus = 'diu_eee_fest_2026/wire_buzz/sync_status';
    
    this.client = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.localChannel = null;

    try {
      this.localChannel = new BroadcastChannel('wire_buzz_channel');
      this.localChannel.onmessage = (e) => {
        if (e.data && e.data.type === 'QUEUE_SYNC_REQUEST') {
          this.broadcastCurrentState();
        }
      };
    } catch (e) {
      console.warn('[Sync] BroadcastChannel not supported:', e);
    }

    // Auto-listen to storage events for cross-tab local fallback
    window.addEventListener('storage', (e) => {
      if (e.key === 'eee_fest_wire_buzz_v3' && window.gameState) {
        window.gameState.loadFromStorage();
        window.gameState.emit('state_changed', window.gameState.state);
        window.gameState.emit('QUEUE_UPDATED', { queue: window.gameState.state.queue });
      }
    });

    this.connectMqtt(this.primaryBroker);
  }

  connectMqtt(brokerUrl) {
    if (typeof mqtt === 'undefined') {
      console.warn('[Sync] MQTT library not yet loaded. Will retry...');
      setTimeout(() => this.connectMqtt(brokerUrl), 600);
      return;
    }

    try {
      const clientId = 'wire_buzz_' + Math.random().toString(16).substring(2, 10);
      this.client = mqtt.connect(brokerUrl, {
        clientId: clientId,
        clean: true,
        connectTimeout: 6000,
        reconnectPeriod: 3500,
        keepalive: 45
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.connectionAttempts = 0;
        console.log('[Sync] Connected to real-time cloud relay:', brokerUrl);

        // Subscribe to live queue and status topics
        this.client.subscribe([this.topicQueue, this.topicStatus], { qos: 1 });

        // Update UI status dot if present
        this.updateSyncUI(true);

        // If on registration page, request latest queue status
        if (window.location.pathname.includes('register')) {
          this.requestLatestQueue();
        } else {
          // Presenter / Admin broadcast existing state
          this.broadcastCurrentState();
        }
      });

      this.client.on('message', (topic, payload) => {
        try {
          const data = JSON.parse(payload.toString());
          this.handleIncomingCloudMessage(topic, data);
        } catch (e) {
          console.warn('[Sync] Parse error:', e);
        }
      });

      this.client.on('error', (err) => {
        console.warn('[Sync] MQTT error on', brokerUrl, err.message);
        this.isConnected = false;
        this.updateSyncUI(false);
      });

      this.client.on('offline', () => {
        this.isConnected = false;
        this.updateSyncUI(false);
        this.connectionAttempts++;
        if (this.connectionAttempts > 3 && brokerUrl === this.primaryBroker) {
          console.log('[Sync] Switching to fallback broker...');
          this.client.end(true);
          this.connectMqtt(this.fallbackBroker);
        }
      });
    } catch (err) {
      console.warn('[Sync] Connection init error:', err);
    }
  }

  handleIncomingCloudMessage(topic, data) {
    if (!data || !data.type) return;

    if (data.type === 'PLAYER_REGISTERED' && data.player) {
      console.log('[Sync] Received cloud registration:', data.player.name);
      
      if (window.gameState) {
        // Add to presenter / admin queue without re-publishing
        const added = window.gameState.addPlayerToQueue(data.player, false);
        
        // Play notification sound on presenter screen if soundEngine exists
        if (window.soundEngine && typeof window.soundEngine.playCountdownTick === 'function') {
          window.soundEngine.playCountdownTick(880);
        }

        // Reply with fresh queue state to notify phone of position
        this.broadcastCurrentState();
      }
    } else if (data.type === 'QUEUE_SYNC' && data.queue) {
      if (window.gameState) {
        window.gameState.state.queue = data.queue;
        if (data.activePlayer) window.gameState.state.activePlayer = data.activePlayer;
        window.gameState.saveToStorage();
        window.gameState.emit('QUEUE_UPDATED', { queue: data.queue });
        if (data.activePlayer) {
          window.gameState.emit('ACTIVE_PLAYER_CHANGED', { player: data.activePlayer });
        }
        window.gameState.emit('state_changed', window.gameState.state);
      }
    } else if (data.type === 'REQUEST_QUEUE_STATUS') {
      if (!window.location.pathname.includes('register')) {
        this.broadcastCurrentState();
      }
    }
  }

  // Publish registration from mobile phone
  publishRegistration(player) {
    const payload = JSON.stringify({
      type: 'PLAYER_REGISTERED',
      player: player,
      timestamp: Date.now()
    });

    // 1. Send via Cloud MQTT (for phone to laptop)
    if (this.client && this.isConnected) {
      this.client.publish(this.topicQueue, payload, { qos: 1 }, (err) => {
        if (!err) console.log('[Sync] Player registration sent to cloud!');
      });
    }

    // 2. Local broadcast
    if (this.localChannel) {
      this.localChannel.postMessage({
        type: 'QUEUE_UPDATED',
        payload: { queue: window.gameState ? window.gameState.state.queue : [] }
      });
    }
  }

  // Broadcast current state from laptop to phones
  broadcastCurrentState() {
    if (!this.client || !this.isConnected || !window.gameState) return;

    const payload = JSON.stringify({
      type: 'QUEUE_SYNC',
      queue: window.gameState.state.queue,
      activePlayer: window.gameState.state.activePlayer,
      mode: window.gameState.state.mode,
      timestamp: Date.now()
    });

    this.client.publish(this.topicQueue, payload, { qos: 0 });
  }

  requestLatestQueue() {
    if (this.client && this.isConnected) {
      this.client.publish(this.topicQueue, JSON.stringify({
        type: 'REQUEST_QUEUE_STATUS',
        timestamp: Date.now()
      }), { qos: 0 });
    }
  }

  updateSyncUI(connected) {
    const syncDot = document.getElementById('cloudSyncDot');
    const syncText = document.getElementById('cloudSyncText');
    if (syncDot) {
      syncDot.style.background = connected ? 'var(--accent-green, #00e676)' : '#666';
      syncDot.style.boxShadow = connected ? '0 0 8px var(--accent-green, #00e676)' : 'none';
    }
    if (syncText) {
      syncText.textContent = connected ? 'Cloud Live' : 'Syncing...';
    }
  }
}

// Global Singleton
window.cloudSync = new CloudQueueSync();
