"use client";

import { useState, useTransition } from "react";
import { Copy, KeyRound, RefreshCw, ShieldOff } from "lucide-react";
import { SeoCard } from "../shared/PageHeader";

interface McpKeyRow {
  id: string;
  label: string;
  prefix: string;
  enabled: boolean;
  scopes: unknown;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function parseRows(value: unknown): McpKeyRow[] {
  const source = record(value)?.rows;
  if (!Array.isArray(source)) return [];
  return source.flatMap((item) => {
    const row = record(item);
    if (!row || typeof row.id !== "string" || typeof row.label !== "string" || typeof row.prefix !== "string") return [];
    return [{ id: row.id, label: row.label, prefix: row.prefix, enabled: row.enabled === true, scopes: row.scopes, createdAt: String(row.createdAt ?? ""), lastUsedAt: typeof row.lastUsedAt === "string" ? row.lastUsedAt : null, expiresAt: typeof row.expiresAt === "string" ? row.expiresAt : null, revokedAt: typeof row.revokedAt === "string" ? row.revokedAt : null }];
  });
}

export function McpManager({ projectId }: { projectId: string }) {
  const [keys, setKeys] = useState<McpKeyRow[]>([]);
  const [revealedKey, setRevealedKey] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      const response = await fetch(`/api/alpha-seo/mcp/keys?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const body = await response.json() as unknown;
      if (!response.ok) return setMessage(String(record(body)?.error ?? "Sem permissão para listar credenciais."));
      setKeys(parseRows(body));
      setMessage("Credenciais atualizadas.");
    });
  }

  function create() {
    startTransition(async () => {
      const response = await fetch("/api/alpha-seo/mcp/keys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId, label: "Painel Alpha", scopes: ["alpha-seo:mcp", "alpha-seo:read", "alpha-seo:write"], rateLimitMax: 120 }) });
      const body = await response.json() as unknown;
      const row = record(body);
      if (!response.ok || typeof row?.key !== "string") return setMessage(String(row?.error ?? "Falha ao criar chave."));
      setRevealedKey(row.key);
      setMessage("Copie agora: esta chave completa não será exibida novamente.");
      load();
    });
  }

  function revoke(keyId: string) {
    startTransition(async () => {
      const response = await fetch(`/api/alpha-seo/mcp/keys?projectId=${encodeURIComponent(projectId)}&keyId=${encodeURIComponent(keyId)}`, { method: "DELETE" });
      const body = await response.json() as unknown;
      if (!response.ok || record(body)?.revoked !== true) return setMessage(String(record(body)?.error ?? "Não foi possível revogar."));
      setKeys((rows) => rows.map((row) => row.id === keyId ? { ...row, enabled: false, revokedAt: new Date().toISOString() } : row));
      setMessage("Chave revogada. O impacto nos clientes MCP é imediato.");
    });
  }

  return <div className="space-y-4"><SeoCard className="p-5"><div className="flex items-start gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/[.05] text-[rgb(var(--seo-accent))]"><KeyRound size={18}/></span><div className="min-w-0 flex-1"><h2 className="font-bold text-white">Credenciais MCP por projeto</h2><p className="mt-2 text-sm text-slate-500">Endpoint Streamable HTTP: <code className="break-all">/api/alpha-seo/mcp</code>. Registry: 46/46 ferramentas.</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={create} disabled={pending} className="min-h-11 rounded-xl bg-[rgb(var(--seo-accent))] px-4 text-xs font-black text-slate-950">Gerar API key</button><button type="button" onClick={load} disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-xs font-bold"><RefreshCw size={13}/>Listar chaves</button></div>{revealedKey && <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3"><code className="block break-all text-xs text-amber-100">{revealedKey}</code><button type="button" onClick={() => navigator.clipboard.writeText(revealedKey)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-300 px-3 text-xs font-black text-amber-950"><Copy size={13}/>Copiar e guardar</button></div>}{message && <p role="status" className="mt-3 text-xs text-slate-400">{message}</p>}</div></div></SeoCard>{keys.length > 0 && <SeoCard className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><caption className="sr-only">Chaves MCP do projeto</caption><thead className="border-b border-white/5 uppercase text-slate-500"><tr><th className="p-3">Nome</th><th className="p-3">Prefixo</th><th className="p-3">Criada</th><th className="p-3">Último uso</th><th className="p-3">Status</th><th className="p-3">Ações</th></tr></thead><tbody>{keys.map((row) => <tr key={row.id} className="border-b border-white/[.04]"><td className="p-3 font-semibold text-white">{row.label}</td><td className="p-3 font-mono text-slate-300">{row.prefix}…</td><td className="p-3 text-slate-400">{new Date(row.createdAt).toLocaleDateString("pt-BR")}</td><td className="p-3 text-slate-400">{row.lastUsedAt ? new Date(row.lastUsedAt).toLocaleString("pt-BR") : "Nunca"}</td><td className="p-3 text-slate-300">{row.enabled && !row.revokedAt ? "Ativa" : "Revogada"}</td><td className="p-3"><button type="button" onClick={() => revoke(row.id)} disabled={pending || !row.enabled || Boolean(row.revokedAt)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-400/20 px-3 font-bold text-rose-300 disabled:opacity-40"><ShieldOff size={13}/>Revogar</button></td></tr>)}</tbody></table></SeoCard>}</div>;
}
