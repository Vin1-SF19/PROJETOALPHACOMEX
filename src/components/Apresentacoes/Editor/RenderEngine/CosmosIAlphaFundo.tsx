"use client";

import { useMemo, useState, useEffect, useSyncExternalStore, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { FundoAnimadoComponente } from "@/lib/validations/slide-componentes";
import { hexParaRgb } from "./fundos-utils";

type PlanetId = "mercury" | "venus" | "earth" | "mars" | "jupiter" | "saturn" | "uranus" | "neptune";

/**
 * Adaptado de IAlphaCosmicBackground.tsx (chat do Bibble/IAlpha) — a mecânica orbital
 * kepleriana e as identidades visuais de cada planeta são preservadas 1:1 (não são
 * editáveis, são astronomicamente reais). O que vira editável no Presentation Studio:
 * cor (accent), velocidade (órbita + rotação própria), densidade (céu estrelado),
 * mostrarSol e quantidadePlanetas (corta a partir de Mercúrio).
 */

// Elementos orbitais médios J2000 (efemérides aproximadas do JPL, válidas 1800–2050).
interface OrbitalElements {
  id: PlanetId;
  semiMajorAxis: number;
  eccentricity: number;
  meanLongitude: number;
  meanLongitudeRate: number;
  perihelionLongitude: number;
}

const ORBITAL_ELEMENTS: OrbitalElements[] = [
  { id: "mercury", semiMajorAxis: 0.38709927, eccentricity: 0.20563593, meanLongitude: 252.2503235, meanLongitudeRate: 149472.67411175, perihelionLongitude: 77.45779628 },
  { id: "venus", semiMajorAxis: 0.72333566, eccentricity: 0.00677672, meanLongitude: 181.9790995, meanLongitudeRate: 58517.81538729, perihelionLongitude: 131.60246718 },
  { id: "earth", semiMajorAxis: 1.00000261, eccentricity: 0.01671123, meanLongitude: 100.46457166, meanLongitudeRate: 35999.37244981, perihelionLongitude: 102.93768193 },
  { id: "mars", semiMajorAxis: 1.52371034, eccentricity: 0.0933941, meanLongitude: -4.55343205, meanLongitudeRate: 19140.30268499, perihelionLongitude: -23.94362959 },
  { id: "jupiter", semiMajorAxis: 5.202887, eccentricity: 0.04838624, meanLongitude: 34.39644051, meanLongitudeRate: 3034.74612775, perihelionLongitude: 14.72847983 },
  { id: "saturn", semiMajorAxis: 9.53667594, eccentricity: 0.05386179, meanLongitude: 49.95424423, meanLongitudeRate: 1222.49362201, perihelionLongitude: 92.59887831 },
  { id: "uranus", semiMajorAxis: 19.18916464, eccentricity: 0.04725744, meanLongitude: 313.23810451, meanLongitudeRate: 428.48202785, perihelionLongitude: 170.9542763 },
  { id: "neptune", semiMajorAxis: 30.06992276, eccentricity: 0.00859048, meanLongitude: -55.12002969, meanLongitudeRate: 218.45945325, perihelionLongitude: 44.96476227 },
];

const NOISE_TILE = 140;

function noiseTexture(baseFrequency: string, octaves: number, seed: number) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${NOISE_TILE}' height='${NOISE_TILE}'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${baseFrequency}' numOctaves='${octaves}' seed='${seed}' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='${NOISE_TILE}' height='${NOISE_TILE}' filter='url(#n)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

interface PlanetPalette { light: string; mid: string; dark: string }

interface PlanetVisual {
  size: number;
  kind: "rocky" | "gas" | "ice";
  palette: PlanetPalette;
  surfaceExtras?: string[];
  bands?: string;
  spot?: string;
  clouds: boolean;
  atmosphere: string;
  atmosphereStrength: number;
  noiseFrequency: string;
  noiseOctaves: number;
  noiseSeed: number;
  textureOpacity: number;
  textureBlend: "overlay" | "soft-light";
  axialTilt: number;
  rotationPeriodHours: number;
  ring: boolean;
  floatDuration: number;
  floatDistance: number;
}

const PLANET_VISUALS: Record<PlanetId, PlanetVisual> = {
  mercury: {
    size: 10, kind: "rocky",
    palette: { light: "#dde3ec", mid: "#8b95a6", dark: "#20293a" },
    surfaceExtras: [
      "radial-gradient(circle at 62% 58%, rgba(16,22,36,0.4) 0%, transparent 12%)",
      "radial-gradient(circle at 34% 66%, rgba(16,22,36,0.34) 0%, transparent 9%)",
    ],
    clouds: false, atmosphere: "148,163,184", atmosphereStrength: 0.22,
    noiseFrequency: "0.32", noiseOctaves: 4, noiseSeed: 11, textureOpacity: 0.55, textureBlend: "overlay",
    axialTilt: 2, rotationPeriodHours: 1407.6, ring: false, floatDuration: 11, floatDistance: 4,
  },
  venus: {
    size: 16, kind: "rocky",
    palette: { light: "#fdf3da", mid: "#dcb278", dark: "#5f431c" },
    clouds: false, atmosphere: "244,220,170", atmosphereStrength: 0.55,
    noiseFrequency: "0.07 0.16", noiseOctaves: 4, noiseSeed: 23, textureOpacity: 0.5, textureBlend: "soft-light",
    axialTilt: -3, rotationPeriodHours: -5832.5, ring: false, floatDuration: 13, floatDistance: 5,
  },
  earth: {
    size: 18, kind: "rocky",
    palette: { light: "#a7cdf8", mid: "#2e6fd8", dark: "#081d49" },
    surfaceExtras: [
      "radial-gradient(ellipse at 38% 42%, rgba(56,170,104,0.6) 0%, rgba(56,170,104,0.22) 9%, transparent 16%)",
      "radial-gradient(ellipse at 68% 60%, rgba(74,164,96,0.5) 0%, transparent 13%)",
      "radial-gradient(circle at 50% 6%, rgba(255,255,255,0.55) 0%, transparent 10%)",
    ],
    clouds: true, atmosphere: "125,190,255", atmosphereStrength: 0.9,
    noiseFrequency: "0.18", noiseOctaves: 4, noiseSeed: 37, textureOpacity: 0.35, textureBlend: "overlay",
    axialTilt: 23, rotationPeriodHours: 23.93, ring: false, floatDuration: 14, floatDistance: 5,
  },
  mars: {
    size: 13, kind: "rocky",
    palette: { light: "#f5bd90", mid: "#b95419", dark: "#331104" },
    surfaceExtras: [
      "radial-gradient(circle at 52% 8%, rgba(255,244,235,0.6) 0%, transparent 12%)",
      "radial-gradient(ellipse at 60% 55%, rgba(64,22,7,0.45) 0%, transparent 22%)",
    ],
    clouds: false, atmosphere: "240,170,120", atmosphereStrength: 0.28,
    noiseFrequency: "0.3", noiseOctaves: 4, noiseSeed: 47, textureOpacity: 0.5, textureBlend: "overlay",
    axialTilt: 25, rotationPeriodHours: 24.62, ring: false, floatDuration: 12, floatDistance: 4,
  },
  jupiter: {
    size: 40, kind: "gas",
    palette: { light: "#f4e6ca", mid: "#c9a06b", dark: "#42301b" },
    bands: "linear-gradient(98deg, #c9a06b 0%, #eedec0 9%, #b98a52 17%, #e7d6b4 26%, #a5713f 35%, #f0e2c4 45%, #bd9059 54%, #e4d0ab 63%, #a97a45 72%, #ead9b8 82%, #b9895a 91%, #d9c39a 100%)",
    spot: "radial-gradient(ellipse at 63% 66%, rgba(196,90,58,0.8) 0%, rgba(196,90,58,0.35) 5%, transparent 11%)",
    clouds: false, atmosphere: "236,210,160", atmosphereStrength: 0.45,
    noiseFrequency: "0.02 0.22", noiseOctaves: 4, noiseSeed: 59, textureOpacity: 0.5, textureBlend: "soft-light",
    axialTilt: 8, rotationPeriodHours: 9.93, ring: false, floatDuration: 19, floatDistance: 7,
  },
  saturn: {
    size: 34, kind: "gas",
    palette: { light: "#f6e9c9", mid: "#d6b378", dark: "#4d3a1e" },
    bands: "linear-gradient(117deg, #d6b378 0%, #efe2c0 14%, #c8a263 28%, #ecdcb8 42%, #bb9355 57%, #ead9b5 72%, #cda868 86%, #e6d4ae 100%)",
    clouds: false, atmosphere: "240,220,170", atmosphereStrength: 0.4,
    noiseFrequency: "0.02 0.18", noiseOctaves: 3, noiseSeed: 71, textureOpacity: 0.42, textureBlend: "soft-light",
    axialTilt: 27, rotationPeriodHours: 10.66, ring: true, floatDuration: 21, floatDistance: 7,
  },
  uranus: {
    size: 24, kind: "ice",
    palette: { light: "#e2fbff", mid: "#79cfe0", dark: "#0b3d4d" },
    surfaceExtras: ["linear-gradient(172deg, rgba(190,238,246,0.35) 0%, rgba(110,195,212,0.12) 50%, rgba(190,238,246,0.35) 100%)"],
    clouds: false, atmosphere: "150,230,245", atmosphereStrength: 0.5,
    noiseFrequency: "0.05 0.1", noiseOctaves: 3, noiseSeed: 83, textureOpacity: 0.3, textureBlend: "soft-light",
    axialTilt: 82, rotationPeriodHours: -17.24, ring: false, floatDuration: 17, floatDistance: 6,
  },
  neptune: {
    size: 22, kind: "ice",
    palette: { light: "#b3ccff", mid: "#3f6fe0", dark: "#0c2361" },
    spot: "radial-gradient(ellipse at 42% 58%, rgba(8,22,72,0.7) 0%, transparent 12%)",
    clouds: false, atmosphere: "120,170,255", atmosphereStrength: 0.6,
    noiseFrequency: "0.04 0.14", noiseOctaves: 3, noiseSeed: 97, textureOpacity: 0.35, textureBlend: "soft-light",
    axialTilt: 28, rotationPeriodHours: 16.11, ring: false, floatDuration: 18, floatDistance: 6,
  },
};

const PLANET_NOISE: Record<PlanetId, string> = Object.fromEntries(
  (Object.keys(PLANET_VISUALS) as PlanetId[]).map((id) => {
    const visual = PLANET_VISUALS[id];
    return [id, noiseTexture(visual.noiseFrequency, visual.noiseOctaves, visual.noiseSeed)];
  }),
) as Record<PlanetId, string>;

const SUN_NOISE = noiseTexture("0.16", 3, 7);

const SUN_POSITION = { left: 33, top: 41 };
const PLANE_TILT = 0.36;
const DEG_TO_RAD = Math.PI / 180;
const PLANE_ROTATION_RAD = -14 * DEG_TO_RAD;
const J2000_JULIAN_DATE = 2451545.0;

interface PlanetScenePosition {
  id: PlanetId;
  left: number;
  top: number;
  depth: number;
  scale: number;
  opacity: number;
  zIndex: number;
  blur: number;
}

interface CosmicScene { planets: PlanetScenePosition[]; moonAngleRad: number }

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function wrapDegrees(value: number) {
  const wrapped = value % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

function heliocentricLongitudeRad(elements: OrbitalElements, julianCenturies: number) {
  const meanLongitude = elements.meanLongitude + elements.meanLongitudeRate * julianCenturies;
  const meanAnomalyRad = wrapDegrees(meanLongitude - elements.perihelionLongitude) * DEG_TO_RAD;
  let eccentricAnomalyRad = meanAnomalyRad;
  for (let step = 0; step < 8; step++) {
    eccentricAnomalyRad = meanAnomalyRad + elements.eccentricity * Math.sin(eccentricAnomalyRad);
  }
  const trueAnomalyRad = 2 * Math.atan2(
    Math.sqrt(1 + elements.eccentricity) * Math.sin(eccentricAnomalyRad / 2),
    Math.sqrt(1 - elements.eccentricity) * Math.cos(eccentricAnomalyRad / 2),
  );
  return trueAnomalyRad + elements.perihelionLongitude * DEG_TO_RAD;
}

function orbitDisplayRadius(semiMajorAxis: number) {
  const minLog = Math.log10(0.387);
  const maxLog = Math.log10(30.07);
  const normalized = (Math.log10(semiMajorAxis) - minLog) / (maxLog - minLog);
  return 13 + normalized * 33;
}

function computeCosmicScene(nowMs: number, planetas: OrbitalElements[]): CosmicScene {
  const julianDate = nowMs / 86400000 + 2440587.5;
  const julianCenturies = (julianDate - J2000_JULIAN_DATE) / 36525;
  const daysSinceJ2000 = julianDate - J2000_JULIAN_DATE;
  const moonAngleRad = wrapDegrees(218.316 + 13.176396 * daysSinceJ2000) * DEG_TO_RAD;
  const cosRotation = Math.cos(PLANE_ROTATION_RAD);
  const sinRotation = Math.sin(PLANE_ROTATION_RAD);

  const planets = planetas.map((elements) => {
    const angleRad = heliocentricLongitudeRad(elements, julianCenturies);
    const radius = orbitDisplayRadius(elements.semiMajorAxis);
    const planeX = radius * Math.cos(angleRad);
    const planeY = radius * Math.sin(angleRad) * PLANE_TILT;
    const depth = Math.sin(angleRad);
    return {
      id: elements.id,
      left: SUN_POSITION.left + planeX * cosRotation - planeY * sinRotation,
      top: SUN_POSITION.top + (planeX * sinRotation + planeY * cosRotation) * 0.92,
      depth,
      scale: 0.84 + ((depth + 1) / 2) * 0.28,
      opacity: 0.5 + ((depth + 1) / 2) * 0.4,
      zIndex: 10 + Math.round(depth * 4),
      blur: depth < 0 ? Number((-depth * 1.4).toFixed(2)) : 0,
    };
  });

  return { planets, moonAngleRad };
}

interface StarPoint { horizontal: number; vertical: number; opacity: number; tint: string }

const STAR_TINTS = { white: "255,255,255", blueWhite: "219,234,254", blue: "165,200,252", warm: "253,224,168" };

function createSeededRandom(seed: number) {
  let currentSeed = seed;
  return () => {
    currentSeed = (currentSeed * 1664525 + 1013904223) % 4294967296;
    return currentSeed / 4294967296;
  };
}

function pickStarTint(roll: number) {
  if (roll < 0.62) return STAR_TINTS.white;
  if (roll < 0.86) return STAR_TINTS.blueWhite;
  if (roll < 0.96) return STAR_TINTS.blue;
  return STAR_TINTS.warm;
}

function createStarLayer(seed: number, amount: number): StarPoint[] {
  const random = createSeededRandom(seed);
  return Array.from({ length: amount }, () => ({
    horizontal: Number((random() * 100).toFixed(2)),
    vertical: Number((random() * 100).toFixed(2)),
    opacity: Number((0.18 + random() * 0.78).toFixed(2)),
    tint: pickStarTint(random()),
  }));
}

function toBoxShadow(stars: StarPoint[], spread: number, blurPx = 0) {
  return stars.map((star) => `${star.horizontal}vw ${star.vertical}vh ${blurPx}px ${spread}px rgba(${star.tint},${star.opacity})`).join(",");
}

function criarStarLayers(densidade: number) {
  return [
    { id: "near", className: "h-0.5 w-0.5", boxShadow: toBoxShadow(createStarLayer(173, Math.round(84 * densidade)), 0), duration: 8, driftScale: 1 },
    { id: "mid", className: "h-px w-px", boxShadow: toBoxShadow(createStarLayer(421, Math.round(126 * densidade)), 0), duration: 13, driftScale: 0.72 },
    { id: "far", className: "h-px w-px opacity-60", boxShadow: toBoxShadow(createStarLayer(911, Math.round(168 * densidade)), 0), duration: 19, driftScale: 0.44 },
    { id: "bright", className: "h-0.5 w-0.5", boxShadow: toBoxShadow(createStarLayer(557, Math.round(18 * densidade)), 0.5, 2), duration: 11, driftScale: 0.85 },
  ];
}

// Relógio como external store: SSR renderiza sem planetas (snapshot null) e o cliente assume após a hidratação.
const SCENE_TICK_MS = 2_000;
const ORBIT_TIME_LAPSE_BASE = 80_000;
const SPIN_TIME_LAPSE_BASE = 3_600;

function subscribeToSceneClock(onStoreChange: () => void) {
  const timer = setInterval(onStoreChange, SCENE_TICK_MS);
  return () => clearInterval(timer);
}

function getSceneTickSnapshot(): number | null {
  return Math.floor(Date.now() / SCENE_TICK_MS);
}

function getServerSceneSnapshot(): number | null {
  return null;
}

interface SpinState { periodSeconds: number; delaySeconds: number; reverse: boolean; offsetPx: number }

function computeSpin(rotationPeriodHours: number, epochMs: number, spinTimeLapse: number): SpinState {
  const periodMs = Math.abs(rotationPeriodHours) * 3_600_000;
  const periodSeconds = periodMs / 1000 / spinTimeLapse;
  const phase = ((epochMs * spinTimeLapse) % periodMs) / periodMs;
  return {
    periodSeconds,
    delaySeconds: phase * periodSeconds,
    reverse: rotationPeriodHours < 0,
    offsetPx: phase * NOISE_TILE,
  };
}

function spinAnimationStyle(spin: SpinState, reduceMotion: boolean): CSSProperties {
  if (reduceMotion) return { backgroundPositionX: `${spin.offsetPx.toFixed(1)}px` };
  return {
    animationName: "ialpha-planet-spin",
    animationDuration: `${spin.periodSeconds.toFixed(1)}s`,
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
    animationDirection: spin.reverse ? "reverse" : "normal",
    animationDelay: `-${spin.delaySeconds.toFixed(1)}s`,
  };
}

export function CosmosIAlphaFundo({ componente }: { componente: FundoAnimadoComponente }) {
  const reduceMotion = useReducedMotion();
  const accent = hexParaRgb(componente.corPrimaria);
  const velocidade = Math.max(0.1, componente.velocidade);
  const densidade = componente.densidade;
  const planetasVisiveis = useMemo(
    () => ORBITAL_ELEMENTS.slice(0, clamp(componente.quantidadePlanetas, 1, ORBITAL_ELEMENTS.length)),
    [componente.quantidadePlanetas],
  );

  // Hora computada só no cliente (evita mismatch de hidratação) — dia/noite só afeta a opacidade das estrelas.
  const [horaAtual, setHoraAtual] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hora real só pode ser lida no client (evita mismatch de hidratação com o SSR)
    setHoraAtual(new Date().getHours());
    const timer = setInterval(() => setHoraAtual(new Date().getHours()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const isNight = horaAtual !== null && (horaAtual >= 18 || horaAtual < 6);
  const starOpacity = isNight ? 0.95 : 0.78;

  const starLayers = useMemo(() => criarStarLayers(densidade), [densidade]);

  const nowTick = useSyncExternalStore(subscribeToSceneClock, getSceneTickSnapshot, getServerSceneSnapshot);
  const [epochMs] = useState(() => Date.now());

  const scene = useMemo(() => {
    if (nowTick === null) return null;
    const realMs = nowTick * SCENE_TICK_MS;
    const lapse = reduceMotion ? 1 : ORBIT_TIME_LAPSE_BASE * velocidade;
    const simulatedMs = epochMs + Math.max(0, realMs - epochMs) * lapse;
    return computeCosmicScene(simulatedMs, planetasVisiveis);
  }, [nowTick, epochMs, reduceMotion, velocidade, planetasVisiveis]);

  const spinTimeLapse = SPIN_TIME_LAPSE_BASE * velocidade;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-[#020617]">
      <style>{`@keyframes ialpha-planet-spin { from { background-position-x: 0px; } to { background-position-x: ${NOISE_TILE}px; } }`}</style>

      <div
        className="absolute inset-0"
        style={{
          background: [
            `radial-gradient(circle at ${SUN_POSITION.left}% ${SUN_POSITION.top}%, rgba(251,146,60,0.08) 0%, transparent 34%)`,
            `radial-gradient(circle at 68% 66%, rgba(${accent},0.1) 0%, transparent 44%)`,
            "linear-gradient(148deg, #020617 0%, #061229 36%, #0b1b3f 68%, #020617 100%)",
          ].join(","),
        }}
      />

      <div
        className="absolute left-[-20%] top-[6%] h-[58%] w-[140%] rotate-[-16deg] blur-3xl"
        style={{ background: "linear-gradient(90deg, transparent 0%, rgba(96,165,250,0.07) 26%, rgba(147,197,253,0.13) 50%, rgba(96,165,250,0.07) 74%, transparent 100%)" }}
      />

      <motion.div
        className="absolute left-[58%] top-[12%] h-96 w-96 rounded-full blur-3xl"
        style={{ background: `rgba(${accent},0.1)` }}
        animate={reduceMotion ? undefined : { opacity: [0.24, 0.48, 0.24], scale: [0.94, 1.08, 0.94] }}
        transition={{ duration: 13 / velocidade, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute left-[6%] top-[58%] h-80 w-80 rounded-full blur-3xl"
        style={{ background: "rgba(30,64,175,0.16)" }}
        animate={reduceMotion ? undefined : { opacity: [0.2, 0.42, 0.2], scale: [1.04, 0.92, 1.04] }}
        transition={{ duration: 17 / velocidade, repeat: Infinity, ease: "easeInOut" }}
      />

      {starLayers.map((layer) => (
        <motion.div
          key={layer.id}
          className={`absolute left-0 top-0 rounded-full ${layer.className}`}
          style={{ boxShadow: layer.boxShadow, opacity: starOpacity }}
          animate={reduceMotion ? undefined : {
            opacity: [starOpacity * 0.62, starOpacity, starOpacity * 0.62],
            x: [0, 10 * layer.driftScale, 0],
            y: [0, -6 * layer.driftScale, 0],
          }}
          transition={{ duration: layer.duration / velocidade, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}

      {componente.mostrarSol && (
        <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${SUN_POSITION.left}%`, top: `${SUN_POSITION.top}%`, zIndex: 10 }}>
          <div
            className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(251,146,60,0.22) 0%, rgba(249,115,22,0.08) 48%, transparent 74%)" }}
          />
          <motion.div
            className="relative isolate h-24 w-24 overflow-hidden rounded-full"
            style={{
              background: "radial-gradient(circle at 44% 40%, #fff7d6 0%, #fbbf24 30%, rgba(249,115,22,0.85) 58%, rgba(194,65,12,0.28) 78%, transparent 100%)",
              boxShadow: "0 0 60px rgba(251,191,36,0.4), 0 0 140px rgba(249,115,22,0.2)",
            }}
            animate={reduceMotion ? undefined : { scale: [1, 1.05, 1], opacity: [0.9, 1, 0.9] }}
            transition={{ duration: 9 / velocidade, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.div
              className="absolute inset-[-20%] rounded-full opacity-40 mix-blend-soft-light"
              style={{ backgroundImage: SUN_NOISE }}
              animate={reduceMotion ? undefined : { backgroundPositionX: ["0px", `${NOISE_TILE}px`] }}
              transition={{ duration: 42 / velocidade, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
        </div>
      )}

      {scene?.planets.map((planet) => {
        const visual = PLANET_VISUALS[planet.id];
        const size = visual.size * planet.scale;

        const lightAngle = Math.atan2(SUN_POSITION.top - planet.top, SUN_POSITION.left - planet.left);
        const lightX = clamp(50 + Math.cos(lightAngle) * 30, 10, 90);
        const lightY = clamp(50 + Math.sin(lightAngle) * 30, 10, 90);
        const shadeX = clamp(50 - Math.cos(lightAngle) * 40, 0, 100);
        const shadeY = clamp(50 - Math.sin(lightAngle) * 40, 0, 100);

        const baseSurface = visual.bands ?? `radial-gradient(circle at ${lightX}% ${lightY}%, ${visual.palette.light} 0%, ${visual.palette.mid} 44%, ${visual.palette.dark} 80%)`;
        const surfaceBackground = [...(visual.surfaceExtras ?? []), baseSurface].join(",");

        const rimOffset = size * 0.14;
        const rimShadow = [
          `inset ${(Math.cos(lightAngle) * rimOffset).toFixed(1)}px ${(Math.sin(lightAngle) * rimOffset).toFixed(1)}px ${(size * 0.3).toFixed(1)}px rgba(${visual.atmosphere},${(0.55 * visual.atmosphereStrength).toFixed(2)})`,
          `0 0 ${(size * 0.55).toFixed(1)}px rgba(${visual.atmosphere},${(0.22 * visual.atmosphereStrength).toFixed(2)})`,
        ].join(",");

        const depthFactor = (planet.depth + 1) / 2;
        const saturation = (0.72 + depthFactor * 0.38).toFixed(2);
        const contrast = (0.92 + depthFactor * 0.14).toFixed(2);
        const sphereFilter = [planet.blur > 0 ? `blur(${planet.blur}px)` : "", `saturate(${saturation})`, `contrast(${contrast})`].filter(Boolean).join(" ");

        const spin = computeSpin(visual.rotationPeriodHours, epochMs, spinTimeLapse);
        const cloudSpin = visual.clouds ? computeSpin(visual.rotationPeriodHours * 0.68, epochMs, spinTimeLapse) : null;

        return (
          <div
            key={planet.id}
            data-planet={planet.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${planet.left}%`, top: `${planet.top}%`, zIndex: planet.zIndex, transition: `left ${SCENE_TICK_MS}ms linear, top ${SCENE_TICK_MS}ms linear` }}
          >
            <motion.div
              className="relative"
              style={{ width: size, height: size, filter: sphereFilter }}
              initial={{ opacity: 0 }}
              animate={reduceMotion ? { opacity: planet.opacity } : { opacity: planet.opacity, y: [0, -visual.floatDistance, 0] }}
              transition={{
                opacity: { duration: 1.6, ease: "easeOut" },
                y: { duration: visual.floatDuration / velocidade, repeat: Infinity, ease: "easeInOut" },
              }}
            >
              <div className="absolute inset-0 isolate overflow-hidden rounded-full" style={{ background: surfaceBackground, boxShadow: rimShadow }}>
                <div
                  data-spin={planet.id}
                  className="absolute inset-[-25%]"
                  style={{
                    backgroundImage: PLANET_NOISE[planet.id],
                    mixBlendMode: visual.textureBlend,
                    opacity: visual.textureOpacity,
                    rotate: `${visual.axialTilt}deg`,
                    ...spinAnimationStyle(spin, reduceMotion === true),
                  }}
                />

                {cloudSpin && (
                  <div
                    className="absolute inset-[-25%] mix-blend-screen"
                    style={{
                      backgroundImage: PLANET_NOISE[planet.id],
                      opacity: 0.42,
                      rotate: `${visual.axialTilt}deg`,
                      ...spinAnimationStyle(cloudSpin, reduceMotion === true),
                    }}
                  />
                )}

                {visual.spot && <div className="absolute inset-0" style={{ background: visual.spot }} />}

                <div
                  className="absolute inset-0 mix-blend-screen"
                  style={{ background: `radial-gradient(circle at ${lightX}% ${lightY}%, rgba(255,244,224,0.42) 0%, rgba(255,244,224,0.1) 34%, transparent 58%)` }}
                />

                <div
                  className="absolute inset-0"
                  style={{ background: `radial-gradient(circle at ${shadeX}% ${shadeY}%, rgba(2,8,23,0.92) 0%, rgba(2,8,23,0.55) 32%, transparent 62%)` }}
                />
              </div>

              {visual.ring && (
                <div
                  className="absolute left-1/2 top-1/2"
                  style={{
                    width: size * 2.4,
                    height: size * 0.95,
                    transform: "translate(-50%, -50%) rotate(-24deg)",
                    background: "radial-gradient(ellipse closest-side, transparent 55%, rgba(242,224,186,0.08) 58%, rgba(242,224,186,0.34) 66%, rgba(150,120,80,0.1) 72%, rgba(242,224,186,0.28) 79%, rgba(242,224,186,0.08) 86%, transparent 92%)",
                  }}
                />
              )}

              {planet.id === "earth" && scene && (
                <div
                  className="absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-slate-200/80"
                  style={{
                    transform: `translate(calc(-50% + ${(Math.cos(scene.moonAngleRad) * size * 1.05).toFixed(1)}px), calc(-50% + ${(Math.sin(scene.moonAngleRad) * size * 0.45).toFixed(1)}px))`,
                    transition: `transform ${SCENE_TICK_MS}ms linear`,
                  }}
                />
              )}
            </motion.div>
          </div>
        );
      })}

      <motion.div
        className="absolute -right-20 top-[20%] h-px w-56 rotate-[-22deg] rounded-full bg-gradient-to-r from-transparent via-white/70 to-transparent"
        animate={reduceMotion ? undefined : { x: [0, -560], y: [0, 220], opacity: [0, 0.4, 0] }}
        transition={{ duration: 5 / velocidade, repeat: Infinity, repeatDelay: isNight ? 7 : 13, ease: "easeInOut" }}
      />

      <div className="absolute inset-0 z-20 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(2,6,23,0.16)_52%,rgba(2,6,23,0.68)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 z-20 h-48 bg-gradient-to-t from-[#020617] via-[#020617]/72 to-transparent" />
    </div>
  );
}
