export function initUI({ appEl, state, network }) {
  const dom = buildLayout(appEl);
  let answerWindow = null;

  dom.nameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = dom.nameInput.value.trim() || "Unbenannt";
    dom.nameInput.value = name;
    network.connect(name);
    if (dom.nameModal) {
      dom.nameModal.style.display = "none";
    }
  });

  dom.buzzerButton.addEventListener("click", () => {
    network.sendBuzzer();
  });

  dom.boardGrid.addEventListener("click", (event) => {
    const target = event.target;
    if (
      target instanceof HTMLButtonElement &&
      target.dataset.questionId &&
      state.data.client.role === "admin"
    ) {
      network.sendAction({ type: "admin:selectQuestion", questionId: target.dataset.questionId });
    }
  });

  dom.playersArea.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    if (target.dataset.action === "slot-kick") {
      const slotIndex = Number(target.dataset.slot);
      if (Number.isInteger(slotIndex) && window.confirm("Slot wirklich freigeben?")) {
        network.sendAction({ type: "admin:kickPlayer", slotIndex });
      }
    }
  });

  dom.adminControls.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const { action } = target.dataset;
    if (action === "correct") {
      network.sendAction({ type: "admin:markAnswer", verdict: "correct" });
    }
    if (action === "incorrect") {
      network.sendAction({ type: "admin:markAnswer", verdict: "incorrect" });
    }
    if (action === "close") {
      network.sendAction({ type: "admin:closeQuestion" });
    }
    if (action === "answer-window") {
      const win = ensureAnswerWindow();
      if (win) {
        answerWindow = win;
        renderAdminAnswerWindow(win, state.data.ui.adminAnswer);
      } else {
        state.update((data) => {
          data.ui.error = "Popup konnte nicht geöffnet werden. Erlaube Popups für diese Seite.";
        });
      }
    }
    if (action === "reset") {
      if (window.confirm("Spiel wirklich zurücksetzen?")) {
        network.sendAction({ type: "admin:reset" });
      }
    }
  });

  state.subscribe((data) => {
    renderBoard(dom, data, state.data.client.role);
    renderPlayers(dom, data);
    renderAdminCard(dom, data);
    renderAdminControlsState(dom, data);
    renderBuzzer(dom, data);
    renderNameModal(dom, data);
    answerWindow = renderAdminAnswer(dom, data, state.data.client.role, answerWindow);
    renderErrors(dom, data);
  });
}

function buildLayout(appEl) {
  appEl.innerHTML = `
    <main class="app-shell">
      <section class="admin-area">
        <div class="video-card admin-card">
          <div class="video-feed" data-role="admin-video">
            <span class="video-placeholder">Admin Kamera</span>
          </div>
          <div class="name-tag" data-role="admin-name">Admin</div>
        </div>
        <div class="admin-controls" data-role="admin-controls">
          <h2>Admin Bedienung</h2>
          <div class="controls-grid">
            <button data-action="correct">Richtige Antwort</button>
            <button data-action="incorrect">Falsche Antwort</button>
            <button data-action="close">Frage schließen</button>
            <button data-action="answer-window">Antwortfenster öffnen</button>
            <button data-action="reset" class="danger">Neues Spiel</button>
          </div>
        </div>
      </section>
      <section class="board-area">
        <header class="board-header">
          <div class="logo">Quizduell²</div>
          <div class="turn-indicator" data-role="turn-indicator">Warte auf Spieler...</div>
          <div class="timer-chip" data-role="timer">30s</div>
        </header>
        <div class="round-label" data-role="round-label">Runde 1 von 2</div>
        <div class="board-grid" data-role="board-grid"></div>
        <div class="question-panel" data-role="question-panel">Wähle eine Frage um zu starten.</div>
      </section>
      <section class="players-area" data-role="players"></section>
      <div class="buzzer-panel">
        <button id="buzzer-button" disabled>Buzzern</button>
      </div>
    </main>
    <div class="name-modal" data-role="name-modal">
      <form class="name-form">
        <h3>Wie heißt du?</h3>
        <p>Bitte gib deinen Anzeigenamen ein.</p>
        <input type="text" name="displayName" placeholder="Spielername" required />
        <button type="submit">Verbinden</button>
      </form>
    </div>
    <div class="toast" data-role="toast" hidden></div>
  `;

  return {
    boardGrid: appEl.querySelector('[data-role="board-grid"]'),
    questionPanel: appEl.querySelector('[data-role="question-panel"]'),
    playersArea: appEl.querySelector('[data-role="players"]'),
    turnIndicator: appEl.querySelector('[data-role="turn-indicator"]'),
    timerChip: appEl.querySelector('[data-role="timer"]'),
    roundLabel: appEl.querySelector('[data-role="round-label"]'),
    adminControls: appEl.querySelector('[data-role="admin-controls"]'),
    adminName: appEl.querySelector('[data-role="admin-name"]'),
    buzzerButton: appEl.querySelector('#buzzer-button'),
    nameModal: appEl.querySelector('[data-role="name-modal"]'),
    nameForm: appEl.querySelector('.name-form'),
    nameInput: appEl.querySelector('.name-form input'),
    toast: appEl.querySelector('[data-role="toast"]')
  };
}

function renderAdminCard(dom, data) {
  if (!dom.adminName) return;
  const admin = data.game.admin;
  const localName = data.client.role === "admin" && data.client.name ? data.client.name : null;
  const displayName = localName || admin?.name || "Admin";
  if (admin?.connected) {
    dom.adminName.textContent = `${displayName} (Admin)`;
  } else {
    dom.adminName.textContent = `${displayName} (Admin offline)`;
  }
}

function renderBoard(dom, data, role) {
  dom.roundLabel.textContent = `${data.game.roundTitle} (${data.game.roundNumber}/${data.game.totalRounds})`;
  dom.timerChip.textContent = `${data.game.activeQuestion?.secondsRemaining ?? 30}s`;
  const turnPlayer = data.game.players.find((player) => player.isTurn && player.connected);
  dom.turnIndicator.textContent = turnPlayer
    ? `${turnPlayer.name} ist an der Reihe`
    : "Warte auf Spieler...";

  dom.boardGrid.innerHTML = data.game.categories
    .map((category) => {
      const questionButtons = category.questions
        .map((question) => {
          const disabled = question.asked || role !== "admin";
          const classes = ["cell", question.asked ? "used" : "available"];
          if (question.active) classes.push("active");
          return `<button class="${classes.join(" ")}" data-question-id="${question.id}" ${
            disabled ? "disabled" : ""
          }>${question.value}</button>`;
        })
        .join("");
      return `<div class="column">
        <div class="column-title">${category.title}</div>
        ${questionButtons}
      </div>`;
    })
    .join("");

  if (data.game.activeQuestion) {
    const statusLabel =
      data.game.activeQuestion.status === "awaiting_buzz"
        ? "Buzzern erlaubt"
        : "Antwort wird geprüft";
    dom.questionPanel.innerHTML = `
      <p class="question-value">${data.game.activeQuestion.value} Punkte · ${statusLabel}</p>
      <h3>${data.game.activeQuestion.prompt}</h3>
    `;
  } else if (data.game.gameFinished) {
    dom.questionPanel.textContent = "Spiel beendet. Admin kann neu starten.";
  } else if (data.game.nextRoundReady) {
    dom.questionPanel.textContent = "Runde erledigt! Admin startet automatisch die nächste Runde.";
  } else {
    dom.questionPanel.textContent = "Wähle eine Frage um zu starten.";
  }
}

function renderPlayers(dom, data) {
  dom.playersArea.innerHTML = data.game.players
    .map((player) => {
      const classes = ["video-card", "player-card"];
      if (player.isTurn) classes.push("is-turn");
      if (player.isAnswering) classes.push("is-answering");
      if (!player.connected) classes.push("is-offline");
      const canKick = data.client.role === "admin" && Boolean(player.sessionId);
      const actionButton = canKick
        ? `<button class="slot-action" data-action="slot-kick" data-slot="${player.slotIndex}">Slot räumen</button>`
        : "";
      return `<div class="${classes.join(" ")}">
        <div class="video-feed" data-slot-video="${player.slotIndex}">
          <span class="video-placeholder">${player.name}</span>
        </div>
        <div class="name-tag">${player.name}</div>
        <div class="score">${player.score} Punkte</div>
        ${actionButton}
      </div>`;
    })
    .join("");
}

function renderAdminControlsState(dom, data) {
  const isAdmin = data.client.role === "admin";
  const active = data.game.activeQuestion;
  const correctBtn = dom.adminControls.querySelector('[data-action="correct"]');
  const incorrectBtn = dom.adminControls.querySelector('[data-action="incorrect"]');
  const closeBtn = dom.adminControls.querySelector('[data-action="close"]');
  const answerBtn = dom.adminControls.querySelector('[data-action="answer-window"]');
  const resetBtn = dom.adminControls.querySelector('[data-action="reset"]');

  if (!isAdmin) {
    dom.adminControls.classList.add("is-disabled");
    [correctBtn, incorrectBtn, closeBtn, answerBtn, resetBtn].forEach((btn) => {
      btn.disabled = true;
    });
    return;
  }

  dom.adminControls.classList.remove("is-disabled");
  const canJudge = active && active.status === "answering";
  const canClose = Boolean(active);
  correctBtn.disabled = !canJudge;
  incorrectBtn.disabled = !canJudge;
  closeBtn.disabled = !canClose;
  answerBtn.disabled = false;
  resetBtn.disabled = false;
}

function renderBuzzer(dom, data) {
  const { client } = data;
  const active = data.game.activeQuestion;
  const eligible =
    client.role === "player" &&
    typeof client.slotIndex === "number" &&
    active &&
    active.status === "awaiting_buzz" &&
    active.buzzableSlots?.includes(client.slotIndex);

  dom.buzzerButton.disabled = !eligible;
}

function renderNameModal(dom, data) {
  const shouldShow = data.ui.showNamePrompt && !data.client.joined;
  if (!dom.nameModal) {
    return;
  }
  dom.nameModal.style.display = shouldShow ? "flex" : "none";
  if (shouldShow) {
    dom.nameInput.value = data.client.name || "";
  }
}

function renderAdminAnswer(dom, data, role, currentWindow) {
  let answerWindow = currentWindow;
  if (answerWindow && answerWindow.closed) {
    answerWindow = null;
  }
  if (role !== "admin") {
    if (answerWindow) {
      answerWindow.close();
      answerWindow = null;
    }
    return answerWindow;
  }
  if (answerWindow) {
    renderAdminAnswerWindow(answerWindow, data.ui.adminAnswer);
  }
  return answerWindow;
}

function ensureAnswerWindow() {
  const existing = window.open("", "quizduell-answer", "width=420,height=320");
  if (!existing) {
    return null;
  }
  if (existing.document.body.childElementCount === 0) {
    renderAdminAnswerWindow(existing, null);
  }
  existing.focus();
  return existing;
}

function renderAdminAnswerWindow(answerWindow, answer) {
  if (!answerWindow || answerWindow.closed) return;
  const doc = answerWindow.document;
  doc.title = "Quizduell – Antwort";
  const prompt = escapeHtml(answer?.prompt || "Noch keine aktive Frage.");
  const response = escapeHtml(answer?.answer || "–");
  doc.body.innerHTML = `
    <style>
      body {
        margin: 0;
        font-family: "Inter", "Segoe UI", sans-serif;
        background: #12062c;
        color: #f9f3ff;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .card {
        padding: 2rem;
        max-width: 420px;
        text-align: center;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
      }
      h1 {
        font-size: 1rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 0.5rem;
        color: #a782ff;
      }
      p {
        margin: 0.5rem 0 1.5rem;
        font-size: 0.95rem;
        opacity: 0.85;
      }
      strong {
        font-size: 1.5rem;
        color: #49ffb1;
      }
    </style>
    <div class="card">
      <h1>Antwort</h1>
      <p>${prompt}</p>
      <strong>${response}</strong>
    </div>
  `;
}


function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderErrors(dom, data) {
  if (data.ui.error) {
    dom.toast.hidden = false;
    dom.toast.textContent = data.ui.error;
  } else {
    dom.toast.hidden = true;
  }
}
