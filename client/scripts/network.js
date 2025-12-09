import { SESSION_STORAGE_KEY } from "./state.js";

export function initNetwork(store) {
  let socket = null;
  let desiredName = "";
  let shouldReconnect = false;
  let reconnectTimeout = null;
  let reconnectDelay = 2000;
  const MAX_RECONNECT_DELAY = 15000;
  let closingForReconnect = false;
  const wsUrl = `${window.location.origin.replace(/^http/, "ws")}/ws`;
  const messageHandlers = new Map();

  function connect(name) {
    desiredName = name;
    shouldReconnect = true;
    reconnectDelay = 2000;
    window.clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
    store.persistName(name);
    openSocket();
  }

  function openSocket() {
    if (!desiredName) {
      return;
    }
    if (socket && socket.readyState <= 1) {
      closingForReconnect = true;
      socket.close();
    }
    store.update((state) => {
      state.client.connectionStatus = "connecting";
      state.client.name = desiredName;
      state.ui.showNamePrompt = false;
      state.ui.error = null;
    });
    socket = new WebSocket(wsUrl);
    socket.addEventListener("open", () => {
      closingForReconnect = false;
      reconnectDelay = 2000;
      send({
        type: "join",
        role: store.data.client.role,
        name: desiredName,
        sessionId: store.data.client.sessionId
      });
    });
    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      handleMessage(payload);
    });
    socket.addEventListener("close", () => {
      if (closingForReconnect) {
        closingForReconnect = false;
        return;
      }
      store.update((state) => {
        state.client.connectionStatus = "disconnected";
        state.client.joined = false;
      });
      scheduleReconnect();
    });
    socket.addEventListener("error", () => {
      store.update((state) => {
        state.ui.error = "Verbindung fehlgeschlagen";
      });
    });
  }

  function scheduleReconnect() {
    if (!shouldReconnect || reconnectTimeout) {
      return;
    }
    reconnectTimeout = window.setTimeout(() => {
      reconnectTimeout = null;
      openSocket();
      reconnectDelay = Math.min(MAX_RECONNECT_DELAY, reconnectDelay * 1.5);
    }, reconnectDelay);
  }

  function handleMessage(message) {
    switch (message.type) {
      case "joined":
        store.update((state) => {
          state.client.connectionStatus = "online";
          state.client.joined = true;
          state.client.sessionId = message.sessionId;
          state.client.slotIndex = message.slotIndex ?? null;
          state.ui.showNamePrompt = false;
        });
        if (message.sessionId) {
          window.localStorage.setItem(SESSION_STORAGE_KEY, message.sessionId);
        }
        break;
      case "state":
        applyGameState(message.payload);
        break;
      case "error":
        store.update((state) => {
          state.ui.error = translateError(message.reason);
        });
        break;
      case "kicked":
        store.update((state) => {
        shouldReconnect = false;
        desiredName = "";
        window.clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
        cleanupSocket();
          state.client.slotIndex = null;
          state.client.connectionStatus = "disconnected";
          state.ui.showNamePrompt = true;
          state.ui.error = message.reason === "reset"
            ? "Spiel wurde zurückgesetzt. Bitte erneut verbinden."
            : "Der Admin hat dich entfernt.";
        });
        cleanupSocket();
        function cleanupSocket() {
          if (socket && socket.readyState <= 1) {
            socket.close();
          }
          socket = null;
        }
        return;
    }
    emitMessage(message.type, message);
  }

  function applyGameState(payload) {
    store.update((state) => {
      state.game = {
        roundNumber: payload.roundNumber,
        roundTitle: payload.roundTitle,
        totalRounds: payload.totalRounds,
        categories: payload.categories,
        players: payload.players,
        admin: payload.admin,
        activeQuestion: payload.activeQuestion,
        timerSeconds: payload.timerSeconds,
        nextRoundReady: payload.nextRoundReady,
        gameFinished: payload.gameFinished,
        lastVerdict: payload.lastVerdict ?? null
      };
      state.ui.adminAnswer = payload.activeQuestion?.answer
        ? {
            questionId: payload.activeQuestion.id,
            prompt: payload.activeQuestion.prompt,
            answer: payload.activeQuestion.answer,
            value: payload.activeQuestion.value
          }
        : null;
    });
  }

  function translateError(code) {
    switch (code) {
      case "players-full":
        return "Alle vier Spielerslots sind bereits belegt.";
      case "admin-exists":
        return "Der Admin ist bereits verbunden.";
      case "question-used":
        return "Diese Frage wurde bereits gespielt.";
      default:
        return "Aktion konnte nicht ausgeführt werden.";
    }
  }

  function send(event) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(event));
    }
  }

  function onMessage(type, handler) {
    if (!messageHandlers.has(type)) {
      messageHandlers.set(type, new Set());
    }
    const handlers = messageHandlers.get(type);
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        messageHandlers.delete(type);
      }
    };
  }

  function emitMessage(type, payload) {
    const handlers = messageHandlers.get(type);
    if (!handlers || handlers.size === 0) {
      return false;
    }
    handlers.forEach((handler) => handler(payload));
    return true;
  }

  return {
    connect,
    sendAction: send,
    onMessage,
    sendSignal(targetSessionId, payload) {
      send({ type: "signal:relay", targetSessionId, payload });
    },
    sendBuzzer() {
      send({ type: "buzzer" });
    }
  };
}
