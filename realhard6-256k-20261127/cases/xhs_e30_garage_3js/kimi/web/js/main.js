import * as THREE from 'three';
import {OrbitControls} from '../vendor/controls/OrbitControls.js';
import {RoomEnvironment} from '../vendor/environments/RoomEnvironment.js';
import {createMaterials} from './materials.js';
import {createCar} from './car.js';
import {createArchitecture,createLift,createWorkshopProps} from './garage.js';

const canvas=document.querySelector('#scene');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.88;
renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x94a9af);scene.fog=new THREE.FogExp2(0x9da9a4,.007);
const camera=new THREE.PerspectiveCamera(36,innerWidth/innerHeight,.07,75);
const defaultPos=new THREE.Vector3(3.28,1.33,-5.18),defaultTarget=new THREE.Vector3(0,.82,-.55);
camera.position.copy(defaultPos);
const controls=new OrbitControls(camera,canvas);controls.target.copy(defaultTarget);controls.enableDamping=true;controls.dampingFactor=.075;
controls.minDistance=.72;controls.maxDistance=19;controls.maxPolarAngle=Math.PI*.68;controls.minPolarAngle=.08;
controls.panSpeed=.65;controls.rotateSpeed=.58;controls.zoomSpeed=.8;controls.update();

const world=new THREE.Group();world.name='Editable workshop assembly';world.scale.x=-1;scene.add(world);
const environment=new RoomEnvironment();const pmrem=new THREE.PMREMGenerator(renderer);scene.environment=pmrem.fromScene(environment,.04).texture;environment.dispose();pmrem.dispose();
scene.environmentIntensity=.46;
const materials=createMaterials();
const architecture=createArchitecture(world,materials);
const props=createWorkshopProps(world,materials);
const lift=createLift(world,materials);
const car=createCar(materials);car.root.position.set(0,0,-.10);world.add(car.root);

const hemi=new THREE.HemisphereLight(0xe6eeeb,0x514a3a,.46);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffe3b1,5.15);sun.position.set(3.9,9.0,7.2);sun.target.position.set(-.3,0,-2.4);scene.add(sun,sun.target);
sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);sun.shadow.camera.left=-9;sun.shadow.camera.right=9;sun.shadow.camera.top=8;sun.shadow.camera.bottom=-8;sun.shadow.camera.near=.5;sun.shadow.camera.far=28;sun.shadow.bias=-.00012;sun.shadow.normalBias=.022;sun.shadow.radius=2;
const softFill=new THREE.DirectionalLight(0xbcd3df,.46);softFill.position.set(5,3.8,-6);scene.add(softFill);
const bounce=new THREE.DirectionalLight(0xe2d5b9,.29);bounce.position.set(-5,2.0,-2);scene.add(bounce);
const rearFill=new THREE.PointLight(0xe1e7d8,9,9,2);rearFill.position.set(1.2,4.2,4.4);scene.add(rearFill);

const state={lift:0,liftTarget:0,door:0,doorTarget:0,view:'default',frames:0,interacting:false};
let cameraTween=null,toastTimer;
const $=s=>document.querySelector(s);
function toast(t){$('#focus-toast').textContent=t;$('#focus-toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#focus-toast').classList.remove('show'),1800);}
function setLift(value){state.liftTarget=THREE.MathUtils.clamp(value,0,1);$('#lift-range').value=Math.round(state.liftTarget*100);$('#lift-btn').setAttribute('aria-pressed',state.liftTarget>.01);$('#lift-label').textContent=state.liftTarget>.01?'降下车辆':'升起车辆';}
function setDoor(open){state.doorTarget=open?1:0;$('#door-btn').setAttribute('aria-pressed',open);$('#door-label').textContent=open?'关闭车门':'打开车门';}
const views={
  default:{p:defaultPos,t:defaultTarget,fov:36,label:'参考机位 · 修复工位全景'},
  front:{p:new THREE.Vector3(3.28,1.33,-5.18),t:new THREE.Vector3(0,.72,-1.20),fov:40,label:'前脸细节 · 四圆灯 / 窄双肾格栅'},
  wheel:{p:new THREE.Vector3(2.28,.75,-3.58),t:new THREE.Vector3(.55,.55,-1.40),fov:34,label:'BBS 编织轮毂 · 金属与橡胶'},
  interior:{p:new THREE.Vector3(2.55,1.52,1.58),t:new THREE.Vector3(-.03,.98,.08),fov:45,label:'驾驶员车门 · 煤灰色皮革内饰'},
  underbody:{p:new THREE.Vector3(2.65,.20,-2.78),t:new THREE.Vector3(0,1.18,-.03),fov:52,label:'举升检查 · 悬架 / 排气 / 液压支臂'}
};
function setView(name){const v=views[name]||views.default;state.view=name;
  if(name==='interior')setDoor(true);if(name==='underbody')setLift(1);
  cameraTween={start:performance.now(),from:camera.position.clone(),targetFrom:controls.target.clone(),to:v.p.clone(),targetTo:v.t.clone(),fovFrom:camera.fov,fovTo:v.fov};
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));toast(v.label);
}
$('#lift-btn').addEventListener('click',()=>setLift(state.liftTarget>.1?0:1));
$('#lift-range').addEventListener('input',e=>setLift(Number(e.target.value)/100));
$('#door-btn').addEventListener('click',()=>setDoor(!state.doorTarget));
$('#reset-btn').addEventListener('click',()=>{setLift(0);setDoor(false);setView('default');});
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
controls.addEventListener('start',()=>{cameraTween=null;state.interacting=true;document.querySelectorAll('[data-view]').forEach(b=>b.classList.remove('active'));});
controls.addEventListener('end',()=>state.interacting=false);
// The door has a genuine raycast target, rather than a flat screen-space hotspot.
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null;
canvas.addEventListener('pointerdown',e=>down={x:e.clientX,y:e.clientY});
canvas.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;
  pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObject(car.doorPivot,true);if(hits.length){setDoor(!state.doorTarget);toast(state.doorTarget?'车门已开启 · 点击可关闭':'车门已关闭');}down=null;
});
window.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='l')setLift(state.liftTarget>.1?0:1);if(e.key.toLowerCase()==='d')setDoor(!state.doorTarget);if(e.key==='Escape')setView('default');});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
const clock=new THREE.Clock();let first=0;
function animate(now){
  const dt=Math.min(clock.getDelta(),.5);
  state.lift=THREE.MathUtils.damp(state.lift,state.liftTarget,3.8,dt);state.door=THREE.MathUtils.damp(state.door,state.doorTarget,4.0,dt);
  const h=state.lift*1.15;car.root.position.y=h;lift.update(h);car.doorPivot.rotation.y=-state.door*1.07;
  $('#height-output').value=`${Math.round(h*100)} cm`;$('#car-status').textContent=`${h>.01?'LIFT IN OPERATION':'VEHICLE RESTING'} · ${Math.round(h*1000)} MM`;
  if(cameraTween){let t=Math.min((now-cameraTween.start)/1250,1);t=1-Math.pow(1-t,3);camera.position.lerpVectors(cameraTween.from,cameraTween.to,t);controls.target.lerpVectors(cameraTween.targetFrom,cameraTween.targetTo,t);camera.fov=THREE.MathUtils.lerp(cameraTween.fovFrom,cameraTween.fovTo,t);camera.updateProjectionMatrix();if(t>=1)cameraTween=null;}
  controls.update();renderer.render(scene,camera);state.frames++;
  if(++first===3){$('#loading').classList.add('done');setTimeout(()=>$('#loading').remove(),1000);document.body.dataset.ready='true';}
}
renderer.setAnimationLoop(animate);
window.garageApp={
  scene,camera,renderer,controls,car,lift,state,setLift,setDoor,setView,
  get cameraMoving(){return !!cameraTween;},
  diagnostics(){const gl=renderer.getContext();return {ready:document.body.dataset.ready==='true',revision:THREE.REVISION,renderer:gl.getParameter(gl.RENDERER),webgl:gl.getParameter(gl.VERSION),resolution:[renderer.domElement.width,renderer.domElement.height],camera:camera.position.toArray(),target:controls.target.toArray(),view:state.view,lift:state.lift,liftHeightMeters:car.root.position.y,doorOpenAmount:state.door,doorAngleDegrees:THREE.MathUtils.radToDeg(car.doorPivot.rotation.y),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,meshes:(()=>{let n=0;scene.traverse(o=>{if(o.isMesh)n++;});return n;})(),errors:window.__runtimeErrors||[]};},
  captureState(name='default'){setLift(0);setDoor(false);setView(name);}
};
window.__runtimeErrors=[];window.addEventListener('error',e=>window.__runtimeErrors.push(String(e.error||e.message)));window.addEventListener('unhandledrejection',e=>window.__runtimeErrors.push(String(e.reason)));
console.info('E30 workshop ready — Three.js r'+THREE.REVISION);
