"use client";
import { useChecklistDraft, useChecklistDrafts } from "./ChecklistDraftGuard";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listarDocumentosChecklist,
  registrarDocumentoChecklist,
  excluirDocumentoChecklist,
  restaurarDocumentoChecklist,
  atualizarObservacaoDocumento,
} from "@/actions/checklist";
import { confirmar, type EmpresaDetalhe, type Documento } from "@/lib/checklist/client/types";
import { uploadPrivadoChecklist } from "@/lib/checklist/client/upload";
import { Acao, Carregando, Falha, Paginas, campoChecklist } from "./ChecklistUI";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useChecklistCommand } from "./useChecklistCommand";
interface Props {
  empresa: EmpresaDetalhe;
  itemId: string;
  busy: boolean;
  onReload: () => Promise<void>;
  getRevision: () => number;
}
export function DocumentosItem({ empresa, itemId, busy, onReload, getRevision }: Props) {
  const [page, setPage] = useState(1),
    [excluidos, setExcluidos] = useState(false),
    [uploadError, setUploadError] = useState(""),
    [uploading, setUploading] = useState(false),
    [receipt, setReceipt] = useState<string | null>(null),
    [confirmarDoc, setConfirmarDoc] = useState<Documento | null>(null);
  const guard = useChecklistDrafts();
  const command = useChecklistCommand(),
    client = useQueryClient();
  const key = ["checklist-documentos", empresa.id, itemId, empresa.checklist?.id, excluidos, page];
  const docs = useQuery({
    queryKey: key,
    queryFn: () => confirmar(listarDocumentosChecklist({ empresaId: empresa.id, itemId, checklistId: empresa.checklist?.id, excluidos, page, pageSize: 10 })),
  });
  const blocked = busy || command.busy || uploading,
    canEdit = empresa.capabilities.canEdit && !empresa.historical;
  async function atualizar() {
    try {
      await onReload();
      await client.invalidateQueries({ queryKey: ["checklist-documentos", empresa.id] });
    } catch {
      setUploadError("Ação confirmada; não foi possível atualizar a listagem. Recarregue o atendimento antes de continuar.");
    }
  }
  async function registrar(recibo: string) {
    const data = await command.run(`upload:${recibo}:${empresa.revision}`, (mutationId) =>
      registrarDocumentoChecklist({ itemId, recibo, expectedRevision: getRevision(), mutationId }),
    );
    if (data) {
      setReceipt(null);
      await atualizar();
    }
  }
  async function enviar(file: File) {
    const unlock = guard.lock();
    setUploading(true);
    setUploadError("");
    try {
      const recibo = await uploadPrivadoChecklist(itemId, file);
      setReceipt(recibo);
      await registrar(recibo);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Falha ao enviar arquivo.");
    } finally {
      unlock();
      setUploading(false);
    }
  }
  async function remover(doc: Documento) {
    const result = await command.run(`${excluidos ? "restore" : "delete"}:${doc.id}:${empresa.revision}`, (mutationId) =>
      (excluidos ? restaurarDocumentoChecklist : excluirDocumentoChecklist)({ documentoId: doc.id, expectedRevision: getRevision(), mutationId }),
    );
    if (result) {
      setConfirmarDoc(null);
      await atualizar();
    }
  }
  async function observar(doc: Documento, obs: string) {
    if (obs === (doc.observacao ?? "")) return true;
    await onReload();
    const revision = getRevision();
    const result = await command.run(`obs:${doc.id}:${obs}:${revision}`, (mutationId) =>
      atualizarObservacaoDocumento({ documentoId: doc.id, observacao: obs || null, expectedRevision: revision, mutationId }),
    );
    if (!result) return false;
    await onReload();
    await client.invalidateQueries({ queryKey: ["checklist-documentos", empresa.id] });
    return true;
  }
  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/15 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Acao
            onClick={() => {
              guard.request(() => {
                setExcluidos(false);
                setPage(1);
              });
            }}
            disabled={blocked || !excluidos}
          >
            Ativos
          </Acao>
          <Acao
            onClick={() => {
              guard.request(() => {
                setExcluidos(true);
                setPage(1);
              });
            }}
            disabled={blocked || excluidos}
          >
            Removidos
          </Acao>
        </div>
        {canEdit && !excluidos && (
          <label className="cursor-pointer rounded-xl border border-white/15 px-3 py-2 text-xs focus-within:ring-2 focus-within:ring-[var(--checklist-accent)]">
            {uploading ? "Enviando arquivo…" : "Anexar documento"}
            <input
              aria-label="Anexar PDF JPEG ou PNG até 8 MiB"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              disabled={blocked || !!receipt}
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void enviar(file);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
      <p className="text-xs text-slate-500">PDF, JPEG ou PNG · até 8 MiB · armazenamento privado</p>
      {(command.error || uploadError) && <Falha error={command.error || uploadError} />}
      {receipt && !blocked && <Acao onClick={() => void registrar(receipt)}>Tentar registrar arquivo já enviado</Acao>}
      {docs.isPending ? (
        <Carregando />
      ) : docs.isError ? (
        <Falha error={docs.error} retry={() => void docs.refetch()} />
      ) : (
        <>
          {docs.data.items.length === 0 ? (
            <p className="py-4 text-sm text-slate-400">Nenhum documento {excluidos ? "removido" : "ativo"}.</p>
          ) : (
            docs.data.items.map((doc) => (
              <DocumentoLinha
                key={doc.id}
                doc={doc}
                canEdit={canEdit}
                busy={blocked}
                onDelete={() => guard.request(() => setConfirmarDoc(doc))}
                onObservation={(obs) => observar(doc, obs)}
              />
            ))
          )}
          <Paginas page={page} pageSize={10} total={docs.data.totalCount} onPage={(page) => guard.request(() => setPage(page))} />
        </>
      )}
      <Dialog
        open={!!confirmarDoc}
        onOpenChange={(open) => {
          if (!open && !command.busy) setConfirmarDoc(null);
        }}
      >
        <DialogContent className="border-white/10 bg-slate-950 text-white">
          <DialogHeader>
            <DialogTitle>{excluidos ? "Restaurar documento?" : "Mover documento para o histórico?"}</DialogTitle>
            <DialogDescription>{confirmarDoc?.nome} · A ação preserva o registro e a autoria.</DialogDescription>
          </DialogHeader>
          {command.error && <Falha error={command.error} />}
          <Acao
            disabled={blocked}
            onClick={() => {
              if (confirmarDoc) void remover(confirmarDoc);
            }}
          >
            Confirmar
          </Acao>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function DocumentoLinha({
  doc,
  canEdit,
  busy,
  onDelete,
  onObservation,
}: {
  doc: Documento;
  canEdit: boolean;
  busy: boolean;
  onDelete: () => void;
  onObservation: (obs: string) => Promise<boolean>;
}) {
  const draft = useChecklistDraft(
    `documento:${doc.id}`,
    { observacao: doc.observacao ?? "" },
    (patch) => onObservation(patch.observacao ?? ""),
    canEdit && !doc.deletadoEm,
  );
  return (
    <article className="space-y-3 rounded-xl border border-white/10 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="break-all text-sm font-medium underline underline-offset-4">
          {doc.nome}
        </a>
        {canEdit && (
          <Acao disabled={busy} onClick={onDelete}>
            {doc.deletadoEm ? "Restaurar" : "Remover"}
          </Acao>
        )}
      </div>
      <p className="text-xs text-slate-400">
        Enviado por {doc.uploadedByCliente ? "cliente" : "equipe Alpha"} · {new Date(doc.criadoEm).toLocaleString("pt-BR")}
        {doc.deletadoEm && ` · Removido por ${doc.deletadoPorCliente ? "cliente" : "equipe Alpha"}`}
      </p>
      <label className="block text-xs text-slate-400">
        Observação do documento
        <textarea
          value={draft.value.observacao}
          onChange={(e) => draft.change("observacao", e.target.value)}
          maxLength={5000}
          readOnly={!canEdit || !!doc.deletadoEm}
          disabled={busy}
          className={campoChecklist + " mt-1"}
        />
      </label>
      {draft.error && <Falha error={draft.error} />}
      {canEdit && !doc.deletadoEm && draft.dirty && (
        <Acao disabled={busy} onClick={() => void draft.save()}>
          Salvar observação
        </Acao>
      )}
    </article>
  );
}
