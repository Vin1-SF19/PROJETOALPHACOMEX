"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExcluirPerguntaFollowUpBpm, ListarPerguntasFollowUpBpm, SalvarPerguntaFollowUpBpm } from "@/actions/bpm/PerguntasFollowUp";

type Pergunta = {
  id?: string; pergunta: string; tipo: "texto" | "selecao" | "booleano";
  opcoes: string[]; obrigatoria: boolean; ativo: boolean; ordem: number;
};

export function PerguntasFollowUpEditor({ pipelineId }: { pipelineId: string }) {
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoId, setSalvandoId] = useState<string | null>(null);

  async function carregar() {
    const resultado = await ListarPerguntasFollowUpBpm(pipelineId);
    if (resultado.success) setPerguntas(resultado.data as Pergunta[]);
    else toast.error(resultado.error);
    setCarregando(false);
  }
  useEffect(() => {
    let ativo = true;
    void ListarPerguntasFollowUpBpm(pipelineId).then((resultado) => {
      if (!ativo) return;
      if (resultado.success) setPerguntas(resultado.data as Pergunta[]);
      else toast.error(resultado.error);
      setCarregando(false);
    });
    return () => { ativo = false; };
  }, [pipelineId]);

  function alterar(indice: number, patch: Partial<Pergunta>) {
    setPerguntas((atuais) => atuais.map((item, posicao) => posicao === indice ? { ...item, ...patch } : item));
  }
  async function salvar(pergunta: Pergunta, indice: number) {
    setSalvandoId(pergunta.id ?? `novo-${indice}`);
    try {
      const resultado = await SalvarPerguntaFollowUpBpm({ ...pergunta, opcoes: pergunta.opcoes.map((valor) => valor.trim()).filter(Boolean), pipelineId });
      if (!resultado.success) { toast.error(resultado.error); return; }
      toast.success("Pergunta do follow-up salva");
      await carregar();
    } catch { toast.error("Não foi possível salvar a pergunta."); }
    finally { setSalvandoId(null); }
  }
  async function excluir(pergunta: Pergunta, indice: number) {
    if (!pergunta.id) { setPerguntas((atuais) => atuais.filter((_, posicao) => posicao !== indice)); return; }
    setSalvandoId(pergunta.id);
    try {
      const resultado = await ExcluirPerguntaFollowUpBpm(pipelineId, pergunta.id);
      if (!resultado.success) { toast.error(resultado.error); return; }
      toast.success("Pergunta removida. Follow-ups antigos mantêm o snapshot original.");
      await carregar();
    } catch { toast.error("Não foi possível remover a pergunta."); }
    finally { setSalvandoId(null); }
  }

  return <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-slate-300" aria-label="Perguntas do follow-up">
    <div>
      <h3 className="font-semibold text-white">Perguntas do follow-up</h3>
      <p className="mt-1 text-slate-400">“Anotações sobre o último follow-up” é obrigatória. Configure aqui as perguntas adicionais; alterações valem para novos follow-ups.</p>
    </div>
    {carregando ? <p>Carregando perguntas...</p> : perguntas.map((item, indice) => <div key={item.id ?? `novo-${indice}`} className="grid gap-2 rounded-lg border border-white/10 p-3">
      <label>Enunciado<input className="mt-1 w-full rounded border border-white/15 bg-slate-900 p-2 text-white" value={item.pergunta} onChange={(event) => alterar(indice, { pergunta: event.target.value })} /></label>
      <div className="flex flex-wrap gap-3">
        <label>Tipo <select className="rounded border border-white/15 bg-slate-900 p-1" value={item.tipo} onChange={(event) => alterar(indice, { tipo: event.target.value as Pergunta["tipo"] })}><option value="texto">Texto</option><option value="selecao">Seleção</option><option value="booleano">Sim / Não</option></select></label>
        <label>Ordem <input type="number" min={0} max={1000} className="w-16 rounded border border-white/15 bg-slate-900 p-1" value={item.ordem} onChange={(event) => alterar(indice, { ordem: Number(event.target.value) })} /></label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={item.obrigatoria} onChange={(event) => alterar(indice, { obrigatoria: event.target.checked })} /> Obrigatória</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={item.ativo} onChange={(event) => alterar(indice, { ativo: event.target.checked })} /> Ativa</label>
      </div>
      {item.tipo === "selecao" && <label>Opções (uma por linha)<textarea className="mt-1 min-h-20 w-full rounded border border-white/15 bg-slate-900 p-2 text-white" value={item.opcoes.join("\n")} onChange={(event) => alterar(indice, { opcoes: event.target.value.split("\n") })} /></label>}
      <div className="flex gap-2"><button type="button" disabled={Boolean(salvandoId)} className="rounded bg-cyan-400 px-3 py-1.5 font-semibold text-slate-950 disabled:opacity-50" onClick={() => void salvar(item, indice)}>Salvar pergunta</button><button type="button" disabled={Boolean(salvandoId)} className="rounded border border-rose-400/30 px-3 py-1.5 text-rose-200 disabled:opacity-50" onClick={() => void excluir(item, indice)}>Remover</button></div>
    </div>)}
    <button type="button" className="rounded border border-cyan-400/30 px-3 py-2 font-semibold text-cyan-200" onClick={() => setPerguntas((atuais) => [...atuais, { pergunta: "", tipo: "texto", opcoes: [], obrigatoria: false, ativo: true, ordem: atuais.length + 1 }])}>Adicionar pergunta</button>
  </section>;
}
