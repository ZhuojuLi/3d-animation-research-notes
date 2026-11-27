import {
  F_STOPS, distanceToNormalized, formatDistance, normalizedToDistance,
  stepAperture, stepFocus,
} from './optics.js';

const byId = id => document.getElementById(id);

function fillRange(input) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const percentage = ((Number(input.value) - min) / (max - min)) * 100;
  input.style.setProperty('--fill', `${Math.max(0, Math.min(100, percentage))}%`);
}

/** Wires accessible HTML controls to the single scene store. */
export function createControls(actions) {
  const elements = {
    play: byId('play'), pause: byId('pause'), scrub: byId('scrub'),
    aperture: byId('aperture-slider'), focus: byId('focus-slider'),
    finish: byId('finish-select'), sectionInset: byId('section-inset'),
  };

  elements.play.addEventListener('click', actions.play);
  elements.pause.addEventListener('click', actions.pause);
  const scrub = () => actions.setTime(Number(elements.scrub.value), true);
  elements.scrub.addEventListener('input', scrub);
  elements.scrub.addEventListener('change', scrub);

  elements.aperture.addEventListener('input', () => {
    actions.setParameter('aperture', Number(elements.aperture.value));
  });
  byId('aperture-prev').addEventListener('click', () => {
    actions.setParameter('aperture', stepAperture(actions.getState().aperture, -1));
  });
  byId('aperture-next').addEventListener('click', () => {
    actions.setParameter('aperture', stepAperture(actions.getState().aperture, 1));
  });

  elements.focus.addEventListener('input', () => {
    actions.setParameter('distance', normalizedToDistance(elements.focus.value));
  });
  byId('focus-prev').addEventListener('click', () => {
    actions.setParameter('distance', stepFocus(actions.getState().distance, -1));
  });
  byId('focus-next').addEventListener('click', () => {
    actions.setParameter('distance', stepFocus(actions.getState().distance, 1));
  });

  elements.finish.addEventListener('change', () => actions.setParameter('finish', elements.finish.value));
  byId('exploded-toggle').addEventListener('click', () => {
    actions.setParameter('explodedOverride', !actions.getState().exploded);
  });
  byId('section-left').addEventListener('click', () => actions.setParameter('section', 'left'));
  byId('section-right').addEventListener('click', () => actions.setParameter('section', 'right'));
  byId('reset-btn').addEventListener('click', actions.reset);

  byId('tab-aperture').addEventListener('click', () => actions.setParameter('activeControl', 'aperture'));
  byId('tab-focus').addEventListener('click', () => actions.setParameter('activeControl', 'focus'));
  document.querySelectorAll('.chapter-nav [data-phase]').forEach(button => {
    const times = { lens: 0, aperture: 2, focus: 4, exposure: 6 };
    button.addEventListener('click', () => actions.setTime(times[button.dataset.phase], true));
  });

  const menu = byId('menu-btn');
  const index = byId('product-index');
  menu.addEventListener('click', () => {
    const expanded = menu.getAttribute('aria-expanded') === 'true';
    menu.setAttribute('aria-expanded', String(!expanded));
    index.hidden = expanded;
  });

  return {
    sync(state, visual, phaseName) {
      elements.scrub.value = state.time.toFixed(3);
      elements.aperture.value = String(state.aperture);
      elements.focus.value = String(distanceToNormalized(state.distance).toFixed(3));
      elements.finish.value = state.finish;
      [elements.scrub, elements.aperture, elements.focus].forEach(fillRange);

      byId('time-display').innerHTML = `${state.time.toFixed(1).padStart(4, '0')} <span>/ 08.0</span>`;
      byId('aperture-value').textContent = state.aperture.toFixed(1).replace('.0', '');
      elements.aperture.setAttribute('aria-valuetext', `f/${state.aperture.toFixed(1)}`);
      const focusText = formatDistance(state.distance);
      byId('focus-value').textContent = focusText;
      byId('focus-value').dataset.infinite = String(!Number.isFinite(state.distance));
      byId('focus-unit').textContent = Number.isFinite(state.distance) ? 'm' : 'infinity';
      elements.focus.setAttribute('aria-valuetext', Number.isFinite(state.distance) ? `${focusText} metres` : 'Infinity');

      byId('phase-name').textContent = phaseName;
      document.querySelectorAll('.chapter-nav [data-phase]').forEach(button => {
        const active = button.dataset.phase === state.phase;
        button.classList.toggle('active', active);
        if (active) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
      });
      elements.play.classList.toggle('active', state.playing);
      elements.pause.classList.toggle('active', !state.playing && state.time > 0 && state.time < 8);
      elements.play.setAttribute('aria-pressed', String(state.playing));

      const apertureActive = state.activeControl === 'aperture';
      byId('tab-aperture').classList.toggle('active', apertureActive);
      byId('tab-focus').classList.toggle('active', !apertureActive);
      byId('tab-aperture').setAttribute('aria-pressed', String(apertureActive));
      byId('tab-focus').setAttribute('aria-pressed', String(!apertureActive));
      byId('aperture-readout').classList.toggle('active', apertureActive);
      byId('focus-readout').classList.toggle('active', !apertureActive);

      const right = state.section === 'right';
      byId('section-left').classList.toggle('active', !right);
      byId('section-right').classList.toggle('active', right);
      byId('section-left').setAttribute('aria-pressed', String(!right));
      byId('section-right').setAttribute('aria-pressed', String(right));
      elements.sectionInset.textContent = right ? 'SECTION R · FOCAL PLANE' : 'SECTION L · FLOATING OPTICS';

      const explodedButton = byId('exploded-toggle');
      explodedButton.setAttribute('aria-pressed', String(visual.explodedAmount >= .5));
      byId('mode-status').textContent = visual.explodedAmount >= .98 ? 'EXPLODED' : visual.explodedAmount <= .02 ? 'ASSEMBLED' : 'IN TRANSITION';
      byId('finish-swatch').dataset.finish = state.finish;

      byId('playback-status').textContent = state.playing
        ? 'PLAYING / ONE SHOT'
        : state.time >= 8 ? 'EXPOSURE COMPLETE' : state.time > 0 ? 'PAUSED / HOLD' : 'READY / ONE SHOT';
      document.querySelector('.status-dot').classList.toggle('playing', state.playing);

      const captions = state.time < 2 ? 'ASSEMBLED EXTERIOR / AXIAL RELEASE'
        : state.time < 4 ? 'NINE-BLADE IRIS / COORDINATED ACTUATION'
          : state.time < 6 ? 'FLOATING GROUP / RANGEFINDER COUPLING'
            : state.time < 8 ? 'FOCAL PLANE / EXPOSURE INTEGRATION'
              : 'FULL EXPOSURE / COMPLETE OPTICAL SECTION';
      byId('mechanism-caption').textContent = captions;
      const phaseLabels = {
        lens: 'LENS / AXIAL ASSEMBLY', aperture: 'APERTURE / NINE BLADES',
        focus: 'FOCUS / DOUBLE-IMAGE COUPLING', exposure: 'EXPOSURE / FOCAL PLANE',
      };
      byId('phase-name').textContent = phaseLabels[state.phase];
    },
  };
}
