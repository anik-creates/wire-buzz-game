/**
 * ============================================================================
 * EEE Fest 2026 - Admin Dashboard Controller
 * Technically Supported by IEEE PES DIU SBC
 * 
 * Functions:
 * - Real-time Queue Management (Reorder up/down, delete, manual walk-in, call to stage)
 * - Automatic stage promotion when a player completes their run
 * - All-Time Score Records & Leaderboard Archive
 * - Delete Participant Records from History
 * - Remote Arena Control (Start Countdown, Trigger Game Over, Trigger Victory, Reset)
 * - Spot Game Mode Selector (Mode 1 / Mode 2)
 * - CSV / JSON Export and GitHub Sync Engine
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const state = window.gameState;

  // ========================== ADMIN AUTHENTICATION ==========================
  const ADMIN_PASSWORD = "eeefestadmin";
  const authOverlay = document.getElementById('adminAuthOverlay');
  const authForm = document.getElementById('adminAuthForm');
  const passwordInput = document.getElementById('adminPasswordInput');
  const authError = document.getElementById('adminAuthError');
  const adminLockBtn = document.getElementById('adminLockBtn');

  function checkAdminAuth() {
    const isAuthed = (sessionStorage.getItem('eee_fest_admin_auth') === 'authenticated');
    if (isAuthed) {
      if (authOverlay) authOverlay.style.display = 'none';
    } else {
      if (authOverlay) {
        authOverlay.style.display = 'flex';
        if (passwordInput) {
          passwordInput.value = '';
          passwordInput.focus();
        }
      }
    }
  }

  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const entered = (passwordInput ? passwordInput.value : '').trim();
      if (entered === ADMIN_PASSWORD) {
        sessionStorage.setItem('eee_fest_admin_auth', 'authenticated');
        if (authError) authError.style.display = 'none';
        if (authOverlay) authOverlay.style.display = 'none';
      } else {
        if (authError) authError.style.display = 'block';
        if (passwordInput) {
          passwordInput.value = '';
          passwordInput.focus();
        }
      }
    });
  }

  if (adminLockBtn) {
    adminLockBtn.addEventListener('click', () => {
      sessionStorage.removeItem('eee_fest_admin_auth');
      checkAdminAuth();
    });
  }

  checkAdminAuth();

  // DOM Elements - Mode
  const btnMode1 = document.getElementById('btnMode1');
  const btnMode2 = document.getElementById('btnMode2');
  const activeModeLabel = document.getElementById('activeModeLabel');

  // DOM Elements - Match Control
  const adminActivePlayer = document.getElementById('adminActivePlayer');
  const adminStartBtn = document.getElementById('adminStartBtn');
  const adminStopBtn = document.getElementById('adminStopBtn');
  const adminFinishBtn = document.getElementById('adminFinishBtn');
  const adminResetBtn = document.getElementById('adminResetBtn');
  const adminClearStageBtn = document.getElementById('adminClearStageBtn');
  const adminNextPlayerBtn = document.getElementById('adminNextPlayerBtn');
  const adminToggleTopScorersBtn = document.getElementById('adminToggleTopScorersBtn');
  const wipeAllDataBtn = document.getElementById('wipeAllDataBtn');

  // DOM Elements - Queue
  const adminQueueList = document.getElementById('adminQueueList');
  const adminQueueCount = document.getElementById('adminQueueCount');
  const manualName = document.getElementById('manualName');
  const manualId = document.getElementById('manualId');
  const addManualBtn = document.getElementById('addManualBtn');
  const clearQueueBtn = document.getElementById('clearQueueBtn');

  // DOM Elements - Analytics Summary
  const statTotalRegistered = document.getElementById('statTotalRegistered');
  const statRegisteredSub = document.getElementById('statRegisteredSub');
  const statTotalPlayed = document.getElementById('statTotalPlayed');
  const statTotalVictories = document.getElementById('statTotalVictories');
  const statArenaRecord = document.getElementById('statArenaRecord');
  const statRecordHolder = document.getElementById('statRecordHolder');

  // DOM Elements - Reports
  const reportsTableBody = document.getElementById('reportsTableBody');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const pushGithubBtn = document.getElementById('pushGithubBtn');

  // Filter Chips
  const filterAll = document.getElementById('filterAll');
  const filterMode1 = document.getElementById('filterMode1');
  const filterMode2 = document.getElementById('filterMode2');
  let currentFilterMode = null; // null = all, 1 = mode 1, 2 = mode 2

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
    updateModeUI(1);
  });

  btnMode2.addEventListener('click', () => {
    state.setMode(2);
    updateModeUI(2);
  });

  // ========================== MATCH CONTROLS ================================

  function renderActivePlayer() {
    state.ensureStageReady();
    const p = state.state.activePlayer;
    if (p && p.name && !state.isDefaultPlaceholder(p)) {
      adminActivePlayer.innerHTML = `<span style="color:var(--fest-gold);font-weight:900">⚡ ON STAGE:</span> <strong>${escapeHtml(p.name)}</strong> <span style="font-family:var(--font-mono);font-size:0.85rem;color:var(--fest-cyan)">(${escapeHtml(p.studentId)})</span>`;
    } else {
      adminActivePlayer.innerHTML = `<span style="color:var(--text-muted)">Stage Open (No active contestant)</span>`;
    }
  }

  adminStartBtn.addEventListener('click', () => {
    state.ensureStageReady();
    const p = state.state.activePlayer;
    if (!p || !p.name || state.isDefaultPlaceholder(p)) {
      alert("No active player in the arena! Please add or advance a player from the queue.");
      return;
    }
    // Triggers countdown on presenter display screen
    state.broadcast('TRIGGER_START_COUNTDOWN');
  });

  adminStopBtn.addEventListener('click', () => {
    state.broadcast('TRIGGER_GAME_OVER', { reason: "STOPPED_BY_ADMIN" });
  });

  adminFinishBtn.addEventListener('click', () => {
    state.broadcast('TRIGGER_FINISH');
  });

  adminResetBtn.addEventListener('click', () => {
    state.broadcast('TRIGGER_RESET');
  });

  if (adminClearStageBtn) {
    adminClearStageBtn.addEventListener('click', () => {
      if (confirm("Clear the current contestant from the active stage?")) {
        state.clearActivePlayer();
        renderActivePlayer();
      }
    });
  }

  if (wipeAllDataBtn) {
    wipeAllDataBtn.addEventListener('click', () => {
      const confirmText = prompt('🚨 ARE YOU SURE?\nThis will permanently delete all contestants in the queue, match history records, and stage data across all devices!\n\nType "RESET" to confirm:');
      if (confirmText && confirmText.trim().toUpperCase() === 'RESET') {
        state.wipeAllData();
        renderActivePlayer();
        renderAdminQueue();
        renderReportsTable();
        updateAnalyticsSummary();
        alert('All Arena data has been wiped and reset to zero.');
      }
    });
  }

  adminNextPlayerBtn.addEventListener('click', () => {
    state.advanceToNextPlayer();
    renderActivePlayer();
    renderAdminQueue();
  });

  if (adminToggleTopScorersBtn) {
    adminToggleTopScorersBtn.addEventListener('click', () => {
      state.broadcast('TRIGGER_TOGGLE_TOP_SCORERS');
    });
  }

  // ========================== QUEUE CONTROLLER ==============================

  function renderAdminQueue() {
    state.ensureStageReady();
    const q = state.state.queue;
    adminQueueCount.textContent = `${q.length} in Queue`;

    if (q.length === 0) {
      adminQueueList.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:0.82rem">Queue is currently empty. Scan QR on mobile to join!</div>`;
      return;
    }

    adminQueueList.innerHTML = q.map((p, idx) => `
      <div class="admin-q-item">
        <div style="display:flex;align-items:center;gap:10px">
          <span class="queue-index-bubble" style="width:24px;height:24px;font-size:0.7rem">#${idx + 1}</span>
          <div>
            <div style="font-weight:800;color:#fff;font-size:0.88rem">${escapeHtml(p.name)}</div>
            <div style="font-size:0.72rem;color:var(--text-muted);font-family:var(--font-mono)">${escapeHtml(p.studentId)} • Registered: ${p.registeredAt || 'Live'}</div>
          </div>
        </div>
        <div class="admin-q-actions" style="display:flex;gap:6px">
          <button type="button" class="fest-action-btn gold-btn" onclick="promoteAdminQueueItem(${idx})" title="Call this participant to stage immediately">★ Stage</button>
          ${idx > 0 ? `<button type="button" class="fest-action-btn dark-btn" onclick="moveQueueItem(${idx}, ${idx - 1})" title="Move Up">▲</button>` : ''}
          ${idx < q.length - 1 ? `<button type="button" class="fest-action-btn dark-btn" onclick="moveQueueItem(${idx}, ${idx + 1})" title="Move Down">▼</button>` : ''}
          <button type="button" class="fest-action-btn danger-outline-btn" onclick="deleteQueueItem(${idx})" title="Remove from queue">✕</button>
        </div>
      </div>
    `).join('');
  }

  window.promoteAdminQueueItem = (idx) => {
    state.promoteToStage(idx);
    renderActivePlayer();
    renderAdminQueue();
  };

  window.deleteQueueItem = (idx) => {
    if (confirm("Remove this participant from the queue?")) {
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
      alert("Please provide both contestant name and student ID.");
      return;
    }

    state.addPlayerToQueue({
      name,
      studentId: id,
      department: "EEE"
    });

    manualName.value = '';
    manualId.value = '';
    renderActivePlayer();
    renderAdminQueue();
    updateAnalyticsSummary();
  });

  clearQueueBtn.addEventListener('click', () => {
    if (confirm("Are you sure you want to delete all players from the queue?")) {
      state.clearQueue();
      renderAdminQueue();
      updateAnalyticsSummary();
    }
  });

  // ========================== ALL-TIME HISTORY & SUMMARY ====================

  function updateAnalyticsSummary() {
    const history = state.state.matchHistory || [];
    const queue = state.state.queue || [];
    const activeOnStage = (state.state.activePlayer && !state.isDefaultPlaceholder(state.state.activePlayer)) ? 1 : 0;

    // Total registered = queue + active + completed
    const uniqueIds = new Set();
    if (activeOnStage) uniqueIds.add(state.state.activePlayer.studentId);
    queue.forEach(p => uniqueIds.add(p.studentId));
    history.forEach(m => uniqueIds.add(m.studentId));

    const totalCount = Math.max(uniqueIds.size, state.state.totalRegistrationsCount || 0);

    if (statTotalRegistered) statTotalRegistered.textContent = totalCount;
    if (statRegisteredSub) {
      statRegisteredSub.textContent = `${queue.length} in queue • ${history.length} matches played`;
    }
    if (statTotalPlayed) statTotalPlayed.textContent = history.length;

    const victories = history.filter(m => m.status === 'FINISHED');
    if (statTotalVictories) statTotalVictories.textContent = victories.length;

    if (history.length > 0) {
      // Find all-time top score or best time
      let best = null;
      if (victories.length > 0) {
        best = victories.reduce((prev, curr) => (curr.score > prev.score) ? curr : prev, victories[0]);
        if (statArenaRecord) statArenaRecord.textContent = best.score + " pts";
        if (statRecordHolder) statRecordHolder.textContent = best.playerName + " (" + (best.elapsedMs / 1000).toFixed(2) + "s)";
      } else {
        best = history.reduce((prev, curr) => (curr.elapsedMs > prev.elapsedMs) ? curr : prev, history[0]);
        if (statArenaRecord) statArenaRecord.textContent = (best.elapsedMs / 1000).toFixed(2) + "s";
        if (statRecordHolder) statRecordHolder.textContent = best.playerName + " (Survival)";
      }
    } else {
      if (statArenaRecord) statArenaRecord.textContent = "--";
      if (statRecordHolder) statRecordHolder.textContent = "No matches recorded yet";
    }
  }

  function renderReportsTable() {
    let list = state.state.matchHistory || [];

    if (currentFilterMode) {
      list = list.filter(m => m.mode === currentFilterMode);
    }

    if (!reportsTableBody) return;

    if (list.length === 0) {
      reportsTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted)">No match records recorded yet. Completed matches will appear here.</td></tr>`;
      return;
    }

    reportsTableBody.innerHTML = list.map((m) => {
      const isWin = (m.status === 'FINISHED');
      const outcomeBadge = isWin 
        ? `<span style="background:rgba(0,230,118,0.12);color:var(--fest-green);padding:3px 8px;border-radius:12px;font-weight:800;font-size:0.72rem">🏆 CONQUERED</span>`
        : `<span style="background:rgba(255,23,68,0.12);color:#ff5252;padding:3px 8px;border-radius:12px;font-weight:800;font-size:0.72rem">⛔ KNOCKOUT</span>`;

      return `
        <tr>
          <td><strong>${escapeHtml(m.playerName)}</strong></td>
          <td style="font-family:var(--font-mono);font-size:0.75rem;color:var(--fest-cyan)">${escapeHtml(m.studentId)}</td>
          <td><span style="font-size:0.75rem;font-weight:700">${m.mode === 1 ? 'Mode 1' : 'Mode 2'}</span></td>
          <td>${outcomeBadge}</td>
          <td style="font-family:var(--font-mono)">${(m.elapsedMs / 1000).toFixed(2)}s</td>
          <td>${m.touches || 0}</td>
          <td style="font-weight:800;color:var(--fest-gold);font-family:var(--font-mono)">${m.score || 0}</td>
          <td>
            <button type="button" class="fest-action-btn danger-outline-btn" style="padding:3px 8px;font-size:0.72rem" onclick="deleteHistoryRecord('${m.id}')" title="Delete participant record">
              🗑 Delete
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  window.deleteHistoryRecord = (id) => {
    if (confirm("Delete this participant's match record from all-time history?")) {
      state.deleteMatchRecord(id);
      renderReportsTable();
      updateAnalyticsSummary();
    }
  };

  clearHistoryBtn.addEventListener('click', () => {
    if (confirm("Are you sure you want to delete ALL match history records? This cannot be undone.")) {
      state.clearMatchHistory();
      renderReportsTable();
      updateAnalyticsSummary();
    }
  });

  // Filter Chips
  if (filterAll) {
    filterAll.addEventListener('click', () => {
      currentFilterMode = null;
      updateFilterButtons(filterAll);
      renderReportsTable();
    });
  }
  if (filterMode1) {
    filterMode1.addEventListener('click', () => {
      currentFilterMode = 1;
      updateFilterButtons(filterMode1);
      renderReportsTable();
    });
  }
  if (filterMode2) {
    filterMode2.addEventListener('click', () => {
      currentFilterMode = 2;
      updateFilterButtons(filterMode2);
      renderReportsTable();
    });
  }

  function updateFilterButtons(activeBtn) {
    [filterAll, filterMode1, filterMode2].forEach(btn => {
      if (btn) btn.classList.remove('active');
    });
    if (activeBtn) activeBtn.classList.add('active');
  }

  // ========================== EXPORT ACTIONS ================================

  exportCsvBtn.addEventListener('click', () => {
    const list = state.state.matchHistory || [];
    if (list.length === 0) {
      alert("No match records to export.");
      return;
    }
    const headers = ["Contestant", "Student ID", "Department", "Mode", "Status", "Time (seconds)", "Touches", "Score", "Reason", "Timestamp"];
    const rows = list.map(m => [
      `"${m.playerName}"`,
      `"${m.studentId}"`,
      `"${m.department || 'EEE'}"`,
      m.mode,
      m.status,
      (m.elapsedMs / 1000).toFixed(2),
      m.touches || 0,
      m.score || 0,
      `"${m.reason || ''}"`,
      `"${m.timestamp || ''}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `EEE_Fest_2026_Wire_Buzz_Records_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  exportJsonBtn.addEventListener('click', () => {
    const list = state.state.matchHistory || [];
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(list, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `EEE_Fest_2026_Wire_Buzz_Records_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  pushGithubBtn.addEventListener('click', () => {
    alert("Live records are cached in your local state and will be synced upon next git commit. You can also export CSV/JSON instantly.");
  });

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // State listeners
  state.on('state_changed', () => {
    renderActivePlayer();
    renderAdminQueue();
    renderReportsTable();
    updateAnalyticsSummary();
  });

  state.on('MODE_CHANGED', (p) => updateModeUI(p.mode));
  state.on('QUEUE_UPDATED', () => {
    renderAdminQueue();
    updateAnalyticsSummary();
  });
  state.on('ACTIVE_PLAYER_CHANGED', () => {
    renderActivePlayer();
    updateAnalyticsSummary();
  });
  state.on('MATCH_FINISHED', () => {
    renderReportsTable();
    updateAnalyticsSummary();
  });
  state.on('REGISTRATIONS_UPDATED', () => {
    updateAnalyticsSummary();
  });

  // Initial renders
  updateModeUI(state.state.mode);
  renderActivePlayer();
  renderAdminQueue();
  renderReportsTable();
  updateAnalyticsSummary();
});
