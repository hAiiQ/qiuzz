export const SESSION_STORAGE_KEY = "quizduell-session-id";
export const NAME_STORAGE_KEY = "quizduell-display-name";
const GAME_SNAPSHOT_KEY = "quizduell-game-snapshot";

function ensureSessionId() {
  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }
  const newId = window.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  window.localStorage.setItem(SESSION_STORAGE_KEY, newId);
  return newId;
}

function readStoredSnapshot() {
  try {
    const raw = window.localStorage.getItem(GAME_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn("Snapshot konnte nicht gelesen werden", error);
    return null;
  }
}

export function initState() {
  const searchParams = new URLSearchParams(window.location.search);
  const sessionId = ensureSessionId();
  const storedName = window.localStorage.getItem(NAME_STORAGE_KEY) || "";
  const roleParam = searchParams.get("role");
  const role = roleParam === "admin" ? "admin" : "player";

  const storedSnapshot = readStoredSnapshot();

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
      gameFinished: false,
      lastVerdict: null
    },
    ui: {
      showNamePrompt: !storedName,
      error: null,
      adminAnswer: null,
      cameraEnabled: true,
      snapshotAvailable: Boolean(storedSnapshot)
    }
  };

  const listeners = new Set();

  function notify() {
    listeners.forEach((listener) => listener(data));
  }

  function writeSnapshot(snapshot) {
    try {
      if (!snapshot) {
        window.localStorage.removeItem(GAME_SNAPSHOT_KEY);
        if (data.ui.snapshotAvailable) {
          data.ui.snapshotAvailable = false;
          notify();
        }
        return;
      }
      const payload = {
        savedAt: Date.now(),
        snapshot
      };
      window.localStorage.setItem(GAME_SNAPSHOT_KEY, JSON.stringify(payload));
      if (!data.ui.snapshotAvailable) {
        data.ui.snapshotAvailable = true;
        notify();
      }
    } catch (error) {
      console.warn("Snapshot konnte nicht gespeichert werden", error);
    }
  }

  return {
    data,
    subscribe(fn) {
      listeners.add(fn);
      fn(data);
      return () => listeners.delete(fn);
    },
    update(mutator) {
      mutator(data);
      notify();
    },
    persistName(name) {
      window.localStorage.setItem(NAME_STORAGE_KEY, name);
    },
    persistSnapshot(snapshot) {
      writeSnapshot(snapshot);
    },
    loadSnapshot() {
      const payload = readStoredSnapshot();
      return payload?.snapshot ?? null;
    },
    clearSnapshot() {
      writeSnapshot(null);
    }
  };
}
