/**
 * ============================================================================
 * EEE Fest 2026 - Mobile Player Registration Controller
 * Organized by IEEE PES DIU SBC
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const state = window.gameState;
  const cloud = window.cloudSync;

  const fbFollowBtn = document.getElementById('fbFollowBtn');
  const fbCheck = document.getElementById('fbCheck');
  const playerNameInput = document.getElementById('playerName');
  const studentIdInput = document.getElementById('studentId');
  const confirmBtn = document.getElementById('confirmBtn');

  const regFormSection = document.getElementById('regFormSection');
  const ticketSection = document.getElementById('ticketSection');
  const ticketNumber = document.getElementById('ticketNumber');
  const ticketPlayerName = document.getElementById('ticketPlayerName');
  const ticketStudentId = document.getElementById('ticketStudentId');
  const registerAnotherBtn = document.getElementById('registerAnotherBtn');

  // Check if player has an active ticket saved in localStorage
  const savedTicket = localStorage.getItem('my_active_wire_buzz_ticket');
  if (savedTicket) {
    try {
      const ticket = JSON.parse(savedTicket);
      if (ticket && ticket.name && ticket.studentId) {
        showTicket(ticket.name, ticket.studentId, ticket.queueNum || "#1");
      }
    } catch (e) {}
  }

  // When user clicks the Facebook button, automatically check the confirmation checkbox
  if (fbFollowBtn) {
    fbFollowBtn.addEventListener('click', () => {
      setTimeout(() => {
        if (fbCheck) fbCheck.checked = true;
      }, 600);
    });
  }

  confirmBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    const studentId = studentIdInput.value.trim();

    if (!name) {
      alert("Please enter your Full Name.");
      playerNameInput.focus();
      return;
    }

    if (!studentId) {
      alert("Please enter your Student ID.");
      studentIdInput.focus();
      return;
    }

    // Auto-check FB verification
    if (fbCheck) {
      fbCheck.checked = true;
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = "Joining Arena Queue...";

    const playerData = {
      name: name,
      studentId: studentId,
      department: "EEE"
    };

    let player = null;
    if (state && typeof state.addPlayerToQueue === 'function') {
      player = state.addPlayerToQueue(playerData, true);
    } else {
      player = {
        id: "p_" + Date.now(),
        name: name,
        studentId: studentId,
        department: "EEE",
        registeredAt: new Date().toLocaleTimeString()
      };
      if (window.cloudSync) {
        window.cloudSync.publishRegistration(player);
      }
    }

    // Compute ticket number
    let queueNum = "#1";
    if (state && state.state) {
      if (state.state.activePlayer && state.state.activePlayer.studentId === studentId) {
        queueNum = "ON STAGE!";
      } else if (state.state.queue) {
        const idx = state.state.queue.findIndex(p => p.studentId === studentId);
        queueNum = (idx >= 0) ? `#${idx + 1}` : `#${state.state.queue.length || 1}`;
      }
    }

    // Save ticket locally so refresh doesn't lose it
    localStorage.setItem('my_active_wire_buzz_ticket', JSON.stringify({
      name: name,
      studentId: studentId,
      queueNum: queueNum,
      time: Date.now()
    }));

    showTicket(name, studentId, queueNum);
    confirmBtn.disabled = false;
    confirmBtn.textContent = "Confirm & Join Arena Queue";
  });

  function showTicket(name, id, qNum) {
    if (ticketPlayerName) ticketPlayerName.textContent = name;
    if (ticketStudentId) ticketStudentId.textContent = id;
    if (ticketNumber) {
      ticketNumber.textContent = qNum;
      ticketNumber.style.color = (qNum === "ON STAGE!") ? "var(--fest-green)" : "var(--fest-gold)";
    }

    if (qNum === "ON STAGE!") {
      const instr = document.querySelector('.ticket-instructions');
      if (instr) {
        instr.innerHTML = "⚡ <strong>YOU ARE CALLED TO THE STAGE!</strong><br>Grip the wand and prepare to play when countdown begins!";
      }
    }

    if (regFormSection) regFormSection.style.display = 'none';
    if (ticketSection) ticketSection.style.display = 'block';
  }

  if (registerAnotherBtn) {
    registerAnotherBtn.addEventListener('click', () => {
      localStorage.removeItem('my_active_wire_buzz_ticket');
      if (playerNameInput) playerNameInput.value = '';
      if (studentIdInput) studentIdInput.value = '';
      if (ticketSection) ticketSection.style.display = 'none';
      if (regFormSection) regFormSection.style.display = 'block';
    });
  }

  // Live Queue update callback: update ticket if queue moves or player takes the stage
  if (state) {
    const updateMyTicketPosition = (queue, activeP) => {
      const saved = localStorage.getItem('my_active_wire_buzz_ticket');
      if (!saved) return;
      try {
        const t = JSON.parse(saved);
        if (activeP && activeP.studentId === t.studentId) {
          if (ticketNumber) {
            ticketNumber.textContent = "ON STAGE!";
            ticketNumber.style.color = "var(--fest-green)";
          }
          const instr = document.querySelector('.ticket-instructions');
          if (instr) {
            instr.innerHTML = "⚡ <strong>YOU ARE CALLED TO THE STAGE!</strong><br>Grip the wand and prepare to play when countdown begins!";
          }
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        } else if (queue) {
          const idx = queue.findIndex(p => p.studentId === t.studentId);
          if (idx >= 0 && ticketNumber) {
            ticketNumber.textContent = `#${idx + 1}`;
            ticketNumber.style.color = "var(--fest-gold)";
          }
        }
      } catch (e) {}
    };

    state.on('QUEUE_UPDATED', (payload) => {
      updateMyTicketPosition(payload.queue, state.state.activePlayer);
    });

    state.on('ACTIVE_PLAYER_CHANGED', (payload) => {
      updateMyTicketPosition(state.state.queue, payload.player);
    });
  }
});
