/**
 * ============================================================================
 * EEE Fest 2026 - Central State & Sync Controller
 * Technically Supported by IEEE PES DIU SBC
 * ============================================================================
 */

class GameStateManager {
  constructor() {
    this.storageKey = 'eee_fest_wire_buzz_v6';
    this.channel = null;
    
    try {
      this.channel = new BroadcastChannel('wire_buzz_channel');
      this.channel.onmessage = (event) => {
        if (event.data && event.data.type) {
          this.handleBroadcastMessage(event.data);
        }
      };
    } catch (e) {
      console.warn("BroadcastChannel unavailable:", e);
    }
    
    this.state = {
      mode: 1, // 1: Sudden Death, 2: Multi-Touch Precision
      status: 'IDLE', // IDLE, COUNTDOWN, PLAYING, GAMEOVER, FINISHED, INTERMISSION
      activePlayer: null, // Empty initial state (no dummy players)
      queue: [],          // Empty initial queue
      currentMatch: {
        startTime: 0,
        endTime: 0,
        elapsedMs: 0,
        touches: 0,
        score: 0,
        reason: ""
      },
      matchHistory: []
    };

    this.listeners = [];
    this.loadFromStorage();
    this.ensureStageReady();
  }

  on(event, callback) {
    this.listeners.push({ event, callback });
  }

  emit(event, data) {
    this.listeners
      .filter(l => l.event === event || l.event === '*')
      .forEach(l => l.callback(data, event));
  }

  isDefaultPlaceholder(p) {
    if (!p || !p.name) return true;
    const n = p.name.trim().toLowerCase();
    const id = (p.studentId || '').trim().toLowerCase();
    return n === 'ready player' || 
           n === 'contestant 1' || 
           n === 'waiting for player' || 
           n === 'stage open' ||
           n === 'player' || 
           n === 'champion' ||
           n === 'none' ||
           id === '231-15-0000' ||
           id === '231-15-0001' ||
           id === 'scan qr to join' ||
           id === 'scan qr to enter' ||
           id === '';
  }

  // Ensures the top person in queue automatically takes the stage if stage is vacant/idle
  ensureStageReady() {
    if (this.isDefaultPlaceholder(this.state.activePlayer)) {
      if (this.state.queue.length > 0) {
        this.state.activePlayer = this.state.queue.shift();
        this.saveToStorage();
        this.emit('ACTIVE_PLAYER_CHANGED', { player: this.state.activePlayer });
        this.emit('QUEUE_UPDATED', { queue: this.state.queue });
        this.emit('state_changed', this.state);
        const sync = window.firebaseSync || window.cloudSync;
        if (sync && typeof sync.syncCurrentQueue === 'function') {
          sync.syncCurrentQueue();
        }
      } else {
        this.state.activePlayer = null;
      }
    }
  }

  loadFromStorage() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.queue)) {
          this.state.queue = parsed.queue.filter(p => !this.isDefaultPlaceholder(p));
        }
        if (Array.isArray(parsed.matchHistory)) {
          this.state.matchHistory = parsed.matchHistory;
        }
        if (parsed.mode === 1 || parsed.mode === 2) {
          this.state.mode = parsed.mode;
        }
        if (parsed.activePlayer && !this.isDefaultPlaceholder(parsed.activePlayer)) {
          this.state.activePlayer = parsed.activePlayer;
        } else {
          this.state.activePlayer = null;
        }
      }
    } catch (e) {
      console.warn("Storage load error:", e);
    }
  }

  saveToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        queue: this.state.queue,
        matchHistory: this.state.matchHistory,
        mode: this.state.mode,
        activePlayer: this.state.activePlayer
      }));
    } catch (e) {
      console.warn("Storage write error:", e);
    }
  }

  broadcast(type, payload = {}) {
    this.saveToStorage();
    if (this.channel) {
      this.channel.postMessage({ type, payload, timestamp: Date.now() });
    }
    this.emit(type, payload);
    this.emit('state_changed', this.state);

    if (window.firebaseSync) {
      if (type.startsWith('TRIGGER_')) {
        window.firebaseSync.sendRemoteEvent(type, payload);
      } else if (type === 'FACTORY_RESET_ALL_DATA') {
        window.firebaseSync.wipeAllData();
      } else if (type === 'MATCH_FINISHED' && payload && payload.record) {
        window.firebaseSync.recordMatch(payload.record);
      } else if (type === 'MATCH_RECORD_DELETED' && payload && payload.id) {
        window.firebaseSync.deleteMatchRecord(payload.id);
      } else if (type === 'MATCH_HISTORY_CLEARED') {
        window.firebaseSync.clearMatchHistory();
      } else if (type === 'QUEUE_UPDATED' || type === 'ACTIVE_PLAYER_CHANGED' || type === 'MODE_CHANGED') {
        window.firebaseSync.syncCurrentQueue();
      }
    }
  }

  handleBroadcastMessage(msg) {
    const { type, payload } = msg;

    switch (type) {
      case 'QUEUE_UPDATED':
        if (payload.queue) this.state.queue = payload.queue;
        this.ensureStageReady();
        break;
      case 'MODE_CHANGED':
        this.state.mode = payload.mode;
        break;
      case 'ACTIVE_PLAYER_CHANGED':
        this.state.activePlayer = payload.player;
        break;
      case 'GAME_STATUS_CHANGED':
        this.state.status = payload.status;
        if (payload.match) this.state.currentMatch = payload.match;
        break;
      case 'MATCH_FINISHED':
        if (payload.record) {
          const exists = this.state.matchHistory.some(m => m.id === payload.record.id);
          if (!exists) this.state.matchHistory.unshift(payload.record);
        }
        break;
      case 'MATCH_RECORD_DELETED':
        if (payload.id) {
          this.state.matchHistory = this.state.matchHistory.filter(m => m.id !== payload.id);
        }
        break;
      case 'MATCH_HISTORY_CLEARED':
        this.state.matchHistory = [];
        break;
      case 'FACTORY_RESET_ALL_DATA':
        this.state.matchHistory = [];
        this.state.queue = [];
        this.state.activePlayer = null;
        this.state.totalRegistrationsCount = 0;
        this.emit('FACTORY_RESET_ALL_DATA', {});
        this.emit('QUEUE_UPDATED', { queue: [] });
        this.emit('ACTIVE_PLAYER_CHANGED', { player: null });
        this.emit('MATCH_HISTORY_CLEARED', {});
        this.emit('MATCH_RECORD_DELETED', {});
        this.emit('REGISTRATIONS_UPDATED', { count: 0 });
        break;
      case 'TRIGGER_FINISH':
        this.emit('TRIGGER_FINISH', payload);
        break;
      case 'TRIGGER_START_COUNTDOWN':
        this.emit('TRIGGER_START_COUNTDOWN', payload);
        break;
      case 'TRIGGER_GAME_OVER':
        this.emit('TRIGGER_GAME_OVER', payload);
        break;
      case 'TRIGGER_RESET':
        this.emit('TRIGGER_RESET', payload);
        break;
    }

    this.saveToStorage();
    this.emit(type, payload);
    this.emit('state_changed', this.state);
  }

  // ========================== QUEUE ACTIONS =================================

  addPlayerToQueue(playerData, publishToCloud = true) {
    const player = {
      id: "p_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      name: (playerData.name || "Contestant").trim(),
      studentId: (playerData.studentId || "").trim(),
      department: playerData.department || "EEE",
      registeredAt: new Date().toLocaleTimeString()
    };

    // Prevent duplicate entries
    if (this.state.activePlayer && this.state.activePlayer.studentId === player.studentId) {
      return this.state.activePlayer;
    }
    const existing = this.state.queue.find(p => p.studentId === player.studentId);
    if (existing) {
      return existing;
    }

    // If stage currently has no real contestant, this player goes DIRECTLY to the playground!
    if (this.isDefaultPlaceholder(this.state.activePlayer)) {
      this.state.activePlayer = player;
      this.broadcast('ACTIVE_PLAYER_CHANGED', { player });
    } else {
      // Contestant currently on stage, so add this player to upcoming queue
      this.state.queue.push(player);
      this.broadcast('QUEUE_UPDATED', { queue: this.state.queue });
    }

    // Broadcast across cloud
    if (publishToCloud && window.cloudSync) {
      window.cloudSync.publishRegistration(player);
      window.cloudSync.broadcastCurrentState();
    }

    return player;
  }

  // Promote any player from queue directly onto the playground
  promoteToStage(queueIndex) {
    if (queueIndex >= 0 && queueIndex < this.state.queue.length) {
      const player = this.state.queue.splice(queueIndex, 1)[0];
      
      // If previous contestant wasn't a placeholder, put them back at front of queue
      if (this.state.activePlayer && !this.isDefaultPlaceholder(this.state.activePlayer)) {
        this.state.queue.unshift(this.state.activePlayer);
      }

      this.state.activePlayer = player;
      this.broadcast('ACTIVE_PLAYER_CHANGED', { player });
      this.broadcast('QUEUE_UPDATED', { queue: this.state.queue });
      if (window.cloudSync) window.cloudSync.broadcastCurrentState();
      return player;
    }
    return null;
  }

  advanceToNextPlayer() {
    if (this.state.queue.length > 0) {
      const next = this.state.queue.shift();
      this.state.activePlayer = next;
      this.saveToStorage();
      this.broadcast('ACTIVE_PLAYER_CHANGED', { player: next });
      this.broadcast('QUEUE_UPDATED', { queue: this.state.queue });
      const sync = window.firebaseSync || window.cloudSync;
      if (sync && typeof sync.syncCurrentQueue === 'function') {
        sync.syncCurrentQueue();
      }
      return next;
    } else {
      this.state.activePlayer = null;
      this.saveToStorage();
      this.broadcast('ACTIVE_PLAYER_CHANGED', { player: null });
      this.broadcast('QUEUE_UPDATED', { queue: [] });
      const sync = window.firebaseSync || window.cloudSync;
      if (sync && typeof sync.syncCurrentQueue === 'function') {
        sync.syncCurrentQueue();
      }
      return null;
    }
  }

  removePlayerFromQueue(index) {
    if (index >= 0 && index < this.state.queue.length) {
      const removed = this.state.queue.splice(index, 1)[0];
      this.saveToStorage();
      this.broadcast('QUEUE_UPDATED', { queue: this.state.queue });
      const sync = window.firebaseSync || window.cloudSync;
      if (sync && typeof sync.syncCurrentQueue === 'function') {
        sync.syncCurrentQueue();
      }
      return removed;
    }
    return null;
  }

  reorderQueue(fromIndex, toIndex) {
    if (fromIndex >= 0 && fromIndex < this.state.queue.length &&
        toIndex >= 0 && toIndex < this.state.queue.length) {
      const item = this.state.queue.splice(fromIndex, 1)[0];
      this.state.queue.splice(toIndex, 0, item);
      this.saveToStorage();
      this.broadcast('QUEUE_UPDATED', { queue: this.state.queue });
      const sync = window.firebaseSync || window.cloudSync;
      if (sync && typeof sync.syncCurrentQueue === 'function') {
        sync.syncCurrentQueue();
      }
    }
  }

  clearQueue() {
    this.state.queue = [];
    if (this.state.status !== 'PLAYING') {
      this.state.activePlayer = null;
    }
    this.saveToStorage();
    this.broadcast('QUEUE_UPDATED', { queue: this.state.queue });
    this.broadcast('ACTIVE_PLAYER_CHANGED', { player: this.state.activePlayer });
    const sync = window.firebaseSync || window.cloudSync;
    if (sync && typeof sync.syncCurrentQueue === 'function') {
      sync.syncCurrentQueue();
    }
  }

  setMode(modeNumber) {
    if (modeNumber === 1 || modeNumber === 2) {
      this.state.mode = modeNumber;
      this.broadcast('MODE_CHANGED', { mode: modeNumber });
    }
  }

  recordMatchResult(status, details) {
    const elapsed = details.elapsedMs || 0;
    const touches = details.touches || 0;

    let score = 0;
    if (this.state.mode === 2) {
      score = Math.max(0, 10000 - (touches * 500) - Math.floor(elapsed / 10));
    } else {
      score = (status === 'FINISHED') ? (5000 + Math.floor(elapsed / 100)) : Math.floor(elapsed / 10);
    }

    const record = {
      id: "m_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      playerName: this.state.activePlayer ? this.state.activePlayer.name : "Contestant",
      studentId: this.state.activePlayer ? this.state.activePlayer.studentId : "",
      department: this.state.activePlayer ? this.state.activePlayer.department : "EEE",
      mode: this.state.mode,
      status: status,
      elapsedMs: elapsed,
      touches: touches,
      score: score,
      reason: details.reason || "TOUCH",
      timestamp: new Date().toLocaleTimeString()
    };

    this.state.matchHistory.unshift(record);
    this.broadcast('MATCH_FINISHED', { record });
    return record;
  }

  clearActivePlayer() {
    this.state.activePlayer = null;
    this.saveToStorage();
    this.broadcast('ACTIVE_PLAYER_CHANGED', { player: null });
    const sync = window.firebaseSync || window.cloudSync;
    if (sync && typeof sync.syncCurrentQueue === 'function') {
      sync.syncCurrentQueue();
    }
  }

  wipeAllData() {
    this.state.matchHistory = [];
    this.state.queue = [];
    this.state.activePlayer = null;
    this.state.totalRegistrationsCount = 0;
    this.saveToStorage();
    this.emit('FACTORY_RESET_ALL_DATA', {});
    this.emit('QUEUE_UPDATED', { queue: [] });
    this.emit('ACTIVE_PLAYER_CHANGED', { player: null });
    this.emit('MATCH_HISTORY_CLEARED', {});
    this.emit('MATCH_RECORD_DELETED', {});
    this.emit('REGISTRATIONS_UPDATED', { count: 0 });
    this.emit('state_changed', this.state);
    if (this.channel) {
      this.channel.postMessage({ type: 'FACTORY_RESET_ALL_DATA', payload: {}, timestamp: Date.now() });
    }
    const sync = window.firebaseSync || window.cloudSync;
    if (sync && typeof sync.wipeAllData === 'function') {
      sync.wipeAllData();
    }
  }

  deleteMatchRecord(id) {
    this.state.matchHistory = this.state.matchHistory.filter(m => m.id !== id);
    this.saveToStorage();
    this.broadcast('MATCH_RECORD_DELETED', { id });
    const sync = window.firebaseSync || window.cloudSync;
    if (sync && typeof sync.deleteMatchRecord === 'function') {
      sync.deleteMatchRecord(id);
    }
  }

  clearMatchHistory() {
    this.state.matchHistory = [];
    this.saveToStorage();
    this.broadcast('MATCH_HISTORY_CLEARED', {});
    const sync = window.firebaseSync || window.cloudSync;
    if (sync && typeof sync.clearMatchHistory === 'function') {
      sync.clearMatchHistory();
    }
  }

  getLeaderboard(mode = null) {
    let list = [...this.state.matchHistory];

    if (mode === 1) {
      list = list.filter(m => m.mode === 1);
      return list.sort((a, b) => {
        if (a.status === 'FINISHED' && b.status !== 'FINISHED') return -1;
        if (b.status === 'FINISHED' && a.status !== 'FINISHED') return 1;
        if (a.status === 'FINISHED' && b.status === 'FINISHED') return a.elapsedMs - b.elapsedMs;
        return b.elapsedMs - a.elapsedMs;
      });
    } else if (mode === 2) {
      list = list.filter(m => m.mode === 2);
      return list.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.elapsedMs - b.elapsedMs;
      });
    } else {
      // All modes combined
      return list.sort((a, b) => {
        if (a.status === 'FINISHED' && b.status !== 'FINISHED') return -1;
        if (b.status === 'FINISHED' && a.status !== 'FINISHED') return 1;
        if (b.score !== a.score) return b.score - a.score;
        return a.elapsedMs - b.elapsedMs;
      });
    }
  }

  getTopScorers(count = 10, mode = null) {
    return this.getLeaderboard(mode).slice(0, count);
  }
}

// Global Central State Instance
window.gameState = new GameStateManager();
