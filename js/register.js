/**
 * ============================================================================
 * EEE Fest 2026 - Mobile Player Registration Controller
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
  const state = window.gameState;

  const fbFollowBtn = document.getElementById('fbFollowBtn');
  const fbCheck = document.getElementById('fbCheck');
  const playerNameInput = document.getElementById('playerName');
  const studentIdInput = document.getElementById('studentId');
  const deptInput = document.getElementById('department');
  const confirmBtn = document.getElementById('confirmBtn');

  const regFormSection = document.getElementById('regFormSection');
  const ticketSection = document.getElementById('ticketSection');
  const ticketNumber = document.getElementById('ticketNumber');
  const ticketPlayerName = document.getElementById('ticketPlayerName');
  const registerAnotherBtn = document.getElementById('registerAnotherBtn');

  // Automatically check the box when user clicks the Facebook link
  fbFollowBtn.addEventListener('click', () => {
    setTimeout(() => {
      fbCheck.checked = true;
    }, 1500);
  });

  confirmBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    const studentId = studentIdInput.value.trim();
    const department = deptInput.value;

    if (!fbCheck.checked) {
      alert("Please follow the IEEE PES DIU SBC Facebook page and check the box to continue!");
      fbCheck.focus();
      return;
    }

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

    // Add player to the central queue
    const player = state.addPlayerToQueue({
      name,
      studentId,
      department
    });

    // Compute ticket position
    let queuePosition = 1;
    if (state.state.activePlayer && state.state.activePlayer.id === player.id) {
      queuePosition = "CURRENT PLAYER (ON STAGE!)";
    } else {
      const idx = state.state.queue.findIndex(p => p.id === player.id);
      queuePosition = (idx >= 0) ? `#${idx + 1}` : `#${state.state.queue.length}`;
    }

    // Show confirmation ticket
    ticketPlayerName.textContent = name;
    ticketNumber.textContent = queuePosition;

    regFormSection.style.display = 'none';
    ticketSection.style.display = 'block';
  });

  registerAnotherBtn.addEventListener('click', () => {
    playerNameInput.value = '';
    studentIdInput.value = '';
    fbCheck.checked = false;
    ticketSection.style.display = 'none';
    regFormSection.style.display = 'block';
  });
});
