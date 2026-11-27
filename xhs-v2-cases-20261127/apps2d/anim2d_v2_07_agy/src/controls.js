/**
 * Keyboard-accessible workbench controls & visual rail synchronizer.
 * Binds #play, #pause, #scrub, #rpm-slider, #spark-slider, and
 * #stroke-{intake,compression,power,exhaust,all}.
 */

import { CYCLE_DURATION, STROKE_JUMP_TIMES, clamp } from './cycle.js';

export function bindControls(dom, controller) {
  const strokeButtons = {
    intake: dom.strokeIntake,
    compression: dom.strokeCompression,
    power: dom.strokePower,
    exhaust: dom.strokeExhaust,
    all: dom.strokeAll,
  };

  // Transport: Play / Pause / Scrub
  dom.play.addEventListener('click', () => {
    controller.play();
  });

  dom.pause.addEventListener('click', () => {
    controller.pause();
  });

  const onScrub = () => {
    const val = clamp(parseFloat(dom.scrub.value) || 0, 0, CYCLE_DURATION);
    controller.scrubTo(val);
  };
  dom.scrub.addEventListener('input', onScrub);
  dom.scrub.addEventListener('change', onScrub);

  // RPM slider (600 .. 17000, step 100)
  const onRpm = () => {
    const val = clamp(Math.round(parseFloat(dom.rpmSlider.value) || 17000), 600, 17000);
    controller.setRpm(val);
  };
  dom.rpmSlider.addEventListener('input', onRpm);
  dom.rpmSlider.addEventListener('change', onRpm);

  // Spark-advance slider (-10 .. 40° BTDC, step 1)
  const onSpark = () => {
    const raw = parseFloat(dom.sparkSlider.value);
    const val = clamp(Number.isFinite(raw) ? Math.round(raw) : 12, -10, 40);
    controller.setSparkAdvance(val);
  };
  dom.sparkSlider.addEventListener('input', onSpark);
  dom.sparkSlider.addEventListener('change', onSpark);

  // Stroke-isolation inspector buttons
  for (const strokeName of ['intake', 'compression', 'power', 'exhaust']) {
    const btn = strokeButtons[strokeName];
    btn.addEventListener('click', () => {
      controller.isolateStroke(strokeName, STROKE_JUMP_TIMES[strokeName]);
    });
  }

  strokeButtons.all.addEventListener('click', () => {
    controller.clearIsolation();
  });

  /**
   * Synchronizes all control inputs, active button states, and custom range progress fills.
   */
  function syncControlsUI(state) {
    // 1. Play / Pause buttons & Live status badge
    dom.play.classList.toggle('is-active', state.playing);
    dom.play.setAttribute('aria-pressed', String(state.playing));
    dom.pause.classList.toggle('is-active', !state.playing);
    dom.pause.setAttribute('aria-pressed', String(!state.playing));

    if (dom.liveDot) {
      dom.liveDot.style.opacity = state.playing ? '1' : '0.82';
    }

    // 2. RPM slider & label readout
    if (document.activeElement !== dom.rpmSlider) {
      dom.rpmSlider.value = String(state.rpm);
    }
    const rpmPct = ((state.rpm - 600) / (17000 - 600)) * 100;
    dom.rpmSlider.style.setProperty('--fill-pct', `${clamp(rpmPct, 0, 100).toFixed(2)}%`);
    dom.rpmValue.textContent = `${state.rpm} RPM`;

    // 3. Spark-advance slider & visible advance value
    if (document.activeElement !== dom.sparkSlider) {
      dom.sparkSlider.value = String(state.sparkAdvance);
    }
    const sparkPct = ((state.sparkAdvance - -10) / (40 - -10)) * 100;
    dom.sparkSlider.style.setProperty('--fill-pct', `${clamp(sparkPct, 0, 100).toFixed(2)}%`);
    dom.sparkValue.textContent = `${state.sparkAdvance}° BTDC`;

    // 4. Persistent Stroke-isolation inspector active button state (including All when null)
    const activeKey = state.isolatedStroke || 'all';
    for (const [key, btn] of Object.entries(strokeButtons)) {
      const isSelected = key === activeKey;
      btn.classList.toggle('is-active', isSelected);
      btn.setAttribute('aria-pressed', String(isSelected));
    }

    // 5. Cycle progress #scrub input & segmented chevron bar
    const scrubVal = state.time;
    if (document.activeElement !== dom.scrub) {
      dom.scrub.value = scrubVal.toFixed(2);
    }
    dom.scrubValue.textContent = `${scrubVal.toFixed(2)}s`;

    const progressPct = clamp((scrubVal / CYCLE_DURATION) * 100, 0, 100);
    if (dom.cycleFillClip) {
      dom.cycleFillClip.setAttribute('width', ((progressPct / 100) * 320).toFixed(2));
    }
    if (dom.cycleCursorGroup) {
      const cursorX = 6 + (progressPct / 100) * 308;
      dom.cycleCursorGroup.setAttribute('transform', `translate(${cursorX.toFixed(2)}, 0)`);
    }
  }

  return { syncControlsUI };
}
