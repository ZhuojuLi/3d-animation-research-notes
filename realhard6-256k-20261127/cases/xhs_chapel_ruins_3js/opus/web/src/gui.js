import GUI from 'three/addons/libs/lil-gui.module.min.js';

export function setupGUI(params, { lights, sky, interaction, resetCam }) {
  const gui = new GUI({ title: '场景参数 Scene' }); gui.close();
  const f1 = gui.addFolder('光照 Light');
  f1.add(lights.sun, 'intensity', 0, 8, 0.05).name('落日强度');
  f1.addColor(lights.sun, 'color').name('落日颜色');
  f1.add(lights.hemi, 'intensity', 0, 3, 0.05).name('天光');
  f1.add(params, 'exposure', 0.3, 2, 0.01).name('曝光');
  f1.add(params, 'bloom', 0, 2, 0.01).name('辉光');
  f1.add(sky.uniforms.uCloud, 'value', 0, 1.5, 0.01).name('云量');
  const f2 = gui.addFolder('烛光 Candles');
  f2.add(params, 'candleBase', 0, 5, 0.05).name('基础亮度');
  f2.add(params, 'candlePeak', 0, 25, 0.1).name('聚焦亮度');
  f2.add(params, 'spillPeak', 0, 60, 0.5).name('门洞溢光');
  const f3 = gui.addFolder('风 Wind');
  f3.add(params, 'windBase', 0, 1, 0.01).name('草·常态');
  f3.add(params, 'windPeak', 0, 2, 0.01).name('草·聚焦');
  f3.add(params, 'treeBase', 0, 2, 0.01).name('树·常态');
  f3.add(params, 'treePeak', 0, 3, 0.01).name('树·聚焦');
  gui.add({ reset: resetCam }, 'reset').name('参考机位 (C)');
  return gui;
}
