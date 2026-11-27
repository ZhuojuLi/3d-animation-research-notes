/** Accessible native controls. Interaction is only state input, never a clock. */

const STROKE_TIMES = Object.freeze({ intake: 1, compression: 3, power: 5, exhaust: 7 });

export class WorkbenchControls {
  constructor(actions) {
    this.actions = actions;
    this.rpm = document.getElementById('rpm-slider');
    this.spark = document.getElementById('spark-slider');
    this.scrub = document.getElementById('scrub');
    this.play = document.getElementById('play');
    this.pause = document.getElementById('pause');
    this.rpmValue = document.getElementById('rpm-value');
    this.sparkValue = document.getElementById('spark-value');
    this.timeValue = document.getElementById('time-readout');
    this.inspectorStatus = document.getElementById('inspector-status');
    this.buttons = [...document.querySelectorAll('[data-stroke]')];

    this.play.addEventListener('click', () => this.actions.play());
    this.pause.addEventListener('click', () => this.actions.pause());
    this.scrub.addEventListener('input', event => {
      const value = Number(event.currentTarget.value);
      this.actions.seek(value, true);
    });
    this.rpm.addEventListener('input', event => {
      this.actions.parameters({ RPM: Number(event.currentTarget.value) });
    });
    this.spark.addEventListener('input', event => {
      this.actions.parameters({ sparkAdvance: Number(event.currentTarget.value) });
    });
    this.buttons.forEach(button => {
      button.addEventListener('click', () => {
        const stroke = button.dataset.stroke;
        this.actions.stroke(stroke === 'all' ? null : stroke, stroke === 'all' ? null : STROKE_TIMES[stroke]);
      });
    });

    const menu = document.querySelector('.menu-mark');
    menu.setAttribute('aria-pressed', 'false');
    menu.setAttribute('aria-label', 'Toggle engine component labels');
    menu.addEventListener('click', () => {
      const hidden = document.body.classList.toggle('annotations-hidden');
      menu.setAttribute('aria-pressed', String(hidden));
      menu.setAttribute('title', hidden ? 'Show component labels' : 'Hide component labels');
    });
  }

  sliderFill(input) {
    const fraction = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min));
    input.style.setProperty('--fill', `${fraction * 100}%`);
  }

  sync(state) {
    if (Number(this.rpm.value) !== state.RPM) this.rpm.value = String(state.RPM);
    if (Number(this.spark.value) !== state.sparkAdvance) this.spark.value = String(state.sparkAdvance);
    this.rpmValue.innerHTML = `${state.RPM} <span>RPM</span>`;
    this.sparkValue.innerHTML = `${state.sparkAdvance}° <span>BTDC</span>`;
    this.scrub.value = state.time.toFixed(2);
    this.scrub.setAttribute('aria-valuetext', `${state.time.toFixed(2)} seconds of 8 seconds, ${state.activeStroke} stroke`);
    this.timeValue.textContent = `${state.time.toFixed(2)} / 8.00 s`;
    this.play.classList.toggle('active', state.playing);
    this.pause.classList.toggle('active', !state.playing);
    this.play.setAttribute('aria-pressed', String(state.playing));
    this.pause.setAttribute('aria-pressed', String(!state.playing));
    this.inspectorStatus.textContent = state.isolatedStroke ? `${state.isolatedStroke.toUpperCase()} · PAUSED` : 'ALL STROKES';
    this.buttons.forEach(button => {
      const selected = state.isolatedStroke ? button.dataset.stroke === state.isolatedStroke : button.dataset.stroke === 'all';
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    this.sliderFill(this.rpm);
    this.sliderFill(this.spark);
    this.sliderFill(this.scrub);
  }
}
