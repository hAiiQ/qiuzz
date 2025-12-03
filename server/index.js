import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { WebSocketServer } from "ws";

import {
  createGameState,
  handleAdminCloseQuestion,
  handleAdminMarkAnswer,
  handleAdminRemovePlayer,
  handleAdminSelectQuestion,
  handleBuzzer,
  handleDisconnect,
  handleJoin,
  handleReset,
  serializeState,
  updateTimers
} from "./gameState.js";
import { Persistence } from "./persistence.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

const PORT = process.env.PORT || 3000;
const HEARTBEAT_MS = 400;

const state = createGameState();
const persistence = new Persistence(path.join(__dirname, "../data/game-state.json"));
await persistence.load(state);

const clientSessions = new Map(); // ws -> { sessionId, role }
const sessionLookup = new Map(); // sessionId -> ws

app.use(express.static(path.join(__dirname, "../client")));

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

wss.on("connection", (ws) => {
  ws.on("message", (message) => {
    try {
      const payload = JSON.parse(message.toString());
      routeEvent(ws, payload);
    } catch (error) {
      console.error("Invalid payload", error);
    }
  });

  ws.on("close", () => {
    const sessionInfo = clientSessions.get(ws);
    if (sessionInfo) {
      handleDisconnect(state, sessionInfo.sessionId);
      clientSessions.delete(ws);
      sessionLookup.delete(sessionInfo.sessionId);
      commitStateChange();
    }
  });
});

function routeEvent(ws, event) {
  switch (event.type) {
    case "join":
      return handleJoinEvent(ws, event);
    case "admin:selectQuestion":
      return requireAdmin(ws, () => {
        const result = handleAdminSelectQuestion(state, event.questionId);
        if (!result.ok) {
          return send(ws, { type: "error", message: result.reason });
        }
        commitStateChange();
      });
    case "admin:markAnswer":
      return requireAdmin(ws, () => {
        const result = handleAdminMarkAnswer(state, event.verdict);
        if (!result.ok) {
          return send(ws, { type: "error", message: result.reason });
        }
        commitStateChange();
      });
    case "admin:closeQuestion":
      return requireAdmin(ws, () => {
        handleAdminCloseQuestion(state);
        commitStateChange();
      });
    case "admin:reset":
      return requireAdmin(ws, () => {
          const result = handleReset(state, { dropPlayers: true });
          disconnectSessions(result.removedSessions, "reset");
          commitStateChange();
      });
      case "admin:kickPlayer":
        return requireAdmin(ws, () => {
          const result = handleAdminRemovePlayer(state, event.slotIndex);
          if (!result.ok) {
            return send(ws, { type: "error", message: result.reason });
          }
          if (result.removedSessionId) {
            disconnectSessions([result.removedSessionId], "kicked");
          }
          commitStateChange();
        });
    case "buzzer":
      return handlePlayerBuzzer(ws);
    case "signal:relay":
      return relaySignal(ws, event);
    default:
      return send(ws, { type: "error", message: "unknown-event" });
  }
}

function handleJoinEvent(ws, event) {
  const sessionId = event.sessionId || randomUUID();
  const result = handleJoin(state, {
    sessionId,
    role: event.role,
    name: event.name
  });

  if (!result.accepted) {
    send(ws, { type: "error", message: result.reason || "join-denied" });
    return;
  }

  clientSessions.set(ws, { sessionId, role: result.role });
  sessionLookup.set(sessionId, ws);

  send(ws, {
    type: "joined",
    sessionId,
    role: result.role,
    slotIndex: result.slotIndex ?? null,
    name: result.player?.name || event.name || ""
  });

  sendState(ws);
  commitStateChange({ skipWs: ws });
}

function handlePlayerBuzzer(ws) {
  const sessionInfo = clientSessions.get(ws);
  if (!sessionInfo || sessionInfo.role !== "player") {
    return;
  }
  const result = handleBuzzer(state, sessionInfo.sessionId);
  if (!result.ok) {
    send(ws, { type: "error", message: result.reason });
    return;
  }
  broadcastState();
}

function relaySignal(ws, event) {
  const sessionInfo = clientSessions.get(ws);
  if (!sessionInfo) {
    return;
  }
  const target = sessionLookup.get(event.targetSessionId);
  if (!target) {
    return;
  }
  send(target, {
    type: "signal",
    fromSessionId: sessionInfo.sessionId,
    payload: event.payload
  });
}

function requireAdmin(ws, callback) {
  const sessionInfo = clientSessions.get(ws);
  if (!sessionInfo || sessionInfo.role !== "admin") {
    send(ws, { type: "error", message: "admin-required" });
    return;
  }
  callback();
}

function send(ws, data) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function sendState(ws, sessionInfo = clientSessions.get(ws)) {
  const includeAnswer = sessionInfo?.role === "admin";
  send(ws, { type: "state", payload: serializeState(state, { includeAnswer }) });
}

function broadcastState(skipWs) {
  for (const [client, info] of clientSessions.entries()) {
    if (client === skipWs) continue;
    sendState(client, info);
  }
}

function disconnectSessions(sessionIds = [], reason = "kicked") {
  sessionIds.forEach((sessionId) => {
    if (!sessionId) return;
    const target = sessionLookup.get(sessionId);
    if (!target) return;
    send(target, {
      type: "kicked",
      reason
    });
    target.close();
    const info = clientSessions.get(target);
    if (info) {
      handleDisconnect(state, info.sessionId);
    }
    clientSessions.delete(target);
    sessionLookup.delete(sessionId);
  });
}

function commitStateChange({ skipWs } = {}) {
  persistence.scheduleSave(state);
  broadcastState(skipWs);
}

setInterval(() => {
  const { changed, needsPersist } = updateTimers(state);
  if (changed) {
    if (needsPersist) {
      persistence.scheduleSave(state);
    }
    broadcastState();
  }
}, HEARTBEAT_MS);

httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
