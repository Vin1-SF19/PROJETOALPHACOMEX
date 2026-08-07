import type { PptxResolvedColor } from "./modelo-intermediario";
import type { NoXml } from "./xml-utils";

export interface ColorResolverContext {
  scheme: Record<string, string>;
  colorMap: Record<string, string>;
  placeholderColor?: string;
}

const PRESET_COLORS: Record<string, string> = {
  black: "#000000", white: "#FFFFFF", red: "#FF0000", green: "#008000", blue: "#0000FF",
  yellow: "#FFFF00", gray: "#808080", grey: "#808080", orange: "#FFA500", purple: "#800080",
  transparent: "#000000",
};

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeHex(value: string): string | null {
  const clean = value.replace(/^#/, "").trim();
  if (/^[0-9a-f]{6}$/i.test(clean)) return `#${clean.toUpperCase()}`;
  if (/^[0-9a-f]{8}$/i.test(clean)) return `#${clean.slice(0, 6).toUpperCase()}`;
  return null;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.slice(1);
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function rgbToHsl([r0, g0, b0]: [number, number, number]): [number, number, number] {
  const r = r0 / 255; const g = g0 / 255; const b = b0 / 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const delta = max - min;
  let h = 0;
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return [h, s, l];
}

function hslToRgb([h, s, l]: [number, number, number]): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const sector = ((h % 360) + 360) % 360;
  const base: [number, number, number] = sector < 60 ? [c, x, 0] : sector < 120 ? [x, c, 0]
    : sector < 180 ? [0, c, x] : sector < 240 ? [0, x, c] : sector < 300 ? [x, 0, c] : [c, 0, x];
  return base.map((v) => (v + m) * 255) as [number, number, number];
}

function numericChild(node: NoXml, name: string): number | undefined {
  const value = Number(node?.[`a:${name}`]?.["@_val"]);
  return Number.isFinite(value) ? value : undefined;
}

function applyTransforms(hex: string, colorNode: NoXml): { hex: string; alpha: number } {
  let rgb = hexToRgb(hex);
  const [h, initialS, initialL] = rgbToHsl(rgb);
  let s = initialS;
  let l = initialL;
  const tint = numericChild(colorNode, "tint");
  const shade = numericChild(colorNode, "shade");
  const lumMod = numericChild(colorNode, "lumMod");
  const lumOff = numericChild(colorNode, "lumOff");
  const satMod = numericChild(colorNode, "satMod");
  const satOff = numericChild(colorNode, "satOff");
  if (tint !== undefined) l += (1 - l) * (1 - tint / 100000);
  if (shade !== undefined) l *= shade / 100000;
  if (lumMod !== undefined) l *= lumMod / 100000;
  if (lumOff !== undefined) l += lumOff / 100000;
  if (satMod !== undefined) s *= satMod / 100000;
  if (satOff !== undefined) s += satOff / 100000;
  rgb = hslToRgb([h, clamp(s), clamp(l)]);

  let alpha = (numericChild(colorNode, "alpha") ?? 100000) / 100000;
  alpha *= (numericChild(colorNode, "alphaMod") ?? 100000) / 100000;
  alpha += (numericChild(colorNode, "alphaOff") ?? 0) / 100000;
  return { hex: rgbToHex(rgb), alpha: clamp(alpha) };
}

function result(hex: string, alpha: number, source: PptxResolvedColor["source"]): PptxResolvedColor {
  const [r, g, b] = hexToRgb(hex);
  return { hex, alpha, css: alpha >= 0.999 ? hex : `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(4))})`, source };
}

export function resolverCorOoxml(node: NoXml | undefined, context: ColorResolverContext): PptxResolvedColor | null {
  if (!node) return null;
  const candidates: Array<[string, PptxResolvedColor["source"], string | null]> = [];
  const srgb = node["a:srgbClr"];
  if (srgb) candidates.push(["a:srgbClr", "srgb", normalizeHex(String(srgb["@_val"] ?? ""))]);
  const sys = node["a:sysClr"];
  if (sys) candidates.push(["a:sysClr", "system", normalizeHex(String(sys["@_lastClr"] ?? ""))]);
  const scheme = node["a:schemeClr"];
  if (scheme) {
    const useName = String(scheme["@_val"] ?? "");
    if (useName === "phClr" && context.placeholderColor) candidates.push(["a:schemeClr", "placeholder", normalizeHex(context.placeholderColor)]);
    else {
      const slot = context.colorMap[useName] ?? useName;
      candidates.push(["a:schemeClr", "scheme", normalizeHex(context.scheme[slot] ?? "")]);
    }
  }
  const scrgb = node["a:scrgbClr"];
  if (scrgb) {
    const r = clamp(Number(scrgb["@_r"]) / 100000) * 255;
    const g = clamp(Number(scrgb["@_g"]) / 100000) * 255;
    const b = clamp(Number(scrgb["@_b"]) / 100000) * 255;
    candidates.push(["a:scrgbClr", "scrgb", rgbToHex([r, g, b])]);
  }
  const preset = node["a:prstClr"];
  if (preset) candidates.push(["a:prstClr", "preset", PRESET_COLORS[String(preset["@_val"] ?? "")] ?? null]);
  const hsl = node["a:hslClr"];
  if (hsl) {
    const h = Number(hsl["@_hue"]) / 60000;
    const s = Number(hsl["@_sat"]) / 100000;
    const l = Number(hsl["@_lum"]) / 100000;
    candidates.push(["a:hslClr", "hsl", [h, s, l].every(Number.isFinite) ? rgbToHex(hslToRgb([h, clamp(s), clamp(l)])) : null]);
  }

  for (const [key, source, hex] of candidates) {
    if (!hex) continue;
    const transformed = applyTransforms(hex, node[key]);
    return result(transformed.hex, transformed.alpha, source);
  }
  return null;
}
