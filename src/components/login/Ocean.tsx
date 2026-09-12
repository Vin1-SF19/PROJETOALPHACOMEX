"use client";

import { memo, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { oceanFragmentShader } from "./ocean-material";

type Props = {
  visible: boolean;
};

function detectWebgl(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

const vertexShader = /* glsl */ `
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
`;

function OceanComponent({ visible }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [useWebgl] = useState<boolean>(() => detectWebgl());
  const [webglFailed, setWebglFailed] = useState(false);

  useEffect(() => {
    if (!visible || !useWebgl || webglFailed) {
      return;
    }

    let raf = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let mesh: THREE.Mesh | null = null;
    let material: THREE.ShaderMaterial | null = null;
    let disposed = false;
    let failureTimer: number | null = null;

    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      setWebglFailed(true);
    };

    try {
      const width = mount.clientWidth || window.innerWidth;
      const height = mount.clientHeight || window.innerHeight;

      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(width, height);
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.addEventListener("webglcontextlost", handleContextLost);
      mount.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
      camera.position.set(0, 0.6, 7.2);
      camera.lookAt(0, -0.8, 0);

      const geo = new THREE.PlaneGeometry(50, 32, 220, 130);
      material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader: oceanFragmentShader,
        transparent: true,
        uniforms: {
          uTime: { value: 0 },
          uDeepColor: { value: new THREE.Color(0x020814) },
          uMidColor: { value: new THREE.Color(0x071828) },
          uCrestColor: { value: new THREE.Color(0x4f6d8a) },
          uRedReflect: { value: new THREE.Color(0xef4444) },
          uBlueReflect: { value: new THREE.Color(0x6885a0) },
        },
      });
      mesh = new THREE.Mesh(geo, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = -1.2;
      scene.add(mesh);

      scene.add(new THREE.AmbientLight(0x1a2a40, 0.6));

      const redLight = new THREE.PointLight(0xef4444, 10, 30, 2);
      redLight.position.set(-5, 2.5, 3.0);
      scene.add(redLight);

      const blueLight = new THREE.PointLight(0x6885a0, 12, 30, 2);
      blueLight.position.set(5, 2.0, 2.5);
      scene.add(blueLight);

      const keyLight = new THREE.DirectionalLight(0x8ab0d0, 0.7);
      keyLight.position.set(0, 8, 2);
      scene.add(keyLight);

      const clock = new THREE.Clock();

      const render = () => {
        if (disposed) return;
        const t = clock.getElapsedTime();
        if (material) {
          material.uniforms.uTime.value = t;
        }
        if (camera) {
          camera.position.x = Math.sin(t * 0.08) * 0.3;
          camera.position.y = 0.6 + Math.sin(t * 0.25) * 0.04;
          camera.lookAt(0, -0.8, 0);
        }
        if (renderer && scene && camera) {
          renderer.render(scene, camera);
        }
        raf = requestAnimationFrame(render);
      };
      render();
    } catch {
      failureTimer = window.setTimeout(() => setWebglFailed(true), 0);
    }

    const onResize = () => {
      if (!renderer || !camera || !mount) return;
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      if (failureTimer !== null) window.clearTimeout(failureTimer);
      window.removeEventListener("resize", onResize);
      if (mesh) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      if (renderer) {
        renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
        renderer?.dispose();
        if (renderer.domElement.parentNode === mount) {
          mount.removeChild(renderer.domElement);
        }
      }
    };
  }, [visible, useWebgl, webglFailed]);

  if (!visible) return null;

  return (
    <div
      ref={mountRef}
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[58vh] overflow-hidden"
      style={{
        animation: "oceanRise 1200ms cubic-bezier(0.22, 1, 0.36, 1) both",
        maskImage: "linear-gradient(to bottom, transparent, black 24%)",
      }}
    >
      {useWebgl && !webglFailed ? (
        <>
          <div
            className="absolute inset-x-0 bottom-0 h-32"
            style={{
              background:
                "linear-gradient(to top, rgba(2,8,20,0.95), rgba(2,8,20,0))",
            }}
          />
          <div
            className="absolute inset-x-0 top-0 h-24"
            style={{
              background:
                "linear-gradient(to bottom, rgba(2,8,16,0.9), rgba(2,8,16,0))",
            }}
          />
        </>
      ) : (
        <div className="login-ocean-fallback absolute inset-0" />
      )}
    </div>
  );
}

export const Ocean = memo(OceanComponent);
export default Ocean;
