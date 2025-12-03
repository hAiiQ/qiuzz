const ICE_SERVERS = [
  {
    urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]
  }
];

const peers = new Map();
let localStream = null;
let streamPromise = null;
let storeRef = null;
let networkRef = null;
let participantMap = new Map();

const noopController = {
  toggleCamera() {
    storeRef?.update((state) => {
      state.ui.cameraEnabled = !state.ui.cameraEnabled;
    });
  }
};

export function initCamera(store, network) {
  storeRef = store;
  networkRef = network;

  if (!navigator.mediaDevices?.getUserMedia) {
    console.warn("MediaDevices API nicht verfügbar");
    return noopController;
  }

  network.onMessage("signal", ({ fromSessionId, payload }) => {
    if (!fromSessionId || !payload) return;
    handleSignal(fromSessionId, payload).catch((error) => {
      console.error("Signalverarbeitung fehlgeschlagen", error);
    });
  });

  store.subscribe((data) => {
    if (!data.client.joined) {
      return;
    }
    participantMap = buildParticipantMap(data);
    ensureLocalStream()
      .then(() => {
        applyMediaSettings(data);
        attachLocalStream(data);
        syncPeers(data);
        peers.forEach((peer, sessionId) => {
          if (peer.remoteStream) {
            attachRemoteStream(sessionId, peer.remoteStream);
          }
        });
      })
      .catch(() => {
        /* Fehler bereits gemeldet */
      });
  });

  return {
    toggleCamera() {
      setCameraEnabled(!storeRef.data.ui.cameraEnabled);
    }
  };
}

function buildParticipantMap(data) {
  const map = new Map();
  data.game.players.forEach((player) => {
    if (!player.sessionId) return;
    map.set(player.sessionId, {
      type: "player",
      slotIndex: player.slotIndex,
      name: player.name,
      connected: player.connected
    });
  });
  if (data.game.admin?.sessionId) {
    map.set(data.game.admin.sessionId, {
      type: "admin",
      slotIndex: null,
      name: data.game.admin.name,
      connected: data.game.admin.connected
    });
  }
  return map;
}

async function ensureLocalStream() {
  if (localStream) {
    return localStream;
  }
  if (!streamPromise) {
    streamPromise = navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        localStream = stream;
        return stream;
      })
      .catch((error) => {
        console.error("Kamera konnte nicht gestartet werden", error);
        storeRef?.update((state) => {
          state.ui.error = "Kamera konnte nicht gestartet werden.";
        });
        streamPromise = null;
        throw error;
      });
  }
  return streamPromise;
}

function attachLocalStream(data) {
  if (!localStream) return;
  let container = null;
  if (data.client.role === "admin") {
    container = document.querySelector('[data-role="admin-video"]');
  } else if (typeof data.client.slotIndex === "number") {
    container = document.querySelector(`[data-slot-video="${data.client.slotIndex}"]`);
  }
  if (container) {
    attachStream(container, localStream);
  }
}

function applyMediaSettings(data) {
  if (!localStream) return;
  const { cameraEnabled } = data.ui;
  localStream.getVideoTracks().forEach((track) => {
    track.enabled = Boolean(cameraEnabled);
  });
}

function setCameraEnabled(enabled) {
  if (!storeRef) return;
  storeRef.update((state) => {
    state.ui.cameraEnabled = enabled;
  });
  if (!navigator.mediaDevices?.getUserMedia) return;
  const promise = enabled ? ensureLocalStream() : Promise.resolve(localStream);
  promise
    .then(() => {
      if (!storeRef) return;
      applyMediaSettings(storeRef.data);
      if (enabled) {
        attachLocalStream(storeRef.data);
        syncPeers(storeRef.data);
      }
    })
    .catch(() => {
      /* Fehler bereits behandelt */
    });
}

// Audio stays muted globally, so no audio toggles are implemented.

function syncPeers(data) {
  if (!localStream) return;
  const localId = data.client.sessionId;

  for (const [sessionId, peer] of peers.entries()) {
    const info = participantMap.get(sessionId);
    if (!info || !info.connected || sessionId === localId) {
      destroyPeer(sessionId, info);
    }
  }

  participantMap.forEach((info, sessionId) => {
    if (!info.connected || sessionId === localId) {
      return;
    }
    if (!peers.has(sessionId)) {
      createPeer(sessionId, shouldInitiate(localId, sessionId));
    }
  });
}

function shouldInitiate(localId, remoteId) {
  if (!localId || !remoteId) return true;
  return localId > remoteId;
}

function createPeer(sessionId, initiator) {
  if (!localStream) return null;
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  const peer = {
    pc,
    remoteStream: null
  };
  peers.set(sessionId, peer);

  pc.ontrack = (event) => {
    const [stream] = event.streams;
    if (!stream) return;
    peer.remoteStream = stream;
    attachRemoteStream(sessionId, stream);
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      networkRef?.sendSignal(sessionId, { kind: "ice", candidate: event.candidate });
    }
  };

  pc.onconnectionstatechange = () => {
    if (["failed", "disconnected", "closed"].includes(pc.connectionState)) {
      const info = participantMap.get(sessionId);
      destroyPeer(sessionId, info);
    }
  };

  if (initiator) {
    startOffer(sessionId, pc).catch((error) => {
      console.error("Offer konnte nicht erstellt werden", error);
    });
  }

  return peer;
}

async function startOffer(sessionId, pc) {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  networkRef?.sendSignal(sessionId, { kind: "offer", sdp: pc.localDescription });
}

async function handleSignal(sessionId, payload) {
  if (!storeRef?.data.client.joined) {
    return;
  }
  await ensureLocalStream().catch(() => {});
  if (!localStream) return;

  const isOffer = payload.kind === "offer";
  let peer = peers.get(sessionId);
  if (!peer) {
    peer = createPeer(sessionId, !isOffer && shouldInitiate(storeRef.data.client.sessionId, sessionId));
  }
  if (!peer) {
    return;
  }

  const pc = peer.pc;

  switch (payload.kind) {
    case "offer":
      await pc.setRemoteDescription(payload.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      networkRef?.sendSignal(sessionId, { kind: "answer", sdp: pc.localDescription });
      break;
    case "answer":
      await pc.setRemoteDescription(payload.sdp);
      break;
    case "ice":
      if (payload.candidate) {
        try {
          await pc.addIceCandidate(payload.candidate);
        } catch (error) {
          console.warn("Konnte ICE-Kandidaten nicht hinzufügen", error);
        }
      }
      break;
    default:
      break;
  }
}

function destroyPeer(sessionId, info) {
  const peer = peers.get(sessionId);
  if (peer) {
    peer.pc.ontrack = null;
    peer.pc.onicecandidate = null;
    peer.pc.close();
    peers.delete(sessionId);
  }
  if (info) {
    restorePlaceholder(info);
  }
}

function attachRemoteStream(sessionId, stream) {
  const info = participantMap.get(sessionId);
  if (!info) return;
  const container = getContainerForParticipant(info);
  attachStream(container, stream);
}

function getContainerForParticipant(info) {
  if (!info) return null;
  if (info.type === "admin") {
    return document.querySelector('[data-role="admin-video"]');
  }
  if (typeof info.slotIndex === "number") {
    return document.querySelector(`[data-slot-video="${info.slotIndex}"]`);
  }
  return null;
}

function attachStream(container, stream) {
  if (!container) return;
  let video = container.querySelector('video[data-role="webrtc-stream"]');
  if (!video) {
    video = document.createElement("video");
    video.dataset.role = "webrtc-stream";
    video.autoplay = true;
    video.playsInline = true;
    video.classList.add("video-feed__stream");
    container.insertBefore(video, container.firstChild);
  }
  if (video.srcObject !== stream) {
    video.srcObject = stream;
  }
  video.muted = true;
  video.volume = 0;
  video.setAttribute("muted", "");
  video.controls = false;
  container.classList.add("has-stream");
  const placeholder = container.querySelector(".video-placeholder");
  if (placeholder) {
    placeholder.hidden = true;
  }
}

function restorePlaceholder(info) {
  const container = getContainerForParticipant(info);
  if (!container) return;
  const video = container.querySelector('video[data-role="webrtc-stream"]');
  if (video) {
    video.srcObject = null;
    video.remove();
  }
  container.classList.remove("has-stream");
  let placeholder = container.querySelector(".video-placeholder");
  if (!placeholder) {
    placeholder = document.createElement("span");
    placeholder.className = "video-placeholder";
    container.appendChild(placeholder);
  }
  placeholder.textContent = info.name || "Slot frei";
  placeholder.hidden = false;
}
