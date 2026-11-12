/**
 * ============================================================================
 * EEE Fest 2026 - Wire Buzz Central State & Synchronizer
 * BroadcastChannel (Zero-Latency Multi-Window Sync) + LocalStorage + Cloud Sync
 * ============================================================================
 */

class GameStateManager {
  constructor() {
    this.storageKey = 'eee_fest_wire_buzz_data_v2';
    this.channel = new BroadcastChannel('wire_buzz_channel');
    
    // Default initial state
    this.state = {
      mode: 1, // 1: Sudden Death, 2: Multi-Touch Precision Score
      status: 'IDLE', // IDLE, COUNTDOWN, PLAYING, GAMEOVER, FINISHED, INTERMISSION
      activePlayer: {
        name: "Anik Sarker",
        studentId: "221-15-5432",
        department: "EEE, DIU"
      },
      queue: [
        { id: "q1", name: "Tanvir Ahmed", studentId: "223-15-9871", department: "EEE" },
        { id: "q2", name: "Nusrat Jahan", studentId: "231-15-4120", department: "EEE" },
        { id: "q3", name: "Shahriar Kabir", studentId: "232-15-7741", department: "EEE" },
        { id: "q4", name: "Farhana Islam", studentId: "222-15-3312", department: "EEE" }
      ],
      currentMatch: {
        startTime: 0,
        endTime: 0,
        elapsedMs: 0,
        touches: 0,
        score: 0,
        reason: ""
      },
      matchHistory: [],
      intermissionTimer: 0
    };

    this.listeners = [];
    this.loadFromStorage();

    // Listen for broadcast sync from other tabs (Admin, Presenter, Registration)
    this.channel.onmessage = (event) => {
      if (event.data && event.data.type) {
        this.handleBroadcastMessage(event.data);
      }
    };
  }

  on(event, callback) {
    this.listeners.push({ event, callback });
  }

  emit(event, data) {
    this.listeners
      .filter(l => l.event === event || l.event === '*')
      .forEach(l => l.callback(data, event));
  }

  loadFromStorage() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.queue) this.state.queue = parsed.queue;
        if (parsed.matchHistory) this.state.matchHistory = parsed.matchHistory;
        if (parsed.mode) this.state.mode = parsed.mode;
        if (parsed.activePlayer) this.state.activePlayer = parsed.activePlayer;
      }
    } catch (e) {
      console.warn("Could not load from storage:", e);
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
    this.channel.postMessage({ type, payload, timestamp: Date.now() });
    this.emit(type, payload);
    this.emit('state_changed', this.state);
  }

  handleBroadcastMessage(msg) {
    const { type, payload } = msg;

    switch (type) {
      case 'QUEUE_UPDATED':
        this.state.queue = payload.queue;
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
        this.state.matchHistory.unshift(payload.record);
        break;
      case 'SYNC_STATE':
        this.state = { ...this.state, ...payload.state };
        break;
    }

    this.saveToStorage();
    this.emit(type, payload);
    this.emit('state_changed', this.state);
  }

  // ========================== QUEUE ACTIONS =================================

  addPlayerToQueue(playerData) {
    const player = {
      id: "p_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      name: playerData.name.trim(),
      studentId: playerData.studentId.trim(),
      department: playerData.department || "EEE",
      registeredAt: new Date().toLocaleTimeString()
    };

    // If no active player, set as active
    if (!this.state.activePlayer || !this.state.activePlayer.name) {
      this.state.activePlayer = player;
      this.broadcast('ACTIVE_PLAYER_CHANGED', { player });
    } else {
      this.state.queue.push(player);
      this.broadcast('QUEUE_UPDATED', { queue: this.state.queue });
    }
    return player;
  }

  removePlayerFromQueue(index) {
    if (index >= 0 && index < this.state.queue.length) {
      const removed = this.state.queue.splice(index, 1)[0];
      this.broadcast('QUEUE_UPDATED', { queue: this.state.queue });
      return removed;
    }
    return null;
  }

  reorderQueue(fromIndex, toIndex) {
    if (fromIndex >= 0 && fromIndex < this.state.queue.length &&
        toIndex >= 0 && toIndex < this.state.queue.length) {
      const item = this.state.queue.splice(fromIndex, 1)[0];
      this.state.queue.splice(toIndex, 0, item);
      this.broadcast('QUEUE_UPDATED', { queue: this.state.queue });
    }
  }

  advanceToNextPlayer() {
    if (this.state.queue.length > 0) {
      const next = this.state.queue.shift();
      this.state.activePlayer = next;
      this.broadcast('ACTIVE_PLAYER_CHANGED', { player: next });
      this.broadcast('QUEUE_UPDATED', { queue: this.state.queue });
      return next;
    } else {
      this.state.activePlayer = {
        name: "Waiting for Player",
        studentId: "Scan QR to Join",
        department: "EEE Fest"
      };
      this.broadcast('ACTIVE_PLAYER_CHANGED', { player: this.state.activePlayer });
      return null;
    }
  }

  clearQueue() {
    this.state.queue = [];
    this.broadcast('QUEUE_UPDATED', { queue: this.state.queue });
  }

  // ========================== MODE SWITCHING ================================

  setMode(modeNumber) {
    if (modeNumber === 1 || modeNumber === 2) {
      this.state.mode = modeNumber;
      this.broadcast('MODE_CHANGED', { mode: modeNumber });
    }
  }

  // ========================== MATCH SCORING =================================

  recordMatchResult(status, details) {
    const elapsed = details.elapsedMs || 0;
    const touches = details.touches || 0;

    // Mode 2 formula: 10000 - (touches * 500) - (timeMs / 10)
    let score = 0;
    if (this.state.mode === 2) {
      score = Math.max(0, 10000 - (touches * 500) - Math.floor(elapsed / 10));
    } else {
      // Mode 1: Survival time in points or 5000 bonus if finished
      score = (status === 'FINISHED') ? (5000 + Math.floor(elapsed / 100)) : Math.floor(elapsed / 10);
    }

    const record = {
      id: "m_" + Date.now(),
      playerName: this.state.activePlayer.name,
      studentId: this.state.activePlayer.studentId,
      department: this.state.activePlayer.department,
      mode: this.state.mode,
      status: status, // GAMEOVER or FINISHED
      elapsedMs: elapsed,
      touches: touches,
      score: score,
      reason: details.reason || "TOUCH",
      timestamp: new Date().toLocaleString()
    };

    this.state.matchHistory.unshift(record);
    this.broadcast('MATCH_FINISHED', { record });
    return record;
  }

  // ========================== LEADERBOARDS ==================================

  getLeaderboard(mode = null) {
    const targetMode = mode || this.state.mode;
    let list = this.state.matchHistory.filter(m => m.mode === targetMode);

    if (targetMode === 1) {
      // Mode 1: Sorted by longest survival time
      list.sort((a, b) => b.elapsedMs - a.elapsedMs);
    } else {
      // Mode 2: Sorted by highest score, then least touches, then fastest time
      list.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.touches !== b.touches) return a.touches - b.touches;
        return a.elapsedMs - b.elapsedMs;
      });
    }

    return list.slice(0, 10); // Top 10
  }

  // ========================== DATA EXPORT ===================================

  exportToCsv() {
    if (this.state.matchHistory.length === 0) {
      alert("No match history to export yet.");
      return;
    }

    const headers = ["Match ID", "Player Name", "Student ID", "Department", "Mode", "Status", "Elapsed (s)", "Touches", "Score", "Timestamp"];
    const rows = this.state.matchHistory.map(m => [
      m.id,
      `"${m.playerName}"`,
      `"${m.studentId}"`,
      `"${m.department || ''}"`,
      `Mode ${m.mode}`,
      m.status,
      (m.elapsedMs / 1000).toFixed(2),
      m.touches,
      m.score,
      `"${m.timestamp}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `EEE_Fest_Wire_Buzz_Reports_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportToJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.state.matchHistory, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `EEE_Fest_Wire_Buzz_Data_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Global Singleton
window.gameState = new GameStateManager();
