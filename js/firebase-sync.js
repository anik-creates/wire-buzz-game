/**
 * ============================================================================
 * EEE Fest 2026 - Wire Buzz Firebase Real-Time Database Sync Engine
 * Technically Supported by IEEE PES DIU SBC
 * 
 * Real-time Multi-Device Sync:
 * - Mobile QR Registrations (phone -> Firebase RTDB -> Arena Projector & Admin)
 * - Live Challenger Queue & Stage Promotion
 * - Official Match History & Top 10 Leaderboard
 * - Master Registered Participants Counter
 * - Remote Admin Commands (Start, Knockout, Finish, Reset, Top 10 Toggle)
 * ============================================================================
 */

(function() {
  const firebaseConfig = {
    apiKey: "AIzaSyClQGVVVLaIkbkAjswOjsvFP6WQT3Y_pyI",
    authDomain: "wirebuzz-31ebe.firebaseapp.com",
    databaseURL: "https://wirebuzz-31ebe-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "wirebuzz-31ebe",
    storageBucket: "wirebuzz-31ebe.firebasestorage.app",
    messagingSenderId: "440114360841",
    appId: "1:440114360841:web:d06c309797427a9a3c7ed8",
    measurementId: "G-N8EN40TBW7"
  };

  class FirebaseSyncEngine {
    constructor() {
      this.db = null;
      this.isInitialized = false;
      this.isConnected = false;
      this.listeners = [];
      this.lastProcessedEventTime = Date.now() - 3000;
      this.localBroadcastChannel = null;

      // BroadcastChannel for instant local 0ms cross-tab sync
      try {
        this.localBroadcastChannel = new BroadcastChannel('wire_buzz_channel');
      } catch (e) {}

      this.initFirebase();
    }

    initFirebase() {
      if (typeof firebase === 'undefined') {
        console.warn('[Firebase] Firebase SDK script not yet ready, will retry...');
        setTimeout(() => this.initFirebase(), 400);
        return;
      }

      try {
        if (!firebase.apps.length) {
          firebase.initializeApp(firebaseConfig);
        }
        this.db = firebase.database();
        this.isInitialized = true;
        console.log('[Firebase] Realtime Database initialized on:', firebaseConfig.databaseURL);

        this.bindConnectionMonitor();
        this.bindLiveListeners();
      } catch (err) {
        console.error('[Firebase] Init error:', err);
      }
    }

    bindConnectionMonitor() {
      if (!this.db) return;
      const connectedRef = this.db.ref('.info/connected');
      connectedRef.on('value', (snap) => {
        this.isConnected = !!snap.val();
        this.updateSyncUI(this.isConnected);
        if (this.isConnected) {
          console.log('[Firebase] Cloud Live WebSocket Connected ✓');
        } else {
          console.log('[Firebase] Cloud connection suspended / offline');
        }
      });
    }

    bindLiveListeners() {
      if (!this.db) return;

      // 1. Live State Listener (Queue, Active Player, Mode)
      const stateRef = this.db.ref('wirebuzz/liveState');
      stateRef.on('value', (snapshot) => {
        const data = snapshot.val() || {};
        if (window.gameState) {
          if (Array.isArray(data.queue)) {
            window.gameState.state.queue = data.queue.filter(p => p && !window.gameState.isDefaultPlaceholder(p));
          } else {
            window.gameState.state.queue = [];
          }

          if (data.activePlayer && !window.gameState.isDefaultPlaceholder(data.activePlayer)) {
            window.gameState.state.activePlayer = data.activePlayer;
          } else {
            window.gameState.state.activePlayer = null;
          }

          window.gameState.ensureStageReady();

          if (data.mode && (data.mode === 1 || data.mode === 2)) {
            window.gameState.state.mode = data.mode;
            window.gameState.emit('MODE_CHANGED', { mode: data.mode });
          }

          window.gameState.saveToStorage();
          window.gameState.emit('QUEUE_UPDATED', { queue: window.gameState.state.queue });
          window.gameState.emit('ACTIVE_PLAYER_CHANGED', { player: window.gameState.state.activePlayer });
          window.gameState.emit('state_changed', window.gameState.state);
        }
      }, (err) => {
        console.warn('[Firebase] liveState read notice:', err.message);
      });

      // 2. Match History Listener (All-Time Scores & Leaderboard)
      const historyRef = this.db.ref('wirebuzz/matchHistory');
      historyRef.on('value', (snapshot) => {
        const val = snapshot.val();
        if (window.gameState) {
          if (val) {
            const records = Object.values(val);
            // Sort newest first
            records.sort((a, b) => (b.timestampRaw || 0) - (a.timestampRaw || 0));
            window.gameState.state.matchHistory = records;
          } else {
            // When cleared in cloud, reset matchHistory to empty array immediately!
            window.gameState.state.matchHistory = [];
          }
          window.gameState.saveToStorage();
          window.gameState.emit('state_changed', window.gameState.state);
          window.gameState.emit('MATCH_FINISHED', {});
          window.gameState.emit('MATCH_HISTORY_CLEARED', {});
          window.gameState.emit('MATCH_RECORD_DELETED', {});
        }
      }, (err) => {
        console.warn('[Firebase] matchHistory read notice:', err.message);
      });

      // 3. Registered Participants Master Registry
      const regRef = this.db.ref('wirebuzz/registeredParticipants');
      regRef.on('value', (snapshot) => {
        const val = snapshot.val();
        const count = val ? Object.keys(val).length : 0;
        if (window.gameState) {
          window.gameState.state.totalRegistrationsCount = count;
          window.gameState.emit('REGISTRATIONS_UPDATED', { count, participants: val });
        }
      }, (err) => {
        console.warn('[Firebase] registeredParticipants notice:', err.message);
      });

      // 4. Remote Real-Time Events (Admin Triggers)
      const eventsRef = this.db.ref('wirebuzz/events');
      eventsRef.limitToLast(1).on('child_added', (snapshot) => {
        const eventData = snapshot.val();
        if (eventData && eventData.timestamp && eventData.timestamp > this.lastProcessedEventTime) {
          this.lastProcessedEventTime = eventData.timestamp;
          this.handleRemoteEvent(eventData.type, eventData.payload);
        }
      });
    }

    handleRemoteEvent(type, payload) {
      if (!type || !window.gameState) return;
      console.log('[Firebase Event Received]:', type, payload);

      if (type === 'FACTORY_RESET_ALL_DATA') {
        window.gameState.state.matchHistory = [];
        window.gameState.state.queue = [];
        window.gameState.state.activePlayer = null;
        window.gameState.state.totalRegistrationsCount = 0;
        window.gameState.saveToStorage();
        window.gameState.emit('FACTORY_RESET_ALL_DATA', {});
        window.gameState.emit('QUEUE_UPDATED', { queue: [] });
        window.gameState.emit('ACTIVE_PLAYER_CHANGED', { player: null });
        window.gameState.emit('MATCH_HISTORY_CLEARED', {});
        window.gameState.emit('MATCH_RECORD_DELETED', {});
        window.gameState.emit('REGISTRATIONS_UPDATED', { count: 0 });
        window.gameState.emit('state_changed', window.gameState.state);
      } else {
        window.gameState.emit(type, payload);
      }

      if (this.localBroadcastChannel) {
        this.localBroadcastChannel.postMessage({ type, payload });
      }
    }

    // ======================== CLOUD MUTATION ACTIONS ========================

    /**
     * Add newly registered participant from Mobile QR
     */
    async publishRegistration(player) {
      if (!player || !player.studentId) return;

      const safeId = String(player.studentId).replace(/[.#$\[\]]/g, '_');
      const timestamp = Date.now();

      const newPlayer = {
        id: player.id || 'p_' + timestamp,
        name: player.name,
        studentId: player.studentId,
        department: player.department || 'EEE',
        registeredAt: player.registeredAt || new Date().toLocaleTimeString(),
        timestampRaw: timestamp
      };

      // 1. Write to Master Registered Participants Registry
      if (this.db) {
        try {
          await this.db.ref(`wirebuzz/registeredParticipants/${safeId}`).set(newPlayer);
        } catch (e) {
          console.warn('[Firebase] Master registration write error:', e);
        }
      }

      // 2. Add to active queue or stage
      if (window.gameState) {
        window.gameState.addPlayerToQueue(newPlayer, false);
      }

      // 3. Sync full queue state to Firebase
      await this.syncCurrentQueue();
    }

    /**
     * Compatibility alias for state.js calls
     */
    broadcastCurrentState() {
      return this.syncCurrentQueue();
    }

    /**
     * Push current local queue & stage state to Firebase
     */
    async syncCurrentQueue() {
      if (!this.db || !window.gameState) return;
      try {
        const payload = {
          queue: window.gameState.state.queue || [],
          activePlayer: window.gameState.state.activePlayer || null,
          mode: window.gameState.state.mode || 1,
          updatedAt: Date.now()
        };
        await this.db.ref('wirebuzz/liveState').update(payload);
      } catch (err) {
        console.warn('[Firebase] syncCurrentQueue write:', err.message);
      }
    }

    /**
     * Record match completion in Firebase
     */
    async recordMatch(record) {
      if (!this.db || !record) return;
      try {
        const recordId = record.id || 'm_' + Date.now();
        const cloudRecord = { ...record, timestampRaw: Date.now() };
        await this.db.ref(`wirebuzz/matchHistory/${recordId}`).set(cloudRecord);
        await this.syncCurrentQueue();
      } catch (err) {
        console.warn('[Firebase] recordMatch write error:', err.message);
      }
    }

    /**
     * Delete match record from Firebase
     */
    async deleteMatchRecord(id) {
      if (!this.db || !id) return;
      try {
        await this.db.ref(`wirebuzz/matchHistory/${id}`).remove();
        await this.sendRemoteEvent('MATCH_RECORD_DELETED', { id });
      } catch (err) {
        console.warn('[Firebase] deleteMatchRecord error:', err.message);
      }
    }

    /**
     * Clear all match history from Firebase
     */
    async clearMatchHistory() {
      if (!this.db) return;
      try {
        await this.db.ref('wirebuzz/matchHistory').set(null);
        await this.sendRemoteEvent('MATCH_HISTORY_CLEARED', {});
      } catch (err) {
        console.warn('[Firebase] clearMatchHistory error:', err.message);
      }
    }

    /**
     * Complete wipe of all Arena data across all devices
     */
    async wipeAllData() {
      if (window.gameState) {
        window.gameState.state.matchHistory = [];
        window.gameState.state.queue = [];
        window.gameState.state.activePlayer = null;
        window.gameState.state.totalRegistrationsCount = 0;
        window.gameState.saveToStorage();
        window.gameState.emit('FACTORY_RESET_ALL_DATA', {});
        window.gameState.emit('QUEUE_UPDATED', { queue: [] });
        window.gameState.emit('ACTIVE_PLAYER_CHANGED', { player: null });
        window.gameState.emit('MATCH_HISTORY_CLEARED', {});
        window.gameState.emit('MATCH_RECORD_DELETED', {});
        window.gameState.emit('REGISTRATIONS_UPDATED', { count: 0 });
        window.gameState.emit('state_changed', window.gameState.state);
      }
      if (!this.db) return;
      try {
        await this.db.ref('wirebuzz/matchHistory').set(null);
        await this.db.ref('wirebuzz/registeredParticipants').set(null);
        await this.db.ref('wirebuzz/liveState').set({
          queue: [],
          activePlayer: null,
          mode: 1,
          updatedAt: Date.now()
        });
        await this.sendRemoteEvent('FACTORY_RESET_ALL_DATA', { timestamp: Date.now() });
      } catch (err) {
        console.warn('[Firebase] wipeAllData error:', err.message);
      }
    }

    /**
     * Send remote admin event via Firebase (Start, Finish, GameOver, Reset, etc.)
     */
    async sendRemoteEvent(type, payload = {}) {
      if (!this.db) return;
      try {
        const eventRef = this.db.ref('wirebuzz/events').push();
        await eventRef.set({
          type: type,
          payload: payload,
          timestamp: Date.now()
        });
      } catch (err) {
        console.warn('[Firebase] sendRemoteEvent error:', err.message);
      }
    }

    updateSyncUI(connected) {
      const syncDot = document.getElementById('cloudSyncDot');
      const syncText = document.getElementById('cloudSyncText');
      if (syncDot) {
        syncDot.style.background = connected ? 'var(--fest-green, #00e676)' : '#ffab00';
        syncDot.style.boxShadow = connected ? '0 0 10px var(--fest-green, #00e676)' : 'none';
      }
      if (syncText) {
        syncText.textContent = connected ? 'Firebase Live' : 'Connecting Cloud...';
      }
    }
  }

  // Global Singleton
  window.firebaseSync = new FirebaseSyncEngine();
  // Compatibility alias for existing references
  window.cloudSync = window.firebaseSync;
})();
