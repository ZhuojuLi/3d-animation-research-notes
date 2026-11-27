import { DURATION, clamp } from './math.js';
import { state, initScene, renderAt, getSceneState, resizeScene, hitSliceAt } from './scene.js';
import { slices, PATTERNS } from './agates.js';

const $=s=>document.querySelector(s);
const canvas=$('#canvas'),scrub=$('#scrub'),play=$('#play'),pause=$('#pause');
const filter=$('#pattern-filter'),toggle=$('#polisher-toggle'),lamp=$('#lamp-slider'),reset=$('#reset');
const timecode=$('#timecode'),live=$('#announcer'),polisherLabel=$('#polisher-label'),lampValue=$('#lamp-value');
let raf=0,last=0;
function announce(message){live.textContent='';requestAnimationFrame(()=>{live.textContent=message;});}
function syncControls() {
  scrub.value=String(state.t);scrub.style.setProperty('--progress',`${state.t/DURATION*100}%`);scrub.setAttribute('aria-valuetext',`${state.t.toFixed(2)} 秒，共 8 秒`);
  timecode.textContent=`${state.t.toFixed(2).padStart(5,'0')} / 08.00`;
  filter.value=state.filter;
  toggle.setAttribute('aria-pressed',String(state.polisherOn));toggle.classList.toggle('is-on',state.polisherOn);
  polisherLabel.textContent=state.polisherOn?'停止抛光':'启动抛光';
  lamp.value=String(state.lamp);lamp.style.setProperty('--progress',`${state.lamp}%`);lampValue.value=`${state.lamp}%`;lampValue.textContent=`${state.lamp}%`;
  lamp.setAttribute('aria-valuetext',`${state.lamp}% 亮度`);
  play.classList.toggle('is-active',state.playing);pause.classList.toggle('is-active',!state.playing);
  const name=state.selectedSlice>=0?`，已选切片 ${slices[state.selectedSlice].id}`:'';
  $('#selection-status').textContent=state.filter==='all'?'暖白背光 · 自由观察':`${PATTERNS[state.filter].name}聚光${name}`;
  play.setAttribute('aria-pressed',String(state.playing));pause.setAttribute('aria-pressed',String(!state.playing));
}
function frame(now) {
  if(!state.playing){raf=0;return;}
  if(!last)last=now;const dt=Math.min(.08,(now-last)/1000);last=now;
  renderAt(state.t+dt);syncControls();raf=requestAnimationFrame(frame);
}
function setPlaying(value) {
  state.playing=value;cancelAnimationFrame(raf);raf=0;last=0;
  if(value)raf=requestAnimationFrame(frame);syncControls();
}
play.addEventListener('click',()=>{if(state.t>=DURATION-.001)renderAt(0);setPlaying(true);});
pause.addEventListener('click',()=>{setPlaying(false);announce('时间轴已暂停');});
scrub.addEventListener('input',()=>{const requested=Number(scrub.value);setPlaying(false);renderAt(requested);syncControls();});
scrub.addEventListener('change',()=>{renderAt(Number(scrub.value));syncControls();announce(`时间轴定位至 ${state.t.toFixed(2)} 秒`);});
filter.addEventListener('change',()=>{
  state.filter=filter.value;state.selectedSlice=-1;renderAt(state.t);syncControls();
  announce(state.filter==='all'?'已显示全部玛瑙切片':`已聚拢${PATTERNS[state.filter].name}切片背光`);
});
canvas.addEventListener('click',event=>{
  const hit=hitSliceAt(event.clientX,event.clientY);if(hit<0)return;
  state.selectedSlice=hit;state.filter=slices[hit].pattern;setPlaying(false);renderAt(state.t);syncControls();
  announce(`已选择 ${slices[hit].id}，${PATTERNS[state.filter].name}。${PATTERNS[state.filter].note}`);
});
canvas.addEventListener('keydown',event=>{
  if(event.key==='Enter'||event.key===' '){
    event.preventDefault();const hit=state.selectedSlice<0?0:(state.selectedSlice+1)%slices.length;
    state.selectedSlice=hit;state.filter=slices[hit].pattern;renderAt(state.t);syncControls();announce(`已选择 ${slices[hit].id}，${PATTERNS[state.filter].name}`);
  }
});
toggle.addEventListener('click',()=>{
  state.polisherOn=!state.polisherOn;renderAt(state.t);syncControls();
  announce(state.polisherOn?'抛光机已启动，抛光轮开始旋转':'抛光机已停止');
});
lamp.addEventListener('input',()=>{
  state.lamp=clamp(Number(lamp.value),0,100);renderAt(state.t);syncControls();
});
lamp.addEventListener('change',()=>announce(`工作灯亮度 ${state.lamp}%`));
reset.addEventListener('click',()=>{
  setPlaying(false);state.filter='all';state.selectedSlice=-1;state.polisherOn=false;state.lamp=72;
  renderAt(0);syncControls();announce('已复位时间轴、展柜筛选、抛光机和工作灯');
});
window.addEventListener('resize',()=>{resizeScene();renderAt(state.t);syncControls();},{passive:true});
window.addEventListener('keydown',event=>{
  if(event.target.matches('input,select,button,canvas'))return;
  if(event.code==='Space'){event.preventDefault();setPlaying(!state.playing);}
  if(event.key.toLowerCase()==='r')reset.click();
});
initScene(canvas);syncControls();
window.renderAt=seconds=>{const result=renderAt(seconds);syncControls();return result;};
window.__getSceneState=getSceneState;
window.__SCENE_READY__=true;
