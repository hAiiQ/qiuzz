import { promises as fs } from "fs";
import path from "path";

function serializeSnapshot(state) {
  return {
    questionStatus: Object.fromEntries(
      Object.entries(state.questionStatus).map(([id, meta]) => [id, { asked: meta.asked }])
    ),
    currentRoundIndex: state.currentRoundIndex,
    turnSlotIndex: state.turnSlotIndex,
    playerSlots: state.playerSlots.map((player) =>
      player
        ? {
            id: player.id,
            name: player.name,
            score: player.score,
            slotIndex: player.slotIndex
          }
        : null
    ),
    adminProfile: {
      id: state.adminProfile.id,
      name: state.adminProfile.name
    }
  };
}

function applySnapshot(state, snapshot) {
  if (!snapshot) return;
  if (snapshot.questionStatus) {
    Object.entries(snapshot.questionStatus).forEach(([id, meta]) => {
      if (state.questionStatus[id]) {
        state.questionStatus[id].asked = Boolean(meta.asked);
      }
    });
  }
  if (typeof snapshot.currentRoundIndex === "number") {
    state.currentRoundIndex = snapshot.currentRoundIndex;
  }
  if (typeof snapshot.turnSlotIndex === "number") {
    state.turnSlotIndex = snapshot.turnSlotIndex;
  }
  if (Array.isArray(snapshot.playerSlots)) {
    for (let i = 0; i < state.playerSlots.length; i += 1) {
      state.playerSlots[i] = null;
    }
    snapshot.playerSlots.forEach((player, index) => {
      if (!player) return;
      state.playerSlots[index] = {
        id: player.id,
        slotIndex: index,
        name: player.name,
        score: player.score ?? 0,
        connected: false
      };
    });
  }
  if (snapshot.adminProfile) {
    state.adminProfile.id = snapshot.adminProfile.id || null;
    state.adminProfile.name = snapshot.adminProfile.name || "Admin";
    state.adminProfile.connected = false;
  }
  state.activeQuestion = null;
}

export class Persistence {
  constructor(filePath) {
    this.filePath = filePath;
    this.pendingTimer = null;
    this.isSaving = false;
  }

  async load(state) {
    try {
      const raw = await fs.readFile(this.filePath, "utf-8");
      const snapshot = JSON.parse(raw);
      applySnapshot(state, snapshot);
      console.log("Spielstand geladen.");
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("Konnte Spielstand nicht laden:", error.message);
      }
    }
  }

  scheduleSave(state) {
    if (this.pendingTimer) {
      return;
    }
    this.pendingTimer = setTimeout(() => {
      this.pendingTimer = null;
      this.save(state).catch((error) => {
        console.error("Persistenzfehler:", error.message);
      });
    }, 400);
  }

  async save(state) {
    if (this.isSaving) return;
    this.isSaving = true;
    const snapshot = serializeSnapshot(state);
    const dir = path.dirname(this.filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(snapshot, null, 2));
    this.isSaving = false;
  }
}
