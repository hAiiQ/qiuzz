import { MAX_PLAYERS, TIMER_SECONDS, rounds } from "./questions.js";

const HALF_PENALTY = 0.5;

export function createGameState() {
  const questionStatus = {};
  rounds.forEach((round, roundIndex) => {
    round.categories.forEach((category) => {
      category.questions.forEach((question) => {
        questionStatus[question.id] = {
          asked: false,
          roundIndex,
          categoryId: category.id
        };
      });
    });
  });

  return {
    adminProfile: {
      id: null,
      name: "Admin",
      connected: false
    },
    rounds,
    questionStatus,
    currentRoundIndex: 0,
    playerSlots: Array.from({ length: MAX_PLAYERS }, () => null),
    turnSlotIndex: 0,
    activeQuestion: null
  };
}

export function handleJoin(state, { sessionId, role, name }) {
  if (!sessionId) {
    return { accepted: false, reason: "missing-session" };
  }

  if (role === "admin") {
    if (state.adminProfile.connected && state.adminProfile.id && state.adminProfile.id !== sessionId) {
      return { accepted: false, reason: "admin-exists" };
    }
    state.adminProfile.id = sessionId;
    state.adminProfile.connected = true;
    if (name) {
      state.adminProfile.name = name;
    }
    return {
      accepted: true,
      role: "admin",
      sessionId,
      admin: {
        name: state.adminProfile.name
      }
    };
  }

  const existingSlot = findSlotById(state, sessionId);
  if (existingSlot !== null) {
    const player = state.playerSlots[existingSlot];
    player.name = name || player.name;
    player.connected = true;
    return {
      accepted: true,
      role: "player",
      sessionId,
      slotIndex: existingSlot,
      player
    };
  }

  const freeSlot = state.playerSlots.findIndex((slot) => slot === null);
  if (freeSlot === -1) {
    return { accepted: false, reason: "players-full" };
  }

  state.playerSlots[freeSlot] = {
    id: sessionId,
    slotIndex: freeSlot,
    name: name || `Spieler ${freeSlot + 1}`,
    score: 0,
    connected: true
  };

  ensureTurnIndexValid(state);

  return {
    accepted: true,
    role: "player",
    sessionId,
    slotIndex: freeSlot,
    player: state.playerSlots[freeSlot]
  };
}

export function handleDisconnect(state, sessionId) {
  if (state.adminProfile.id === sessionId) {
    state.adminProfile.id = null;
    state.adminProfile.connected = false;
  }

  const slot = findSlotById(state, sessionId);
  if (slot !== null) {
    const player = state.playerSlots[slot];
    if (player) {
      player.connected = false;
    }
  }

  if (
    state.activeQuestion &&
    state.activeQuestion.currentResponderSlot !== null &&
    state.playerSlots[state.activeQuestion.currentResponderSlot]?.id === sessionId
  ) {
    // Treat disconnect as incorrect answer
    applyIncorrectAnswer(state, state.activeQuestion.currentResponderSlot);
  }

  ensureTurnIndexValid(state);
}

export function handleAdminSelectQuestion(state, questionId) {
  if (state.activeQuestion) {
    return { ok: false, reason: "question-already-active" };
  }

  const questionMeta = state.questionStatus[questionId];
  if (!questionMeta) {
    return { ok: false, reason: "unknown-question" };
  }

  if (questionMeta.roundIndex !== state.currentRoundIndex) {
    return { ok: false, reason: "wrong-round" };
  }

  if (questionMeta.asked) {
    return { ok: false, reason: "question-used" };
  }

  const round = state.rounds[state.currentRoundIndex];
  const category = round.categories.find((cat) => cat.id === questionMeta.categoryId);
  const question = category.questions.find((q) => q.id === questionId);
  const currentSlot = getCurrentTurnSlot(state);
  if (currentSlot === null) {
    return { ok: false, reason: "no-active-player" };
  }

  state.activeQuestion = {
    id: question.id,
    categoryId: category.id,
    prompt: question.prompt,
    answer: question.answer,
    value: question.value,
    roundIndex: state.currentRoundIndex,
    status: "answering",
    currentResponderSlot: currentSlot,
    attemptedSlots: new Set(),
    timerExpiresAt: Date.now() + TIMER_SECONDS * 1000,
    secondsRemaining: TIMER_SECONDS
  };

  return { ok: true, question: state.activeQuestion };
}

export function handleAdminMarkAnswer(state, verdict) {
  if (!state.activeQuestion || state.activeQuestion.currentResponderSlot === null) {
    return { ok: false, reason: "no-responder" };
  }

  if (verdict === "correct") {
    awardPoints(state, state.activeQuestion.currentResponderSlot, state.activeQuestion.value);
    finalizeQuestion(state);
    return { ok: true };
  }

  if (verdict === "incorrect") {
    applyIncorrectAnswer(state, state.activeQuestion.currentResponderSlot);
    return { ok: true };
  }

  return { ok: false, reason: "unknown-verdict" };
}

export function handleAdminCloseQuestion(state) {
  if (!state.activeQuestion) {
    return { ok: false };
  }
  finalizeQuestion(state, { advanceTurn: true, markAsked: true });
  return { ok: true };
}

export function handleReset(state, options = {}) {
  const { dropPlayers = false } = options;
  const fresh = createGameState();
  state.questionStatus = fresh.questionStatus;
  state.currentRoundIndex = fresh.currentRoundIndex;
  state.turnSlotIndex = fresh.turnSlotIndex;
  state.activeQuestion = null;
  const removedSessions = [];

  if (dropPlayers) {
    state.playerSlots.forEach((player) => {
      if (player?.id) {
        removedSessions.push(player.id);
      }
    });
    state.playerSlots = Array.from({ length: MAX_PLAYERS }, () => null);
  } else {
    for (let i = 0; i < MAX_PLAYERS; i += 1) {
      if (state.playerSlots[i]) {
        state.playerSlots[i].score = 0;
      }
    }
  }

  ensureTurnIndexValid(state);
  return { removedSessions };
}

export function handleAdminRemovePlayer(state, slotIndex) {
  if (typeof slotIndex !== "number" || slotIndex < 0 || slotIndex >= MAX_PLAYERS) {
    return { ok: false, reason: "invalid-slot" };
  }
  const player = state.playerSlots[slotIndex];
  if (!player) {
    return { ok: false, reason: "slot-empty" };
  }

  if (state.activeQuestion) {
    if (state.activeQuestion.currentResponderSlot === slotIndex) {
      applyIncorrectAnswer(state, slotIndex);
    }
    state.activeQuestion.attemptedSlots.add(slotIndex);
    if (state.activeQuestion.status === "awaiting_buzz") {
      const remaining = availableBuzzers(state);
      if (remaining.length === 0) {
        finalizeQuestion(state);
      }
    }
  }

  state.playerSlots[slotIndex] = null;
  if (state.turnSlotIndex === slotIndex) {
    advanceTurnSlot(state);
  }
  ensureTurnIndexValid(state);

  return { ok: true, removedSessionId: player.id };
}

export function handleBuzzer(state, sessionId) {
  if (!state.activeQuestion || state.activeQuestion.status !== "awaiting_buzz") {
    return { ok: false, reason: "buzz-closed" };
  }

  const slot = findSlotById(state, sessionId);
  if (slot === null) {
    return { ok: false, reason: "not-player" };
  }

  if (state.activeQuestion.attemptedSlots.has(slot)) {
    return { ok: false, reason: "already-tried" };
  }

  const player = state.playerSlots[slot];
  if (!player || !player.connected) {
    return { ok: false, reason: "player-offline" };
  }

  state.activeQuestion.status = "answering";
  state.activeQuestion.currentResponderSlot = slot;
  state.activeQuestion.timerExpiresAt = Date.now() + TIMER_SECONDS * 1000;
  state.activeQuestion.secondsRemaining = TIMER_SECONDS;
  return { ok: true };
}

export function updateTimers(state, now = Date.now()) {
  if (!state.activeQuestion || !state.activeQuestion.timerExpiresAt) {
    return { changed: false, needsPersist: false };
  }

  const msRemaining = state.activeQuestion.timerExpiresAt - now;
  const seconds = Math.max(0, Math.ceil(msRemaining / 1000));
  let changed = false;
  let needsPersist = false;
  if (seconds !== state.activeQuestion.secondsRemaining) {
    state.activeQuestion.secondsRemaining = seconds;
    changed = true;
  }

  if (msRemaining <= 0) {
    applyIncorrectAnswer(state, state.activeQuestion.currentResponderSlot);
    changed = true;
    needsPersist = true;
  }

  return { changed, needsPersist };
}

export function serializeState(state, { includeAnswer = false } = {}) {
  const round = state.rounds[state.currentRoundIndex];
  const categories = round.categories.map((category) => ({
    id: category.id,
    title: category.title,
    questions: category.questions.map((question) => ({
      id: question.id,
      value: question.value,
      asked: state.questionStatus[question.id].asked,
      active: state.activeQuestion?.id === question.id
    }))
  }));

  const players = state.playerSlots.map((player, index) => {
    if (!player) {
      return {
        slotIndex: index,
        sessionId: null,
        name: `Slot ${index + 1}`,
        score: 0,
        connected: false,
        isTurn: false,
        isAnswering: false
      };
    }
    return {
      slotIndex: index,
      sessionId: player.id,
      name: player.name,
      score: player.score,
      connected: player.connected,
      isTurn: index === state.turnSlotIndex,
      isAnswering: state.activeQuestion?.currentResponderSlot === index
    };
  });

  const buzzableSlots = state.activeQuestion ? availableBuzzers(state) : [];
  const activeQuestion = state.activeQuestion
    ? {
        id: state.activeQuestion.id,
        categoryId: state.activeQuestion.categoryId,
        prompt: state.activeQuestion.prompt,
        value: state.activeQuestion.value,
        status: state.activeQuestion.status,
        respondingSlot: state.activeQuestion.currentResponderSlot,
        secondsRemaining: state.activeQuestion.secondsRemaining,
        attemptedSlots: Array.from(state.activeQuestion.attemptedSlots),
        buzzableSlots,
        answer: includeAnswer ? state.activeQuestion.answer : undefined
      }
    : null;

  return {
    roundNumber: state.currentRoundIndex + 1,
    roundTitle: round.title,
    totalRounds: state.rounds.length,
    admin: {
      sessionId: state.adminProfile.id,
      name: state.adminProfile.name,
      connected: state.adminProfile.connected
    },
    categories,
    players,
    activeQuestion,
    timerSeconds: activeQuestion?.secondsRemaining ?? TIMER_SECONDS,
    nextRoundReady: isRoundComplete(state) && state.currentRoundIndex + 1 < state.rounds.length,
    gameFinished: isGameComplete(state)
  };
}

export function getAdminAnswer(state) {
  if (!state.activeQuestion) {
    return null;
  }
  return {
    questionId: state.activeQuestion.id,
    prompt: state.activeQuestion.prompt,
    answer: state.activeQuestion.answer,
    value: state.activeQuestion.value
  };
}

function findSlotById(state, sessionId) {
  const slotIndex = state.playerSlots.findIndex((player) => player?.id === sessionId);
  return slotIndex === -1 ? null : slotIndex;
}

function getCurrentTurnSlot(state) {
  ensureTurnIndexValid(state);
  const player = state.playerSlots[state.turnSlotIndex];
  return player && player.connected ? state.turnSlotIndex : null;
}

function ensureTurnIndexValid(state) {
  if (!state.playerSlots[state.turnSlotIndex]?.connected) {
    const next = findNextConnectedSlot(state, state.turnSlotIndex);
    if (next !== null) {
      state.turnSlotIndex = next;
    }
  }
}

function findNextConnectedSlot(state, startIndex) {
  for (let i = 0; i < MAX_PLAYERS; i += 1) {
    const idx = (startIndex + i) % MAX_PLAYERS;
    const player = state.playerSlots[idx];
    if (player && player.connected) {
      return idx;
    }
  }
  return null;
}

function awardPoints(state, slotIndex, amount) {
  const player = state.playerSlots[slotIndex];
  if (!player) return;
  player.score += amount;
}

function deductPoints(state, slotIndex, amount) {
  const player = state.playerSlots[slotIndex];
  if (!player) return;
  player.score -= amount;
}

function applyIncorrectAnswer(state, slotIndex) {
  if (!state.activeQuestion) {
    return;
  }
  if (slotIndex === null || slotIndex === undefined) {
    return;
  }
  const penalty = Math.floor(state.activeQuestion.value * HALF_PENALTY);
  deductPoints(state, slotIndex, penalty);
  state.activeQuestion.attemptedSlots.add(slotIndex);
  const remainingSlots = availableBuzzers(state);
  if (remainingSlots.length === 0) {
    finalizeQuestion(state);
    return;
  }
  state.activeQuestion.currentResponderSlot = null;
  state.activeQuestion.status = "awaiting_buzz";
  state.activeQuestion.timerExpiresAt = null;
  state.activeQuestion.secondsRemaining = TIMER_SECONDS;
}

function availableBuzzers(state) {
  if (!state.activeQuestion) return [];
  return state.playerSlots
    .map((player, index) => ({ player, index }))
    .filter(
      ({ player, index }) =>
        player &&
        player.connected &&
        !state.activeQuestion.attemptedSlots.has(index) &&
        state.activeQuestion.currentResponderSlot !== index
    )
    .map(({ index }) => index);
}

function finalizeQuestion(state, options = { advanceTurn: true, markAsked: true }) {
  const { advanceTurn, markAsked } = options;
  if (state.activeQuestion && markAsked) {
    state.questionStatus[state.activeQuestion.id].asked = true;
  }
  state.activeQuestion = null;
  if (advanceTurn) {
    advanceTurnSlot(state);
  }
  if (isRoundComplete(state)) {
    progressToNextRound(state);
  }
}

function advanceTurnSlot(state) {
  const next = findNextConnectedSlot(state, state.turnSlotIndex + 1);
  if (next !== null) {
    state.turnSlotIndex = next;
  }
}

function isRoundComplete(state) {
  const round = state.rounds[state.currentRoundIndex];
  return round.categories.every((category) =>
    category.questions.every((question) => state.questionStatus[question.id].asked)
  );
}

function progressToNextRound(state) {
  if (state.currentRoundIndex + 1 >= state.rounds.length) {
    return;
  }
  state.currentRoundIndex += 1;
  state.turnSlotIndex = findNextConnectedSlot(state, state.turnSlotIndex) ?? 0;
}

function isGameComplete(state) {
  return state.currentRoundIndex === state.rounds.length - 1 && isRoundComplete(state);
}
