"use client";

import { useId, useState } from "react";
import { Copy, ListChecks } from "lucide-react";
import { toast } from "sonner";

import { ListarCamposObrigatoriosWebhookBpm } from "@/actions/bpm/WebhookCampos";
import { Button } from "@/components/ui/button";
import type { GrupoCamposWebhook } from "@/lib/bpm/webhook-campos-server";

export function WebhookCamposObrigatorios({ endpointId }: { endpointId: string }) {
  const painelId = useId();
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<GrupoCamposWebhook[]>([]);

  async function alternar() {
    if (aberto) { setAberto(false); return; }
    setAberto(true);
    setCarregando(true);
    setErro(null);
    try {
      const resultado = await ListarCamposObrigatoriosWebhookBpm(endpointId);
      if (resultado.success) setGrupos(resultado.data);
      else setErro(resultado.error);
    } catch { setErro("Não foi possível consultar os campos. Tente novamente."); }
    finally { setCarregando(false); }
  }

  async function copiarId(id: string) {
    try { await navigator.clipboard.writeText(id); toast.success("ID copiado"); }
    catch { toast.error("Não foi possível copiar. Selecione e copie o ID exibido."); }
  }

  return <div className="mt-3 border-t border-white/10 pt-3">
    <Button type="button" variant="outline" size="sm" onClick={alternar} disabled={carregando}
      aria-expanded={aberto} aria-controls={painelId}>
      <ListChecks size={14} /> {carregando ? "Consultando campos…" : aberto ? "Ocultar campos obrigatórios" : "Ver campos obrigatórios"}
    </Button>
    {aberto && <div id={painelId} className="mt-3 space-y-4 text-sm" aria-busy={carregando}>
      {carregando && <p role="status" className="text-slate-400">Consultando a configuração atual do pipeline…</p>}
      {erro && <p role="alert" className="text-amber-200">{erro}</p>}
      {!carregando && !erro && <>
        <p className="text-slate-300">Para criar um card, informe <code>empresa.cnpj</code> e <code>empresa.razaoSocial</code>. Esses parâmetros não exigem ID de campo.</p>
        <p className="text-xs text-slate-400">Para mover um card, use os IDs abaixo como chaves de <code>camposValores</code>. Campos condicionais dependem dos dados do card; regras e checklists continuam sendo validados pela API.</p>
        {grupos.map((grupo) => <section key={grupo.etapaDestino} className="space-y-2 rounded-lg border border-white/10 p-3">
          <h3 className="font-semibold text-white">{grupo.titulo}</h3>
          <p className="text-xs text-slate-400"><code>etapaDestino: {grupo.etapaDestino}</code></p>
          {grupo.aviso && <p className="text-xs text-amber-200">{grupo.aviso}</p>}
          {grupo.etapaDestino === "REUNIAO_AGENDADA" && <p className="text-xs text-slate-300"><code>dataReuniao</code> é obrigatório fora de <code>camposValores</code>: data/hora com fuso, por exemplo <code>2026-11-10T14:30:00-03:00</code>.</p>}
          {grupo.campos.length ? <div className="overflow-x-auto"><table className="w-full text-left text-xs">
            <caption className="sr-only">Campos obrigatórios para {grupo.titulo}</caption>
            <thead className="text-slate-400"><tr><th scope="col" className="p-2">Campo</th><th scope="col" className="p-2">ID para camposValores</th><th scope="col" className="p-2">Obrigatoriedade</th></tr></thead>
            <tbody>{grupo.campos.map((campo) => <tr key={campo.id} className="border-t border-white/10 text-slate-200">
              <td className="p-2"><span className="font-medium">{campo.nome}</span><p className="text-slate-400">Tipo: {campo.tipo}</p>
                {campo.opcoes.length > 0 && <p className="mt-1 text-slate-400">Opções: {campo.opcoes.join(" · ")}</p>}
                {!campo.editavelViaWebhook && <p className="mt-1 text-amber-200">Preencha no CRM; este campo não pode ser editado por este movimento.</p>}
              </td>
              <td className="p-2"><div className="flex items-center gap-2"><code className="select-all break-all">{campo.id}</code>
                <Button type="button" size="sm" variant="ghost" aria-label={`Copiar ID do campo ${campo.nome}`} onClick={() => copiarId(campo.id)}><Copy size={14} /></Button>
              </div></td>
              <td className="p-2">{campo.condicional ? "Condicional" : "Obrigatório"}</td>
            </tr>)}</tbody>
          </table></div> : <p className="text-xs text-slate-400">Nenhum campo dinâmico obrigatório encontrado para esta transição.</p>}
          {grupo.outrosRequisitos.length > 0 && <div className="text-xs text-slate-300"><p className="font-medium">Outros requisitos configurados:</p><ul className="mt-1 list-disc space-y-1 pl-4">{grupo.outrosRequisitos.map((requisito) => <li key={requisito}>{requisito}</li>)}</ul></div>}
        </section>)}
      </>}
    </div>}
  </div>;
}
