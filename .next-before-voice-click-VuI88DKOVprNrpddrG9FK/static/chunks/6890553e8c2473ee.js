(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,228958,e=>{"use strict";var t=e.i(843476),o=e.i(271645),r=e.i(408560),i=e.i(190072);let n=`
  uniform vec3 uDeepColor;
  uniform vec3 uMidColor;
  uniform vec3 uCrestColor;
  uniform vec3 uRedReflect;
  uniform vec3 uBlueReflect;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vElevation;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), u.x), u.y);
  }

  float surface(vec2 p) {
    // Crossing capillary ripples: texture in the material, no extra geometry.
    vec2 drift = vec2(uTime * 0.16, -uTime * 0.12);
    float swell = noise(p * 1.7 + drift);
    float ripple = noise(p * vec2(7.0, 13.0) - drift * 1.3);
    float grain = noise(p * vec2(21.0, 32.0) + drift);
    return swell * 0.45 + ripple * 0.38 + grain * 0.17;
  }

  void main() {
    vec2 p = vWorldPos.xz;
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float distanceToEye = length(cameraPosition - vWorldPos);
    float detail = 1.0 - smoothstep(7.0, 28.0, distanceToEye);

    // Geometric normal in WORLD space; the former view-space normal made
    // Fresnel read like a uniformly shiny sheet instead of reflecting water.
    vec3 normal = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
    if (normal.y < 0.0) normal = -normal;
    float texel = surface(p);
    float footprint = max(length(fwidth(p)), 0.018);
    float bumpStrength = mix(0.035, 0.16, detail);
    vec2 bump = vec2(surface(p + vec2(footprint, 0.0)) - texel,
                     surface(p + vec2(0.0, footprint)) - texel);
    normal = normalize(normal + vec3(-bump.x, 0.0, -bump.y) * bumpStrength / footprint);

    float crest = smoothstep(0.05, 0.32, vElevation);
    float fresnel = 0.04 + 0.96 * pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 5.0);
    float skyLight = clamp(dot(normal, normalize(vec3(-0.35, 0.8, 0.45))), 0.0, 1.0);
    vec3 water = mix(uDeepColor, uMidColor, 0.3 + 0.45 * skyLight);
    water += vec3(0.014, 0.026, 0.035) * mix(0.4, 1.0, detail);
    water = mix(water, uCrestColor, crest * (0.28 + skyLight * 0.35));
    water *= 0.80 + texel * 0.42;

    // A broad cold sky reflection and small, irregular specular flecks.
    vec3 reflected = reflect(-viewDir, normal);
    float sky = smoothstep(-0.15, 0.7, reflected.y);
    water += vec3(0.075, 0.12, 0.16) * fresnel * sky * 0.55;
    vec3 halfLight = normalize(viewDir + normalize(vec3(-0.4, 0.7, 0.45)));
    float specular = pow(max(dot(normal, halfLight), 0.0), mix(40.0, 100.0, detail));
    water += vec3(0.42, 0.57, 0.67) * specular * (0.1 + 0.38 * texel);

    float broken = smoothstep(0.35, 0.68, texel);
    float facet = smoothstep(0.22, 0.68, normal.y) * (0.28 + crest * 0.72);
    float bluePool = exp(-pow((p.x - 3.6 + normal.x * 2.0) / 4.0, 2.0));
    float redPool = exp(-pow((p.x + 3.8 + normal.x * 2.5) / 2.2, 2.0));
    water += uBlueReflect * bluePool * broken * facet * 0.28;
    water += uRedReflect * redPool * broken * facet * 0.14;

    // Sparse lace on high crests, never a continuous white/neon stripe.
    float foamGrain = noise(p * vec2(24.0, 37.0) + vec2(uTime * 0.13, 0.0));
    float foamPatch = noise(p * vec2(2.8, 4.2) - uTime * 0.08);
    float foam = smoothstep(0.18, 0.40, vElevation)
               * smoothstep(0.42, 0.68, foamPatch)
               * smoothstep(0.48, 0.72, foamGrain);
    water = mix(water, vec3(0.52, 0.66, 0.76), foam * mix(0.12, 0.48, detail));

    float haze = smoothstep(12.0, 35.0, distanceToEye);
    water = mix(water, vec3(0.024, 0.044, 0.065), haze * 0.68);
    gl_FragColor = vec4(water, 0.97);
  }
`,a=`
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vElevation;
  varying vec3 vNormal;
  varying float vSlope;

  vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(dot(hash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
          dot(hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
      mix(dot(hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 0.0)),
          dot(hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  // Gerstner wave: displaces vertex along wave direction
  vec3 gerstner(vec2 dir, float steepness, float wavelength, float speed, vec2 p, float t) {
    float k = 6.28318 / wavelength;
    float c = sqrt(9.8 / k) * speed;
    vec2 dx = dir * k;
    float f = dot(dx, p) - c * t;
    float a = steepness / k;
    return vec3(dir.x * a * cos(f), a * sin(f), dir.y * a * cos(f));
  }

  void main() {
    vUv = uv;
    vec3 pos = position;
    vec2 p = pos.xy;

    // 5 Gerstner waves with different directions, amplitudes, wavelengths, speeds
    vec3 g1 = gerstner(vec2(1.0, 0.0), 0.65, 8.0, 0.6, p, uTime);
    vec3 g2 = gerstner(vec2(0.7, 0.7), 0.52, 5.0, 0.8, p, uTime);
    vec3 g3 = gerstner(vec2(-0.5, 0.8), 0.42, 3.0, 1.1, p, uTime);
    vec3 g4 = gerstner(vec2(0.3, -0.9), 0.32, 2.0, 1.4, p, uTime);
    vec3 g5 = gerstner(vec2(-0.8, 0.3), 0.24, 1.2, 1.8, p, uTime);

    vec3 displacement = g1 + g2 + g3 + g4 + g5;

    // Add fine noise ripple for micro-detail
    float ripple = fbm(p * 0.8 + uTime * 0.2) * 0.08;
    float micro = fbm(p * 2.2 - uTime * 0.3) * 0.03;

    pos += displacement;
    pos.y += ripple + micro;

    vElevation = displacement.y + ripple + micro;

    // Compute normal from partial derivatives
    float eps = 0.01;
    vec2 pRight = p + vec2(eps, 0.0);
    vec2 pUp = p + vec2(0.0, eps);

    vec3 d1 = gerstner(vec2(1.0, 0.0), 0.65, 8.0, 0.6, pRight, uTime) -
              gerstner(vec2(1.0, 0.0), 0.65, 8.0, 0.6, p, uTime);
    vec3 d2 = gerstner(vec2(0.7, 0.7), 0.52, 5.0, 0.8, pRight, uTime) -
              gerstner(vec2(0.7, 0.7), 0.52, 5.0, 0.8, p, uTime);
    vec3 d3 = gerstner(vec2(-0.5, 0.8), 0.42, 3.0, 1.1, pRight, uTime) -
              gerstner(vec2(-0.5, 0.8), 0.42, 3.0, 1.1, p, uTime);
    vec3 d4 = gerstner(vec2(0.3, -0.9), 0.32, 2.0, 1.4, pRight, uTime) -
              gerstner(vec2(0.3, -0.9), 0.32, 2.0, 1.4, p, uTime);
    vec3 d5 = gerstner(vec2(-0.8, 0.3), 0.24, 1.2, 1.8, pRight, uTime) -
              gerstner(vec2(-0.8, 0.3), 0.24, 1.2, 1.8, p, uTime);

    vec3 dRight = (d1 + d2 + d3 + d4 + d5) / eps;

    vec3 d1u = gerstner(vec2(1.0, 0.0), 0.65, 8.0, 0.6, pUp, uTime) -
               gerstner(vec2(1.0, 0.0), 0.65, 8.0, 0.6, p, uTime);
    vec3 d2u = gerstner(vec2(0.7, 0.7), 0.52, 5.0, 0.8, pUp, uTime) -
               gerstner(vec2(0.7, 0.7), 0.52, 5.0, 0.8, p, uTime);
    vec3 d3u = gerstner(vec2(-0.5, 0.8), 0.42, 3.0, 1.1, pUp, uTime) -
               gerstner(vec2(-0.5, 0.8), 0.42, 3.0, 1.1, p, uTime);
    vec3 d4u = gerstner(vec2(0.3, -0.9), 0.32, 2.0, 1.4, pUp, uTime) -
               gerstner(vec2(0.3, -0.9), 0.32, 2.0, 1.4, p, uTime);
    vec3 d5u = gerstner(vec2(-0.8, 0.3), 0.24, 1.2, 1.8, pUp, uTime) -
               gerstner(vec2(-0.8, 0.3), 0.24, 1.2, 1.8, p, uTime);

    vec3 dUp = (d1u + d2u + d3u + d4u + d5u) / eps;

    vec3 tangent = normalize(vec3(dRight.x, dRight.y, 1.0));
    vec3 bitangent = normalize(vec3(dUp.x, dUp.y, 1.0));
    vec3 n = normalize(cross(bitangent, tangent));

    vec4 world = modelMatrix * vec4(pos, 1.0);
    vWorldPos = world.xyz;
    vNormal = normalize(normalMatrix * n);
    vSlope = length(dRight.xz) + length(dUp.xz);

    gl_Position = projectionMatrix * viewMatrix * world;
  }
`,l=(0,o.memo)(function({visible:e}){let l=(0,o.useRef)(null),[s]=(0,o.useState)(()=>(function(){try{let e=document.createElement("canvas");return!!(window.WebGLRenderingContext&&(e.getContext("webgl2")||e.getContext("webgl")||e.getContext("experimental-webgl")))}catch{return!1}})()),[c,v]=(0,o.useState)(!1);return((0,o.useEffect)(()=>{if(!e||!s||c)return;let t=0,o=null,m=null,p=null,d=null,u=null,f=!1,g=null,h=l.current;if(!h)return;let w=e=>{e.preventDefault(),v(!0)};try{let e=h.clientWidth||window.innerWidth,l=h.clientHeight||window.innerHeight;(o=new r.WebGLRenderer({antialias:!0,alpha:!0,powerPreference:"high-performance"})).setPixelRatio(Math.min(window.devicePixelRatio||1,1.5)),o.setSize(e,l),o.setClearColor(0,0),o.domElement.addEventListener("webglcontextlost",w),h.appendChild(o.domElement),m=new i.Scene,(p=new i.PerspectiveCamera(38,e/l,.1,100)).position.set(0,.6,7.2),p.lookAt(0,-.8,0);let s=new i.PlaneGeometry(50,32,220,130);u=new i.ShaderMaterial({vertexShader:a,fragmentShader:n,transparent:!0,uniforms:{uTime:{value:0},uDeepColor:{value:new i.Color(133140)},uMidColor:{value:new i.Color(464936)},uCrestColor:{value:new i.Color(5205386)},uRedReflect:{value:new i.Color(0xef4444)},uBlueReflect:{value:new i.Color(6849952)}}}),(d=new i.Mesh(s,u)).rotation.x=-Math.PI/2,d.position.y=-1.2,m.add(d),m.add(new i.AmbientLight(1714752,.6));let c=new i.PointLight(0xef4444,10,30,2);c.position.set(-5,2.5,3),m.add(c);let v=new i.PointLight(6849952,12,30,2);v.position.set(5,2,2.5),m.add(v);let g=new i.DirectionalLight(9089232,.7);g.position.set(0,8,2),m.add(g);let x=new i.Clock,b=()=>{if(f)return;let e=x.getElapsedTime();u&&(u.uniforms.uTime.value=e),p&&(p.position.x=.3*Math.sin(.08*e),p.position.y=.6+.04*Math.sin(.25*e),p.lookAt(0,-.8,0)),o&&m&&p&&o.render(m,p),t=requestAnimationFrame(b)};b()}catch{g=window.setTimeout(()=>v(!0),0)}let x=()=>{if(!o||!p||!h)return;let e=h.clientWidth||window.innerWidth,t=h.clientHeight||window.innerHeight;o.setSize(e,t),p.aspect=e/t,p.updateProjectionMatrix()};return window.addEventListener("resize",x),()=>{f=!0,cancelAnimationFrame(t),null!==g&&window.clearTimeout(g),window.removeEventListener("resize",x),d&&(d.geometry.dispose(),d.material.dispose()),o&&(o.domElement.removeEventListener("webglcontextlost",w),o?.dispose(),o.domElement.parentNode===h&&h.removeChild(o.domElement))}},[e,s,c]),e)?(0,t.jsx)("div",{ref:l,className:"pointer-events-none absolute inset-x-0 bottom-0 h-[58vh] overflow-hidden",style:{animation:"oceanRise 1200ms cubic-bezier(0.22, 1, 0.36, 1) both",maskImage:"linear-gradient(to bottom, transparent, black 24%)"},children:s&&!c?(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)("div",{className:"absolute inset-x-0 bottom-0 h-32",style:{background:"linear-gradient(to top, rgba(2,8,20,0.95), rgba(2,8,20,0))"}}),(0,t.jsx)("div",{className:"absolute inset-x-0 top-0 h-24",style:{background:"linear-gradient(to bottom, rgba(2,8,16,0.9), rgba(2,8,16,0))"}})]}):(0,t.jsx)("div",{className:"login-ocean-fallback absolute inset-0"})}):null});e.s(["Ocean",0,l,"default",0,l],228958)},390889,e=>{e.n(e.i(228958))}]);