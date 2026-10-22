"use client";
import { useLayoutEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LockKeyhole, History } from "lucide-react";
import { obterEmpresaChecklist, selecionarTipoChecklist, atualizarItemChecklist } from "@/actions/checklist";
import { confirmar, erroChecklist, type EmpresaDetalhe } from "@/lib/checklist/client/types";
import { tiposChecklist, statusChecklist } from "@/lib/checklist/schemas";
import { TIPO_LABELS } from "@/lib/checklist/items";
import { ChecklistDraftGuard, useChecklistDrafts, useDraftState } from "@/components/checklist/ChecklistDraftGuard";
import { ChecklistItemCard } from "@/components/checklist/ChecklistItemCard";
import { AtendimentoSettings } from "@/components/checklist/AtendimentoSettings";
import { HistoricoAtendimento } from "@/components/checklist/HistoricoAtendimento";
import { Acao, Carregando, Falha, Percentual, campoChecklist } from "@/components/checklist/ChecklistUI";
import { ChecklistExport } from "@/components/checklist/ChecklistExport";
import { useChecklistCommand } from "@/components/checklist/useChecklistCommand";
interface Props {
  empresaId: string;
  initial?: EmpresaDetalhe;
  initialView?: string;
}
export default function ChecklistView(props: Props) {
  return (
    <ChecklistDraftGuard key={props.empresaId}>
      <ChecklistViewContent {...props} />
    </ChecklistDraftGuard>
  );
}
function ChecklistViewContent({ empresaId, initial, initialView }: Props) {
  const registry = useChecklistDrafts(),
    draftState = useDraftState();
  const client = useQueryClient(),
    [view, setView] = useState<string | undefined>(initialView),
    [tipo, setTipo] = useState(""),
    [secao, setSecao] = useState(""),
    [tab, setTab] = useState("ITENS"),
    [reloadError, setReloadError] = useState("");
  const command = useChecklistCommand();
  const key = ["checklist-detalhe", empresaId, view];
  const query = useQuery({
    queryKey: key,
    queryFn: () => confirmar(obterEmpresaChecklist(empresaId, { checklistId: view })),
    initialData: view === initialView ? initial : undefined,
  });
  const empresa = query.data;
  function confirmed(data: EmpresaDetalhe) {
    client.setQueryData(key, data);
    void client.invalidateQueries({ queryKey: ["checklist-empresas"] });
    void client.invalidateQueries({ queryKey: ["checklist-analistas"] });
  }
  async function reload() {
    try {
      const data = await confirmar(obterEmpresaChecklist(empresaId, { checklistId: view }));
      confirmed(data);
      setReloadError("");
    } catch (error) {
      setReloadError(erroChecklist(error));
      throw error;
    }
  }
  function current() {
    const data = client.getQueryData<EmpresaDetalhe>(key);
    if (!data) throw new Error("Recarregue o atendimento.");
    return data;
  }
  const change = registry.request;
  useLayoutEffect(() => {
    registry.setBeforeSave(reload);
    return () => {
      registry.setBeforeSave(undefined);
    };
  });
  async function patchItem(itemId: string, patch: { status?: (typeof statusChecklist)[number]; observacao?: string | null }) {
    const data = current();
    const response = await command.run(JSON.stringify({ itemId, patch, revision: data.revision }), (mutationId) =>
      atualizarItemChecklist({ itemId, patch, expectedRevision: data.revision, mutationId }),
    );
    if (response) {
      confirmed(response);
    }
    return !!response;
  }
  async function trocar() {
    if (!tiposChecklist.some((t) => t === tipo)) return;
    const data = current();
    const result = await command.run(`tipo:${tipo}:${data.revision}`, (mutationId) =>
      selecionarTipoChecklist({ empresaId, tipo, expectedRevision: data.revision, mutationId }),
    );
    if (result) {
      setSecao("");
      setView(undefined);
      client.setQueryData(["checklist-detalhe", empresaId, undefined], result);
      confirmed(result);
    }
  }
  if (query.isPending) return <Carregando />;
  if (query.isError || !empresa) return <Falha error={query.error ?? "Atendimento indisponível"} retry={() => void query.refetch()} />;
  const secoes = [...new Set(empresa.checklist?.itens.map((i) => i.secao) ?? [])],
    active = secoes.includes(secao) ? secao : secoes[0];
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-7 text-slate-100 sm:px-7">
      <Link
        href="/PainelAlpha/CheckList"
        onClick={(e) => {
          if (draftState.dirty || draftState.busy) {
            e.preventDefault();
            change(() => {
              window.location.assign("/PainelAlpha/CheckList");
            });
          }
        }}
        className="inline-flex items-center gap-2 rounded-lg text-sm text-slate-400 focus-visible:ring-2"
      >
        <ArrowLeft size={16} />
        Empresas e analistas
      </Link>
      <header className="rounded-3xl border border-white/10 bg-slate-950/75 p-6 backdrop-blur-xl">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <p className="text-xs text-slate-400">
              {empresa.cliente.cnpj} · {empresa.status}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{empresa.cliente.razaoSocial}</h1>
            <p className="mt-2 text-sm text-slate-400">Analista: {empresa.analista?.nome ?? "Aguardando atribuição"}</p>
          </div>
          <div className="min-w-48">
            <Percentual percentual={empresa.resumo.percentual} descricao={`${empresa.resumo.concluidos}/${empresa.resumo.total} obrigatórios`} />
          </div>
        </div>
        {!empresa.capabilities.canEdit && (
          <p className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
            <LockKeyhole size={14} />
            {empresa.historical
              ? "Checklist histórico — consulta sem alterar o tipo ativo."
              : "Somente leitura. A edição pertence ao analista responsável ou Líder Operacional."}
          </p>
        )}
      </header>
      <section className="grid gap-4 rounded-2xl border border-white/10 bg-slate-900/60 p-5 md:grid-cols-2">
        <label className="text-xs text-slate-400">
          Visualizar checklist (sem ativar)
          <select
            value={view ?? empresa.checklistAtivoId ?? ""}
            disabled={command.busy || draftState.busy}
            onChange={(e) => {
              const id = e.target.value;
              change(() => {
                setSecao("");
                setView(id === empresa.checklistAtivoId ? undefined : id);
              });
            }}
            className={campoChecklist + " mt-1"}
          >
            {!empresa.checklists.length && <option value="">Nenhum checklist criado</option>}
            {empresa.checklists.map((c) => (
              <option key={c.id} value={c.id}>
                {TIPO_LABELS[c.tipo]}
                {c.id === empresa.checklistAtivoId ? " · ativo" : " · histórico"}
              </option>
            ))}
          </select>
        </label>
        {empresa.capabilities.canEdit && !empresa.historical && (
          <div>
            <label className="text-xs text-slate-400">
              Criar ou trocar embasamento
              <div className="mt-1 flex gap-2">
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={campoChecklist}>
                  <option value="">Selecione o tipo</option>
                  {tiposChecklist.map((t) => (
                    <option key={t} value={t}>
                      {TIPO_LABELS[t]}
                    </option>
                  ))}
                </select>
                <Acao disabled={!tipo || command.busy || draftState.busy || tipo === empresa.tipoAtivo} onClick={() => change(() => void trocar())}>
                  Aplicar
                </Acao>
              </div>
            </label>
            <p className="mt-2 text-xs text-slate-500">Preserva documentos e itens dos tipos anteriores.</p>
          </div>
        )}
        <ChecklistExport empresa={empresa} />
      </section>
      <nav aria-label="Seções do atendimento" className="flex flex-wrap gap-2">
        {["ITENS", "DADOS", "HISTORICO"].map((t) => (
          <Acao key={t} aria-pressed={tab === t} onClick={() => change(() => setTab(t))}>
            {t === "ITENS" ? (
              "Checklist"
            ) : t === "DADOS" ? (
              "Dados e acesso"
            ) : (
              <>
                <History size={14} />
                Histórico real
              </>
            )}
          </Acao>
        ))}
      </nav>
      {(command.error || reloadError) && <Falha error={command.error || reloadError} retry={() => void reload().catch(() => {})} />}
      {tab === "ITENS" && (
        <>
          {empresa.resumo.estado === "SEM_CHECKLIST" ? (
            <div className="rounded-2xl border border-dashed border-white/15 p-8 text-sm text-slate-400">
              Este atendimento ainda não possui checklist ativo.{" "}
              {empresa.capabilities.canEdit ? "Selecione um embasamento com modelo publicado." : "Aguarde a definição do analista responsável."}
            </div>
          ) : empresa.resumo.estado === "SEM_ITENS" ? (
            <Falha error="Checklist sem itens. Solicite ao líder a revisão do catálogo; nenhum modelo será aplicado retroativamente." />
          ) : (
            <>
              <nav aria-label="Seções do checklist" className="flex flex-wrap gap-2">
                {secoes.map((s) => (
                  <Acao key={s} aria-pressed={active === s} onClick={() => change(() => setSecao(s))}>
                    {s}
                  </Acao>
                ))}
              </nav>
              <div className="space-y-4">
                {empresa.checklist?.itens
                  .filter((i) => i.secao === active)
                  .map((item) => (
                    <ChecklistItemCard
                      key={item.id}
                      item={item}
                      empresa={empresa}
                      busy={command.busy || draftState.busy}
                      onObservation={(value) => patchItem(item.id, { observacao: value || null })}
                      getRevision={() => current().revision}
                      onStatus={(status) => void patchItem(item.id, { status })}
                      onReload={reload}
                    />
                  ))}
              </div>
            </>
          )}
        </>
      )}
      {tab === "DADOS" && (
        <AtendimentoSettings key={empresa.id} empresa={empresa} onConfirmed={confirmed} onReload={reload} getRevision={() => current().revision} />
      )}
      {tab === "HISTORICO" && <HistoricoAtendimento empresaId={empresa.id} />}
    </main>
  );
}
