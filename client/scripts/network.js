import { SESSION_STORAGE_KEY } from "./state.js";

export function initNetwork(store) {
  let socket = null;
  const wsUrl = `${window.location.origin.replace(/^http/, "ws")}/ws`;
  const messageHandlers = new Map();

  function connect(name) {
    cleanupSocket();
    store.update((state) => {
      state.client.connectionStatus = "connecting";
      state.client.name = name;
      state.ui.showNamePrompt = false;
      state.ui.error = null;
    });
    store.persistName(name);
    socket = new WebSocket(wsUrl);
    socket.addEventListener("open", () => {
      send({
        type: "join",
        role: store.data.client.role,
        name,
        sessionId: store.data.client.sessionId
      });
    });
    socket.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data);
      handleMessage(payload);
    });
    socket.addEventListener("close", () => {
      store.update((state) => {
        state.client.connectionStatus = "disconnected";
        state.client.joined = false;
      });
    });
    socket.addEventListener("error", () => {
      store.update((state) => {
        state.ui.error = "Verbindung fehlgeschlagen";
      });
    });
  }

  function cleanupSocket() {
    if (socket && socket.readyState <= 1) {
      socket.close();
    }
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
          state.ui.error = translateError(message.message);
        });
        break;
      default:
        if (!emitMessage(message.type, message)) {
          console.warn("Unknown message", message);
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
        gameFinished: payload.gameFinished
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
