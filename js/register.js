/**
 * ============================================================================
 * EEE Fest 2026 - Mobile Player Registration & Live Contestant Hub
 * Technically Supported by IEEE PES DIU SBC
 * 
 * Features:
 * - Real-time Firebase Sync & Master Registrations Registry
 * - Returning Player Live Status Hub (Queue Position, On-Stage Alert, Match Result)
 * - Live Top 10 Leaderboard directly on contestant's mobile phone screen
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const state = window.gameState;
  const sync = window.firebaseSync || window.cloudSync;

  const fbFollowBtn = document.getElementById('fbFollowBtn');
  const fbCheck = document.getElementById('fbCheck');
  const playerNameInput = document.getElementById('playerName');
  const studentIdInput = document.getElementById('studentId');
  const confirmBtn = document.getElementById('confirmBtn');

  const regFormSection = document.getElementById('regFormSection');
  const ticketSection = document.getElementById('ticketSection');
  const ticketHeadline = document.getElementById('ticketHeadline');
  const ticketStatusRing = document.getElementById('ticketStatusRing');
  const ticketNumber = document.getElementById('ticketNumber');
  const ticketSubStatus = document.getElementById('ticketSubStatus');
  const ticketPlayerName = document.getElementById('ticketPlayerName');
  const ticketStudentId = document.getElementById('ticketStudentId');
  const ticketMatchResult = document.getElementById('ticketMatchResult');
  const ticketInstructions = document.getElementById('ticketInstructions');
  const registerAnotherBtn = document.getElementById('registerAnotherBtn');

  // Mobile Leaderboard Elements
  const mobileLeaderboardList = document.getElementById('mobileLeaderboardList');
  const mobFilterAll = document.getElementById('mobFilterAll');
  const mobFilterMode1 = document.getElementById('mobFilterMode1');
  const mobFilterMode2 = document.getElementById('mobFilterMode2');
  let currentMobLeaderboardMode = null; // null = all, 1 = mode 1, 2 = mode 2

  // Auto-check FB checkbox when clicking FB follow link
  if (fbFollowBtn) {
    fbFollowBtn.addEventListener('click', () => {
      setTimeout(() => {
        if (fbCheck) fbCheck.checked = true;
      }, 500);
    });
  }

  // Check if returning player has active registration
  function checkSavedRegistration() {
    const saved = localStorage.getItem('my_active_wire_buzz_ticket');
    if (saved) {
      try {
        const ticket = JSON.parse(saved);
        if (ticket && ticket.studentId) {
          showContestantHub(ticket.name, ticket.studentId);
          return true;
        }
      } catch (e) {}
    }
    return false;
  }

  // Confirm and Submit Registration
  confirmBtn.addEventListener('click', async () => {
    const name = playerNameInput.value.trim();
    const studentId = studentIdInput.value.trim();

    if (!name) {
      alert("Please enter your Full Name.");
      playerNameInput.focus();
      return;
    }

    if (!studentId) {
      alert("Please enter your Student ID Number.");
      studentIdInput.focus();
      return;
    }

    if (fbCheck) fbCheck.checked = true;

    confirmBtn.disabled = true;
    confirmBtn.textContent = "Joining Arena Queue...";

    const playerData = {
      id: "p_" + Date.now(),
      name: name,
      studentId: studentId,
      department: "EEE",
      registeredAt: new Date().toLocaleTimeString()
    };

    // Save ticket locally so re-opening the link immediately displays their live status
    localStorage.setItem('my_active_wire_buzz_ticket', JSON.stringify({
      id: playerData.id,
      name: name,
      studentId: studentId,
      registeredAt: playerData.registeredAt,
      time: Date.now()
    }));

    // Send to Firebase
    if (sync && typeof sync.publishRegistration === 'function') {
      await sync.publishRegistration(playerData);
    } else if (state) {
      state.addPlayerToQueue(playerData, true);
    }

    confirmBtn.disabled = false;
    confirmBtn.textContent = "Confirm & Join Arena Queue";

    showContestantHub(name, studentId);
  });

  // Switch between Form and Live Hub
  function showContestantHub(name, studentId) {
    if (regFormSection) regFormSection.style.display = 'none';
    if (ticketSection) ticketSection.style.display = 'block';

    if (ticketPlayerName) ticketPlayerName.textContent = name;
    if (ticketStudentId) ticketStudentId.textContent = studentId;

    updatePlayerLiveStatus(studentId);
    renderMobileLeaderboard();
  }

  // Update Contestant Status (Queue Position, On Stage, or Finished)
  function updatePlayerLiveStatus(studentId) {
    if (!studentId || !state || !state.state) return;

    const activeP = state.state.activePlayer;
    const queue = state.state.queue || [];
    const history = state.state.matchHistory || [];

    // 1. Is Player Currently On Stage?
    if (activeP && activeP.studentId === studentId && !state.isDefaultPlaceholder(activeP)) {
      if (ticketHeadline) ticketHeadline.textContent = "⚡ YOU ARE ON STAGE!";
      if (ticketStatusRing) {
        ticketStatusRing.textContent = "⚡";
        ticketStatusRing.style.borderColor = "var(--fest-green)";
        ticketStatusRing.style.color = "var(--fest-green)";
      }
      if (ticketNumber) {
        ticketNumber.textContent = "ON STAGE!";
        ticketNumber.style.color = "var(--fest-green)";
      }
      if (ticketSubStatus) {
        ticketSubStatus.textContent = "Grip the wand at the arena! Countdown starting!";
        ticketSubStatus.style.color = "var(--fest-green)";
      }
      if (ticketInstructions) {
        ticketInstructions.innerHTML = "⚡ <strong>STEP UP TO THE WIRE NOW!</strong><br>Keep your eyes on the projector screen as your countdown begins.";
      }
      if (ticketMatchResult) ticketMatchResult.style.display = 'none';

      if (navigator.vibrate) navigator.vibrate([250, 100, 250, 100, 400]);
      return;
    }

    // 2. Is Player Waiting in Queue?
    const qIndex = queue.findIndex(p => p.studentId === studentId);
    if (qIndex >= 0) {
      const pos = qIndex + 1;
      if (ticketHeadline) ticketHeadline.textContent = "YOU ARE IN THE QUEUE!";
      if (ticketStatusRing) {
        ticketStatusRing.textContent = "✓";
        ticketStatusRing.style.borderColor = "var(--fest-gold)";
        ticketStatusRing.style.color = "var(--fest-gold)";
      }
      if (ticketNumber) {
        ticketNumber.textContent = `#${pos}`;
        ticketNumber.style.color = "var(--fest-gold)";
      }
      if (ticketSubStatus) {
        if (pos === 1) {
          ticketSubStatus.textContent = "⚡ You're next on stage! Head to the wire.";
          ticketSubStatus.style.color = "var(--fest-cyan)";
        } else {
          ticketSubStatus.textContent = `${pos - 1} contestant${pos > 2 ? 's' : ''} ahead of you in line`;
          ticketSubStatus.style.color = "var(--text-secondary)";
        }
      }
      if (ticketInstructions) {
        ticketInstructions.innerHTML = "Your registration is confirmed. Please watch the <strong>Wire Buzz projector screen</strong>.<br>Stay near the arena stage when your turn approaches!";
      }
      if (ticketMatchResult) ticketMatchResult.style.display = 'none';
      return;
    }

    // 3. Has Player Completed Their Match?
    const record = history.find(m => m.studentId === studentId);
    if (record) {
      const isWin = (record.status === 'FINISHED');
      if (ticketHeadline) ticketHeadline.textContent = isWin ? "🏆 RUN CONQUERED!" : "⛔ RUN COMPLETED";
      if (ticketStatusRing) {
        ticketStatusRing.textContent = isWin ? "🏆" : "✕";
        ticketStatusRing.style.borderColor = isWin ? "var(--fest-green)" : "#ff1744";
        ticketStatusRing.style.color = isWin ? "var(--fest-green)" : "#ff5252";
      }
      if (ticketNumber) {
        ticketNumber.textContent = isWin ? "CLEARED" : "KNOCKOUT";
        ticketNumber.style.color = isWin ? "var(--fest-green)" : "#ff5252";
      }

      // Compute ranking
      const leaders = state.getLeaderboard(record.mode);
      const myRank = leaders.findIndex(m => m.id === record.id) + 1;

      if (ticketSubStatus) {
        ticketSubStatus.textContent = myRank > 0 
          ? `Official Standing: Rank #${myRank} of ${leaders.length} Contestants`
          : `Official Match Recorded in Hall of Fame`;
        ticketSubStatus.style.color = "var(--fest-gold)";
      }

      if (ticketMatchResult) {
        ticketMatchResult.style.display = 'block';
        ticketMatchResult.innerHTML = `
          <div style="display:flex;justify-content:space-around;padding:10px;background:rgba(255,255,255,0.03);border-radius:8px;margin-top:10px">
            <div><span style="font-size:0.7rem;color:var(--text-muted)">TIME</span><br><strong>${(record.elapsedMs / 1000).toFixed(2)}s</strong></div>
            <div><span style="font-size:0.7rem;color:var(--text-muted)">TOUCHES</span><br><strong>${record.touches || 0}</strong></div>
            <div><span style="font-size:0.7rem;color:var(--text-muted)">SCORE</span><br><strong style="color:var(--fest-gold)">${record.score || 0} pts</strong></div>
          </div>
        `;
      }

      if (ticketInstructions) {
        ticketInstructions.innerHTML = "Thank you for competing at <strong>EEE Fest 2026</strong>!<br>Check the real-time leaderboard below to see where you rank.";
      }
      return;
    }

    // Default Fallback
    if (ticketHeadline) ticketHeadline.textContent = "REGISTRATION RECORDED";
    if (ticketNumber) ticketNumber.textContent = "LIVE";
    if (ticketSubStatus) ticketSubStatus.textContent = "Synced with Wire Buzz Arena";
  }

  // Render Mobile Real-Time Leaderboard
  function renderMobileLeaderboard() {
    if (!mobileLeaderboardList || !state) return;

    const list = state.getTopScorers(10, currentMobLeaderboardMode);
    const saved = localStorage.getItem('my_active_wire_buzz_ticket');
    let myId = "";
    if (saved) {
      try { myId = JSON.parse(saved).studentId; } catch (e) {}
    }

    if (list.length === 0) {
      mobileLeaderboardList.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:0.82rem">Leaderboard empty. Complete runs will appear here live!</div>`;
      return;
    }

    mobileLeaderboardList.innerHTML = list.map((m, idx) => {
      const rank = idx + 1;
      const isMe = (myId && m.studentId === myId);
      const isWin = (m.status === 'FINISHED');
      
      let badgeStyle = "background:rgba(255,255,255,0.08);color:#fff";
      if (rank === 1) badgeStyle = "background:var(--fest-gold);color:#000;box-shadow:0 0 10px rgba(245,166,35,0.6)";
      else if (rank === 2) badgeStyle = "background:#c0c0c0;color:#000";
      else if (rank === 3) badgeStyle = "background:#cd7f32;color:#000";

      return `
        <div class="mob-lb-item ${isMe ? 'is-me-highlight' : ''}">
          <div style="display:flex;align-items:center;gap:10px">
            <span class="top-rank-badge" style="${badgeStyle}">${rank}</span>
            <div>
              <div style="font-weight:800;color:#fff;font-size:0.88rem">
                ${escapeHtml(m.playerName)} ${isMe ? '<span style="font-size:0.65rem;background:var(--fest-gold);color:#000;padding:1px 5px;border-radius:4px;margin-left:4px">YOU</span>' : ''}
              </div>
              <div style="font-size:0.72rem;color:var(--text-muted);font-family:var(--font-mono)">${escapeHtml(m.studentId)} • ${m.mode === 1 ? 'Mode 1' : 'Mode 2'}</div>
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:900;color:var(--fest-gold);font-family:var(--font-mono);font-size:0.92rem">${m.score || 0} pts</div>
            <div style="font-size:0.72rem;color:${isWin ? 'var(--fest-green)' : '#ff5252'}">${(m.elapsedMs / 1000).toFixed(2)}s • ${isWin ? '🏆' : '✕'}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Register Another Player
  if (registerAnotherBtn) {
    registerAnotherBtn.addEventListener('click', () => {
      if (playerNameInput) playerNameInput.value = '';
      if (studentIdInput) studentIdInput.value = '';
      if (ticketSection) ticketSection.style.display = 'none';
      if (regFormSection) regFormSection.style.display = 'block';
    });
  }

  // Filter Chips on Phone
  if (mobFilterAll) {
    mobFilterAll.addEventListener('click', () => {
      currentMobLeaderboardMode = null;
      updateMobFilterTabs(mobFilterAll);
      renderMobileLeaderboard();
    });
  }
  if (mobFilterMode1) {
    mobFilterMode1.addEventListener('click', () => {
      currentMobLeaderboardMode = 1;
      updateMobFilterTabs(mobFilterMode1);
      renderMobileLeaderboard();
    });
  }
  if (mobFilterMode2) {
    mobFilterMode2.addEventListener('click', () => {
      currentMobLeaderboardMode = 2;
      updateMobFilterTabs(mobFilterMode2);
      renderMobileLeaderboard();
    });
  }

  function updateMobFilterTabs(activeChip) {
    [mobFilterAll, mobFilterMode1, mobFilterMode2].forEach(c => {
      if (c) c.classList.remove('active');
    });
    if (activeChip) activeChip.classList.add('active');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Real-time State & Firebase Listeners
  if (state) {
    state.on('state_changed', () => {
      const saved = localStorage.getItem('my_active_wire_buzz_ticket');
      if (saved) {
        try {
          const t = JSON.parse(saved);
          updatePlayerLiveStatus(t.studentId);
        } catch (e) {}
      }
      renderMobileLeaderboard();
    });

    state.on('QUEUE_UPDATED', () => {
      const saved = localStorage.getItem('my_active_wire_buzz_ticket');
      if (saved) {
        try {
          const t = JSON.parse(saved);
          updatePlayerLiveStatus(t.studentId);
        } catch (e) {}
      }
    });

    state.on('ACTIVE_PLAYER_CHANGED', () => {
      const saved = localStorage.getItem('my_active_wire_buzz_ticket');
      if (saved) {
        try {
          const t = JSON.parse(saved);
          updatePlayerLiveStatus(t.studentId);
        } catch (e) {}
      }
    });

    state.on('MATCH_FINISHED', () => {
      const saved = localStorage.getItem('my_active_wire_buzz_ticket');
      if (saved) {
        try {
          const t = JSON.parse(saved);
          updatePlayerLiveStatus(t.studentId);
        } catch (e) {}
      }
      renderMobileLeaderboard();
    });
  }

  // Initial check on page load
  checkSavedRegistration();
});
