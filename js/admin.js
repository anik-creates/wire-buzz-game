/**
 * ============================================================================
 * EEE Fest 2026 - Admin Dashboard Controller
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const state = window.gameState;
  const sound = window.soundEngine;
  const serial = window.serialController;

  // DOM Elements - Mode
  const btnMode1 = document.getElementById('btnMode1');
  const btnMode2 = document.getElementById('btnMode2');
  const activeModeLabel = document.getElementById('activeModeLabel');

  // DOM Elements - Match
  const adminActivePlayer = document.getElementById('adminActivePlayer');
  const adminStartBtn = document.getElementById('adminStartBtn');
  const adminStopBtn = document.getElementById('adminStopBtn');
  const adminFinishBtn = document.getElementById('adminFinishBtn');
  const adminResetBtn = document.getElementById('adminResetBtn');
  const adminNextPlayerBtn = document.getElementById('adminNextPlayerBtn');

  // DOM Elements - Queue
  const adminQueueList = document.getElementById('adminQueueList');
  const adminQueueCount = document.getElementById('adminQueueCount');
  const manualName = document.getElementById('manualName');
  const manualId = document.getElementById('manualId');
  const addManualBtn = document.getElementById('addManualBtn');
  const clearQueueBtn = document.getElementById('clearQueueBtn');

  // DOM Elements - Serial
  const adminComBtn = document.getElementById('adminComBtn');
  const adminComDot = document.getElementById('adminComDot');
  const adminComText = document.getElementById('adminComText');
  const serialConsole = document.getElementById('serialConsole');
  const serialCmdInput = document.getElementById('serialCmdInput');
  const sendSerialBtn = document.getElementById('sendSerialBtn');
  const testBuzzerBtn = document.getElementById('testBuzzerBtn');

  // DOM Elements - Sound
  const sndTouchBtn = document.getElementById('sndTouchBtn');
  const sndFailBtn = document.getElementById('sndFailBtn');
  const sndClapsBtn = document.getElementById('sndClapsBtn');
  const sndCountBtn = document.getElementById('sndCountBtn');
  const sndTtsBtn = document.getElementById('sndTtsBtn');

  // DOM Elements - Reports
  const reportsTableBody = document.getElementById('reportsTableBody');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const pushGithubBtn = document.getElementById('pushGithubBtn');

  // ========================== MODE SWITCHING ================================

  function updateModeUI(mode) {
    if (mode === 1) {
      btnMode1.className = "admin-mode-select-box active-mode-1";
      btnMode2.className = "admin-mode-select-box";
      activeModeLabel.textContent = "Mode 1: Sudden Death Active";
      activeModeLabel.style.color = "#ff1744";
    } else {
      btnMode1.className = "admin-mode-select-box";
      btnMode2.className = "admin-mode-select-box active-mode-2";
      activeModeLabel.textContent = "Mode 2: Touch Master Active";
      activeModeLabel.style.color = "var(--fest-gold)";
    }
  }

  btnMode1.addEventListener('click', () => {
    state.setMode(1);
    serial.setHardwareMode(1);
    updateModeUI(1);
  });

  btnMode2.addEventListener('click', () => {
    state.setMode(2);
    serial.setHardwareMode(2);
    updateModeUI(2);
  });

  // ========================== MATCH CONTROLS ================================

  function renderActivePlayer() {
    const p = state.state.activePlayer;
    if (p && p.name) {
      adminActivePlayer.innerHTML = `<strong>${escapeHtml(p.name)}</strong> (${escapeHtml(p.studentId)})`;
    } else {
      adminActivePlayer.textContent = "No player selected";
    }
  }

  adminStartBtn.addEventListener('click', () => {
    const p = state.state.activePlayer;
    if (!p || !p.name) {
      alert("No active player in the arena! Please add or advance a player from the queue.");
      return;
    }
    // Simulate spacebar trigger on presenter screen via broadcast
    state.broadcast('TRIGGER_START_COUNTDOWN');
    serial.startHardwareGame(state.state.mode, p.name, p.studentId);
  });

  adminStopBtn.addEventListener('click', () => {
    state.broadcast('TRIGGER_GAME_OVER', { reason: "STOPPED_BY_ADMIN" });
    serial.stopHardwareGame();
  });

  adminFinishBtn.addEventListener('click', () => {
    state.broadcast('TRIGGER_FINISH');
    serial.sendCommand('FINISH');
  });

  adminResetBtn.addEventListener('click', () => {
    state.broadcast('TRIGGER_RESET');
    serial.resetHardwareGame();
  });

  adminNextPlayerBtn.addEventListener('click', () => {
    const next = state.advanceToNextPlayer();
    if (next) {
      sound.announceNextPlayer(next.name, next.studentId);
    }
    renderActivePlayer();
  });

  // ========================== QUEUE CONTROLLER ==============================

  function renderAdminQueue() {
    const q = state.state.queue;
    adminQueueCount.textContent = `${q.length} Players`;

    if (q.length === 0) {
      adminQueueList.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-dim);font-size:0.85rem">Queue is currently empty.</div>`;
      return;
    }

    adminQueueList.innerHTML = q.map((p, idx) => `
      <div class="admin-q-item">
        <div>
          <span style="font-weight:700;color:#fff">#${idx + 1} ${escapeHtml(p.name)}</span>
          <span style="font-size:0.75rem;color:var(--text-muted);margin-left:8px">(${escapeHtml(p.studentId)})</span>
        </div>
        <div class="admin-q-actions">
          ${idx > 0 ? `<button type="button" class="btn btn-dark btn-icon" onclick="moveQueueItem(${idx}, ${idx - 1})" title="Move Up">▲</button>` : ''}
          ${idx < q.length - 1 ? `<button type="button" class="btn btn-dark btn-icon" onclick="moveQueueItem(${idx}, ${idx + 1})" title="Move Down">▼</button>` : ''}
          <button type="button" class="btn btn-danger btn-icon" onclick="deleteQueueItem(${idx})" title="Delete Player">✕</button>
        </div>
      </div>
    `).join('');
  }

  window.deleteQueueItem = (idx) => {
    if (confirm("Remove this player from the queue?")) {
      state.removePlayerFromQueue(idx);
      renderAdminQueue();
    }
  };

  window.moveQueueItem = (from, to) => {
    state.reorderQueue(from, to);
    renderAdminQueue();
  };

  addManualBtn.addEventListener('click', () => {
    const name = manualName.value.trim();
    const id = manualId.value.trim();
    if (!name || !id) {
      alert("Please provide both player name and student ID.");
      return;
    }

    state.addPlayerToQueue({
      name,
      studentId: id,
      department: "EEE"
    });

    manualName.value = '';
    manualId.value = '';
    renderAdminQueue();
  });

  clearQueueBtn.addEventListener('click', () => {
    if (confirm("Are you sure you want to delete all players from the queue?")) {
      state.clearQueue();
      renderAdminQueue();
    }
  });

  // ========================== SERIAL HARDWARE MONITOR =======================

  function logToConsole(text, type = "info") {
    const time = new Date().toLocaleTimeString();
    const line = `[${time}] ${text}\n`;
    serialConsole.textContent += line;
    serialConsole.scrollTop = serialConsole.scrollHeight;
  }

  adminComBtn.addEventListener('click', async () => {
    if (!serial.isConnected) {
      logToConsole("Requesting Web Serial port for ESP32-S3...");
      const ok = await serial.connect();
      if (ok) {
        logToConsole("Connected to ESP32 on COM port at 115200 baud!", "success");
      }
    } else {
      await serial.disconnect();
      logToConsole("Disconnected from COM port.");
    }
  });

  serial.on('connection_changed', (data) => {
    if (data.connected) {
      adminComDot.className = "dot-indicator connected";
      adminComText.textContent = "ESP32 Connected (COM)";
    } else {
      adminComDot.className = "dot-indicator";
      adminComText.textContent = "Connect ESP32 (COM16)";
    }
  });

  serial.on('raw_line', (line) => {
    logToConsole("<< " + line);
  });

  sendSerialBtn.addEventListener('click', () => {
    const cmd = serialCmdInput.value.trim();
    if (!cmd) return;
    logToConsole(">> " + cmd);
    serial.sendCommand(cmd);
    serialCmdInput.value = '';
  });

  serialCmdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendSerialBtn.click();
    }
  });

  testBuzzerBtn.addEventListener('click', () => {
    logToConsole("Testing physical buzzer on ESP32 (BUZZ 300)...");
    serial.testHardwareBuzzer(300);
  });

  // ========================== SOUNDBOARD TESTER =============================

  sndTouchBtn.addEventListener('click', () => sound.playTouchBuzz());
  sndFailBtn.addEventListener('click', () => sound.playGameOverFail());
  sndClapsBtn.addEventListener('click', () => sound.playCelebrationClaps(3.0));
  sndCountBtn.addEventListener('click', () => {
    sound.playCountdown(3);
    setTimeout(() => sound.playCountdown(2), 600);
    setTimeout(() => sound.playCountdown(1), 1200);
    setTimeout(() => sound.playCountdown('GO'), 1800);
  });
  sndTtsBtn.addEventListener('click', () => {
    sound.speak("Welcome to the Wire Buzz Challenge at EEE Fest 2026, organized by IEEE PES DIU SBC!", true);
  });

  // ========================== REPORTS & GITHUB ==============================

  function renderReports() {
    const history = state.state.matchHistory;
    if (history.length === 0) {
      reportsTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-dim)">No game matches recorded yet.</td></tr>`;
      return;
    }

    reportsTableBody.innerHTML = history.map(m => `
      <tr>
        <td><strong>${escapeHtml(m.playerName)}</strong></td>
        <td style="font-family:monospace">${escapeHtml(m.studentId)}</td>
        <td>Mode ${m.mode}</td>
        <td>
          <span style="color:${m.status === 'FINISHED' ? 'var(--fest-green)' : 'var(--fest-red)'};font-weight:700">
            ${m.status}
          </span>
        </td>
        <td style="font-family:monospace">${(m.elapsedMs / 1000).toFixed(2)}s</td>
        <td>${m.touches}</td>
        <td style="color:var(--fest-cyan);font-weight:700">${m.score.toLocaleString()}</td>
      </tr>
    `).join('');
  }

  exportCsvBtn.addEventListener('click', () => state.exportToCsv());
  exportJsonBtn.addEventListener('click', () => state.exportToJson());

  pushGithubBtn.addEventListener('click', () => {
    const history = state.state.matchHistory;
    const jsonStr = JSON.stringify(history, null, 2);
    
    // Create download/sync payload
    state.exportToJson();
    alert("Match results exported! You can commit this JSON file to your GitHub repository to update the public leaderboard on GitHub Pages!");
  });

  // Listeners for State
  state.on('state_changed', () => {
    renderActivePlayer();
    renderAdminQueue();
    renderReports();
  });

  state.on('MATCH_FINISHED', () => {
    renderReports();
  });

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Initial UI Render
  updateModeUI(state.state.mode);
  renderActivePlayer();
  renderAdminQueue();
  renderReports();
});
