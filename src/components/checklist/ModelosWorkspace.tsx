"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, FileCog, Globe2, Layers3, Tag } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listarModelosChecklist, desativarModeloChecklist, ordenarModelosChecklist } from "@/actions/checklist-modelos";
import { confirmar } from "@/lib/checklist/client/types";
import { tiposChecklist } from "@/lib/checklist/schemas";
import { TIPO_CORES, TIPO_LABELS } from "@/lib/checklist/items";
import { SECOES_MODELO_LABELS } from "@/lib/checklist/modelos";
import { cn } from "@/lib/utils";
import { Acao, Carregando, Falha, Paginas, campoChecklist } from "./ChecklistUI";
import { ModelosDocumentoForm, type Modelo } from "./ModelosDocumentoForm";
import { ChecklistDraftGuard, useOptionalChecklistDrafts } from "./ChecklistDraftGuard";
import { useChecklistCommand } from "./useChecklistCommand";

const subscribeIdle = () => () => {};
const idle = () => false;
interface ModelosWorkspaceProps {
  canManage: boolean;
  tipoInicial?: string;
}
export function ModelosWorkspace(props: ModelosWorkspaceProps) {
  return <ChecklistDraftGuard><ModelosWorkspaceContent {...props} /></ChecklistDraftGuard>;
}
function ModelosWorkspaceContent({ canManage, tipoInicial = "" }: ModelosWorkspaceProps) {
  const [tipo, setTipo] = useState(tipoInicial),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState<Modelo | null>(null),
    [formRevision, setFormRevision] = useState(0),
    formRef = useRef<HTMLElement>(null),
    drafts = useOptionalChecklistDrafts(),
    command = useChecklistCommand();
  const busy = useSyncExternalStore(drafts?.subscribe ?? subscribeIdle, () => drafts?.state.busy ?? false, idle) || command.busy;
  const tipoDetalhe = tiposChecklist.find((t) => t === tipoInicial);
  const query = useQuery({
    queryKey: ["checklist-modelos", tipo, page],
    queryFn: () => confirmar(listarModelosChecklist({ ...(tipo === "GLOBAL" ? { escopo: "GLOBAL" } : tipo ? { tipo } : {}), page, pageSize: 20 })),
  });
  function resetForm() {
    setEdit(null);
    setFormRevision((r) => r + 1);
  }
  function editar(modelo: Modelo) {
    const open = () => {
      setEdit(modelo);
      formRef.current?.focus();
      formRef.current?.scrollIntoView?.({ block: "start" });
    };
    if (drafts) drafts.request(open);
    else open();
  }
  async function revisar(modelo: Modelo, ordem?: number) {
    const data = await command.run(`${modelo.id}:${modelo.revision}:${ordem ?? "desativar"}`, (mutationId) =>
      ordem === undefined
        ? desativarModeloChecklist({ identidadeId: modelo.id, expectedRevision: modelo.revision, mutationId })
        : ordenarModelosChecklist({ identidadeId: modelo.id, expectedRevision: modelo.revision, mutationId, ordem }),
    );
    if (data) await query.refetch();
  }
  return (
    <main className="min-h-screen space-y-8 px-6 pb-24 pt-8 text-slate-200 md:px-8">
      <Link
        href={tipoDetalhe ? "/PainelAlpha/CheckList/Embasamentos" : "/PainelAlpha/CheckList"}
        className="inline-flex items-center gap-2 rounded text-[10px] font-black uppercase tracking-widest text-slate-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--checklist-accent)]"
      >
        <ArrowLeft size={15} /> {tipoDetalhe ? "Todos os embasamentos" : "Voltar ao checklist"}
      </Link>
      <header className="max-w-3xl">
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-blue-300">
          {tipoDetalhe ? "Modelo de embasamento" : "Configuração operacional"}
        </p>
        <h1 className={cn("font-black uppercase italic tracking-tighter text-white", tipoDetalhe ? "text-3xl md:text-4xl" : "text-4xl md:text-5xl")}>
          {tipoDetalhe ? TIPO_LABELS[tipoDetalhe] : "Configurar embasamentos"}
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          {tipoDetalhe
            ? "Os documentos globais aparecem em todos os modelos. Os específicos entram somente neste embasamento."
            : "Escolha um modelo para cadastrar os documentos que serão usados nos próximos checklists."}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Versões publicadas valem somente para novos checklists. Os documentos e snapshots existentes são preservados.
        </p>
      </header>
      {!tipoDetalhe && (
        <section aria-label="Embasamentos" className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {tiposChecklist.map((t) => (
            <Link
              key={t}
              href={`/PainelAlpha/CheckList/Embasamentos/${t}`}
              className="group rounded-[2rem] border border-white/10 bg-slate-950/60 p-6 transition hover:-translate-y-1 hover:border-blue-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--checklist-accent)]"
            >
              <span className={cn("mb-8 inline-flex rounded-2xl border p-3", TIPO_CORES[t])}><FileCog size={22} /></span>
              <h2 className="text-xl font-black uppercase tracking-tight text-white">{TIPO_LABELS[t]}</h2>
              <p className="mt-2 text-xs text-slate-500">Configure itens específicos ou itens globais para todos os embasamentos.</p>
              <span className="mt-6 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-300 group-hover:text-blue-200">
                <Layers3 size={14} /> Abrir modelo
              </span>
            </Link>
          ))}
        </section>
      )}
      {!canManage && (
        <p className="rounded-xl border border-white/10 p-3 text-xs text-slate-400">
          Consulta do catálogo. Publicação e gestão exclusivas de Admin, TI e Líder Operacional.
        </p>
      )}
      <section aria-label="Documentos do modelo" className="space-y-5">
        <label className="block max-w-sm text-xs text-slate-400">
          Filtrar escopo
          <select
            value={tipo}
            onChange={(e) => { setTipo(e.target.value); setPage(1); }}
            className={campoChecklist + " mt-1"}
          >
            <option value="">Todos os modelos</option>
            <option value="GLOBAL">Somente globais</option>
            {tiposChecklist.map((t) => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
          </select>
        </label>
        {command.error && <Falha error={command.error} />}
        {query.isPending ? <Carregando /> : query.isError ? (
          <Falha error={query.error} retry={() => void query.refetch()} />
        ) : (
          <>
            {!query.data.items.length && (
              <p className="rounded-[2rem] border border-dashed border-white/15 bg-slate-950/40 p-8 text-sm text-slate-500">
                Nenhum documento configurado neste escopo.
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {query.data.items.map((m) => (
                <article key={m.id} className="rounded-[1.75rem] border border-white/10 bg-slate-950/60 p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <span className="whitespace-pre-wrap break-words rounded-lg bg-white/[0.05] px-2.5 py-1 text-[10px] font-black tracking-widest text-blue-200">{m.codigo}</span>
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest",
                      m.escopo === "GLOBAL" ? "bg-violet-500/15 text-violet-200" : "bg-blue-500/15 text-blue-200")}
                      title={m.escopo === "GLOBAL" ? "Global para todos" : Object.entries(TIPO_LABELS).find(([value]) => value === m.escopo)?.[1]}
                    >
                      {m.escopo === "GLOBAL" ? <Globe2 size={11} /> : <Tag size={11} />}
                      {m.escopo === "GLOBAL" ? "Global" : "Específico"}
                    </span>
                  </div>
                  <h2 className="text-sm font-black uppercase tracking-wide text-white">{m.modelo?.nome ?? "Identidade sem revisão"}</h2>
                  {m.modelo?.descricao && <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-slate-400">{m.modelo.descricao}</p>}
                  <div className="mt-4 flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-widest">
                    <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-slate-400">
                      {Object.entries(SECOES_MODELO_LABELS).find(([value]) => value === m.modelo?.secao)?.[1] ?? m.modelo?.secao}
                    </span>
                    <span className={cn("rounded-full px-2.5 py-1", m.modelo?.obrigatorio ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-500/15 text-slate-400")}>
                      {m.modelo?.obrigatorio ? "Obrigatório" : "Opcional"}
                    </span>
                    <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-slate-400">
                      v{m.modelo?.versao ?? 0} · {m.modelo?.ativo ? "Ativo" : "Inativo"} · ordem {m.modelo?.ordem ?? 0}
                    </span>
                  </div>
                  {canManage && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Acao disabled={busy} onClick={() => editar(m)}>Editar / publicar versão</Acao>
                      {m.modelo?.ativo && <Acao disabled={busy} onClick={() => void revisar(m)}>Desativar</Acao>}
                      <Acao aria-label={`Subir ${m.codigo}`} disabled={busy || !m.modelo || m.modelo.ordem <= 0}
                        onClick={() => void revisar(m, Math.max(0, (m.modelo?.ordem ?? 0) - 1))}>↑ Ordem</Acao>
                      <Acao aria-label={`Descer ${m.codigo}`} disabled={busy || !m.modelo || m.modelo.ordem >= 100000}
                        onClick={() => void revisar(m, Math.min(100000, (m.modelo?.ordem ?? 0) + 1))}>↓ Ordem</Acao>
                    </div>
                  )}
                </article>
              ))}
            </div>
            <Paginas page={page} pageSize={20} total={query.data.totalCount} onPage={setPage} />
          </>
        )}
      </section>
      {canManage && (
        <section ref={formRef} tabIndex={-1} aria-label="Configuração de documento" className="rounded-[2rem] outline-none focus-visible:ring-2 focus-visible:ring-[var(--checklist-accent)]">
          <ModelosDocumentoForm key={`${edit?.id ?? "novo"}:${formRevision}`} modelo={edit} disabled={busy} escopoInicial={tipoDetalhe ?? "GLOBAL"}
            onCancel={resetForm}
            onSaved={() => { resetForm(); void query.refetch(); }}
          />
        </section>
      )}
    </main>
  );
}
