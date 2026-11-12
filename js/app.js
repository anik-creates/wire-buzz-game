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
  const activePlayerDept = document.getElementById('activePlayerDept');
  const activePlayerAvatar = document.getElementById('activePlayerAvatar');
  const activePlayerStatus = document.getElementById('activePlayerStatus');
  
  const modeBadge = document.getElementById('modeBadge');
  const modeHeadline = document.getElementById('arenaModeHeadline');
  const touchStatBox = document.getElementById('touchStatBox');
  const touchCounter = document.getElementById('touchCounter');
  const queueList = document.getElementById('queueList');
  const queueCount = document.getElementById('queueCount');
  
  const countdownOverlay = document.getElementById('countdownOverlay');
  const countdownNumber = document.getElementById('countdownNumber');
  const gameoverOverlay = document.getElementById('gameoverOverlay');
  const victoryOverlay = document.getElementById('victoryOverlay');
  const leaderboardOverlay = document.getElementById('leaderboardOverlay');

  const comStatusPill = document.getElementById('comStatusPill');
  const comStatusText = document.getElementById('comStatusText');
  const comStatusDot = document.getElementById('comStatusDot');
  const clockEl = document.getElementById('liveClock');

  // Confetti Canvas
  const confettiCanvas = document.getElementById('confettiCanvas');
  let confettiCtx = confettiCanvas ? confettiCanvas.getContext('2d') : null;
  let confettiParticles = [];
  let confettiAnimationId = null;

  // Animation Frame Stopwatch
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

  // Resize Confetti Canvas
  function resizeConfetti() {
    if (confettiCanvas) {
      confettiCanvas.width = window.innerWidth;
      confettiCanvas.height = window.innerHeight;
    }
  }
  window.addEventListener('resize', resizeConfetti);
  resizeConfetti();

  // ========================== RENDER FUNCTIONS ==============================

  function renderActivePlayer() {
    const p = state.state.activePlayer || { name: "Ready", studentId: "Scan QR", department: "EEE" };
    activePlayerName.textContent = p.name;
    activePlayerId.textContent = p.studentId;
    activePlayerDept.textContent = p.department || "DIU EEE";
    activePlayerAvatar.textContent = p.name.charAt(0).toUpperCase();

    if (state.state.status === 'PLAYING') {
      activePlayerStatus.textContent = "IN GAME";
      activePlayerStatus.style.color = "var(--fest-cyan)";
    } else {
      activePlayerStatus.textContent = "ON DECK";
      activePlayerStatus.style.color = "var(--fest-green)";
    }
  }

  function renderMode() {
    const isMode1 = state.state.mode === 1;
    if (isMode1) {
      modeBadge.className = "badge-mode mode-sudden-death";
      modeBadge.innerHTML = `<span class="dot-indicator connected" style="background:#ff1744;box-shadow:0 0 10px #ff1744"></span> Mode 1: Sudden Death`;
      modeHeadline.textContent = "⚡ MODE 1: ONE TOUCH = GAME OVER";
      if (touchStatBox) touchStatBox.style.display = 'none';
    } else {
      modeBadge.className = "badge-mode mode-multi-touch";
      modeBadge.innerHTML = `<span class="dot-indicator connected" style="background:#f5a623;box-shadow:0 0 10px #f5a623"></span> Mode 2: Touch Master`;
      modeHeadline.textContent = "🎯 MODE 2: MULTI-TOUCH & PRECISION SCORING";
      if (touchStatBox) touchStatBox.style.display = 'flex';
    }
  }

  function renderQueue() {
    const q = state.state.queue;
    queueCount.textContent = `${q.length} in queue`;

    if (q.length === 0) {
      queueList.innerHTML = `<div class="empty-queue-msg">No players waiting. Scan the QR code to take the stage!</div>`;
      return;
    }

    queueList.innerHTML = q.map((p, idx) => `
      <div class="queue-item">
        <div class="queue-item-left">
          <div class="queue-index-bubble">#${idx + 1}</div>
          <div class="queue-player-details">
            <div class="q-name">${escapeHtml(p.name)}</div>
            <div class="q-id">${escapeHtml(p.studentId)} • ${escapeHtml(p.department || 'EEE')}</div>
          </div>
        </div>
      </div>
    `).join('');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

    hideAllOverlays();
    state.state.status = 'COUNTDOWN';
    state.state.currentMatch.touches = 0;
    if (touchCounter) touchCounter.textContent = "0";

    const p = state.state.activePlayer;
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

    // Signal ESP32 over serial
    const p = state.state.activePlayer;
    serial.startHardwareGame(state.state.mode, p.name, p.studentId);
  }

  function handleTouchDetected(touchCount) {
    if (state.state.status !== 'PLAYING') return;

    state.state.currentMatch.touches = touchCount;
    if (touchCounter) touchCounter.textContent = touchCount;

    // Pulse animation
    if (touchStatBox) {
      touchStatBox.classList.add('pulse-touch');
      setTimeout(() => touchStatBox.classList.remove('pulse-touch'), 300);
    }

    if (state.state.mode === 1) {
      // Sudden Death: One Touch = Game Over
      triggerGameOver("TOUCH");
    } else {
      // Mode 2: Multi-Touch audio alert
      sound.playTouchBuzz(180);
    }
  }

  function triggerGameOver(reason = "TOUCH") {
    if (state.state.status !== 'PLAYING') return;

    stopwatchRunning = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    state.state.status = 'GAMEOVER';

    const p = state.state.activePlayer;
    const finalElapsed = elapsedMs;
    const finalTouches = state.state.currentMatch.touches;

    // Record in history & save
    const record = state.recordMatchResult('GAMEOVER', {
      elapsedMs: finalElapsed,
      touches: finalTouches,
      reason: reason
    });

    // Notify ESP32
    serial.stopHardwareGame();

    // Sound and TTS
    sound.playGameOverFail();
    sound.announceGameOver(p.name, (finalElapsed / 1000).toFixed(1), state.state.mode);

    // Populate Game Over Overlay
    document.getElementById('goPlayerName').textContent = p.name;
    document.getElementById('goTime').textContent = `${(finalElapsed / 1000).toFixed(2)}s`;
    document.getElementById('goTouches').textContent = finalTouches;
    document.getElementById('goReason').textContent = (reason === 'TOUCH') ? "Touched the Wire Track!" : reason;

    gameoverOverlay.style.display = 'flex';

    // Transition to Intermission Leaderboard after 4.5 seconds
    setTimeout(() => {
      gameoverOverlay.style.display = 'none';
      showIntermissionLeaderboard();
    }, 4500);
  }

  function triggerVictory() {
    if (state.state.status !== 'PLAYING') return;

    stopwatchRunning = false;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    state.state.status = 'FINISHED';

    const p = state.state.activePlayer;
    const finalElapsed = elapsedMs;
    const finalTouches = state.state.currentMatch.touches;

    const record = state.recordMatchResult('FINISHED', {
      elapsedMs: finalElapsed,
      touches: finalTouches
    });

    serial.sendCommand('FINISH');

    // Confetti and Cheering Claps
    sound.playCelebrationClaps(5.0);
    sound.announceVictory(p.name, record.score, finalTouches, (finalElapsed / 1000).toFixed(1));
    startConfetti();

    // Populate Victory Overlay
    document.getElementById('vicPlayerName').textContent = p.name;
    document.getElementById('vicScore').textContent = record.score.toLocaleString();
    document.getElementById('vicTime').textContent = `${(finalElapsed / 1000).toFixed(2)}s`;
    document.getElementById('vicTouches').textContent = finalTouches;

    victoryOverlay.style.display = 'flex';

    // Transition to Leaderboard after 5.5 seconds
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
        
        // Advance to next player
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

    // Top 3 Podium
    podiumSlots.forEach((slot, i) => {
      if (!slot) return;
      const l = leaders[i];
      if (l) {
        slot.style.opacity = '1';
        slot.querySelector('.podium-name').textContent = l.playerName;
        slot.querySelector('.podium-score').textContent = (state.state.mode === 1) ? `${(l.elapsedMs / 1000).toFixed(2)}s` : `${l.score} pts`;
      } else {
        slot.style.opacity = '0.35';
        slot.querySelector('.podium-name').textContent = "---";
        slot.querySelector('.podium-score').textContent = "---";
      }
    });

    // Mini Table for 4th-10th
    const tbody = document.getElementById('leaderboardMiniBody');
    if (!tbody) return;

    if (leaders.length <= 3) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-dim)">More scores will appear here as players compete!</td></tr>`;
      return;
    }

    tbody.innerHTML = leaders.slice(3).map((l, idx) => `
      <tr>
        <td>#${idx + 4}</td>
        <td><strong>${escapeHtml(l.playerName)}</strong></td>
        <td>${escapeHtml(l.studentId)}</td>
        <td>${(l.elapsedMs / 1000).toFixed(2)}s</td>
        <td style="color:var(--fest-cyan);font-weight:700">${(state.state.mode === 1) ? `${(l.elapsedMs / 1000).toFixed(2)}s` : `${l.score} pts`}</td>
      </tr>
    `).join('');
  }

  function hideAllOverlays() {
    countdownOverlay.style.display = 'none';
    gameoverOverlay.style.display = 'none';
    victoryOverlay.style.display = 'none';
    leaderboardOverlay.style.display = 'none';
    stopConfetti();
  }

  function resetStage() {
    hideAllOverlays();
    state.state.status = 'IDLE';
    resetStopwatch();
    if (touchCounter) touchCounter.textContent = "0";
    renderActivePlayer();
    serial.resetHardwareGame();
  }

  // ========================== CONFETTI ENGINE ===============================

  function startConfetti() {
    if (!confettiCtx) return;
    confettiParticles = [];
    const colors = ['#f5a623', '#00e5ff', '#ff1744', '#00f59b', '#7928ca', '#ffffff'];

    for (let i = 0; i < 140; i++) {
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

  // ========================== SERIAL EVENT BINDINGS =========================

  serial.on('connection_changed', (data) => {
    if (data.connected) {
      comStatusDot.className = "dot-indicator connected";
      comStatusText.textContent = "ESP32 Connected";
    } else {
      comStatusDot.className = "dot-indicator";
      comStatusText.textContent = "Connect COM";
    }
  });

  serial.on('TOUCH', (data) => {
    handleTouchDetected(data.count || (state.state.currentMatch.touches + 1));
  });

  serial.on('GAMEOVER', (data) => {
    triggerGameOver(data.reason || "TOUCH");
  });

  serial.on('FINISH', () => {
    triggerVictory();
  });

  comStatusPill.addEventListener('click', () => {
    if (!serial.isConnected) {
      serial.connect();
    } else {
      serial.disconnect();
    }
  });

  // ========================== KEYBOARD & SPACEBAR ===========================

  window.addEventListener('keydown', (e) => {
    // Ignore input if inside text fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (state.state.status === 'IDLE') {
        startCountdownSequence();
      }
    } else if (e.code === 'KeyT') {
      // Simulate Touch
      handleTouchDetected(state.state.currentMatch.touches + 1);
    } else if (e.code === 'KeyF') {
      // Simulate Finish
      triggerVictory();
    } else if (e.code === 'KeyR') {
      // Reset Stage
      resetStage();
    } else if (e.code === 'KeyM') {
      // Toggle Mode
      const newMode = (state.state.mode === 1) ? 2 : 1;
      state.setMode(newMode);
    }
  });

  // Start CTA click
  const startCtaBanner = document.getElementById('startCtaBanner');
  if (startCtaBanner) {
    startCtaBanner.addEventListener('click', startCountdownSequence);
  }

  // State Change Listener
  state.on('state_changed', () => {
    renderActivePlayer();
    renderMode();
    renderQueue();
  });

  state.on('MODE_CHANGED', () => {
    renderMode();
  });

  state.on('ACTIVE_PLAYER_CHANGED', () => {
    renderActivePlayer();
  });

  state.on('QUEUE_UPDATED', () => {
    renderQueue();
  });

  // Initial Renders
  renderActivePlayer();
  renderMode();
  renderQueue();
  formatTime(0);

  // Generate dynamic QR Code for phone scanning
  initQrCode();
});

// Pure JS QR Code Generator fallback (zero external CDN dependency)
function initQrCode() {
  const qrContainer = document.getElementById('qrCodeImage');
  if (!qrContainer) return;

  // Compute registration URL
  const currentHost = window.location.origin + window.location.pathname.replace(/index\.html$/, '');
  const registerUrl = currentHost + (currentHost.endsWith('/') ? '' : '/') + 'register.html';
  
  // Update link text
  const linkEl = document.getElementById('qrLinkDirect');
  if (linkEl) {
    linkEl.href = registerUrl;
    linkEl.textContent = "Open Registration Page ↗";
  }

  // Generate QR code using Google Chart API or SVG QR image for crystal clear scanning
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(registerUrl)}`;
  
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
    // Fallback if offline
    qrContainer.innerHTML = `
      <div style="font-size:0.75rem;padding:12px;background:#fff;color:#000;border-radius:8px;font-family:monospace;word-break:break-all;">
        <strong>OFFLINE ACCESS:</strong><br>${registerUrl}
      </div>
    `;
  };
}
