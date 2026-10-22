"use client";
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
}
export function AtendimentoSettings({ empresa, onConfirmed, onReload }: Props) {
  const [status, setStatus] = useState(empresa.status),
    [embasamento, setEmbasamento] = useState(empresa.embasamento),
    [mes, setMes] = useState(empresa.mesProtocolo ?? ""),
    [grupo, setGrupo] = useState(empresa.linkGrupo ?? ""),
    [analista, setAnalista] = useState(empresa.analista?.id.toString() ?? ""),
    [token, setToken] = useState(""),
    [resetMessage, setResetMessage] = useState("");
  const command = useChecklistCommand();
  const analistas = useQuery({
    queryKey: ["checklist-analistas"],
    queryFn: () => confirmar(listarAnalistasChecklist()),
    enabled: empresa.capabilities.canAssignOwner,
  });
  async function salvar() {
    const patch = { status, embasamento, mesProtocolo: mes || null, linkGrupo: grupo || null };
    const data = await command.run(JSON.stringify({ patch, revision: empresa.revision }), (mutationId) =>
      atualizarEmpresaChecklist({ empresaId: empresa.id, patch, expectedRevision: empresa.revision, mutationId }),
    );
    if (data) onConfirmed(data);
  }
  async function atribuir() {
    const data = await command.run(`owner:${analista}:${empresa.revision}`, (mutationId) =>
      atribuirAnalistaChecklist({ empresaId: empresa.id, analistaId: Number(analista), expectedRevision: empresa.revision, mutationId }),
    );
    if (data) onConfirmed(data);
  }
  async function reset() {
    setToken("");
    const data = await command.run(`reset:${empresa.id}:${empresa.revision}`, (mutationId) =>
      emitirResetAcessoPortal({ empresaId: empresa.id, expectedRevision: empresa.revision, mutationId }),
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
          { label: "Status", value: status, set: setStatus },
          { label: "Embasamento cadastral", value: embasamento, set: setEmbasamento },
          { label: "Mês de protocolo", value: mes, set: setMes },
          { label: "Link do grupo (HTTPS)", value: grupo, set: setGrupo },
        ].map((f) => (
          <label key={f.label} className="text-xs text-slate-400">
            {f.label}
            <input
              className={campoChecklist + " mt-1"}
              value={f.value}
              maxLength={f.label.startsWith("Link") ? 1000 : 120}
              readOnly={!empresa.capabilities.canEdit}
              onChange={(e) => f.set(e.target.value)}
            />
          </label>
        ))}
      </div>
      {empresa.capabilities.canEdit && (
        <Acao disabled={command.busy} onClick={() => void salvar()}>
          Salvar dados
        </Acao>
      )}
      {empresa.capabilities.canAssignOwner && (
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
          <Acao disabled={!analista || command.busy} onClick={() => void atribuir()}>
            Confirmar responsável
          </Acao>
          {analistas.isError && <Falha error={analistas.error} />}
        </div>
      )}
      {empresa.capabilities.canManagePortalAccess && (
        <div className="space-y-2 border-t border-white/10 pt-4">
          <p className="text-xs text-slate-400">Acesso do cliente: {empresa.contaPortal?.nome ?? "Não disponível"}</p>
          <Acao disabled={command.busy} onClick={() => void reset()}>
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
      {command.error && <Falha error={command.error} />}
    </section>
  );
}
