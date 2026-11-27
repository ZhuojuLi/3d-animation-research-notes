/** Accessible native controls wired to a single transport / absolute-seek API. */
export function bindControls(api) {
  const byId = id => document.getElementById(id);
  const play = byId('play');
  const pause = byId('pause');
  const scrub = byId('scrub');
  const pivot = byId('pivot-toggle');
  const speed = byId('speed-slider');
  const reset = byId('reset-btn');

  play.addEventListener('click', () => api.play());
  pause.addEventListener('click', () => api.pause());
  reset.addEventListener('click', () => api.reset());
  pivot.addEventListener('click', () => api.togglePivot());

  const seek = () => api.seek(Number(scrub.value));
  scrub.addEventListener('input', seek);
  scrub.addEventListener('change', seek);

  speed.addEventListener('input', () => api.setSpeed(Number(speed.value)));
  speed.addEventListener('change', () => api.setSpeed(Number(speed.value)));

  // Native keyboard operation plus useful transport shortcuts outside a slider.
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLButtonElement) return;
    if (event.code === 'Space') {
      event.preventDefault();
      api.getState().playing ? api.pause() : api.play();
    } else if (event.key.toLowerCase() === 'r') {
      api.reset();
    } else if (event.key.toLowerCase() === 'p') {
      api.togglePivot();
    }
  });
}
