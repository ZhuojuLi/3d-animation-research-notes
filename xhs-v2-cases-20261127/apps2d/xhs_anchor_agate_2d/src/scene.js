import { DURATION, TAU, rng, polygon, text, trackingText, clamp } from './math.js';
import { drawExhibit } from './exhibit.js';
import { drawRoom, drawWorkbench, drawCoreBox } from './workshop.js';
import { dust } from './rocks.js';
import { slices, sliceAt, PATTERNS } from './agates.js';

export const WORLD = { width: 1600, height: 900 };
export const state = { t:0,phase:0,duration:DURATION,mode:'periodic',playing:false,filter:'all',selectedSlice:-1,polisherOn:false,lamp:72 };
let view={scale:1,ox:0,oy:0,ratio:1};
let ctx,displayCtx,canvas;
const surface=document.createElement('canvas');surface.width=WORLD.width;surface.height=WORLD.height;
const grain=document.createElement('canvas');grain.width=192;grain.height=108;
{
  const g=grain.getContext('2d'),im=g.createImageData(grain.width,grain.height),rand=rng(91023);
  for(let i=0;i<im.data.length;i+=4){const v=rand()*255;im.data[i]=v;im.data[i+1]=v;im.data[i+2]=v;im.data[i+3]=rand()*255;}
  g.putImageData(im,0,0);
}
function drawAtmosphere(state) {
  // Static emulsion texture prevents perfectly flat computer blacks.
  ctx.save();ctx.globalAlpha=.025;ctx.globalCompositeOperation='soft-light';ctx.imageSmoothingEnabled=true;
  const pattern=ctx.createPattern(grain,'repeat');ctx.fillStyle=pattern;ctx.fillRect(0,0,1600,900);ctx.restore();
  ctx.save();ctx.globalCompositeOperation='screen';
  for(const d of dust){
    const a=state.phase*(d.side>.55?1:2)+d.phase;
    const x=1000+d.x*546+Math.sin(a)*8;
    const y=170+d.y*629+Math.cos(a)*6;
    const alpha=(.055+d.size*.026)*(state.lamp/100)*(.6+.4*Math.sin(a+d.phase)**2);
    ctx.fillStyle=`rgba(236,217,168,${alpha})`;ctx.beginPath();ctx.arc(x,y,d.size*.6,0,TAU);ctx.fill();
  }
  ctx.restore();
  // glass reflections remain very faint so translucency stays visible
  ctx.save();polygon(ctx,[[60,133],[187,133],[365,617],[302,617]]);ctx.fillStyle='rgba(255,255,233,.021)';ctx.fill();ctx.restore();
  const v=ctx.createRadialGradient(650,380,310,720,385,1000);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,7,5,.46)');ctx.fillStyle=v;ctx.fillRect(0,0,1600,900);
  // unobtrusive exhibition footer on the physical wall
  trackingText(ctx,'NATURAL ARCHIVE  /  MINERAL GALLERY',1110,876,1.2,7,'#54614f');
  text(ctx,'08.0 s',1556,876,7,'#54614f','right');
}
export function initScene(target) {
  canvas=target;displayCtx=canvas.getContext('2d',{alpha:false,willReadFrequently:true});ctx=surface.getContext('2d',{alpha:false,willReadFrequently:true});
  resizeScene();renderAt(0);return state;
}
export function resizeScene() {
  if(!canvas)return;
  const rect=canvas.getBoundingClientRect(),ratio=Math.min(2,Math.max(1,window.devicePixelRatio||1));
  const w=Math.max(1,Math.round(rect.width*ratio)),h=Math.max(1,Math.round(rect.height*ratio));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const scale=Math.min(rect.width/WORLD.width,rect.height/WORLD.height);
  view={scale,ox:(rect.width-WORLD.width*scale)/2,oy:(rect.height-WORLD.height*scale)/2,ratio};
  draw();
}
function draw() {
  if(!ctx||!displayCtx)return;
  const {scale,ox,oy,ratio}=view;
  // Explicitly reset every persistent raster property before a deterministic seek.
  ctx.setTransform(1,0,0,1,0,0);
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.filter='none';
  ctx.lineCap='butt';ctx.lineJoin='miter';ctx.lineWidth=1;ctx.miterLimit=10;
  ctx.shadowColor='rgba(0,0,0,0)';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.fillStyle='#0c120f';ctx.fillRect(0,0,WORLD.width,WORLD.height);
  ctx.save();ctx.beginPath();ctx.rect(0,0,WORLD.width,WORLD.height);ctx.clip();
  drawRoom(ctx,state);drawWorkbench(ctx,state);drawExhibit(ctx,state);drawCoreBox(ctx,state);drawAtmosphere(state);
  ctx.restore();
  // The presentation surface receives one immutable, fixed-resolution raster.
  displayCtx.setTransform(1,0,0,1,0,0);displayCtx.globalAlpha=1;displayCtx.globalCompositeOperation='source-over';
  displayCtx.imageSmoothingEnabled=true;displayCtx.imageSmoothingQuality='high';
  displayCtx.fillStyle='#0c120f';displayCtx.fillRect(0,0,canvas.width,canvas.height);
  displayCtx.drawImage(surface,0,0,WORLD.width,WORLD.height,ox*ratio,oy*ratio,WORLD.width*scale*ratio,WORLD.height*scale*ratio);
  displayCtx.getImageData(0,0,1,1); // flush before screenshots or the next deterministic seek
}
export function renderAt(seconds) {
  const n=Number.isFinite(Number(seconds))?Number(seconds):0;
  state.t=((n%DURATION)+DURATION)%DURATION;
  // avoid tiny floating variations at the seam: exact 0 and exact 8 share phase 0.
  if(Math.abs(state.t-DURATION)<1e-10||Math.abs(state.t)<1e-10)state.t=0;
  state.phase=state.t/DURATION*TAU;
  draw();return getSceneState();
}
export function getSceneState() {
  const current=state.selectedSlice>=0?slices[state.selectedSlice]:null;
  return Object.freeze({
    t:Number(state.t.toFixed(6)),duration:DURATION,mode:'periodic',phase:Number(state.phase.toFixed(6)),playing:state.playing,
    filter:state.filter,filterName:PATTERNS[state.filter].name,selectedSlice:state.selectedSlice,selectedSpecimen:current?.id||null,
    polisherOn:state.polisherOn,wheelAngle:Number(((state.polisherOn?state.phase*4:state.phase*.035)%TAU).toFixed(6)),
    lamp:state.lamp,lightIntensity:Number((state.lamp/100).toFixed(3)),sliceCount:slices.length,
  });
}
export function clientToWorld(clientX,clientY) {
  const r=canvas.getBoundingClientRect();
  return {x:(clientX-r.left-view.ox)/view.scale,y:(clientY-r.top-view.oy)/view.scale};
}
export function hitSliceAt(clientX,clientY) {
  const p=clientToWorld(clientX,clientY);return sliceAt(p.x,p.y);
}
