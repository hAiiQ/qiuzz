export function initTimer(state) {
  return {
    start(seconds) {
      state.timer.secondsRemaining = seconds;
      state.timer.running = true;
    },
    stop() {
      state.timer.running = false;
    }
  };
}
