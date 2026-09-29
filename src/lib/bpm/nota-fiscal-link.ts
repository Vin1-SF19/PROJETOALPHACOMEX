import "server-only";

import { resolve4, resolve6 } from "node:dns/promises";
import { request } from "node:https";
import { BlockList, isIP } from "node:net";

import { linkNotaFiscalHttps } from "@/lib/bpm/financeiro-nota-fiscal";

const bloqueados = new BlockList();
for (const [ip, prefixo] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24],
  ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) bloqueados.addSubnet(ip, prefixo, "ipv4");
for (const [ip, prefixo] of [
  ["::", 128], ["::1", 128], ["fc00::", 7], ["fe80::", 10],
  ["ff00::", 8], ["2001:db8::", 32],
] as const) bloqueados.addSubnet(ip, prefixo, "ipv6");

function enderecoPublico(ip: string): boolean {
  const familia = isIP(ip);
  return Boolean(familia) && !ip.toLowerCase().includes("::ffff:")
    && !bloqueados.check(ip, familia === 4 ? "ipv4" : "ipv6");
}

async function requisicaoCabecalho(url: URL): Promise<{ status: number; destino: string | null }> {
  if (!linkNotaFiscalHttps(url.href)) throw new Error("Link da NF deve usar HTTPS válido.");
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new Error("Link da NF aponta para destino privado.");
  }
  const ips = isIP(host) ? [host] : [...await resolve4(host).catch(() => []), ...await resolve6(host).catch(() => [])];
  if (!ips.length || ips.some((ip) => !enderecoPublico(ip))) throw new Error("Link da NF sem endereço público válido.");
  const ip = ips[0];
  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: "HEAD", timeout: 5_000, headers: { "user-agent": "PainelAlpha-NF/1.0" },
      lookup: (_hostname, _options, callback) => callback(null, ip, isIP(ip)),
    }, (res) => {
      const status = res.statusCode ?? 0;
      const destino = res.headers.location ?? null;
      res.resume();
      resolve({ status, destino });
    });
    req.on("timeout", () => req.destroy(new Error("Tempo esgotado ao consultar link da NF.")));
    req.on("error", reject);
    req.end();
  });
}

/** Consulta apenas cabeçalhos, sem baixar a NF, com DNS público fixado na conexão. */
export async function verificarLinkNotaFiscalAcessivel(link: string): Promise<void> {
  let url: URL;
  try { url = new URL(link); } catch { throw new Error("Link da NF inválido."); }
  for (let redirecionamentos = 0; redirecionamentos <= 3; redirecionamentos++) {
    const resposta = await requisicaoCabecalho(url);
    if (resposta.status >= 200 && resposta.status < 300) return;
    if ([301, 302, 303, 307, 308].includes(resposta.status) && resposta.destino && redirecionamentos < 3) {
      url = new URL(resposta.destino, url);
      continue;
    }
    throw new Error(`Link da NF inacessível (HTTP ${resposta.status}).`);
  }
  throw new Error("Link da NF excedeu o limite de redirecionamentos.");
}
