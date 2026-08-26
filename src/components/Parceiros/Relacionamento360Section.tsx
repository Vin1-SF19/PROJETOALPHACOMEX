"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star, TrendingUp, Users2, Percent, DollarSign, Target, History, GitBranch } from "lucide-react";
import { AtualizarPotencialRecorrenciaParceiro, RegistrarProximaAcaoParceiro, type ObterIndicadoresDesenvolvimentoParceiro, type ListarHistoricoParceiro } from "@/actions/parceiros-desenvolvimento";
import type { ListarIndicacoesDoParceiro } from "@/actions/parceiros-indicacoes";

type Indicadores = Awaited<ReturnType<typeof ObterIndicadoresDesenvolvimentoParceiro>>;
type Historico = Awaited<ReturnType<typeof ListarHistoricoParceiro>>["historico"];
type Indicacoes = Awaited<ReturnType<typeof ListarIndicacoesDoParceiro>>["indicacoes"];

const ESTAGIO_LABEL: Record<string, string> = {
  NOVO: "Novo Parceiro",
  EM_ATIVACAO: "Em Ativação",
  ATIVADO_SEM_INDICACAO: "Ativado sem Indicação",
  PRIMEIRA_INDICACAO: "Primeira Indicação",
  ATIVO: "Parceiro Ativo",
  RECORRENTE: "Parceiro Recorrente",
  INATIVO: "Inativo",
  EM_REATIVACAO: "Em Reativação",
};

const ESTAGIO_COR: Record<string, string> = {
  NOVO: "text-slate-300 border-slate-400/40 bg-slate-400/10",
  EM_ATIVACAO: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  ATIVADO_SEM_INDICACAO: "text-sky-300 border-sky-500/40 bg-sky-500/10",
  PRIMEIRA_INDICACAO: "text-violet-300 border-violet-500/40 bg-violet-500/10",
  ATIVO: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  RECORRENTE: "text-fuchsia-300 border-fuchsia-500/40 bg-fuchsia-500/10",
  INATIVO: "text-red-300 border-red-500/40 bg-red-500/10",
  EM_REATIVACAO: "text-amber-300 border-amber-500/40 bg-amber-500/10",
};

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Relacionamento360Section({
  parceiroId,
  estagioDesenvolvimento,
  potencialRecorrenciaInicial,
  responsavelNome,
  segmento,
  origem,
  proximaAcaoEmInicial,
  proximaAcaoDescricaoInicial,
  indicadores,
  historico,
  indicacoesFunil,
  podeEditar,
  accent,
  cardCls,
}: {
  parceiroId: number;
  estagioDesenvolvimento: string;
  potencialRecorrenciaInicial: number | null;
  responsavelNome: string | null;
  segmento: string | null;
  origem: string | null;
  proximaAcaoEmInicial?: Date | null;
  proximaAcaoDescricaoInicial?: string | null;
  indicadores: Indicadores;
  historico: Historico;
  indicacoesFunil: Indicacoes;
  podeEditar: boolean;
  accent: string;
  cardCls: string;
}) {
  const router = useRouter();
  const [potencial, setPotencial] = useState(potencialRecorrenciaInicial ?? 0);
  const [salvandoPotencial, setSalvandoPotencial] = useState(false);
  const [proximaAcaoEm, setProximaAcaoEm] = useState(proximaAcaoEmInicial ?? null);
  const [proximaAcaoDescricao, setProximaAcaoDescricao] = useState(proximaAcaoDescricaoInicial ?? null);
  const [novaData, setNovaData] = useState("");
  const [novaDesc, setNovaDesc] = useState("");
  const [salvandoProximaAcao, setSalvandoProximaAcao] = useState(false);

  async function salvarPotencial(novoValor: number) {
    setSalvandoPotencial(true);
    setPotencial(novoValor);
    const r = await AtualizarPotencialRecorrenciaParceiro({ parceiroId, potencialRecorrencia: novoValor });
    setSalvandoPotencial(false);
    if (!r.success) { toast.error(r.error); return; }
    toast.success("Potencial de recorrência atualizado");
    router.refresh();
  }

  async function salvarProximaAcao() {
    if (!novaData || !novaDesc.trim()) { toast.error("Preencha data e descrição"); return; }
    setSalvandoProximaAcao(true);
    const r = await RegistrarProximaAcaoParceiro({ parceiroId, proximaAcaoEm: novaData, proximaAcaoDescricao: novaDesc.trim() });
    setSalvandoProximaAcao(false);
    if (!r.success) { toast.error(r.error); return; }
    setProximaAcaoEm(new Date(novaData));
    setProximaAcaoDescricao(novaDesc.trim());
    setNovaData("");
    setNovaDesc("");
    toast.success("Próxima ação registrada");
  }

  const ind = indicadores.success ? indicadores.indicadores : null;

  return (
    <>
      {/* Relacionamento */}
      <div className={cardCls}>
        <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: `rgb(${accent})` }}>
          <GitBranch size={13} /> Relacionamento
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${ESTAGIO_COR[estagioDesenvolvimento] ?? ESTAGIO_COR.NOVO}`}>
            {ESTAGIO_LABEL[estagioDesenvolvimento] ?? estagioDesenvolvimento}
          </span>
          {responsavelNome && <span className="text-[11px] text-slate-500">Responsável: {responsavelNome}</span>}
          {segmento && <span className="text-[11px] text-slate-500">· {segmento}</span>}
          {origem && <span className="text-[11px] text-slate-500">· {origem}</span>}
        </div>

        <div>
          <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold mb-1.5">Potencial de recorrência</p>
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                disabled={!podeEditar || salvandoPotencial}
                onClick={() => void salvarPotencial(n)}
                title={`${n}/5`}
                className="disabled:cursor-not-allowed"
              >
                <Star size={18} className={n <= potencial ? "fill-amber-400 text-amber-400" : "text-slate-700"} />
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold mb-1.5">Próxima ação</p>
          {proximaAcaoEm && proximaAcaoDescricao && (
            <p className="text-[11px] text-slate-300 mb-1.5">
              {new Date(proximaAcaoEm).toLocaleDateString("pt-BR")} — {proximaAcaoDescricao}
            </p>
          )}
          {podeEditar && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={novaData}
                onChange={(e) => setNovaData(e.target.value)}
                className="h-9 rounded-lg px-2.5 text-[11px] outline-none text-slate-200"
                style={{ background: "rgba(15,23,42,0.6)", border: `1px solid rgba(${accent},0.2)` }}
              />
              <input
                value={novaDesc}
                onChange={(e) => setNovaDesc(e.target.value)}
                placeholder="Ex: Ligação, WhatsApp..."
                className="flex-1 h-9 rounded-lg px-2.5 text-[11px] outline-none text-slate-200"
                style={{ background: "rgba(15,23,42,0.6)", border: `1px solid rgba(${accent},0.2)` }}
              />
              <button
                onClick={() => void salvarProximaAcao()}
                disabled={salvandoProximaAcao}
                className="h-9 px-3 rounded-lg text-[10px] font-bold text-black shrink-0 disabled:opacity-50"
                style={{ background: `rgba(${accent},1)` }}
              >
                Registrar
              </button>
            </div>
          )}
        </div>

        {ind && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            <IndicadorMini icon={<Target size={13} />} label="Indicações" valor={ind.totalIndicacoes} />
            <IndicadorMini icon={<Users2 size={13} />} label="Oportunidades" valor={ind.totalOportunidades} />
            <IndicadorMini icon={<TrendingUp size={13} />} label="Contratos" valor={ind.contratosOriginados} />
            <IndicadorMini icon={<Percent size={13} />} label="Conversão" valor={`${(ind.conversao * 100).toFixed(0)}%`} />
            <IndicadorMini icon={<DollarSign size={13} />} label="Receita" valor={fmtBRL(ind.receitaOriginada)} span2 />
            <IndicadorMini icon={<History size={13} />} label="Dias sem indicação" valor={ind.diasSemIndicacao ?? "Nunca indicou"} span2 />
          </div>
        )}
      </div>

      {/* Acompanhamento comercial das indicações (funil BPM — distinto da seção de comissões acima) */}
      {indicacoesFunil.length > 0 && (
        <div className={cardCls}>
          <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: `rgb(${accent})` }}>
            Acompanhamento Comercial das Indicações
          </p>
          <div className="space-y-2">
            {indicacoesFunil.map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.03)" }}>
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-slate-200 truncate">{i.empresa.razaoSocial}</p>
                  <p className="text-[10px] text-slate-500">{new Date(i.dataIndicacao).toLocaleDateString("pt-BR")}</p>
                </div>
                <div className="text-right shrink-0">
                  {i.oportunidade ? (
                    <span className="text-[10px] font-bold text-slate-300">{i.oportunidade.pipelineNome} · {i.oportunidade.etapaNome}</span>
                  ) : (
                    <span className="text-[10px] text-amber-400">Não direcionada ao closer</span>
                  )}
                  {i.contrato?.dataContratacao && (
                    <p className="text-[10px] text-emerald-400">Contratado{i.contrato.valorContrato ? ` · ${fmtBRL(i.contrato.valorContrato)}` : ""}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Histórico */}
      {historico.length > 0 && (
        <div className={cardCls}>
          <p className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5" style={{ color: `rgb(${accent})` }}>
            <History size={13} /> Histórico de Relacionamento
          </p>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {historico.map((h) => (
              <div key={h.id} className="text-[11px] border-l-2 pl-3" style={{ borderColor: `rgba(${accent},0.4)` }}>
                <p className="text-slate-300">{h.acao.replaceAll("_", " ")}{h.automacaoOrigem ? ` (automação: ${h.automacaoOrigem})` : h.usuario ? ` — ${h.usuario.nome}` : ""}</p>
                <p className="text-slate-600 text-[10px]">{new Date(h.createdAt).toLocaleString("pt-BR")}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function IndicadorMini({ icon, label, valor, span2 }: { icon: React.ReactNode; label: string; valor: string | number; span2?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2 ${span2 ? "col-span-2" : ""}`} style={{ background: "rgba(255,255,255,0.03)" }}>
      <div className="flex items-center gap-1.5 text-slate-500 mb-1">{icon}<span className="text-[9px] uppercase tracking-widest font-bold">{label}</span></div>
      <p className="text-[13px] font-black text-slate-200">{valor}</p>
    </div>
  );
}
