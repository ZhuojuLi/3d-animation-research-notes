import * as THREE from 'three';

export function buildAtmosphere(scene, camera) {
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const forward = new THREE.Vector3(); camera.getWorldDirection(forward);
  const sunDirection = forward.clone().addScaledVector(right, -.320).addScaledVector(up, .095).normalize();
  const skyMaterial = new THREE.ShaderMaterial({
    name: '橙粉暮空与体积云层', side: THREE.BackSide, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uSunDirection: { value: sunDirection }, uAspect: { value: 1.5 } },
    vertexShader: `varying vec3 vWorld; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vWorld=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `
      precision highp float;
      varying vec3 vWorld; uniform vec3 uSunDirection; uniform float uTime;
      float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      float fbm(vec3 p){float f=0.;float a=.5;for(int i=0;i<5;i++){f+=a*noise(p);p=p*2.03+vec3(9.7,6.3,3.1);a*=.5;}return f;}
      void main(){
        vec3 d=normalize(vWorld-cameraPosition);
        float h=d.y;
        vec3 low=vec3(.94,.285,.058), horizon=vec3(.72,.245,.092), middle=vec3(.265,.142,.145), high=vec3(.105,.093,.125);
        vec3 col=mix(horizon,middle,smoothstep(-.02,.32,h)); col=mix(col,high,smoothstep(.20,.82,h));
        col=mix(low,col,smoothstep(-.07,.09,h));
        float sunDot=dot(d,uSunDirection); float ang=acos(clamp(sunDot,-1.,1.));
        float glow=exp(-ang*5.9); float inner=exp(-ang*31.);
        col+=vec3(.40,.145,.027)*glow+vec3(.92,.41,.105)*inner;
        float plane=1./max(.065,h+.12);
        vec3 q=vec3(d.x*2.5*plane,(h+.03)*8.0,d.z*plane*.85);
        q.x+=uTime*.0015;
        float broad=fbm(q*1.8+vec3(2.8,4.1,1.7));
        float wisps=fbm(q*4.8+vec3(broad*3.7,1.8,3.6));
        float fragments=fbm(q*14.0+vec3(broad*6.2,2.4,8.1));
        float density=smoothstep(.49,.665,wisps*.47+broad*.33+fragments*.39);
        float cloudBand=smoothstep(-.015,.075,h)*(1.-smoothstep(.50,.90,h));
        density*=cloudBand*.69;
        float nearSun=exp(-ang*2.4);
        vec3 cloudDark=mix(vec3(.14,.10,.16),vec3(.30,.145,.145),nearSun);
        vec3 cloudLight=mix(vec3(.38,.23,.28),vec3(.96,.43,.18),nearSun);
        float edge=smoothstep(.34,.68,broad)-smoothstep(.53,.78,broad);
        vec3 cloud=mix(cloudDark,cloudLight,clamp(edge*1.6+pow(nearSun,3.)*.8,0.,1.));
        col=mix(col,cloud,density);
        float disc=1.-smoothstep(.0095,.0130,ang);
        col=mix(col,vec3(3.4,2.24,.90),disc);
        col+=vec3(.38,.15,.045)*exp(-ang*15.)*(1.1-density);
        float haze=exp(-abs(h)*18.);
        col=mix(col,vec3(.91,.34,.12),haze*.12);
        gl_FragColor=vec4(col,1.);
      }
    `
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(680, 64, 40), skyMaterial); sky.name = '落日程序化天空'; sky.frustumCulled = false; scene.add(sky);
  const sunlight = new THREE.DirectionalLight(0xffad64, 3.6); sunlight.name = '逆光夕阳'; sunlight.position.copy(sunDirection).multiplyScalar(180); sunlight.position.y = 24;
  sunlight.target.position.set(-4, 0, 7); scene.add(sunlight.target); sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048); sunlight.shadow.camera.left = -29; sunlight.shadow.camera.right = 29; sunlight.shadow.camera.top = 27; sunlight.shadow.camera.bottom = -25;
  sunlight.shadow.camera.near = 1; sunlight.shadow.camera.far = 320; sunlight.shadow.bias = -.00025; sunlight.shadow.normalBias = .045; sunlight.shadow.radius = 3;
  scene.add(sunlight);
  const hemisphere = new THREE.HemisphereLight(0xc4bec2, 0x665044, 1.72); scene.add(hemisphere);
  const fill = new THREE.DirectionalLight(0xd7cdbf, 2.45); fill.position.set(-12, 15, 22); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffce9c, .50); rim.position.set(-25, 8, -12); scene.add(rim);
  // Sparse motes catch the backlight without obscuring the architecture.
  const count = 76, positions = new Float32Array(count * 3), sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) { positions[i * 3] = -8 + Math.random() * 19; positions[i * 3 + 1] = .4 + Math.random() * 7; positions[i * 3 + 2] = -6 + Math.random() * 19; sizes[i] = .55 + Math.random() * .75; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(positions, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const dustMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'attribute float aSize; uniform float uTime; varying float vFade; void main(){vec3 p=position;p.x+=sin(uTime*.12+position.y*3.)*.19;p.y+=sin(uTime*.18+position.x)*.13;vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=min(2.1,aSize*(32./-mv.z));vFade=clamp((12.+mv.z)/8.,0.,1.)*.23;gl_Position=projectionMatrix*mv;}',
    fragmentShader: 'varying float vFade;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d)*vFade;gl_FragColor=vec4(1.,.68,.37,a);}'
  });
  const dust = new THREE.Points(g, dustMat); scene.add(dust);
  return { skyMaterial, sunlight, dustMat, sunDirection };
}
