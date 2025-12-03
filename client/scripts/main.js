import { initState } from "./state.js";
import { initNetwork } from "./network.js";
import { initUI } from "./ui.js";
import { initCamera } from "./camera.js";

(async () => {
  const appEl = document.getElementById("app");
  const state = initState();
  const network = initNetwork(state);
  const camera = initCamera(state, network);
  initUI({ appEl, state, network, camera });

  if (!state.data.ui.showNamePrompt && state.data.client.name) {
    network.connect(state.data.client.name);
  }
})();
