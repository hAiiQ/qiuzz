const VERDICT_FLASH_DURATION = 3000;
const SOUND_VOLUME = 0.4;
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
const soundState = {
  buzzer: null,
  verdictCorrect: null,
  verdictIncorrect: null,
  verdictClosed: null,
  lastBuzzerQuestionId: null,
  lastBuzzerResponderSlot: null,
  lastVerdictToken: null,
  unlocked: false
};

export function initUI({ appEl, state, network, camera }) {
  const dom = buildLayout(appEl, state.data.client.role);
  let adminWindow = null;
  preloadSounds();

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

  if (dom.restoreGameButton) {
    dom.restoreGameButton.addEventListener("click", () => {
      if (state.data.client.role !== "admin") {
        return;
      }
      const snapshot = state.loadSnapshot?.();
      if (!snapshot) {
        state.update((data) => {
          data.ui.error = "Kein gespeicherter Spielstand gefunden.";
        });
        return;
      }
      if (!window.confirm("Gespeicherten Spielstand wiederherstellen? Aktuelle Partie wird ueberschrieben.")) {
        return;
      }
      network.sendAction({ type: "admin:restoreSnapshot", snapshot });
    });
  }

  appEl.addEventListener("click", (event) => {
    const trigger =
      event.target instanceof HTMLElement
        ? event.target.closest('[data-role="question-media-trigger"]')
        : null;
    if (!(trigger instanceof HTMLElement)) {
      return;
    }
    const src = trigger.getAttribute("data-media-src");
    if (src) {
      openMediaLightbox(dom, src);
    }
  });

  if (dom.mediaLightbox) {
    dom.mediaLightbox.addEventListener("click", (event) => {
      if (event.target === dom.mediaLightbox) {
        closeMediaLightbox(dom);
      }
    });
  }
  if (dom.mediaLightboxClose) {
    dom.mediaLightboxClose.addEventListener("click", () => closeMediaLightbox(dom));
  }
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMediaLightbox(dom);
    }
  });

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
            <button data-action="restore-game" type="button" hidden>Spielstand wiederherstellen</button>
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
    <div class="media-lightbox" data-role="media-lightbox" hidden>
      <button type="button" class="media-lightbox__close" data-role="media-lightbox-close" aria-label="Bild schließen">×</button>
      <img data-role="media-lightbox-image" alt="Fragebild vergrößert" />
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
    restoreGameButton: appEl.querySelector('[data-action="restore-game"]'),
    playerControls: appEl.querySelector('[data-role="player-controls"]'),
    adminNameOverlay: appEl.querySelector('[data-role="admin-name-overlay"]'),
    buzzerButton: appEl.querySelector('#buzzer-button'),
    buzzerPad: appEl.querySelector('[data-role="buzzer-pad"]'),
    buzzerStatus: appEl.querySelector('[data-role="buzzer-status"]'),
    nameModal: appEl.querySelector('[data-role="name-modal"]'),
    nameForm: appEl.querySelector('.name-form'),
    nameInput: appEl.querySelector('.name-form input'),
    toast: appEl.querySelector('[data-role="toast"]'),
    mediaLightbox: appEl.querySelector('[data-role="media-lightbox"]'),
    mediaLightboxImage: appEl.querySelector('[data-role="media-lightbox-image"]'),
    mediaLightboxClose: appEl.querySelector('[data-role="media-lightbox-close"]')
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
  maybePlayBuzzerSound(active);
  const answer = data.ui.adminAnswer;
  const prompt = escapeHtml(answer?.prompt || active?.prompt || "Noch keine aktive Frage.");
  const response = escapeHtml(answer?.answer || "–");
  const imageMarkup = renderQuestionMedia(answer?.image || active?.image, { interactive: false });
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
      .question-media {
        margin: 0.75rem 0;
        display: flex;
        justify-content: center;
      }
      .question-media__image {
        width: 100%;
        max-width: 360px;
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(0, 0, 0, 0.25);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
      }
      .question-media__image img {
        display: block;
        width: 100%;
        height: auto;
        object-fit: cover;
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
      .question-media {
        margin: 0.75rem 0;
        display: flex;
        justify-content: center;
      }
      .question-media__image {
        width: min(320px, 90%);
        height: 200px;
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(0, 0, 0, 0.25);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
      }
      .question-media__image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
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
        ${imageMarkup}
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
  dom.timerChip.textContent = `${data.game.activeQuestion?.secondsRemaining ?? data.game.timerSeconds ?? 30}s`;
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
  const overlayTimerValue = active?.secondsRemaining ?? data.game.timerSeconds ?? 30;
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
  const activeImageMarkup = renderQuestionMedia(active?.image);
  const activePromptMarkup = renderPromptMarkup(active?.prompt, Boolean(active?.image));
  const verdictImageMarkup = verdictFlash ? renderQuestionMedia(verdictFlash.image) : "";
  const verdictPromptMarkup = verdictFlash
    ? renderPromptMarkup(verdictFlash.prompt, Boolean(verdictFlash.image))
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
      <div class="timer-chip timer-chip--overlay">${overlayTimerValue}s</div>
      <div class="${classes.join(" ")}">
        <p class="question-overlay__value">${active.value} Punkte · ${statusLabel}</p>
        ${verdictBadge}
        ${activeImageMarkup}
        ${activePromptMarkup}
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
        ${verdictImageMarkup}
        ${verdictPromptMarkup}
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

function renderQuestionMedia(imageSrc, options = {}) {
  if (!imageSrc) {
    return "";
  }
  const { interactive = true } = options;
  const safeSrc = escapeHtml(imageSrc);
  if (interactive) {
    return `
      <div class="question-media">
        <button type="button" class="question-media__image question-media__image--button" data-role="question-media-trigger" data-media-src="${safeSrc}" aria-label="Bild vergrößern">
          <img src="${safeSrc}" alt="Fragebild" loading="lazy" />
          <span class="question-media__hint">Zum Vergrößern klicken</span>
        </button>
      </div>
    `;
  }
  return `
    <div class="question-media">
      <div class="question-media__image">
        <img src="${safeSrc}" alt="Fragebild" loading="lazy" />
      </div>
    </div>
  `;
}

function renderPromptMarkup(prompt, hasImage) {
  if (hasImage) {
    return '<p class="question-overlay__notice">Bildfrage – zum Vergrößern klicken</p>';
  }
  if (!prompt) {
    return "";
  }
  return `<h3 class="question-overlay__prompt">${escapeHtml(prompt)}</h3>`;
}

function openMediaLightbox(dom, src) {
  if (!dom.mediaLightbox || !dom.mediaLightboxImage) {
    return;
  }
  dom.mediaLightboxImage.src = src;
  dom.mediaLightbox.hidden = false;
  dom.mediaLightbox.classList.add("is-visible");
  document.body.classList.add("media-lightbox-open");
}

function closeMediaLightbox(dom) {
  if (!dom.mediaLightbox || !dom.mediaLightboxImage) {
    return;
  }
  dom.mediaLightbox.classList.remove("is-visible");
  dom.mediaLightboxImage.src = "";
  dom.mediaLightbox.hidden = true;
  document.body.classList.remove("media-lightbox-open");
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
  if (dom.restoreGameButton) {
    dom.restoreGameButton.hidden = !data.ui.snapshotAvailable;
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
  playVerdictSound(verdict);
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

function preloadSounds() {
  soundState.buzzer = createSound("./assets/sounds/buzzer.mp3");
  soundState.verdictCorrect = createSound("./assets/sounds/richtig.mp3");
  soundState.verdictIncorrect = createSound("./assets/sounds/falsch.mp3");
  soundState.verdictClosed = createSound("./assets/sounds/closed.mp3");
  setupSoundUnlock();
}

function createSound(src) {
  if (!window.Audio) return null;
  const audio = new Audio(src);
  audio.preload = "auto";
  audio.volume = SOUND_VOLUME;
  audio.load();
  return audio;
}

function playSound(instance) {
  if (!instance) return;
  if (!soundState.unlocked) {
    return;
  }
  const node = instance.cloneNode();
  node.volume = SOUND_VOLUME;
  node.play().catch(() => {
    /* Benutzerinteraktion erforderlich */
  });
}

function maybePlayBuzzerSound(activeQuestion) {
  if (!activeQuestion || activeQuestion.status !== "answering") {
    return;
  }
  const responderSlot =
    typeof activeQuestion.respondingSlot === "number"
      ? activeQuestion.respondingSlot
      : typeof activeQuestion.currentResponderSlot === "number"
        ? activeQuestion.currentResponderSlot
        : null;
  if (
    soundState.lastBuzzerQuestionId === activeQuestion.id &&
    soundState.lastBuzzerResponderSlot === responderSlot
  ) {
    return;
  }
  soundState.lastBuzzerQuestionId = activeQuestion.id;
  soundState.lastBuzzerResponderSlot = responderSlot;
  playSound(soundState.buzzer);
}

function setupSoundUnlock() {
  const handler = () => {
    soundState.unlocked = true;
    unlockSounds();
    window.removeEventListener("pointerdown", handler);
    window.removeEventListener("keydown", handler);
  };
  window.addEventListener("pointerdown", handler, { once: true });
  window.addEventListener("keydown", handler, { once: true });
}

function unlockSounds() {
  const sounds = [
    soundState.buzzer,
    soundState.verdictCorrect,
    soundState.verdictIncorrect,
    soundState.verdictClosed
  ].filter(Boolean);
  if (sounds.length === 0) {
    soundState.unlocked = true;
    return;
  }
  sounds.forEach((audio) => {
    const previousVolume = audio.volume;
    audio.volume = 0;
    const playPromise = audio.play();
    if (playPromise?.then) {
      playPromise
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = previousVolume;
          soundState.unlocked = true;
        })
        .catch(() => {
          audio.volume = previousVolume;
        });
    } else {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = previousVolume;
      soundState.unlocked = true;
    }
  });
}

function playVerdictSound(verdict) {
  if (!verdict) return;
  if (soundState.lastVerdictToken === verdict.token) {
    return;
  }
  soundState.lastVerdictToken = verdict.token;
  if (verdict.verdict === "correct") {
    playSound(soundState.verdictCorrect);
  } else if (verdict.verdict === "incorrect") {
    playSound(soundState.verdictIncorrect);
  } else if (verdict.verdict === "closed") {
    playSound(soundState.verdictClosed);
  }
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
