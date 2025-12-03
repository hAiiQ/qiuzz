export function initUI({ appEl, state, network, camera }) {
  const dom = buildLayout(appEl, state.data.client.role);
  let adminWindow = null;

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
    const button = event.target instanceof HTMLElement ? event.target.closest("button") : null;
    if (!(button instanceof HTMLButtonElement)) return;
    if (button.dataset.action === "slot-kick") {
      const slotIndex = Number(button.dataset.slot);
      if (Number.isInteger(slotIndex) && window.confirm("Slot wirklich freigeben?")) {
        network.sendAction({ type: "admin:kickPlayer", slotIndex });
      }
      return;
    }
    if (
      button.dataset.action === "toggle-camera" &&
      button.dataset.sessionId === state.data.client.sessionId
    ) {
      camera?.toggleCamera();
    }
  });

  if (dom.adminCameraToggle && camera?.toggleCamera) {
    dom.adminCameraToggle.addEventListener("click", () => {
      if (state.data.client.role === "admin") {
        camera.toggleCamera();
      }
    });
  }

  if (dom.adminWindowButton) {
    dom.adminWindowButton.addEventListener("click", () => {
      if (state.data.client.role !== "admin") {
        return;
      }
      const win = ensureAdminWindow();
      if (!win) {
        state.update((data) => {
          data.ui.error = "Popup konnte nicht geöffnet werden. Erlaube Popups für diese Seite.";
        });
        return;
      }
      adminWindow = win;
      renderAdminWindowContent(win, state.data, network);
    });
  }

  state.subscribe((data) => {
    renderBoard(dom, data, state.data.client.role);
    renderPlayers(dom, data);
    renderAdminCard(dom, data);
    renderAdminControlsState(dom, data);
    renderBuzzer(dom, data);
    renderCameraToggle(dom, data);
    renderNameModal(dom, data);
    adminWindow = syncAdminWindow(data, state.data.client.role, adminWindow, network);
    renderErrors(dom, data);
  });
}

function buildLayout(appEl, role) {
  const isAdmin = role === "admin";
  appEl.innerHTML = `
    <main class="app-shell">
      <section class="admin-area">
        <div class="video-card admin-card player-card">
          <div class="video-feed" data-role="admin-video">
            ${isAdmin ? `
            <button
              type="button"
              class="camera-pill"
              data-role="admin-camera-toggle"
              aria-label="Kamera umschalten"
            >
              <span aria-hidden="true">📷</span>
            </button>` : ""}
            <span class="video-placeholder">Admin Kamera</span>
            <div class="player-meta">
              <span class="player-meta__name" data-role="admin-name-overlay">Admin</span>
              <span class="player-meta__score">Moderator</span>
            </div>
          </div>
          <div class="name-tag" data-role="admin-name">Admin</div>
        </div>
        <div class="admin-controls" data-role="admin-controls">
          <h2>Admin Bedienung</h2>
          <p class="admin-controls__hint">Öffne das Popup, um Fragen zu steuern und Antworten zu sehen.</p>
          <div class="controls-grid">
            <button data-action="open-admin-window">Admin-Fenster öffnen</button>
          </div>
        </div>
        <div class="player-controls" data-role="player-controls" hidden>
          <h2>Buzzern</h2>
          <p class="player-controls__hint">Sobald der Moderator buzzern freigibt, kannst du hier drücken.</p>
          <button id="buzzer-button" disabled>Buzzern</button>
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
    adminWindowButton: appEl.querySelector('[data-action="open-admin-window"]'),
    playerControls: appEl.querySelector('[data-role="player-controls"]'),
    adminName: appEl.querySelector('[data-role="admin-name"]'),
    adminNameOverlay: appEl.querySelector('[data-role="admin-name-overlay"]'),
    adminCameraToggle: appEl.querySelector('[data-role="admin-camera-toggle"]'),
    buzzerButton: appEl.querySelector('#buzzer-button'),
    nameModal: appEl.querySelector('[data-role="name-modal"]'),
    nameForm: appEl.querySelector('.name-form'),
    nameInput: appEl.querySelector('.name-form input'),
    toast: appEl.querySelector('[data-role="toast"]')
  };
}

function syncAdminWindow(data, role, currentWindow, network) {
  let adminWindow = currentWindow;
  if (adminWindow && adminWindow.closed) {
    adminWindow = null;
  }
  if (role !== "admin") {
    if (adminWindow) {
      adminWindow.close();
    }
    return null;
  }
  if (adminWindow) {
    renderAdminWindowContent(adminWindow, data, network);
  }
  return adminWindow;
}

function ensureAdminWindow() {
  const existing = window.open("", "quizduell-admin", "width=520,height=640");
  if (!existing) {
    return null;
  }
  existing.focus();
  return existing;
}

function renderAdminWindowContent(targetWindow, data, network) {
  if (!targetWindow || targetWindow.closed) return;
  const doc = targetWindow.document;
  doc.title = "Quizduell – Admin";
  const active = data.game.activeQuestion;
  const answer = data.ui.adminAnswer;
  const prompt = escapeHtml(answer?.prompt || active?.prompt || "Noch keine aktive Frage.");
  const response = escapeHtml(answer?.answer || "–");
  const statusLabel = active
    ? active.status === "awaiting_buzz"
      ? "Buzzern erlaubt"
      : active.status === "answering"
        ? "Antwort wird geprüft"
        : "Frage aktiv"
    : "Kein Frage aktiv";
  const canJudge = Boolean(active && active.status === "answering");
  const canClose = Boolean(active);
  const roundLabel = `${data.game.roundTitle} (${data.game.roundNumber}/${data.game.totalRounds})`;

  doc.body.innerHTML = `
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Inter", "Segoe UI", sans-serif;
        background: #0e0520;
        color: #f9f3ff;
        min-height: 100vh;
        padding: 1.5rem;
      }
      .admin-popup {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
      }
      .admin-popup__section {
        background: rgba(255, 255, 255, 0.07);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 18px;
        padding: 1rem 1.25rem;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
      }
      h2 {
        margin: 0 0 0.35rem;
        font-size: 1.1rem;
      }
      p {
        margin: 0;
      }
      .status-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.25rem 0.8rem;
        border-radius: 999px;
        background: rgba(127, 77, 255, 0.25);
        font-weight: 600;
        font-size: 0.85rem;
        margin-top: 0.35rem;
      }
      .question-prompt {
        font-size: 1rem;
        line-height: 1.5;
        margin-top: 0.5rem;
      }
      .answer-text {
        font-size: 1.15rem;
        line-height: 1.4;
        margin-top: 0.5rem;
        font-weight: 600;
      }
      .controls-grid {
        display: grid;
        gap: 0.75rem;
      }
      .controls-grid button {
        padding: 0.9rem;
        border-radius: 12px;
        border: none;
        background: linear-gradient(90deg, #7f4dff, #a782ff);
        color: white;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.15s ease, transform 0.15s ease;
      }
      .controls-grid button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
        transform: none;
      }
      .controls-grid button.danger {
        background: #ff4d7a;
      }
    </style>
    <div class="admin-popup">
      <section class="admin-popup__section">
        <h2>Spielstatus</h2>
        <p>${escapeHtml(roundLabel)}</p>
        <span class="status-chip">${escapeHtml(statusLabel)}</span>
      </section>
      <section class="admin-popup__section">
        <h2>Frage</h2>
        <p class="question-prompt">${prompt}</p>
        <h2>Antwort</h2>
        <p class="answer-text">${response}</p>
      </section>
      <section class="admin-popup__section">
        <h2>Aktionen</h2>
        <div class="controls-grid">
          <button data-action="correct" ${!canJudge ? "disabled" : ""}>Richtige Antwort</button>
          <button data-action="incorrect" ${!canJudge ? "disabled" : ""}>Falsche Antwort</button>
          <button data-action="close" ${!canClose ? "disabled" : ""}>Frage schließen</button>
          <button data-action="reset" class="danger">Neues Spiel</button>
        </div>
      </section>
    </div>
  `;

  const sendAction = (action) => {
    switch (action) {
      case "correct":
        network.sendAction({ type: "admin:markAnswer", verdict: "correct" });
        break;
      case "incorrect":
        network.sendAction({ type: "admin:markAnswer", verdict: "incorrect" });
        break;
      case "close":
        network.sendAction({ type: "admin:closeQuestion" });
        break;
      case "reset":
        if (targetWindow.confirm("Spiel wirklich zurücksetzen?")) {
          network.sendAction({ type: "admin:reset" });
        }
        break;
      default:
        break;
    }
  };

  doc.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.getAttribute("data-action");
      if (action) {
        sendAction(action);
      }
    });
  });
}
function renderAdminCard(dom, data) {
  if (!dom.adminName) return;
  const admin = data.game.admin;
  const localName = data.client.role === "admin" && data.client.name ? data.client.name : null;
  const displayName = localName || admin?.name || "Admin";
  if (dom.adminNameOverlay) {
    dom.adminNameOverlay.textContent = displayName;
  }
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
  const clientSessionId = data.client.sessionId;
  dom.playersArea.innerHTML = data.game.players
    .map((player) => {
      const classes = ["video-card", "player-card"];
      if (player.isTurn) classes.push("is-turn");
      if (player.isAnswering) classes.push("is-answering");
      if (!player.connected) classes.push("is-offline");
      const canKick = data.client.role === "admin" && Boolean(player.sessionId);
      const hasSession = Boolean(player.sessionId) && Boolean(clientSessionId);
      const isLocal = hasSession && player.sessionId === clientSessionId;
      let cameraButton = "";
      if (Number.isInteger(player.slotIndex) && isLocal) {
        cameraButton = `<button class="camera-pill${data.ui.cameraEnabled ? "" : " is-off"}" type="button" data-action="toggle-camera" data-camera-indicator="local" data-session-id="${player.sessionId}" data-slot="${player.slotIndex}" aria-label="Kamera ${
          data.ui.cameraEnabled ? "deaktivieren" : "aktivieren"
        }">
            <span aria-hidden="true">📷</span>
          </button>`;
      }
      const kickButton = canKick
        ? `<button class="slot-pill" type="button" data-action="slot-kick" data-slot="${player.slotIndex}" aria-label="Slot räumen">
            <span aria-hidden="true">✖</span>
          </button>`
        : "";
      return `<div class="${classes.join(" ")}">
        <div class="video-feed" data-slot-video="${player.slotIndex}">
          <span class="video-placeholder">${player.name}</span>
          ${cameraButton}
          ${kickButton}
          <div class="player-meta">
            <span class="player-meta__name">${player.name}</span>
            <span class="player-meta__score">${player.score} Punkte</span>
          </div>
        </div>
      </div>`;
    })
    .join("");
}

function renderAdminControlsState(dom, data) {
  const isAdmin = data.client.role === "admin";
  const controlsEl = dom.adminControls;

  if (!isAdmin) {
    if (controlsEl) controlsEl.hidden = true;
    if (dom.playerControls) {
      dom.playerControls.hidden = false;
      dom.playerControls.style.display = "flex";
    }
    return;
  }

  if (!controlsEl) return;
  if (dom.playerControls) {
    dom.playerControls.hidden = true;
    dom.playerControls.style.display = "none";
  }
  controlsEl.hidden = false;
  controlsEl.classList.remove("is-disabled");
  if (dom.adminWindowButton) {
    dom.adminWindowButton.disabled = false;
  }
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

function renderCameraToggle(dom, data) {
  const enabled = data.ui.cameraEnabled;
  if (dom.adminCameraToggle) {
    dom.adminCameraToggle.classList.toggle("is-off", !enabled);
    dom.adminCameraToggle.setAttribute("aria-pressed", String(!enabled));
    dom.adminCameraToggle.title = enabled ? "Kamera deaktivieren" : "Kamera aktivieren";
  }
  const localButtons = dom.playersArea?.querySelectorAll('[data-camera-indicator="local"]') ?? [];
  localButtons.forEach((button) => {
    button.classList.toggle("is-off", !enabled);
    button.setAttribute("aria-pressed", String(!enabled));
    button.title = enabled ? "Kamera deaktivieren" : "Kamera aktivieren";
  });
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
