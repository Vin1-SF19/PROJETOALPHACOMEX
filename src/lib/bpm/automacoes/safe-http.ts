import "server-only";

import { isIP } from "node:net";
import { resolve4, resolve6 } from "node:dns/promises";

import { chamadaHttpSchema } from "./central-schemas";

const MAX_RESPOSTA = 1_048_576;
const HEADERS_PROIBIDOS = /^(authorization|proxy-authorization|cookie|set-cookie|host|x-forwarded-|x-real-ip|connection)/i;

function ipv4Privado(ip: string): boolean {
  const partes = ip.split(".").map(Number);
  if (partes.length !== 4 || partes.some((v) => !Number.isInteger(v) || v < 0 || v > 255)) return true;
  const [a, b] = partes;
  return a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254
    || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127;
}

function ipv6Privado(ip: string): boolean {
  const normalizado = ip.toLowerCase();
  return normalizado === "::" || normalizado === "::1" || normalizado.startsWith("fc")
    || normalizado.startsWith("fd") || /^fe[89ab]/.test(normalizado) || normalizado.startsWith("::ffff:");
}

async function validarDestino(url: URL): Promise<void> {
  if (url.protocol !== "https:") throw new Error("A integração aceita apenas HTTPS");
  if (url.username || url.password) throw new Error("Credenciais na URL não são permitidas");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) throw new Error("Destino privado não permitido");
  const ips = isIP(host) ? [host] : [...await resolve4(host).catch(() => []), ...await resolve6(host).catch(() => [])];
  if (ips.length === 0) throw new Error("Destino sem DNS público válido");
  if (ips.some((ip) => isIP(ip) === 4 ? ipv4Privado(ip) : ipv6Privado(ip))) throw new Error("Destino privado não permitido");
}

export async function executarHttpSeguro(input: unknown, idempotencyKey: string) {
  const config = chamadaHttpSchema.parse(input);
  const headers = new Headers({ "content-type": "application/json", "user-agent": "PainelAlpha-Automacoes/1.0", "idempotency-key": idempotencyKey });
  for (const [nome, valor] of Object.entries(config.headers)) {
    if (HEADERS_PROIBIDOS.test(nome)) throw new Error(`Header não permitido: ${nome}`);
    headers.set(nome, valor);
  }
  let url = new URL(config.url);
  let redirecionamentos = 0;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    while (true) {
      await validarDestino(url);
      const resposta = await fetch(url, {
        method: config.metodo, headers, redirect: "manual", signal: controller.signal,
        body: config.metodo === "GET" || config.corpo === undefined ? undefined : JSON.stringify(config.corpo),
      });
      if ([301, 302, 303, 307, 308].includes(resposta.status)) {
        if (++redirecionamentos > 3) throw new Error("Muitos redirecionamentos");
        const location = resposta.headers.get("location");
        if (!location) throw new Error("Redirecionamento sem destino");
        url = new URL(location, url); continue;
      }
      const tamanho = Number(resposta.headers.get("content-length") ?? 0);
      if (tamanho > MAX_RESPOSTA) throw new Error("Resposta excede 1 MB");
      const bytes = new Uint8Array(await resposta.arrayBuffer());
      if (bytes.byteLength > MAX_RESPOSTA) throw new Error("Resposta excede 1 MB");
      const texto = new TextDecoder().decode(bytes);
      let corpo: unknown = texto.slice(0, 20_000);
      try { corpo = texto ? JSON.parse(texto) : null; } catch { /* texto é retorno válido */ }
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}: ${texto.slice(0, 500)}`);
      return { status: resposta.status, contentType: resposta.headers.get("content-type"), corpo };
    }
  } finally { clearTimeout(timer); }
}
