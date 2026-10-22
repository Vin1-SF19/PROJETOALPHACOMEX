"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { obterDossieChecklistCard, listarDossiesCandidatosCard, vincularDossieChecklistCard } from "@/actions/bpm/ChecklistDocumental";
import { confirmar } from "@/lib/checklist/client/types";
import { abrirChecklistNoPainel } from "@/lib/checklist/client/notificacoes";
import { TIPO_LABELS } from "@/lib/checklist/items";
import { ChecklistProvider } from "@/components/checklist/ChecklistProvider";
import { Acao, Carregando, Falha, Paginas, Percentual, campoChecklist } from "@/components/checklist/ChecklistUI";
import { useChecklistCommand } from "@/components/checklist/useChecklistCommand";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
interface Props {
  cardId: string;
  podeEditar: boolean;
  onAtualizado: () => void;
}
export function PainelDossieChecklist(props: Props) {
  return (
    <ChecklistProvider>
      <Dossie {...props} />
    </ChecklistProvider>
  );
}
function Dossie({ cardId, podeEditar, onAtualizado }: Props) {
  const [page, setPage] = useState(1),
    [busca, setBusca] = useState(""),
    [selecionado, setSelecionado] = useState<string | undefined>(),
    [confirmando, setConfirmando] = useState(false),
    [escolhendo, setEscolhendo] = useState(false),
    command = useChecklistCommand();
  const query = useQuery({ queryKey: ["crm-dossie", cardId], queryFn: () => confirmar(obterDossieChecklistCard(cardId)) });
  const candidatos = useQuery({
    queryKey: ["crm-dossie-candidatos", cardId, page, busca],
    queryFn: () => confirmar(listarDossiesCandidatosCard(cardId, { page, pageSize: 10, busca: busca || undefined })),
    enabled: escolhendo && podeEditar,
  });
  async function salvar() {
    const data = query.data;
    if (!data || selecionado === undefined) return;
    const response = await command.run(`${cardId}:${selecionado}:${data.revision}:${data.cardUpdatedAt}`, (mutationId) =>
      vincularDossieChecklistCard({
        cardId,
        empresaOperacionalId: selecionado || null,
        expectedRevision: data.revision,
        expectedCardUpdatedAt: data.cardUpdatedAt,
        mutationId,
      }),
    );
    if (response) {
      setConfirmando(false);
      setEscolhendo(false);
      setSelecionado(undefined);
      await query.refetch();
      onAtualizado();
    }
  }
  if (query.isPending) return <Carregando />;
  if (query.isError) return <Falha error={query.error} retry={() => void query.refetch()} />;
  const data = query.data,
    dossie = data.dossie;
  return (
    <section className="space-y-4 p-4 text-slate-100">
      <header>
        <h3 className="font-semibold">Dossiê documental RADAR</h3>
        <p className="mt-1 text-xs text-slate-400">Checklist do atendimento operacional. Os Procedimentos do CRM permanecem independentes.</p>
      </header>
      {dossie ? (
        <article className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
          <div>
            <p className="font-medium">{dossie.cliente.razaoSocial}</p>
            <p className="mt-1 text-xs text-slate-400">
              Analista: {dossie.analista?.nome ?? "Aguardando atribuição"} · {dossie.tipoAtivo ? TIPO_LABELS[dossie.tipoAtivo] : "Embasamento não definido"}
            </p>
          </div>
          <Percentual percentual={dossie.resumo.percentual} descricao={`${dossie.resumo.pendentes} pendência(s) obrigatória(s)`} />
          <Acao onClick={() => abrirChecklistNoPainel(dossie.id)}>Abrir no Checklist</Acao>
          {podeEditar && dossie.capabilities.canLinkCrm && (
            <Acao
              disabled={command.busy}
              onClick={() => {
                setSelecionado("");
                setConfirmando(true);
              }}
            >
              Desvincular deste card
            </Acao>
          )}
        </article>
      ) : (
        <p className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-slate-400">
          Nenhum dossiê vinculado a este card. A seleção é explícita e usa a mesma empresa master.
        </p>
      )}
      {podeEditar && (!dossie || dossie.capabilities.canLinkCrm) && (
        <Acao onClick={() => setEscolhendo((v) => !v)}>{escolhendo ? "Cancelar seleção" : "Selecionar atendimento existente"}</Acao>
      )}
      {escolhendo && (
        <div className="space-y-3">
          <label className="block text-xs text-slate-400">
            Buscar atendimento
            <input
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPage(1);
              }}
              className={campoChecklist + " mt-1"}
            />
          </label>
          {candidatos.isPending ? (
            <Carregando />
          ) : candidatos.isError ? (
            <Falha error={candidatos.error} retry={() => void candidatos.refetch()} />
          ) : (
            candidatos.data && (
              <>
                {!candidatos.data.items.length && <p className="text-sm text-slate-400">Nenhum atendimento desta empresa disponível.</p>}
                {candidatos.data.items.map((c) => (
                  <label key={c.id} className="flex items-center gap-3 rounded-xl border border-white/10 p-3 text-sm">
                    <input
                      type="radio"
                      name={`dossie-${cardId}`}
                      value={c.id}
                      checked={selecionado === c.id}
                      disabled={!c.capabilities.canEdit || command.busy}
                      onChange={() => setSelecionado(c.id)}
                    />
                    <span className="flex-1">
                      {c.razaoSocial}
                      <small className="mt-1 block text-slate-400">
                        {c.analista?.nome ?? "Sem analista"} · {c.tipoAtivo ? TIPO_LABELS[c.tipoAtivo] : "Sem checklist"} · {c.resumo.percentual}%
                        {!c.capabilities.canEdit && " · somente leitura"}
                      </small>
                    </span>
                  </label>
                ))}
                <Paginas page={page} pageSize={10} total={candidatos.data.totalCount} onPage={setPage} />
                <Acao disabled={!selecionado || command.busy} onClick={() => setConfirmando(true)}>
                  Confirmar seleção
                </Acao>
              </>
            )
          )}
        </div>
      )}
      {command.error && <Falha error={command.error} retry={() => void query.refetch()} />}
      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent className="border-white/10 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>{selecionado ? "Vincular atendimento a este card?" : "Desvincular dossiê deste card?"}</DialogTitle>
            <DialogDescription>Os documentos permanecem no atendimento. Este vínculo não conclui tarefas nem movimenta etapas.</DialogDescription>
          </DialogHeader>
          {command.error && <Falha error={command.error} />}
          <Acao disabled={command.busy} onClick={() => void salvar()}>
            {command.busy ? "Salvando…" : "Confirmar vínculo"}
          </Acao>
        </DialogContent>
      </Dialog>
    </section>
  );
}
