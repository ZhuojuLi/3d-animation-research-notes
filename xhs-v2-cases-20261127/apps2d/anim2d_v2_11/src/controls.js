export function bindControls({ clock, settings, renderCurrent, playingChanged }) {
  const flow = document.getElementById('flow-multiplier');
  const scrub = document.getElementById('scrub');
  flow.addEventListener('input', () => {
    settings.flowMultiplier = Math.round(Number(flow.value) * 10) / 10;
    renderCurrent();
  });
  scrub.addEventListener('input', () => clock.seek(Number(scrub.value)));
  scrub.addEventListener('change', () => clock.seek(Number(scrub.value)));
  document.getElementById('play').addEventListener('click', () => clock.play());
  document.getElementById('pause').addEventListener('click', () => clock.pause());
  document.querySelectorAll('.line-focus[data-line]').forEach(button => {
    button.addEventListener('click', () => {
      const line = button.dataset.line;
      settings.focusedLine = settings.focusedLine === line ? null : line;
      renderCurrent();
    });
  });
  document.getElementById('speed-limit-toggle').addEventListener('click', () => {
    settings.speedLimit = !settings.speedLimit;
    renderCurrent();
  });
  return { playingChanged };
}

export function syncControls(t, settings, playing, timecode) {
  const flow = document.getElementById('flow-multiplier');
  flow.value = settings.flowMultiplier.toFixed(1);
  flow.style.setProperty('--range-progress', `${(settings.flowMultiplier - .6) / 1.4 * 100}%`);
  document.getElementById('flow-output').innerHTML = `${settings.flowMultiplier.toFixed(1)}<span>×</span>`;
  document.querySelectorAll('.line-focus[data-line]').forEach(button => {
    const active = settings.focusedLine === button.dataset.line;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
    button.title = active ? '再次点击恢复全网' : `聚焦${button.textContent.trim().replace(/聚焦|\d+/g, '')}`;
  });
  const speedButton = document.getElementById('speed-limit-toggle');
  speedButton.classList.toggle('active', settings.speedLimit);
  speedButton.setAttribute('aria-pressed', String(settings.speedLimit));
  document.getElementById('speed-button-text').textContent = settings.speedLimit ? '解除限速' : '应用限速';
  const speedStatus = document.getElementById('speed-status');
  speedStatus.classList.toggle('active', settings.speedLimit);
  speedStatus.querySelector('span').textContent = settings.speedLimit ? '绿线 · 限速中' : '绿线 · 常速运行';
  const scrub = document.getElementById('scrub');
  scrub.value = String(t);
  scrub.style.setProperty('--range-progress', `${t / 8 * 100}%`);
  document.getElementById('time-output').textContent = timecode;
  const playState = document.getElementById('play-state');
  playState.classList.toggle('playing', playing);
  playState.innerHTML = `<i></i>${playing ? '运行中' : '已暂停'}`;
  document.getElementById('play').setAttribute('aria-pressed', String(playing));
  document.getElementById('pause').setAttribute('aria-pressed', String(!playing));
}
