const VERDICT_FLASH_DURATION = 3000;
const verdictFlashState = {
  token: 0,
  visible: false,
  verdict: null,
  timeoutId: null,
  dom: null,
  data: null
};
const playersRenderState = {
  cards: new Map()
};

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

  if (dom.buzzerPad) {
    dom.buzzerPad.addEventListener("click", (event) => {
      if (dom.buzzerButton.disabled) {
        return;
      }
      if (event.target instanceof HTMLElement && event.target.closest("button")) {
        return;
      }
      dom.buzzerButton.focus();
      dom.buzzerButton.click();
    });
  }

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
  });

  if (dom.boardGrid) {
    dom.boardGrid.addEventListener("click", (event) => {
      if (state.data.client.role !== "admin") {
        return;
      }
      const button =
        event.target instanceof HTMLElement
          ? event.target.closest("button[data-question-id]")
          : null;
      if (!(button instanceof HTMLButtonElement) || button.disabled) {
        return;
      }
      const questionId = button.getAttribute("data-question-id");
      if (!questionId) {
        return;
      }
      network.sendAction({ type: "admin:selectQuestion", questionId });
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
    renderQuestionOverlay(dom, data);
    renderPlayers(dom, data);
    renderAdminCard(dom, data);
    renderAdminControlsState(dom, data);
    renderBuzzer(dom, data);
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
            <span class="video-placeholder">Admin Kamera</span>
            <div class="player-meta">
              <span class="player-meta__name" data-role="admin-name-overlay">Admin</span>
              <span class="player-meta__score">Moderator</span>
            </div>
          </div>
        </div>
        <div class="admin-controls" data-role="admin-controls">
          <h2>Admin Bedienung</h2>
          <p class="admin-controls__hint">Öffne das Popup, um Fragen zu steuern und Antworten zu sehen.</p>
          <div class="controls-grid">
            <button data-action="open-admin-window">Admin-Fenster öffnen</button>
          </div>
        </div>
        <div class="player-controls" data-role="player-controls" hidden>
          <div class="neon-buzzer" data-role="buzzer-pad">
            <button id="buzzer-button" type="button" aria-label="Buzzern">
              <span class="neon-buzzer__text">BUZZER</span>
            </button>
            <div class="neon-buzzer__halo"></div>
            <div class="neon-buzzer__label" data-role="buzzer-status">Warte auf Freigabe...</div>
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
        <div class="question-overlay" data-role="question-overlay" hidden></div>
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
    questionOverlay: appEl.querySelector('[data-role="question-overlay"]'),
    playersArea: appEl.querySelector('[data-role="players"]'),
    turnIndicator: appEl.querySelector('[data-role="turn-indicator"]'),
    timerChip: appEl.querySelector('[data-role="timer"]'),
    roundLabel: appEl.querySelector('[data-role="round-label"]'),
    adminControls: appEl.querySelector('[data-role="admin-controls"]'),
    adminWindowButton: appEl.querySelector('[data-action="open-admin-window"]'),
    playerControls: appEl.querySelector('[data-role="player-controls"]'),
    adminNameOverlay: appEl.querySelector('[data-role="admin-name-overlay"]'),
    buzzerButton: appEl.querySelector('#buzzer-button'),
    buzzerPad: appEl.querySelector('[data-role="buzzer-pad"]'),
    buzzerStatus: appEl.querySelector('[data-role="buzzer-status"]'),
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
  const admin = data.game.admin;
  const localName = data.client.role === "admin" && data.client.name ? data.client.name : null;
  const displayName = localName || admin?.name || "Admin";
  if (dom.adminNameOverlay) {
    dom.adminNameOverlay.textContent = displayName;
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
}

function renderQuestionOverlay(dom, data) {
  const overlay = dom.questionOverlay;
  if (!overlay) return;
  verdictFlashState.dom = dom;
  verdictFlashState.data = data;

  const active = data.game.activeQuestion;
  updateVerdictFlash(data.game.lastVerdict);
  const verdictFlash = verdictFlashState.visible ? verdictFlashState.verdict : null;
  const verdictClass = verdictFlash ? getVerdictClass(verdictFlash.verdict) : "";
  overlay.dataset.verdict = verdictFlash?.verdict ?? "";
  const verdictBadge = verdictFlash
    ? `<span class="question-overlay__badge question-overlay__badge--${verdictFlash.verdict}">${getVerdictLabel(
        verdictFlash.verdict
      )}</span>`
    : "";
  const shouldRevealAnswer = verdictFlash && ["correct", "closed"].includes(verdictFlash.verdict);
  const verdictAnswer = shouldRevealAnswer && verdictFlash?.answer
    ? `<p class="question-overlay__answer"><span>Antwort:</span> ${escapeHtml(verdictFlash.answer)}</p>`
    : "";

  if (active) {
    const statusLabel =
      active.status === "awaiting_buzz"
        ? "Buzzern erlaubt"
        : active.status === "answering"
          ? "Antwort wird geprüft"
          : "Frage aktiv";
    const classes = ["question-overlay__card"];
    if (verdictClass) {
      classes.push(verdictClass);
    }
    overlay.hidden = false;
    overlay.classList.add("is-visible");
    overlay.innerHTML = `
      <div class="${classes.join(" ")}">
        <p class="question-overlay__value">${active.value} Punkte · ${statusLabel}</p>
        ${verdictBadge}
        <h3 class="question-overlay__prompt">${escapeHtml(active.prompt)}</h3>
        ${verdictAnswer}
      </div>
    `;
    return;
  }

  if (verdictFlash) {
    const classes = ["question-overlay__card"];
    if (verdictClass) {
      classes.push(verdictClass);
    }
    overlay.hidden = false;
    overlay.classList.add("is-visible");
    overlay.innerHTML = `
      <div class="${classes.join(" ")}">
        <p class="question-overlay__value">${verdictFlash.value} Punkte</p>
        ${verdictBadge}
        <h3 class="question-overlay__prompt">${escapeHtml(verdictFlash.prompt)}</h3>
        ${verdictAnswer}
      </div>
    `;
    return;
  }

  if (data.game.gameFinished || data.game.nextRoundReady) {
    const message = data.game.gameFinished
      ? "Spiel beendet. Admin kann neu starten."
      : "Runde erledigt! Admin startet gleich die nächste Runde.";
    overlay.hidden = false;
    overlay.classList.add("is-visible");
    overlay.innerHTML = `
      <div class="question-overlay__card">
        <h3 class="question-overlay__prompt">${message}</h3>
      </div>
    `;
    return;
  }

  overlay.hidden = true;
  overlay.classList.remove("is-visible");
  overlay.innerHTML = "";
}

function renderPlayers(dom, data) {
  const clientSessionId = data.client.sessionId;
  const seenSlots = new Set();

  data.game.players.forEach((player, index) => {
    const cacheEntry = ensurePlayerCard(player.slotIndex, dom.playersArea);
    seenSlots.add(player.slotIndex);
    updatePlayerCard(cacheEntry, player, data, clientSessionId);
    const referenceNode = dom.playersArea.children[index];
    if (referenceNode !== cacheEntry.card) {
      dom.playersArea.insertBefore(cacheEntry.card, referenceNode || null);
    }
  });

  playersRenderState.cards.forEach((entry, slotIndex) => {
    if (!seenSlots.has(slotIndex)) {
      entry.card.remove();
      playersRenderState.cards.delete(slotIndex);
    }
  });
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
  if (dom.buzzerPad) {
    dom.buzzerPad.classList.toggle("is-armed", eligible);
    dom.buzzerPad.classList.toggle("is-disabled", !active);
  }
  if (dom.buzzerStatus) {
    let text = "Nur der Admin kann buzzern.";
    if (client.role === "player") {
      if (!active) {
        text = "Warte auf nächste Frage...";
      } else if (eligible) {
        text = "Jetzt buzzern!";
      } else if (active.status === "answering") {
        text = "Antwort läuft...";
      } else if (active.status === "awaiting_buzz") {
        text = "Nicht freigegeben.";
      } else {
        text = "Warte auf Moderator...";
      }
    }
    dom.buzzerStatus.textContent = text;
  }
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

function updateVerdictFlash(verdict) {
  if (!verdict) {
    stopVerdictFlash();
    return;
  }
  if (verdict.token === verdictFlashState.token) {
    return;
  }
  startVerdictFlash(verdict);
}

function startVerdictFlash(verdict) {
  if (verdictFlashState.timeoutId) {
    window.clearTimeout(verdictFlashState.timeoutId);
  }
  verdictFlashState.token = verdict.token;
  verdictFlashState.verdict = verdict;
  verdictFlashState.visible = true;
  verdictFlashState.timeoutId = window.setTimeout(() => {
    verdictFlashState.visible = false;
    verdictFlashState.verdict = null;
    verdictFlashState.timeoutId = null;
    if (verdictFlashState.dom && verdictFlashState.data) {
      renderQuestionOverlay(verdictFlashState.dom, verdictFlashState.data);
    }
  }, VERDICT_FLASH_DURATION);
}

function stopVerdictFlash() {
  if (verdictFlashState.timeoutId) {
    window.clearTimeout(verdictFlashState.timeoutId);
    verdictFlashState.timeoutId = null;
  }
  verdictFlashState.visible = false;
  verdictFlashState.verdict = null;
}

function getVerdictClass(verdict) {
  if (verdict === "correct") {
    return "question-overlay__card--correct";
  }
  if (verdict === "incorrect") {
    return "question-overlay__card--incorrect";
  }
  return "question-overlay__card--closed";
}

function getVerdictLabel(verdict) {
  if (verdict === "correct") {
    return "Richtige Antwort";
  }
  if (verdict === "incorrect") {
    return "Falsche Antwort";
  }
  return "Frage geschlossen";
}

function ensurePlayerCard(slotIndex, parent) {
  if (!playersRenderState.cards.has(slotIndex)) {
    const entry = createPlayerCard(slotIndex);
    playersRenderState.cards.set(slotIndex, entry);
    parent.appendChild(entry.card);
  }
  return playersRenderState.cards.get(slotIndex);
}

function createPlayerCard(slotIndex) {
  const card = document.createElement("div");
  card.className = "video-card player-card";
  card.dataset.slotIndex = String(slotIndex);

  const videoFeed = document.createElement("div");
  videoFeed.className = "video-feed";
  videoFeed.dataset.slotVideo = String(slotIndex);

  const placeholder = document.createElement("span");
  placeholder.className = "video-placeholder";
  videoFeed.appendChild(placeholder);

  const kickButton = document.createElement("button");
  kickButton.type = "button";
  kickButton.className = "slot-pill";
  kickButton.dataset.action = "slot-kick";
  kickButton.hidden = true;
  kickButton.innerHTML = '<span aria-hidden="true">✖</span>';
  videoFeed.appendChild(kickButton);

  const meta = document.createElement("div");
  meta.className = "player-meta";
  const nameEl = document.createElement("span");
  nameEl.className = "player-meta__name";
  meta.appendChild(nameEl);
  const scoreEl = document.createElement("span");
  scoreEl.className = "player-meta__score";
  meta.appendChild(scoreEl);
  videoFeed.appendChild(meta);

  card.appendChild(videoFeed);

  return {
    card,
    elements: { videoFeed, placeholder, kickButton, nameEl, scoreEl },
    state: {
      slotIndex,
      name: "",
      score: null,
      isTurn: false,
      isAnswering: false,
      connected: false,
      canKick: false
    }
  };
}

function updatePlayerCard(entry, player, data, clientSessionId) {
  const { card, elements } = entry;
  const state = entry.state || (entry.state = {});

  if (state.slotIndex !== player.slotIndex) {
    state.slotIndex = player.slotIndex;
    card.dataset.slotIndex = String(player.slotIndex);
    elements.videoFeed.dataset.slotVideo = String(player.slotIndex);
    if (state.canKick && Number.isInteger(player.slotIndex)) {
      elements.kickButton.dataset.slot = player.slotIndex;
    }
  }

  if (state.name !== player.name) {
    state.name = player.name;
    elements.placeholder.textContent = player.name;
    elements.nameEl.textContent = player.name;
  }

  if (state.score !== player.score) {
    state.score = player.score;
    elements.scoreEl.textContent = `${player.score} Punkte`;
  }

  const respondingSlot = data.game.activeQuestion?.respondingSlot;
  const hasResponder = typeof respondingSlot === "number";
  const isAnswering = hasResponder ? player.slotIndex === respondingSlot : Boolean(player.isAnswering);
  if (state.isAnswering !== isAnswering) {
    state.isAnswering = isAnswering;
    card.classList.toggle("is-answering", isAnswering);
  }
  const isTurn = !isAnswering && Boolean(player.isTurn) && !hasResponder;
  if (state.isTurn !== isTurn) {
    state.isTurn = isTurn;
    card.classList.toggle("is-turn", isTurn);
  }

  const connected = Boolean(player.connected);
  if (state.connected !== connected) {
    state.connected = connected;
    card.classList.toggle("is-offline", !connected);
  }

  const canKick = data.client.role === "admin" && Boolean(player.sessionId);
  if (state.canKick !== canKick) {
    state.canKick = canKick;
    if (canKick && Number.isInteger(player.slotIndex)) {
      elements.kickButton.hidden = false;
      elements.kickButton.dataset.slot = player.slotIndex;
      elements.kickButton.setAttribute("aria-label", "Slot räumen");
    } else {
      elements.kickButton.hidden = true;
      elements.kickButton.removeAttribute("data-slot");
    }
  } else if (canKick && Number.isInteger(player.slotIndex)) {
    elements.kickButton.dataset.slot = player.slotIndex;
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
