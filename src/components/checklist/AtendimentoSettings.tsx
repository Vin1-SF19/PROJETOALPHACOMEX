"use client";
import { useChecklistDraft, useDraftState } from "./ChecklistDraftGuard";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { atualizarEmpresaChecklist, atribuirAnalistaChecklist, listarAnalistasChecklist } from "@/actions/checklist";
import { emitirResetAcessoPortal } from "@/actions/ClientesOperacional";
import { confirmar, type EmpresaDetalhe } from "@/lib/checklist/client/types";
import { useChecklistCommand } from "./useChecklistCommand";
import { Acao, Falha, campoChecklist } from "./ChecklistUI";
interface Props {
  empresa: EmpresaDetalhe;
  onConfirmed: (data: EmpresaDetalhe) => void;
  onReload: () => Promise<void>;
  getRevision: () => number;
}
export function AtendimentoSettings({ empresa, onConfirmed, onReload, getRevision }: Props) {
  const [analista, setAnalista] = useState(empresa.analista?.id.toString() ?? ""),
    [token, setToken] = useState(""),
    [resetMessage, setResetMessage] = useState("");
  const command = useChecklistCommand();
  const analistas = useQuery({
    queryKey: ["checklist-analistas"],
    queryFn: () => confirmar(listarAnalistasChecklist()),
    enabled: !empresa.historical && empresa.capabilities.canAssignOwner,
  });
  const draft = useChecklistDraft(
    `metadata:${empresa.id}`,
    { status: empresa.status, embasamento: empresa.embasamento, mesProtocolo: empresa.mesProtocolo ?? "", linkGrupo: empresa.linkGrupo ?? "" },
    async (patch) => {
      const normalized = {
          ...patch,
          ...(patch.mesProtocolo !== undefined ? { mesProtocolo: patch.mesProtocolo || null } : {}),
          ...(patch.linkGrupo !== undefined ? { linkGrupo: patch.linkGrupo || null } : {}),
        },
        revision = getRevision();
      const data = await command.run(JSON.stringify({ patch: normalized, revision }), (mutationId) =>
        atualizarEmpresaChecklist({ empresaId: empresa.id, patch: normalized, expectedRevision: revision, mutationId }),
      );
      if (!data) return false;
      onConfirmed(data);
      await onReload();
      return true;
    },
    empresa.capabilities.canEdit,
  );
  const draftState = useDraftState(),
    blocked = command.busy || draftState.busy;
  async function atribuir() {
    const data = await command.run(`owner:${analista}:${empresa.revision}`, (mutationId) =>
      atribuirAnalistaChecklist({ empresaId: empresa.id, analistaId: Number(analista), expectedRevision: getRevision(), mutationId }),
    );
    if (data) onConfirmed(data);
  }
  async function reset() {
    setToken("");
    const data = await command.run(`reset:${empresa.id}:${empresa.revision}`, (mutationId) =>
      emitirResetAcessoPortal({ empresaId: empresa.id, expectedRevision: getRevision(), mutationId }),
    );
    if (data) {
      setToken(data.token ?? "");
      setResetMessage(data.token ? "Token emitido e disponível por15minutos." : "Já emitido nesta solicitação. O segredo não é exibido novamente.");
      await onReload().catch(() => setResetMessage("Reset confirmado; não foi possível atualizar os dados. Recarregue o atendimento."));
    }
  }
  const origin = process.env.NEXT_PUBLIC_CHECKLIST_PORTAL_ORIGIN;
  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/70 p-5">
      <h2 className="font-semibold">Dados do atendimento</h2>
      <p className="text-xs text-slate-400">Empresa e CNPJ são mantidos no cadastro master do CRM.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { label: "Status", value: draft.value.status, set: (value: string) => draft.change("status", value) },
          { label: "Embasamento cadastral", value: draft.value.embasamento, set: (value: string) => draft.change("embasamento", value) },
          { label: "Mês de protocolo", value: draft.value.mesProtocolo, set: (value: string) => draft.change("mesProtocolo", value) },
          { label: "Link do grupo (HTTPS)", value: draft.value.linkGrupo, set: (value: string) => draft.change("linkGrupo", value) },
        ].map((f) => (
          <label key={f.label} className="text-xs text-slate-400">
            {f.label}
            <input
              className={campoChecklist + " mt-1"}
              value={f.value}
              maxLength={f.label.startsWith("Link") ? 1000 : 120}
              disabled={blocked}
              readOnly={!empresa.capabilities.canEdit}
              onChange={(e) => f.set(e.target.value)}
            />
          </label>
        ))}
      </div>
      {empresa.capabilities.canEdit && (
        <Acao disabled={blocked} onClick={() => void draft.save()}>
          Salvar dados
        </Acao>
      )}
      {!empresa.historical && empresa.capabilities.canAssignOwner && (
        <div className="border-t border-white/10 pt-4">
          <label className="block text-xs text-slate-400">
            Atribuir analista
            <select className={campoChecklist + " my-2"} value={analista} onChange={(e) => setAnalista(e.target.value)}>
              <option value="">Selecione</option>
              {analistas.data
                ?.filter((a) => a.ativo && !a.legado)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
            </select>
          </label>
          <Acao disabled={!analista || blocked} onClick={() => void atribuir()}>
            Confirmar responsável
          </Acao>
          {analistas.isError && <Falha error={analistas.error} />}
        </div>
      )}
      {empresa.capabilities.canManagePortalAccess && (
        <div className="space-y-2 border-t border-white/10 pt-4">
          <p className="text-xs text-slate-400">Acesso do cliente: {empresa.contaPortal?.nome ?? "Não disponível"}</p>
          <Acao disabled={blocked} onClick={() => void reset()}>
            Emitir reset de acesso (15 min)
          </Acao>
          {resetMessage && (
            <p role="status" className="text-xs text-slate-300">
              {resetMessage}
            </p>
          )}
          {token && (
            <div className="space-y-2 rounded-xl bg-black/20 p-3">
              <p className="text-xs text-slate-400">Token de uso único. Entregue ao cliente por um canal seguro; esta resposta é a única exibição.</p>
              <output className="block break-all font-mono text-xs">{token}</output>
              <Acao onClick={() => void navigator.clipboard.writeText(token)}>Copiar token</Acao>
              {origin && token.length >= 32 ? (
                <a
                  className="block break-all text-xs underline"
                  href={`${origin.replace(/\/$/, "")}/redefinir-senha#token=${encodeURIComponent(token)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir redefinição no portal configurado
                </a>
              ) : (
                <p className="text-xs text-slate-400">O endereço isolado do portal precisa estar configurado para gerar o link.</p>
              )}
            </div>
          )}
        </div>
      )}
      {(command.error || draft.error) && <Falha error={command.error || draft.error} />}
    </section>
  );
}
