import { dataForSeoScopeSchema, type DataForSeoScope } from "./schemas";

export interface NormalizedSeoTarget {
  apiTarget: string;
  displayTarget: string;
  hostname: string;
  path: string;
  scope: DataForSeoScope;
  includeSubdomains: boolean;
}

export function normalizeSeoTarget(input: string, requestedScope: DataForSeoScope = "domain"): NormalizedSeoTarget {
  const scope = dataForSeoScopeSchema.parse(requestedScope);
  const raw = input.trim();
  let url: URL;
  try {
    url = new URL(raw.includes("://") ? raw : `https://${raw}`);
  } catch {
    throw new Error("Informe um domínio ou URL válido");
  }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || !url.hostname) throw new Error("Informe um alvo HTTP(S) válido");
  if ((url.search || url.hash) && scope === "exact_url") throw new Error("URLs com query ou fragmento não são suportadas");
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  const path = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
  if (scope === "subfolder" && !path) throw new Error("O escopo subfolder exige um caminho");
  const exactUrl = `${url.protocol}//${hostname}${path || "/"}`;
  return {
    apiTarget: scope === "exact_url" ? exactUrl : hostname,
    displayTarget: scope === "subfolder" ? `${hostname}${path}` : scope === "exact_url" ? exactUrl : hostname,
    hostname,
    path,
    scope,
    includeSubdomains: scope === "subdomains",
  };
}

export function buildUrlPrefixFilter(field: string, target: NormalizedSeoTarget): unknown[] {
  if (target.scope === "exact_url") return [field, "=", target.apiTarget];
  if (target.scope === "subfolder") return [field, "like", `%://${target.hostname}${target.path}%`];
  return [];
}
