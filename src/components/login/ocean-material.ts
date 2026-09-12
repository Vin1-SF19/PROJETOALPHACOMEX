// Surface shading only. Wave displacement and its clock remain in Ocean.tsx.
export const oceanFragmentShader = /* glsl */ `
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
`;
