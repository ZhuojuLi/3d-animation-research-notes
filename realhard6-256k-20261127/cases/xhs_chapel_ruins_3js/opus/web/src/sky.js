import * as THREE from 'three';

export const SUN_DIR = new THREE.Vector3(-0.40, 0.092, -0.91).normalize();

const noiseGLSL = `
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6); for(int i=0;i<6;i++){ s+=a*vn(p); p=m*p; a*=.5; } return s; }`;

export function createSky() {
  const uniforms = {
    sunDir: { value: SUN_DIR.clone() }, uTime: { value: 0 },
    uCloud: { value: 1.0 }, uExposure: { value: 1.0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*p; gl_Position.z = gl_Position.w; }`,
    fragmentShader: `uniform vec3 sunDir; uniform float uTime, uCloud, uExposure; varying vec3 vDir; ${noiseGLSL}
    vec3 skyBase(vec3 d, float sd){
      float h = d.y;
      vec3 hor = vec3(1.25,0.52,0.20), low = vec3(0.95,0.40,0.32), mid = vec3(0.52,0.30,0.42), zen = vec3(0.16,0.14,0.30);
      vec3 c = mix(hor, low, smoothstep(0.0, 0.08, h));
      c = mix(c, mid, smoothstep(0.06, 0.28, h));
      c = mix(c, zen, smoothstep(0.25, 0.85, h));
      float az = 0.5 + 0.5*dot(normalize(d.xz), normalize(sunDir.xz));     // brighter on sun side
      c *= mix(0.55, 1.0, az);
      c += vec3(1.4,0.65,0.25)*pow(sd, 6.)*0.9 + vec3(1.6,1.0,0.55)*pow(sd, 60.)*1.6 + vec3(2.,1.6,1.)*pow(sd,600.)*4.;
      return c;
    }
    void main(){
      vec3 d = normalize(vDir);
      float sd = max(dot(d, sunDir), 0.);
      vec3 col = skyBase(d, sd);
      if (d.y > 0.0) {
        vec2 uv = d.xz / (d.y + 0.12) * 1.3 + vec2(uTime*0.004, 0.0);
        vec2 st = uv * vec2(1.0, 2.2);                                  // stretched stratocumulus
        float n = fbm(st*1.6 + vec2(3.1,7.7));
        float n2 = fbm(st*1.6 + vec2(3.1,7.7) + normalize(sunDir.xz)*0.18);
        float band = smoothstep(0.02, 0.10, d.y) * (1.0 - smoothstep(0.55, 0.95, d.y));
        float clear = smoothstep(0.88, 0.995, sd) * 0.6;                // opening around the sun
        float dens = smoothstep(0.44 + clear, 0.78, n) * band * uCloud;
        float lit = clamp((n - n2)*5. + 0.45, 0., 1.);
        float prox = pow(sd, 3.);
        vec3 shadowC = mix(vec3(0.24,0.17,0.26), vec3(0.55,0.28,0.30), prox);
        vec3 litC = mix(vec3(0.95,0.48,0.48), vec3(1.9,0.85,0.35), prox);
        vec3 cc = mix(shadowC, litC, lit*0.75 + prox*0.35);
        float rim = (1.0 - smoothstep(0.0, 0.35, dens)) * smoothstep(0.0,0.05,dens) * pow(sd, 4.) * 3.0;
        cc += vec3(1.6,0.8,0.35)*rim;
        col = mix(col, cc, dens*0.92);
      } else {
        col = mix(skyBase(vec3(d.x,0.0,d.z), sd), vec3(0.35,0.2,0.18), smoothstep(0.0,-0.3,d.y));
      }
      float disk = smoothstep(0.99955, 0.99975, sd);
      col += vec3(30.,18.,8.) * disk;
      gl_FragColor = vec4(col*uExposure, 1.0);
    }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(4000, 64, 32), mat);
  mesh.frustumCulled = false; mesh.renderOrder = -10;
  return { mesh, uniforms };
}

export function createLights(scene) {
  const sun = new THREE.DirectionalLight(0xffa25a, 3.2);
  sun.position.copy(SUN_DIR).multiplyScalar(60).add(new THREE.Vector3(2, 0, -2));
  sun.position.y = 9;   // a touch higher for usable shadow rake
  sun.target.position.set(2, 0, -2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera; c.left = -22; c.right = 22; c.top = 22; c.bottom = -22; c.near = 1; c.far = 160;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xb98ab0, 0x5a3a28, 0.9);
  scene.add(hemi);
  // soft warm fill from the open sky behind the camera (facade side faces away from sun)
  const fill = new THREE.DirectionalLight(0xd59a90, 0.55);
  fill.position.set(6, 10, 20); scene.add(fill);
  return { sun, hemi, fill };
}
