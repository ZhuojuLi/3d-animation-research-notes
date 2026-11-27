// Final warm grade + vignette + subtle grain (applied in linear before OutputPass)
export const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.55 }, uWarm: { value: 0.06 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVig, uWarm; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = vUv - 0.5; q.x *= 1.2;
      float v = 1.0 - uVig * smoothstep(0.25, 0.85, length(q));
      c.rgb *= v;
      float l = dot(c.rgb, vec3(0.2126,0.7152,0.0722));
      c.rgb += uWarm * vec3(0.6, 0.15, -0.35) * l;                       // warm highlights
      c.rgb += vec3(0.010, 0.004, 0.016) * (1.0 - smoothstep(0.0, 0.25, l)); // lifted violet shadows
      c.rgb += (h(vUv*1000.) - 0.5) * 0.012;
      gl_FragColor = c;
    }` };
