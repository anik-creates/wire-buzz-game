/**
 * ============================================================================
 * EEE Fest 2026 - Presenting Display Controller (Projector Screen)
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const state = window.gameState;
  const sound = window.soundEngine;
  const serial = window.serialController;

  // DOM Elements
  const timerDisplay = document.getElementById('timerDigits');
  const timerMillis = document.getElementById('timerMillis');
  const activePlayerName = document.getElementById('activePlayerName');
  const activePlayerId = document.getElementById('activePlayerId');
  const activePlayerStatus = document.getElementById('activePlayerStatus');
  
  const modeBadge = document.getElementById('modeBadge');
  const modeHeadline = document.getElementById('arenaModeHeadline');
  const touchStatBox = document.getElementById('touchStatBox');
  const touchCounter = document.getElementById('touchCounter');
  const queueList = document.getElementById('queueList');
  const queueCount = document.getElementById('queueCount');
  
  const countdownOverlay = document.getElementById('countdownOverlay');
  const countdownNumber = document.getElementById('countdownNumber');
  const countdownPlayerCallout = document.getElementById('countdownPlayerCallout');
  const gameoverOverlay = document.getElementById('gameoverOverlay');
  const victoryOverlay = document.getElementById('victoryOverlay');
  const leaderboardOverlay = document.getElementById('leaderboardOverlay');

  // Top 10 Hall of Fame Modal Elements
  const topScorersNavBtn = document.getElementById('topScorersNavBtn');
  const topScorersModal = document.getElementById('topScorersModal');
  const closeTopScorersBtn = document.getElementById('closeTopScorersBtn');
  const tabTopAll = document.getElementById('tabTopAll');
  const tabTopMode1 = document.getElementById('tabTopMode1');
  const tabTopMode2 = document.getElementById('tabTopMode2');
  const topScorersTableBody = document.getElementById('topScorersTableBody');
  let topScorersCurrentMode = null; // null = all, 1 = mode 1, 2 = mode 2

  // Left Sidebar Leaderboard Elements
  const leftLeaderboardList = document.getElementById('leftLeaderboardList');
  const leftTabAll = document.getElementById('leftTabAll');
  const leftTabMode1 = document.getElementById('leftTabMode1');
  const leftTabMode2 = document.getElementById('leftTabMode2');
  let leftLeaderboardMode = null; // null = all, 1 = mode 1, 2 = mode 2

  const comStatusPill = document.getElementById('comStatusPill');
  const comStatusText = document.getElementById('comStatusText');
  const comStatusDot = document.getElementById('comStatusDot');
  const clockEl = document.getElementById('liveClock');

  // Confetti Canvas
  const confettiCanvas = document.getElementById('confettiCanvas');
  let confettiCtx = confettiCanvas ? confettiCanvas.getContext('2d') : null;
  let confettiParticles = [];
  let confettiAnimationId = null;

  // Stopwatch Controller
  let stopwatchRunning = false;
  let startTime = 0;
  let elapsedMs = 0;
  let animationFrameId = null;

  // Real-time Clock
  setInterval(() => {
    const now = new Date();
    if (clockEl) {
      clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }, 1000);

  function resizeConfetti() {
    if (confettiCanvas) {
      confettiCanvas.width = window.innerWidth;
      confettiCanvas.height = window.innerHeight;
    }
  }
  window.addEventListener('resize', resizeConfetti);
  resizeConfetti();

  // ========================== RENDERING =====================================

  function renderActivePlayer() {
    state.ensureStageReady();
    const p = state.state.activePlayer;
    const isPlaceholder = state.isDefaultPlaceholder(p);

    const activePlayerAvatar = document.getElementById('activePlayerAvatar');

    if (activePlayerAvatar) {
      activePlayerAvatar.textContent = (!isPlaceholder && p && p.name) ? p.name.charAt(0).toUpperCase() : "?";
    }

    if (activePlayerName) {
      activePlayerName.textContent = (!isPlaceholder && p && p.name) ? p.name : "WAITING FOR PLAYER";
    }

    if (activePlayerId) {
      activePlayerId.textContent = (!isPlaceholder && p && p.studentId) ? p.studentId : "SCAN QR TO ENTER";
    }

    if (activePlayerStatus) {
      if (state.state.status === 'PLAYING') {
        activePlayerStatus.textContent = "⚡ IN ARENA";
        activePlayerStatus.style.color = "var(--fest-cyan)";
      } else if (!isPlaceholder) {
        activePlayerStatus.textContent = "⚡ ON STAGE (READY)";
        activePlayerStatus.style.color = "var(--fest-green)";
      } else {
        activePlayerStatus.textContent = "⚡ STAGE OPEN";
        activePlayerStatus.style.color = "var(--fest-gold)";
      }
    }
  }

  function renderMode() {
    const isMode1 = state.state.mode === 1;
    if (isMode1) {
      if (modeBadge) {
        modeBadge.className = "fest-mode-pill mode-sudden-death";
        modeBadge.innerHTML = `<span class="pulse-dot red-pulse"></span> Mode 1: Sudden Death`;
      }
      if (modeHeadline) modeHeadline.textContent = "⚡ MODE 1: ONE TOUCH = INSTANT KNOCKOUT";
      if (touchStatBox) touchStatBox.style.display = 'none';
    } else {
      if (modeBadge) {
        modeBadge.className = "fest-mode-pill mode-multi-touch";
        modeBadge.innerHTML = `<span class="pulse-dot connected" style="background:var(--fest-gold)"></span> Mode 2: Touch Master`;
      }
      if (modeHeadline) modeHeadline.textContent = "🎯 MODE 2: MULTI-TOUCH & PRECISION SCORING";
      if (touchStatBox) touchStatBox.style.display = 'flex';
    }
  }

  function renderQueue() {
    state.ensureStageReady();
    const q = state.state.queue;
    if (queueCount) queueCount.textContent = `${q.length} IN QUEUE`;

    if (!queueList) return;

    if (q.length === 0) {
      queueList.innerHTML = `<div class="empty-queue-msg">Queue empty. Scan QR to take the stage!</div>`;
      return;
    }

    queueList.innerHTML = q.map((p, idx) => `
      <div class="queue-item" onclick="window.promoteQueueIndex(${idx})" title="Click to call ${escapeHtml(p.name)} directly to the playground stage" style="cursor:pointer">
        <div class="queue-item-left">
          <div class="queue-index-bubble">#${idx + 1}</div>
          <div class="queue-player-details">
            <div class="q-name">${escapeHtml(p.name)}</div>
            <div class="q-id">${escapeHtml(p.studentId)}</div>
          </div>
        </div>
        <div style="font-size:0.7rem;color:var(--fest-gold);font-weight:800;letter-spacing:0.05em">★ CALL UP</div>
      </div>
    `).join('');
  }

  window.promoteQueueIndex = (idx) => {
    const promoted = state.promoteToStage(idx);
    if (promoted) {
      sound.announceNextPlayer(promoted.name, promoted.studentId);
      showToast("⚡ Called " + promoted.name + " to the stage!");
      renderActivePlayer();
      renderQueue();
    }
  };

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ========================== LEFT SIDEBAR TOP 10 ==========================

  function renderLeftLeaderboard() {
    if (!leftLeaderboardList || !state) return;
    const list = state.getTopScorers(10, leftLeaderboardMode);

    if (list.length === 0) {
      leftLeaderboardList.innerHTML = `<div class="empty-queue-msg">No runs recorded yet.<br>Top 10 champions will appear here live!</div>`;
      return;
    }

    leftLeaderboardList.innerHTML = list.map((m, idx) => {
      const rank = idx + 1;
      let badgeClass = "rank-other";
      if (rank === 1) badgeClass = "rank-1";
      else if (rank === 2) badgeClass = "rank-2";
      else if (rank === 3) badgeClass = "rank-3";

      const isWin = (m.status === 'FINISHED');
      const timeStr = `${(m.elapsedMs / 1000).toFixed(2)}s`;
      const scoreDisplay = (m.mode === 1) ? timeStr : `${m.score || 0} pts`;

      return `
        <div class="left-lb-item ${rank <= 3 ? 'top-three' : ''}">
          <div class="left-lb-left">
            <span class="top-rank-badge ${badgeClass}">${rank}</span>
            <div class="left-lb-meta">
              <div class="left-lb-name">${escapeHtml(m.playerName)}</div>
              <div class="left-lb-id">${escapeHtml(m.studentId)} • M${m.mode}</div>
            </div>
          </div>
          <div class="left-lb-right">
            <div class="left-lb-score">${scoreDisplay}</div>
            <div class="left-lb-outcome ${isWin ? 'outcome-win' : 'outcome-ko'}">
              ${isWin ? '🏆 WIN' : '⛔ KO'}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  if (leftTabAll) {
    leftTabAll.addEventListener('click', () => {
      leftLeaderboardMode = null;
      updateLeftTabs(leftTabAll);
      renderLeftLeaderboard();
    });
  }
  if (leftTabMode1) {
    leftTabMode1.addEventListener('click', () => {
      leftLeaderboardMode = 1;
      updateLeftTabs(leftTabMode1);
      renderLeftLeaderboard();
    });
  }
  if (leftTabMode2) {
    leftTabMode2.addEventListener('click', () => {
      leftLeaderboardMode = 2;
      updateLeftTabs(leftTabMode2);
      renderLeftLeaderboard();
    });
  }

  function updateLeftTabs(activeBtn) {
    [leftTabAll, leftTabMode1, leftTabMode2].forEach(btn => {
      if (btn) btn.classList.remove('active');
    });
    if (activeBtn) activeBtn.classList.add('active');
  }

  // ========================== STOPWATCH CONTROLLER ==========================

  function updateStopwatch() {
    if (!stopwatchRunning) return;
    elapsedMs = Date.now() - startTime;
    formatTime(elapsedMs);
    animationFrameId = requestAnimationFrame(updateStopwatch);
  }

  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor(ms % 1000);

    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');
    const mmm = String(milliseconds).padStart(3, '0');

    if (timerDisplay) timerDisplay.textContent = `${mm}:${ss}.`;
    if (timerMillis) timerMillis.textContent = mmm;
  }

  function resetStopwatch() {
    stopwatchRunning = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    elapsedMs = 0;
    formatTime(0);
  }

  // ========================== GAME STATE MACHINE ============================

  function startCountdownSequence() {
    if (state.state.status === 'PLAYING' || state.state.status === 'COUNTDOWN') return;

    // Ensure stage has an active player
    state.ensureStageReady();

    if (state.isDefaultPlaceholder(state.state.activePlayer)) {
      if (state.state.queue.length > 0) {
        state.state.activePlayer = state.state.queue.shift();
        state.broadcast('ACTIVE_PLAYER_CHANGED', { player: state.state.activePlayer });
        state.broadcast('QUEUE_UPDATED', { queue: state.state.queue });
        renderActivePlayer();
        renderQueue();
      } else {
        showToast("⚠ No contestant in queue! Please scan QR code to enter.");
        return;
      }
    }

    hideAllOverlays();
    state.state.status = 'COUNTDOWN';
    state.state.currentMatch.touches = 0;
    if (touchCounter) touchCounter.textContent = "0";

    const p = state.state.activePlayer;
    if (countdownPlayerCallout) {
      countdownPlayerCallout.textContent = (p && p.name) ? `${p.name} (${p.studentId || 'Challenger'})` : "READY PLAYER";
    }
    sound.announceGameStart(p.name, state.state.mode);

    countdownOverlay.style.display = 'flex';
    let count = 3;
    countdownNumber.textContent = count;
    sound.playCountdown(count);

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        countdownNumber.textContent = count;
        sound.playCountdown(count);
      } else if (count === 0) {
        countdownNumber.textContent = "GO!";
        sound.playCountdown('GO');
      } else {
        clearInterval(interval);
        countdownOverlay.style.display = 'none';
        launchGame();
      }
    }, 1000);
  }

  function launchGame() {
    state.state.status = 'PLAYING';
    state.state.currentMatch.touches = 0;
    state.state.currentMatch.elapsedMs = 0;
    state.broadcast('GAME_STATUS_CHANGED', { status: 'PLAYING' });

    startTime = Date.now();
    stopwatchRunning = true;
    updateStopwatch();

    renderActivePlayer();

    // Signal ESP32
    const p = state.state.activePlayer;
    serial.startHardwareGame(state.state.mode, p.name, p.studentId);
  }

  function handleTouchDetected(touchCount) {
    if (state.state.status !== 'PLAYING') return;

    state.state.currentMatch.touches = touchCount;
    if (touchCounter) touchCounter.textContent = touchCount;

    if (touchStatBox) {
      touchStatBox.classList.add('pulse-touch');
      setTimeout(() => touchStatBox.classList.remove('pulse-touch'), 300);
    }

    if (state.state.mode === 1) {
      triggerGameOver("TOUCH");
    } else {
      sound.playTouchBuzz(180);
    }
  }

  function triggerGameOver(reason = "TOUCH") {
    if (state.state.status !== 'PLAYING') return;

    stopwatchRunning = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    state.state.status = 'GAMEOVER';

    const p = state.state.activePlayer || { name: "Contestant", studentId: "231" };
    const finalElapsed = elapsedMs;
    const finalTouches = state.state.currentMatch.touches;

    const record = state.recordMatchResult('GAMEOVER', {
      elapsedMs: finalElapsed,
      touches: finalTouches,
      reason: reason
    });

    serial.stopHardwareGame();

    sound.playGameOverFail();
    sound.announceGameOver(p.name, (finalElapsed / 1000).toFixed(1), state.state.mode);

    document.getElementById('goPlayerName').textContent = p.name;
    document.getElementById('goTime').textContent = `${(finalElapsed / 1000).toFixed(2)}s`;
    document.getElementById('goTouches').textContent = finalTouches;
    document.getElementById('goReason').textContent = (reason === 'TOUCH') ? "Touched the Wire Track!" : reason;

    gameoverOverlay.style.display = 'flex';

    setTimeout(() => {
      gameoverOverlay.style.display = 'none';
      showIntermissionLeaderboard();
    }, 4500);
  }

  // Finish Line Trigger (From Hardware or Web Simulation)
  function triggerVictory(fromHardware = false) {
    if (state.state.status === 'FINISHED' || state.state.status === 'GAMEOVER') return;
    const isPlaying = (state.state.status === 'PLAYING');
    
    stopwatchRunning = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    state.state.status = 'FINISHED';

    const p = state.state.activePlayer || { name: "Champion", studentId: "Contestant" };
    const finalElapsed = isPlaying ? elapsedMs : 12450;
    const finalTouches = isPlaying ? state.state.currentMatch.touches : 0;

    const record = state.recordMatchResult('FINISHED', {
      elapsedMs: finalElapsed,
      touches: finalTouches
    });

    if (!fromHardware) {
      serial.sendCommand('FINISH');
    }

    sound.playCelebrationClaps(5.0);
    sound.announceVictory(p.name, record.score, finalTouches, (finalElapsed / 1000).toFixed(1));
    startConfetti();

    document.getElementById('vicPlayerName').textContent = p.name;
    document.getElementById('vicScore').textContent = record.score.toLocaleString();
    document.getElementById('vicTime').textContent = `${(finalElapsed / 1000).toFixed(2)}s`;
    document.getElementById('vicTouches').textContent = finalTouches;

    victoryOverlay.style.display = 'flex';

    setTimeout(() => {
      stopConfetti();
      victoryOverlay.style.display = 'none';
      showIntermissionLeaderboard();
    }, 5500);
  }

  function showIntermissionLeaderboard() {
    hideAllOverlays();
    state.state.status = 'INTERMISSION';

    const leaders = state.getLeaderboard(state.state.mode);
    renderLeaderboardOverlay(leaders);
    leaderboardOverlay.style.display = 'flex';

    let remaining = 6;
    const countdownBar = document.getElementById('intermissionCountdown');
    if (countdownBar) countdownBar.textContent = `Next player takes the stage in ${remaining}s...`;

    const countdownTimer = setInterval(() => {
      remaining--;
      if (remaining > 0) {
        if (countdownBar) countdownBar.textContent = `Next player takes the stage in ${remaining}s...`;
      } else {
        clearInterval(countdownTimer);
        leaderboardOverlay.style.display = 'none';
        
        const nextPlayer = state.advanceToNextPlayer();
        resetStage();
        if (nextPlayer) {
          sound.announceNextPlayer(nextPlayer.name, nextPlayer.studentId);
        }
      }
    }, 1000);
  }

  function renderLeaderboardOverlay(leaders) {
    const podiumSlots = [
      document.getElementById('podiumRank1'),
      document.getElementById('podiumRank2'),
      document.getElementById('podiumRank3')
    ];

    podiumSlots.forEach((slot, i) => {
      if (!slot) return;
      const l = leaders[i];
      const nameEl = slot.querySelector('.podium-contestant-name') || slot.querySelector('.podium-name');
      const scoreEl = slot.querySelector('.podium-contestant-score') || slot.querySelector('.podium-score');
      if (l) {
        slot.style.opacity = '1';
        if (nameEl) nameEl.textContent = l.playerName;
        if (scoreEl) scoreEl.textContent = (state.state.mode === 1) ? `${(l.elapsedMs / 1000).toFixed(2)}s` : `${l.score} pts`;
      } else {
        slot.style.opacity = '0.35';
        if (nameEl) nameEl.textContent = "---";
        if (scoreEl) scoreEl.textContent = "---";
      }
    });

    const tbody = document.getElementById('leaderboardMiniBody');
    if (!tbody) return;

    if (leaders.length <= 3) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">More scores will appear here as matches complete!</td></tr>`;
      return;
    }

    tbody.innerHTML = leaders.slice(3).map((l, idx) => `
      <tr>
        <td>#${idx + 4}</td>
        <td><strong>${escapeHtml(l.playerName)}</strong></td>
        <td>${escapeHtml(l.studentId)}</td>
        <td>${(l.elapsedMs / 1000).toFixed(2)}s</td>
        <td style="color:var(--fest-gold);font-weight:700">${(state.state.mode === 1) ? `${(l.elapsedMs / 1000).toFixed(2)}s` : `${l.score} pts`}</td>
      </tr>
    `).join('');
  }

  function hideAllOverlays() {
    countdownOverlay.style.display = 'none';
    gameoverOverlay.style.display = 'none';
    victoryOverlay.style.display = 'none';
    leaderboardOverlay.style.display = 'none';
    if (topScorersModal) topScorersModal.style.display = 'none';
    stopConfetti();
  }

  // ========================== TOP 10 HALL OF FAME ==========================

  function showTopScorersModal(mode = null) {
    if (mode !== undefined && mode !== null) {
      topScorersCurrentMode = mode;
    }
    updateTopScorersTabs();
    renderTopScorersModal();
    if (topScorersModal) {
      topScorersModal.style.display = 'flex';
    }
  }

  function hideTopScorersModal() {
    if (topScorersModal) {
      topScorersModal.style.display = 'none';
    }
  }

  function toggleTopScorersModal() {
    if (topScorersModal && topScorersModal.style.display === 'flex') {
      hideTopScorersModal();
    } else {
      showTopScorersModal();
    }
  }

  function updateTopScorersTabs() {
    [tabTopAll, tabTopMode1, tabTopMode2].forEach(tab => {
      if (tab) tab.classList.remove('active');
    });
    if (topScorersCurrentMode === 1 && tabTopMode1) {
      tabTopMode1.classList.add('active');
    } else if (topScorersCurrentMode === 2 && tabTopMode2) {
      tabTopMode2.classList.add('active');
    } else if (tabTopAll) {
      tabTopAll.classList.add('active');
    }
  }

  function renderTopScorersModal() {
    const list = state.getTopScorers(10, topScorersCurrentMode);

    // Podium entries (Rank 1, Rank 2, Rank 3)
    const p1 = list[0] || null;
    const p2 = list[1] || null;
    const p3 = list[2] || null;

    const fillPodium = (nameElId, scoreElId, record) => {
      const nameEl = document.getElementById(nameElId);
      const scoreEl = document.getElementById(scoreElId);
      if (nameEl) nameEl.textContent = record ? record.playerName : "---";
      if (scoreEl) {
        if (!record) {
          scoreEl.textContent = "--";
        } else if (record.mode === 1) {
          scoreEl.textContent = (record.status === 'FINISHED') 
            ? `${(record.elapsedMs / 1000).toFixed(2)}s 🏆`
            : `${(record.elapsedMs / 1000).toFixed(2)}s (KO)`;
        } else {
          scoreEl.textContent = `${record.score} pts`;
        }
      }
    };

    fillPodium('topPodium1Name', 'topPodium1Score', p1);
    fillPodium('topPodium2Name', 'topPodium2Score', p2);
    fillPodium('topPodium3Name', 'topPodium3Score', p3);

    // Table rows 1 through 10
    if (!topScorersTableBody) return;

    if (list.length === 0) {
      topScorersTableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:28px;color:var(--text-muted)">No match records recorded yet. Completed matches will appear in the Top 10 Hall of Fame!</td></tr>`;
      return;
    }

    topScorersTableBody.innerHTML = list.map((m, idx) => {
      const rank = idx + 1;
      let badgeClass = "rank-other";
      if (rank === 1) badgeClass = "rank-1";
      else if (rank === 2) badgeClass = "rank-2";
      else if (rank === 3) badgeClass = "rank-3";

      const isWin = (m.status === 'FINISHED');
      const outcomeBadge = isWin
        ? `<span style="background:rgba(0,230,118,0.15);color:var(--fest-green);padding:2px 8px;border-radius:10px;font-weight:800;font-size:0.72rem">🏆 CONQUERED</span>`
        : `<span style="background:rgba(255,23,68,0.15);color:#ff5252;padding:2px 8px;border-radius:10px;font-weight:800;font-size:0.72rem">⛔ KNOCKOUT</span>`;

      return `
        <tr>
          <td><span class="top-rank-badge ${badgeClass}">${rank}</span></td>
          <td><strong>${escapeHtml(m.playerName)}</strong></td>
          <td style="font-family:var(--font-mono);font-size:0.75rem;color:var(--fest-cyan)">${escapeHtml(m.studentId)}</td>
          <td><span style="font-size:0.75rem;font-weight:700">${m.mode === 1 ? 'Mode 1' : 'Mode 2'}</span></td>
          <td>${outcomeBadge}</td>
          <td style="font-family:var(--font-mono)">${(m.elapsedMs / 1000).toFixed(2)}s</td>
          <td>${m.touches || 0}</td>
          <td style="font-family:var(--font-mono);font-weight:900;color:var(--fest-gold);font-size:0.95rem">${m.score || 0}</td>
        </tr>
      `;
    }).join('');
  }

  function resetStage() {
    hideAllOverlays();
    state.state.status = 'IDLE';
    resetStopwatch();
    if (touchCounter) touchCounter.textContent = "0";
    renderActivePlayer();
    serial.resetHardwareGame();
  }

  // ========================== CONFETTI ======================================

  function startConfetti() {
    if (!confettiCtx) return;
    confettiParticles = [];
    const colors = ['#f5a623', '#00e5ff', '#ff1744', '#00e676', '#ffffff'];

    for (let i = 0; i < 150; i++) {
      confettiParticles.push({
        x: Math.random() * confettiCanvas.width,
        y: Math.random() * -confettiCanvas.height,
        r: Math.random() * 8 + 4,
        d: Math.random() * 100,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.random() * 10 - 10,
        tiltAngle: 0,
        tiltAngleInc: (Math.random() * 0.07) + 0.05
      });
    }

    function drawConfetti() {
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      confettiParticles.forEach((p, idx) => {
        p.tiltAngle += p.tiltAngleInc;
        p.y += (Math.cos(p.d) + 3 + p.r / 2);
        p.tilt = Math.sin(p.tiltAngle) * 15;

        confettiCtx.beginPath();
        confettiCtx.lineWidth = p.r;
        confettiCtx.strokeStyle = p.color;
        confettiCtx.moveTo(p.x + p.tilt + (p.r / 2), p.y);
        confettiCtx.lineTo(p.x + p.tilt, p.y + p.tilt + (p.r / 2));
        confettiCtx.stroke();

        if (p.y > confettiCanvas.height) {
          confettiParticles[idx].x = Math.random() * confettiCanvas.width;
          confettiParticles[idx].y = -10;
        }
      });
      confettiAnimationId = requestAnimationFrame(drawConfetti);
    }

    drawConfetti();
  }

  function stopConfetti() {
    if (confettiAnimationId) cancelAnimationFrame(confettiAnimationId);
    if (confettiCtx && confettiCanvas) {
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
  }

  // ========================== HARDWARE TOAST FEEDBACK ======================

  function showToast(msg) {
    const toast = document.getElementById('hardwareToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.style.display = 'block';
    if (window._toastTimeout) clearTimeout(window._toastTimeout);
    window._toastTimeout = setTimeout(() => {
      toast.style.display = 'none';
    }, 2200);
  }

  // ========================== SERIAL EVENT BINDINGS =========================

  serial.on('connection_changed', (data) => {
    if (data.connected) {
      comStatusDot.className = "pulse-dot connected";
      comStatusText.textContent = "ESP32 COM Connected";
      showToast("✓ ESP32 Connected on COM Port");
    } else {
      comStatusDot.className = "pulse-dot";
      comStatusText.textContent = "Connect COM";
      if (data.error && !data.isUserCancel) {
        showToast("⚠ " + data.error);
      }
    }
  });

  serial.on('connection_state', (data) => {
    if (data.state === 'CONNECTING') {
      comStatusText.textContent = "Connecting...";
    }
  });

  serial.on('TOUCH', (data) => {
    handleTouchDetected(data.count || (state.state.currentMatch.touches + 1));
  });

  serial.on('GAMEOVER', (data) => {
    triggerGameOver(data.reason || "TOUCH");
  });

  // Finish Line Event Handler (From ESP32)
  serial.on('FINISH', () => {
    triggerVictory(true);
  });

  serial.on('FINISH_TRIGGERED', () => {
    if (state.state.status === 'PLAYING') {
      triggerVictory(true);
    } else {
      showToast("✓ Finish Pad Contact Tested (GPIO 6 OK)");
    }
  });

  serial.on('FINISH_TEST', () => {
    showToast("✓ Finish Pad Contact Tested (GPIO 6 OK)");
  });

  serial.on('TOUCH_TEST', () => {
    showToast("⚡ Wire Track Contact Tested (GPIO 4 OK)");
  });

  comStatusPill.addEventListener('click', async () => {
    if (!serial.isConnected) {
      comStatusText.textContent = "Connecting...";
      const ok = await serial.connect(null, false);
      if (!ok) {
        comStatusText.textContent = "Connect COM";
      }
    } else {
      if (confirm("Disconnect ESP32 serial COM port?")) {
        await serial.disconnect();
        showToast("Disconnected from ESP32");
      }
    }
  });

  // ========================== TOP 10 MODAL BINDINGS =========================

  if (topScorersNavBtn) {
    topScorersNavBtn.addEventListener('click', () => toggleTopScorersModal());
  }

  if (closeTopScorersBtn) {
    closeTopScorersBtn.addEventListener('click', () => hideTopScorersModal());
  }

  if (tabTopAll) {
    tabTopAll.addEventListener('click', () => {
      topScorersCurrentMode = null;
      updateTopScorersTabs();
      renderTopScorersModal();
    });
  }

  if (tabTopMode1) {
    tabTopMode1.addEventListener('click', () => {
      topScorersCurrentMode = 1;
      updateTopScorersTabs();
      renderTopScorersModal();
    });
  }

  if (tabTopMode2) {
    tabTopMode2.addEventListener('click', () => {
      topScorersCurrentMode = 2;
      updateTopScorersTabs();
      renderTopScorersModal();
    });
  }

  // ========================== KEYBOARD & REMOTE TRIGGERS ====================

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (state.state.status === 'IDLE') {
        startCountdownSequence();
      }
    } else if (e.code === 'KeyL') {
      e.preventDefault();
      toggleTopScorersModal();
    } else if (e.code === 'Escape') {
      hideTopScorersModal();
    } else if (e.code === 'KeyT') {
      handleTouchDetected(state.state.currentMatch.touches + 1);
    } else if (e.code === 'KeyF') {
      triggerVictory();
    } else if (e.code === 'KeyR') {
      resetStage();
    } else if (e.code === 'KeyM') {
      const newMode = (state.state.mode === 1) ? 2 : 1;
      state.setMode(newMode);
    }
  });

  // Remote Admin Broadcast Listeners
  state.on('TRIGGER_START_COUNTDOWN', () => {
    startCountdownSequence();
  });

  state.on('TRIGGER_FINISH', () => {
    triggerVictory();
  });

  state.on('TRIGGER_GAME_OVER', (data) => {
    triggerGameOver(data ? data.reason : "STOPPED_BY_ADMIN");
  });

  state.on('TRIGGER_RESET', () => {
    resetStage();
  });

  state.on('TRIGGER_TOGGLE_TOP_SCORERS', () => {
    toggleTopScorersModal();
  });

  state.on('TRIGGER_SHOW_TOP_SCORERS', () => {
    showTopScorersModal();
  });

  state.on('TRIGGER_HIDE_TOP_SCORERS', () => {
    hideTopScorersModal();
  });

  state.on('MATCH_FINISHED', () => {
    renderLeftLeaderboard();
    if (topScorersModal && topScorersModal.style.display === 'flex') {
      renderTopScorersModal();
    }
  });

  const startCtaBanner = document.getElementById('startCtaBanner');
  if (startCtaBanner) {
    startCtaBanner.addEventListener('click', startCountdownSequence);
  }

  state.on('state_changed', () => {
    renderActivePlayer();
    renderMode();
    renderQueue();
    renderLeftLeaderboard();
  });

  state.on('MODE_CHANGED', () => renderMode());
  state.on('ACTIVE_PLAYER_CHANGED', () => renderActivePlayer());
  state.on('QUEUE_UPDATED', () => renderQueue());

  renderActivePlayer();
  renderMode();
  renderQueue();
  renderLeftLeaderboard();
  formatTime(0);

  initQrCode();
  serial.autoConnect();
});

function initQrCode() {
  const qrContainer = document.getElementById('qrCodeImage');
  if (!qrContainer) return;

  const currentHost = window.location.origin + window.location.pathname.replace(/index\.html$/, '');
  const registerUrl = currentHost + (currentHost.endsWith('/') ? '' : '/') + 'register.html';
  
  const linkEl = document.getElementById('qrLinkDirect');
  if (linkEl) {
    linkEl.href = registerUrl;
    linkEl.textContent = "Open Registration Page ↗";
  }

  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(registerUrl)}`;
  const img = new Image();
  img.src = qrApiUrl;
  img.alt = "Scan to Register";
  img.style.width = "100%";
  img.style.height = "auto";
  img.style.borderRadius = "8px";
  
  img.onload = () => {
    qrContainer.innerHTML = '';
    qrContainer.appendChild(img);
  };

  img.onerror = () => {
    qrContainer.innerHTML = `
      <div style="font-size:0.75rem;padding:12px;background:#fff;color:#000;border-radius:8px;font-family:monospace;word-break:break-all;">
        ${registerUrl}
      </div>
    `;
  };
}
