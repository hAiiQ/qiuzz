export const SESSION_STORAGE_KEY = "quizduell-session-id";
export const NAME_STORAGE_KEY = "quizduell-display-name";

function ensureSessionId() {
  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }
  const newId = window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  window.localStorage.setItem(SESSION_STORAGE_KEY, newId);
  return newId;
}

export function initState() {
  const searchParams = new URLSearchParams(window.location.search);
  const sessionId = ensureSessionId();
  const storedName = window.localStorage.getItem(NAME_STORAGE_KEY) || "";
  const roleParam = searchParams.get("role");
  const role = roleParam === "admin" ? "admin" : "player";

  const data = {
    client: {
      role,
      sessionId,
      name: storedName,
      slotIndex: null,
      joined: false,
      connectionStatus: "idle"
    },
    game: {
      roundNumber: 1,
      roundTitle: "Runde 1",
      totalRounds: 2,
      categories: [],
      players: [],
      admin: {
        sessionId: null,
        name: "Admin",
        connected: false
      },
      activeQuestion: null,
      timerSeconds: 30,
      nextRoundReady: false,
      gameFinished: false
    },
    ui: {
      showNamePrompt: !storedName,
      error: null,
      adminAnswer: null,
      cameraEnabled: true
    }
  };

  const listeners = new Set();

  return {
    data,
    subscribe(fn) {
      listeners.add(fn);
      fn(data);
      return () => listeners.delete(fn);
    },
    update(mutator) {
      mutator(data);
      listeners.forEach((listener) => listener(data));
    },
    persistName(name) {
      window.localStorage.setItem(NAME_STORAGE_KEY, name);
    }
  };
}
