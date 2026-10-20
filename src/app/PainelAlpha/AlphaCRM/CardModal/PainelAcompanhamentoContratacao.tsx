"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ObterAcompanhamentoContratacaoBpm, AtualizarAcompanhamentoContratacaoBpm } from "@/actions/bpm/AcompanhamentoContratacao";

type Dados = NonNullable<Awaited<ReturnType<typeof ObterAcompanhamentoContratacaoBpm>>["data"]>;

export function PainelAcompanhamentoContratacao({ cardId, realtimeRevision, onAtualizado }: {
  cardId: string; realtimeRevision: number; onAtualizado: () => void;
}) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resultado = await ObterAcompanhamentoContratacaoBpm(cardId);
      if (!resultado.success) { setErro(resultado.error); return; }
      setDados(resultado.data);
    } catch { setErro("Não foi possível carregar o acompanhamento."); }
    finally { setCarregando(false); }
  }, [cardId]);
  useEffect(() => { const timer = setTimeout(() => void carregar(), 0); return () => clearTimeout(timer); }, [carregar, realtimeRevision]);
  async function registrar(acao: "REGISTRAR_ENVIO" | "CONFERIR_PAGAMENTO") {
    if (!dados) return;
    setSalvando(true);
    try {
      const resultado = await AtualizarAcompanhamentoContratacaoBpm({ cardId, versao: dados.versao, acao });
      if (!resultado.success) { toast.error(resultado.error); return; }
      toast.success(acao === "REGISTRAR_ENVIO" ? "Envio registrado." : "Pagamento encaminhado para conferência.");
      await carregar();
      onAtualizado();
    } catch { toast.error("Não foi possível registrar. Recarregue para conferir o estado atual."); }
    finally { setSalvando(false); }
  }
  if (carregando) return <p className="text-xs text-slate-400" role="status">Carregando acompanhamento da contratação…</p>;
  if (erro) return <div role="alert" className="text-xs text-amber-300">{erro} <button type="button" onClick={() => void carregar()} className="underline">Tentar novamente</button></div>;
  if (!dados) return null;
  const podeEnviar = dados.podeAgir && !dados.envioJaAcompanhado && dados.contratoUrl && (!dados.status || ["AGUARDANDO_CONTRATO", "CONTRATO_A_ENVIAR"].includes(dados.status));
  return <section className="space-y-3 rounded-xl border border-sky-400/20 bg-sky-400/5 p-4" aria-label="Acompanhamento da contratação">
    <h3 className="text-xs font-bold text-white">Acompanhamento da contratação</h3>
    {dados.contratoUrl ? <a href={dados.contratoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-300 underline">Abrir contrato elaborado</a>
      : <p className="text-xs text-slate-400">Aguardando o Financeiro concluir a elaboração e validar o contrato.</p>}
    <p className="text-xs text-slate-400">Registre o envio após encaminhar o documento ao cliente. A confirmação do pagamento é feita pelo Financeiro.</p>
    <div className="flex flex-wrap gap-2">
      {podeEnviar && <button type="button" disabled={salvando} onClick={() => void registrar("REGISTRAR_ENVIO")} className="min-h-11 rounded-lg border border-sky-400/30 px-3 text-xs text-sky-200 disabled:opacity-50">Registrar envio</button>}
      {dados.pagamentoEncaminhado ? <p className="text-xs text-slate-300">{dados.conferenciaConcluida ? "Tarefa de conferência concluída pelo Financeiro." : "Pagamento encaminhado para conferência."}</p> : dados.podeAgir && !dados.financeiroConcluido
        && <button type="button" disabled={salvando} onClick={() => void registrar("CONFERIR_PAGAMENTO")} className="min-h-11 rounded-lg border border-white/20 px-3 text-xs text-slate-200 disabled:opacity-50">Encaminhar pagamento para conferência</button>}
    </div>
  </section>;
}
