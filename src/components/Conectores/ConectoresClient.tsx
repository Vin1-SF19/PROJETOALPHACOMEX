"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  Cable, RefreshCw, Plus, Pause, Play, Trash2, FileStack,
  KeyRound, Database, AlertTriangle, X, Loader2, Search,
  ChevronRight, ArrowLeft, CheckCircle2,
  Info, ListChecks, FileCheck2, UploadCloud, FileJson,
} from "lucide-react";
import BrandIcon from "./BrandIcon";
import {
  fetchConnectors, fetchCCPair, connectorAction, deleteConnector,
  createConnector, uploadConnectorFiles, deleteCredential,
  createDocumentSet, deleteDocumentSet,
  sourceLabel, statusMeta, formatRelative,
  CONNECTOR_CATALOG, CONNECTOR_CATEGORIES, availabilityMeta,
  type ConnectorsData, type ConnectorIndexingStatus, type CCPairDetail,
  type ConnectorMeta, type CreateConnectorPayload,
} from "@/lib/onyx/connectors-browser";

type Tab = "conectores" | "documentSets" | "credenciais";

export default function ConectoresClient({ onyxConfigured }: { onyxConfigured: boolean }) {
  const [data, setData] = useState<ConnectorsData | null>(null);
  const [loading, setLoading] = useState(onyxConfigured);
  const [erro, setErro] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("conectores");
  const [busca, setBusca] = useState("");
  const [busy, setBusy] = useState<number | null>(null);

  const [detalheId, setDetalheId] = useState<number | null>(null);
  const [criar, setCriar] = useState(false);
  const [criarDocSet, setCriarDocSet] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const fresh = await fetchConnectors();
      setData(fresh);
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!onyxConfigured) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch inicial + polling do status de indexação
    void carregar();
    const t = setInterval(() => { void carregar(); }, 15000); // auto-refresh do status de indexação
    return () => clearInterval(t);
  }, [carregar, onyxConfigured]);

  const conectores = useMemo(() => {
    if (!data) return [];
    const all = data.groups.flatMap((g) => g.indexing_statuses);
    const q = busca.trim().toLowerCase();
    return q ? all.filter((c) => (c.name ?? "").toLowerCase().includes(q) || sourceLabel(c.source).toLowerCase().includes(q)) : all;
  }, [data, busca]);

  const totais = useMemo(() => {
    const all = data?.groups.flatMap((g) => g.indexing_statuses) ?? [];
    return {
      fontes: all.length,
      docs: all.reduce((a, c) => a + (c.docs_indexed || 0), 0),
      erros: all.filter((c) => c.in_repeated_error_state || c.last_finished_status === "failed").length,
      docSets: data?.documentSets.length ?? 0,
    };
  }, [data]);

  async function acao(c: ConnectorIndexingStatus, action: "pause" | "resume" | "reindex") {
    setBusy(c.cc_pair_id);
    try {
      await connectorAction(c.cc_pair_id, { action });
      await carregar();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function excluir(c: ConnectorIndexingStatus) {
    if (!confirm(`Excluir a fonte "${c.name ?? c.source}"? Os documentos indexados serão removidos da base da IA.`)) return;
    setBusy(c.cc_pair_id);
    try {
      await deleteConnector(c.cc_pair_id);
      await carregar();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!onyxConfigured) {
    return (
      <Shell>
        <div className="p-8 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
          <p className="text-white font-bold">Onyx não configurado</p>
          <p className="text-sm text-slate-400 mt-1">Defina ONYX_API_URL e ONYX_API_KEY no servidor.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={<Database className="w-4 h-4 text-cyan-400" />} valor={totais.fontes} label="Fontes" box="bg-cyan-600/15 border-cyan-500/20" />
        <Stat icon={<FileStack className="w-4 h-4 text-emerald-400" />} valor={totais.docs} label="Documentos" box="bg-emerald-600/15 border-emerald-500/20" />
        <Stat icon={<FileStack className="w-4 h-4 text-indigo-400" />} valor={totais.docSets} label="Document Sets" box="bg-indigo-600/15 border-indigo-500/20" />
        <Stat icon={<AlertTriangle className="w-4 h-4 text-rose-400" />} valor={totais.erros} label="Com erro" box="bg-rose-600/15 border-rose-500/20" />
      </div>

      {/* Tabs + ações */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="flex gap-1 p-1 rounded-xl bg-white/3 border border-white/5 w-fit">
          {([["conectores", "Conectores"], ["documentSets", "Document Sets"], ["credenciais", "Credenciais"]] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${tab === id ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30" : "text-slate-400 hover:text-white border border-transparent"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={carregar} className="p-2 rounded-lg bg-white/3 border border-white/5 text-slate-300 hover:text-white hover:bg-white/5 transition" title="Atualizar">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          {tab === "conectores" && (
            <button onClick={() => setCriar(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 transition text-xs font-bold uppercase tracking-wider">
              <Plus className="w-4 h-4" /> Nova fonte
            </button>
          )}
          {tab === "documentSets" && (
            <button onClick={() => setCriarDocSet(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 transition text-xs font-bold uppercase tracking-wider">
              <Plus className="w-4 h-4" /> Novo set
            </button>
          )}
        </div>
      </div>

      {erro && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {erro}
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : tab === "conectores" ? (
        <>
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar fonte…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/3 border border-white/5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
            />
          </div>

          {conectores.length === 0 ? (
            <Vazio onAdd={() => setCriar(true)} />
          ) : (
            <div className="space-y-2">
              {conectores.map((c) => {
                const st = statusMeta(c);
                const ocupado = busy === c.cc_pair_id;
                return (
                  <div key={c.cc_pair_id} className="group flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/5 hover:border-white/10 transition">
                    <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/15 shrink-0">
                      <SourceIcon source={c.source} />
                    </div>
                    <button onClick={() => setDetalheId(c.cc_pair_id)} className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-bold text-white truncate">{c.name ?? "(sem nome)"}</p>
                      <p className="text-[11px] text-slate-500">{sourceLabel(c.source)} · {c.docs_indexed} docs · {formatRelative(c.last_success)}</p>
                    </button>
                    <span className={`hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${st.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {st.label}
                    </span>
                    <div className="flex items-center gap-1">
                      <IconBtn title="Reindexar" onClick={() => acao(c, "reindex")} disabled={ocupado || c.in_progress}>
                        <RefreshCw className={`w-3.5 h-3.5 ${ocupado ? "animate-spin" : ""}`} />
                      </IconBtn>
                      {c.cc_pair_status === "PAUSED" ? (
                        <IconBtn title="Reativar" onClick={() => acao(c, "resume")} disabled={ocupado}><Play className="w-3.5 h-3.5" /></IconBtn>
                      ) : (
                        <IconBtn title="Pausar" onClick={() => acao(c, "pause")} disabled={ocupado}><Pause className="w-3.5 h-3.5" /></IconBtn>
                      )}
                      <IconBtn title="Excluir" danger onClick={() => excluir(c)} disabled={ocupado}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                      <button onClick={() => setDetalheId(c.cc_pair_id)} className="p-2 text-slate-600 group-hover:text-slate-300 transition"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : tab === "documentSets" ? (
        <DocumentSetsTab data={data!} onChange={carregar} />
      ) : (
        <CredenciaisTab data={data!} onChange={carregar} />
      )}

      {detalheId != null && <DetalheModal ccPairId={detalheId} onClose={() => setDetalheId(null)} onChanged={carregar} />}
      {criar && <CriarModal onClose={() => setCriar(false)} onCreated={() => { setCriar(false); carregar(); }} />}
      {criarDocSet && data && <CriarDocSetModal conectores={data.groups.flatMap((g) => g.indexing_statuses)} onClose={() => setCriarDocSet(false)} onCreated={() => { setCriarDocSet(false); carregar(); }} />}
    </Shell>
  );
}

// ─── Sub-componentes de layout ────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#020617] text-slate-200 font-sans p-6 lg:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
            <Cable className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-black uppercase tracking-tighter text-white">
              Conectores <span className="text-cyan-400">IAlpha</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-0.5">
              Fontes de conhecimento da IA — indexação e sincronização
            </p>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}

function Stat({ icon, valor, label, box }: { icon: React.ReactNode; valor: number; label: string; box: string }) {
  return (
    <div className="p-4 rounded-2xl bg-white/3 border border-white/5">
      <div className={`p-2 rounded-xl border w-fit mb-2 ${box}`}>{icon}</div>
      <p className="text-2xl font-black text-white">{valor}</p>
      <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mt-0.5">{label}</p>
    </div>
  );
}

function IconBtn({ children, title, onClick, disabled, danger }: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`p-2 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed ${danger ? "text-slate-500 hover:text-rose-400 hover:bg-rose-500/10" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
    >
      {children}
    </button>
  );
}

/** Ícone de uma fonte pelo seu source (usa o catálogo + BrandIcon). */
function SourceIcon({ source, size = 16 }: { source: string; size?: number }) {
  const meta = CONNECTOR_CATALOG.find((c) => c.id === source);
  if (meta) return <BrandIcon brandSlug={meta.brandSlug} fallbackIcon={meta.fallbackIcon} color={meta.color} size={size} />;
  return <Database size={size} className="text-cyan-400" />;
}

function Vazio({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="p-10 rounded-2xl bg-white/3 border border-white/5 border-dashed text-center">
      <Cable className="w-8 h-8 text-slate-600 mx-auto mb-3" />
      <p className="text-white font-bold">Nenhuma fonte conectada</p>
      <p className="text-sm text-slate-500 mt-1 mb-4">Conecte arquivos, sites ou um NAS para a IA aprender.</p>
      <button onClick={onAdd} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 transition text-xs font-bold uppercase tracking-wider">
        <Plus className="w-4 h-4" /> Nova fonte
      </button>
    </div>
  );
}

// ─── Aba: Document Sets ───────────────────────────────────────────────────────

function DocumentSetsTab({ data, onChange }: { data: ConnectorsData; onChange: () => void }) {
  const [busy, setBusy] = useState<number | null>(null);
  async function excluir(id: number, nome: string) {
    if (!confirm(`Excluir o document set "${nome}"?`)) return;
    setBusy(id);
    try { await deleteDocumentSet(id); await onChange(); }
    catch (e) { alert((e as Error).message); }
    finally { setBusy(null); }
  }
  if (data.documentSets.length === 0) {
    return <div className="p-10 rounded-2xl bg-white/3 border border-white/5 border-dashed text-center text-slate-500 text-sm">Nenhum document set. Agrupe fontes para filtrar buscas dos agentes.</div>;
  }
  return (
    <div className="space-y-2">
      {data.documentSets.map((ds) => (
        <div key={ds.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/5">
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/15"><FileStack className="w-4 h-4 text-indigo-400" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{ds.name}</p>
            <p className="text-[11px] text-slate-500 truncate">{ds.cc_pair_descriptors?.length ?? 0} fonte(s) · {ds.is_public ? "Público" : "Privado"}{ds.description ? ` · ${ds.description}` : ""}</p>
          </div>
          <IconBtn title="Excluir" danger onClick={() => excluir(ds.id, ds.name)} disabled={busy === ds.id}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
        </div>
      ))}
    </div>
  );
}

// ─── Aba: Credenciais ─────────────────────────────────────────────────────────

function CredenciaisTab({ data, onChange }: { data: ConnectorsData; onChange: () => void }) {
  const [busy, setBusy] = useState<number | null>(null);
  const creds = data.credentials.filter((c) => c.source !== "not_applicable");
  async function excluir(id: number, nome: string) {
    if (!confirm(`Excluir a credencial "${nome}"? Conectores que dependem dela podem parar de sincronizar.`)) return;
    setBusy(id);
    try { await deleteCredential(id); await onChange(); }
    catch (e) { alert((e as Error).message); }
    finally { setBusy(null); }
  }
  if (creds.length === 0) {
    return <div className="p-10 rounded-2xl bg-white/3 border border-white/5 border-dashed text-center text-slate-500 text-sm">Nenhuma credencial cadastrada.</div>;
  }
  return (
    <div className="space-y-2">
      {creds.map((c) => (
        <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/5">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/15"><KeyRound className="w-4 h-4 text-amber-400" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{c.name ?? `Credencial #${c.id}`}</p>
            <p className="text-[11px] text-slate-500 truncate">{sourceLabel(c.source)}{c.user_email ? ` · ${c.user_email}` : ""}</p>
          </div>
          <IconBtn title="Excluir" danger onClick={() => excluir(c.id, c.name ?? `#${c.id}`)} disabled={busy === c.id}><Trash2 className="w-3.5 h-3.5" /></IconBtn>
        </div>
      ))}
    </div>
  );
}

// ─── Modal genérico ───────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-[#0a1120] border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-white/5 sticky top-0 bg-[#0a1120]">
          <h2 className="text-sm font-black uppercase tracking-wider text-white">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

// ─── Modal: detalhe da fonte ──────────────────────────────────────────────────

function DetalheModal({ ccPairId, onClose, onChanged }: { ccPairId: number; onClose: () => void; onChanged: () => void }) {
  const [cc, setCc] = useState<CCPairDetail | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetchCCPair(ccPairId).then(setCc).catch((e) => setErro((e as Error).message));
  }, [ccPairId]);

  return (
    <Modal title="Detalhe da fonte" onClose={onClose}>
      {erro ? (
        <p className="text-rose-300 text-sm">{erro}</p>
      ) : !cc ? (
        <div className="flex justify-center py-8 text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : (
        <div className="space-y-3 text-sm">
          <Linha k="Nome" v={cc.name} />
          <Linha k="Tipo" v={sourceLabel(cc.connector.source)} />
          <Linha k="Status" v={cc.status} />
          <Linha k="Documentos indexados" v={String(cc.num_docs_indexed)} />
          <Linha k="Tentativas de indexação" v={String(cc.number_of_index_attempts)} />
          <Linha k="Última indexação" v={formatRelative(cc.last_indexed)} />
          <Linha k="Última limpeza" v={formatRelative(cc.last_pruned)} />
          {cc.creator_email && <Linha k="Criado por" v={cc.creator_email} />}
          {cc.connector.refresh_freq != null && <Linha k="Frequência de sync" v={`${Math.round(cc.connector.refresh_freq / 60)} min`} />}
          {cc.latest_checkpoint_description && <Linha k="Progresso" v={cc.latest_checkpoint_description} />}
          <div className="pt-2">
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Configuração</p>
            <pre className="text-[11px] text-slate-400 bg-black/30 rounded-lg p-3 overflow-x-auto border border-white/5">{JSON.stringify(cc.connector.connector_specific_config, null, 2)}</pre>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={async () => { try { await connectorAction(ccPairId, { action: "reindex", fromBeginning: true }); onChanged(); onClose(); } catch (e) { alert((e as Error).message); } }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 transition text-xs font-bold uppercase tracking-wider"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Reindexar do zero
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Linha({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-white/3 pb-1.5">
      <span className="text-slate-500">{k}</span>
      <span className="text-white font-medium text-right truncate">{v}</span>
    </div>
  );
}

// ─── Modal: criar fonte ───────────────────────────────────────────────────────

function CriarModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [sel, setSel] = useState<ConnectorMeta | null>(null);
  const [busca, setBusca] = useState("");
  const [cat, setCat] = useState<string>("todos");

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return CONNECTOR_CATALOG.filter((c) => {
      if (cat !== "todos" && c.category !== cat) return false;
      if (q && !c.label.toLowerCase().includes(q) && !c.short.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [busca, cat]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[88vh] overflow-hidden flex flex-col rounded-2xl bg-[#0a1120] border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            {sel && (
              <button onClick={() => setSel(null)} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"><ArrowLeft className="w-4 h-4" /></button>
            )}
            <h2 className="text-sm font-black uppercase tracking-wider text-white">
              {sel ? sel.label : "Conectar uma fonte"}
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"><X className="w-4 h-4" /></button>
        </div>

        {sel ? (
          <DetalheConector meta={sel} onCreated={onCreated} />
        ) : (
          <div className="flex flex-col min-h-0">
            {/* Busca + categorias */}
            <div className="p-4 space-y-3 border-b border-white/5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar conector (Gmail, Drive, Slack…)" className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/3 border border-white/5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40" />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {[{ id: "todos", label: "Todos" }, ...CONNECTOR_CATEGORIES].map((c) => (
                  <button key={c.id} onClick={() => setCat(c.id)} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${cat === c.id ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30" : "text-slate-400 hover:text-white border border-transparent bg-white/3"}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Galeria */}
            <div className="p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {lista.map((c) => {
                const av = availabilityMeta(c.availability);
                return (
                  <button key={`${c.id}-${c.label}`} onClick={() => setSel(c)} className="group p-3 rounded-xl bg-white/3 border border-white/5 hover:border-cyan-500/30 hover:bg-white/5 transition text-left flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                        <BrandIcon brandSlug={c.brandSlug} fallbackIcon={c.fallbackIcon} color={c.color} size={20} />
                      </div>
                      <span className={`w-1.5 h-1.5 rounded-full mt-1 ${c.availability === "ready" ? "bg-emerald-400" : c.availability === "credential" ? "bg-sky-400" : "bg-amber-400"}`} title={av.label} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white truncate">{c.label}</p>
                      <p className="text-[10px] text-slate-500 truncate">{c.short}</p>
                    </div>
                  </button>
                );
              })}
              {lista.length === 0 && <p className="col-span-full text-center text-sm text-slate-500 py-8">Nenhum conector encontrado.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Detalhe do conector: guia explicativo + formulário ───────────────────────

function DetalheConector({ meta, onCreated }: { meta: ConnectorMeta; onCreated: () => void }) {
  const [nome, setNome] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [cred, setCred] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const av = availabilityMeta(meta.availability);

  async function salvar() {
    setErro(null);
    if (!nome.trim()) { setErro("Dê um nome à fonte."); return; }
    setSalvando(true);
    try {
      const payload: CreateConnectorPayload = {
        name: nome.trim(), source: meta.id, input_type: meta.input_type,
        connector_specific_config: {}, run_now: true,
      };
      if (meta.isFileUpload) {
        if (files.length === 0) { setErro("Selecione ao menos um arquivo."); setSalvando(false); return; }
        const up = await uploadConnectorFiles(files);
        payload.connector_specific_config = { file_locations: up.file_paths };
      } else {
        const cfg: Record<string, unknown> = {};
        for (const f of meta.configFields) {
          const v = config[f.key];
          if (f.required && !v?.trim()) { setErro(`Preencha: ${f.label}`); setSalvando(false); return; }
          if (v != null && v !== "") cfg[f.key] = f.type === "boolean" ? v === "true" : v;
        }
        payload.connector_specific_config = cfg;
        payload.refresh_freq = meta.defaultRefreshFreq ?? null;
        if (meta.credentialFields.length > 0) {
          const cj: Record<string, unknown> = {};
          for (const f of meta.credentialFields) {
            const v = cred[f.key];
            if (f.required && !v?.trim()) { setErro(`Preencha: ${f.label}`); setSalvando(false); return; }
            if (v != null && v !== "") cj[f.key] = v;
          }
          payload.credential_json = cj;
        }
      }
      await createConnector(payload);
      onCreated();
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  }

  return (
    <div className="overflow-y-auto p-4 grid md:grid-cols-2 gap-5">
      {/* Coluna esquerda: guia */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <BrandIcon brandSlug={meta.brandSlug} fallbackIcon={meta.fallbackIcon} color={meta.color} size={26} />
          </div>
          <div>
            <p className="text-base font-black text-white">{meta.label}</p>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${av.cls}`}>{av.label}</span>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">{meta.description}</p>

        <Guia titulo="O que você precisa ter" icon={<ListChecks className="w-3.5 h-3.5 text-cyan-400" />} itens={meta.requisitos} />
        {meta.formato && <Guia titulo="Como o conteúdo deve estar" icon={<FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />} itens={meta.formato} />}
        {meta.passos && <Guia titulo="Passo a passo" icon={<Info className="w-3.5 h-3.5 text-indigo-400" />} itens={meta.passos} ordenado />}

        {meta.availability === "server" && (
          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[12px] text-amber-200/90 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Este conector precisa de configuração no servidor (app/OAuth). Você pode preencher os dados abaixo, mas pode ser necessário o time técnico finalizar no servidor da IA.</span>
          </div>
        )}
      </div>

      {/* Coluna direita: formulário */}
      <div className="space-y-4">
        <Campo label="Nome da fonte" required>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={`Ex: ${meta.label} — Comercial`} className={inputCls} />
        </Campo>

        {meta.isFileUpload ? (
          <Campo label="Arquivos" required>
            <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-cyan-500/15 file:text-cyan-300 file:text-xs file:font-bold hover:file:bg-cyan-500/25" />
            {files.length > 0 && <p className="text-[11px] text-slate-500 mt-1">{files.length} arquivo(s) selecionado(s)</p>}
          </Campo>
        ) : (
          <>
            {meta.configFields.map((f) => (
              <Campo key={f.key} label={f.label} required={f.required} help={f.help}>
                <CampoInput field={f} value={config[f.key] ?? ""} onChange={(v) => setConfig((p) => ({ ...p, [f.key]: v }))} />
              </Campo>
            ))}
            {meta.credentialFields.length > 0 && (
              <div className="pt-1 space-y-3">
                <p className="text-[10px] text-amber-400/80 uppercase font-black tracking-widest flex items-center gap-1"><KeyRound className="w-3 h-3" /> Credencial</p>
                {meta.credentialFields.map((f) => (
                  <Campo key={f.key} label={f.label} required={f.required} help={f.help}>
                    <CampoInput field={f} value={cred[f.key] ?? ""} onChange={(v) => setCred((p) => ({ ...p, [f.key]: v }))} />
                  </Campo>
                ))}
              </div>
            )}
          </>
        )}

        {erro && <p className="text-rose-300 text-xs">{erro}</p>}

        <button onClick={salvar} disabled={salvando} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/30 transition text-sm font-bold uppercase tracking-wider disabled:opacity-50">
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {salvando ? "Conectando…" : "Conectar e indexar"}
        </button>
      </div>
    </div>
  );
}

function Guia({ titulo, icon, itens, ordenado }: { titulo: string; icon: React.ReactNode; itens: string[]; ordenado?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1.5 flex items-center gap-1.5">{icon}{titulo}</p>
      <ul className="space-y-1">
        {itens.map((it, i) => (
          <li key={i} className="text-[12px] text-slate-300 leading-snug flex gap-2">
            <span className="text-slate-600 shrink-0">{ordenado ? `${i + 1}.` : "•"}</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CampoInput({ field, value, onChange }: { field: ConnectorMeta["configFields"][number]; value: string; onChange: (v: string) => void }) {
  if (field.type === "json-file") {
    return <JsonDropzone value={value} onChange={onChange} />;
  }
  if (field.type === "boolean") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        <option value="">Não</option>
        <option value="true">Sim</option>
        <option value="false">Não</option>
      </select>
    );
  }
  return (
    <input
      type={field.type === "password" ? "password" : field.type === "number" ? "number" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder}
      className={inputCls}
    />
  );
}

/**
 * Dropzone para credenciais em arquivo .json (conta de serviço Google, etc.).
 * Arraste o arquivo ou clique para selecionar — o conteúdo é lido e guardado
 * como string no `value` (formato que o Onyx espera). Valida que é JSON.
 */
function JsonDropzone({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputId = useId();

  async function handleFile(file: File | undefined) {
    setErro(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") {
      setErro("Selecione um arquivo .json válido.");
      return;
    }
    const texto = await file.text();
    try {
      JSON.parse(texto); // valida o conteúdo
    } catch {
      setErro("O arquivo não contém um JSON válido.");
      return;
    }
    setFileName(file.name);
    onChange(texto);
  }

  function limpar() {
    setFileName(null);
    setErro(null);
    onChange("");
  }

  if (value && fileName) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/8 border border-emerald-500/25">
        <FileJson className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="text-xs text-emerald-200 truncate flex-1">{fileName}</span>
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <button type="button" onClick={limpar} className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-white/5" title="Remover">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor={inputId}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); void handleFile(e.dataTransfer.files?.[0]); }}
        className={`flex flex-col items-center justify-center gap-1.5 px-3 py-5 rounded-lg border-2 border-dashed cursor-pointer transition ${dragOver ? "border-cyan-500/60 bg-cyan-500/10" : "border-white/10 bg-white/3 hover:border-cyan-500/30 hover:bg-white/5"}`}
      >
        <UploadCloud className={`w-6 h-6 ${dragOver ? "text-cyan-300" : "text-slate-500"}`} />
        <span className="text-xs text-slate-300 font-medium text-center">
          Arraste o arquivo <span className="text-cyan-300">.json</span> aqui
        </span>
        <span className="text-[10px] text-slate-500">ou clique para selecionar</span>
      </label>
      <input
        id={inputId}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      {value && !fileName && (
        <p className="text-[10px] text-emerald-400/80 mt-1">JSON carregado (colado anteriormente).</p>
      )}
      {erro && <p className="text-[11px] text-rose-300 mt-1">{erro}</p>}
    </div>
  );
}

function Campo({ label, required, help, children }: { label: string; required?: boolean; help?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1 block">
        {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>
      {children}
      {help && <p className="text-[10px] text-slate-600 mt-1">{help}</p>}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 rounded-lg bg-white/3 border border-white/5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40";

// ─── Modal: criar document set ────────────────────────────────────────────────

function CriarDocSetModal({ conectores, onClose, onCreated }: { conectores: ConnectorIndexingStatus[]; onClose: () => void; onCreated: () => void }) {
  const [nome, setNome] = useState("");
  const [desc, setDesc] = useState("");
  const [sel, setSel] = useState<number[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function toggle(id: number) {
    setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  }

  async function salvar() {
    setErro(null);
    if (!nome.trim()) { setErro("Dê um nome ao set."); return; }
    if (sel.length === 0) { setErro("Selecione ao menos uma fonte."); return; }
    setSalvando(true);
    try {
      await createDocumentSet({ name: nome.trim(), description: desc.trim(), cc_pair_ids: sel, is_public: true });
      onCreated();
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  }

  return (
    <Modal title="Novo document set" onClose={onClose}>
      <div className="space-y-4">
        <Campo label="Nome" required><input value={nome} onChange={(e) => setNome(e.target.value)} className={inputCls} placeholder="Ex: Documentos Fiscais" /></Campo>
        <Campo label="Descrição"><input value={desc} onChange={(e) => setDesc(e.target.value)} className={inputCls} placeholder="Opcional" /></Campo>
        <Campo label="Fontes incluídas" required>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {conectores.map((c) => (
              <label key={c.cc_pair_id} className="flex items-center gap-2 p-2 rounded-lg bg-white/3 border border-white/5 cursor-pointer hover:border-white/10">
                <input type="checkbox" checked={sel.includes(c.cc_pair_id)} onChange={() => toggle(c.cc_pair_id)} className="accent-cyan-500" />
                <span className="text-sm text-white truncate">{c.name ?? c.source}</span>
                <span className="text-[10px] text-slate-500 ml-auto">{sourceLabel(c.source)}</span>
              </label>
            ))}
          </div>
        </Campo>
        {erro && <p className="text-rose-300 text-xs">{erro}</p>}
        <button onClick={salvar} disabled={salvando} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 hover:bg-indigo-500/30 transition text-sm font-bold uppercase tracking-wider disabled:opacity-50">
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Criar set
        </button>
      </div>
    </Modal>
  );
}
