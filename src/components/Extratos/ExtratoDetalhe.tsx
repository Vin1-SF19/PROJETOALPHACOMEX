"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, PlusCircle, Database, MapPin, Calendar, Loader2,
  ShieldCheck, Upload, TrendingUp, Trash2, AlertCircle, Eye,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BuscarEmpresaPorId } from "@/actions/Extratos";
import { AtualizarAnotacaoBanco, ExcluirBancoVinculado, VincularNovoBanco } from "@/actions/bancos";
import { CriarNovoPeriodo } from "@/actions/periodos";
import { ModalVincularBanco } from "./ModalVincularBanco";
import { ModalNovoPeriodo } from "./ModalNovoPeriodo";
import { ModalUploadExtrato } from "./ModalUploadExtrato";
import { ModalConferencia } from "./ModalConferencia";
import { ModalTransacoesSalvas } from "./ModalTransacoesSalvas";
import { exportarRelatorioExcel, type TransacaoParaExportar } from "./lib/exportar-excel";
import { formatarCnpj } from "./lib/formatters";
import type { BancoCatalogo } from "./lib/bancos-catalogo";
import { getTema } from "@/lib/temas";

interface BancoVinculado {
  id: number;
  bancoId: string;
  nomeBanco: string;
  logo: string;
  descricao: string | null;
  anotacao: string | null;
  transacoes: { id: string; data: Date | null; descricao: string; valor: number }[];
}

interface Periodo {
  id: number;
  mes: string;
  ano: string;
  bancos: BancoVinculado[];
}

interface Empresa {
  id: number;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  municipio: string | null;
  uf: string | null;
  regimeTributario: string | null;
  dataConstituicao: string | null;
  periodos: Periodo[];
}

interface ContextoOCR {
  bancoId: number;
  banco: string;
  mes: string;
}

interface ExtratoDetalheProps {
  extratoId: string;
  temaName?: string;
}

export function ExtratoDetalhe({ extratoId, temaName = "blue" }: ExtratoDetalheProps) {
  const accent = getTema(temaName).accent;
  const router = useRouter();

  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [modalBancoAberto, setModalBancoAberto] = useState(false);
  const [modalPeriodoAberto, setModalPeriodoAberto] = useState(false);
  const [periodoSelecionadoId, setPeriodoSelecionadoId] = useState<number | null>(null);
  const [modalUploadAberto, setModalUploadAberto] = useState(false);
  const [contextoOCR, setContextoOCR] = useState<ContextoOCR | null>(null);
  const [periodosAbertos, setPeriodosAbertos] = useState<number[]>([]);
  const [bancoParaExcluir, setBancoParaExcluir] = useState<BancoVinculado | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [linhasPreview, setLinhasPreview] = useState<TransacaoParaExportar[]>([]);
  const [modalVisualizarSalvos, setModalVisualizarSalvos] = useState(false);
  const [bancoSelecionadoId, setBancoSelecionadoId] = useState<number | null>(null);

  const carregarDados = useCallback(async () => {
    if (!extratoId) return;
    try {
      const res = await BuscarEmpresaPorId(extratoId);
      if (res.success) setEmpresa(res.data as unknown as Empresa);
      else router.push("/PainelAlpha/ExtratosBancarios");
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extratoId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregarDados();
  }, [carregarDados]);

  const togglePeriodo = (id: number) => {
    setPeriodosAbertos((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const handleCriarPeriodo = async (dados: { mes: string; ano: string }) => {
    const res = await CriarNovoPeriodo(dados.mes, dados.ano, Number(extratoId));
    if (res.success) {
      toast.success("Período criado");
      setModalPeriodoAberto(false);
      await carregarDados();
    } else {
      toast.error(res.error || "Erro ao criar período");
    }
  };

  const handleSalvarBanco = async (dados: { bancoSel: BancoCatalogo; descricao: string }) => {
    if (!periodoSelecionadoId) return;
    const res = await VincularNovoBanco({
      bancoId: dados.bancoSel.id,
      nome: dados.bancoSel.nome,
      logo: dados.bancoSel.logo,
      descricao: dados.descricao,
      periodoId: periodoSelecionadoId,
    });
    if (res.success) {
      toast.success("Banco vinculado!");
      setModalBancoAberto(false);
      await carregarDados();
    } else {
      toast.error(res.error || "Erro ao vincular banco");
    }
  };

  const handleExcluirBanco = async () => {
    if (!bancoParaExcluir) return;
    const res = await ExcluirBancoVinculado(bancoParaExcluir.id);
    if (res.success) {
      toast.success("Banco removido");
      setBancoParaExcluir(null);
      await carregarDados();
    } else {
      toast.error(res.error || "Erro ao excluir banco");
    }
  };

  const abrirPreviewGeral = () => {
    if (!empresa) return;
    const todasTransacoes: TransacaoParaExportar[] = empresa.periodos.flatMap((p) =>
      p.bancos.flatMap((b) =>
        b.transacoes.map((t) => ({
          mesReferencia: `${p.mes}/${p.ano}`,
          nomeBanco: b.nomeBanco,
          data: t.data ? new Date(t.data).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "DATA INCERTA",
          descricao: t.descricao,
          valor: t.valor,
        })),
      ),
    );
    setLinhasPreview(todasTransacoes);
    setShowPreview(true);
  };

  if (carregando || !empresa) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center h-screen">
        <Loader2 className="w-12 h-12 animate-spin" style={{ color: `rgba(${accent},1)` }} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617]">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="text-slate-200 p-4 md:p-8 font-sans"
      >
        <div className="max-w-[1400px] mx-auto space-y-10">
          <header className="relative overflow-hidden bg-slate-950/70 border border-white/5 rounded-[3rem] p-8 md:p-12 shadow-2xl backdrop-blur-2xl">
            <button
              onClick={() => router.back()}
              onMouseEnter={(e) => { e.currentTarget.style.color = `rgba(${accent},1)`; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = ""; }}
              className="cursor-pointer group flex items-center gap-2 text-slate-500 transition-all mb-10 uppercase text-[10px] font-black tracking-widest"
            >
              <ArrowLeft size={14} aria-hidden="true" className="group-hover:-translate-x-1 transition-transform" />
              Voltar para listagem
            </button>

            <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-10">
              <motion.div layoutId={`empresa-card-${empresa.id}`} className="space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <div
                    className="px-4 py-1.5 rounded-xl text-[13px] font-black uppercase tracking-tighter border flex items-center gap-2"
                    style={{ background: `rgba(${accent},0.1)`, color: `rgba(${accent},1)`, borderColor: `rgba(${accent},0.2)` }}
                  >
                    <ShieldCheck size={12} aria-hidden="true" />
                    {formatarCnpj(empresa.cnpj)}
                  </div>
                  <div className="px-4 py-1.5 bg-slate-800/80 text-slate-400 rounded-xl text-[13px] font-black uppercase tracking-tighter border border-white/5">
                    {empresa.regimeTributario}
                  </div>
                </div>
                <h1 className="text-5xl md:text-6xl font-black text-white uppercase italic tracking-tighter leading-none">{empresa.razaoSocial}</h1>
                {empresa.nomeFantasia && <h2 className="md:text-2xl font-bold text-slate-600 italic tracking-tighter leading-none">{empresa.nomeFantasia}</h2>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-800/50 rounded-2xl border border-white/5"><MapPin size={18} aria-hidden="true" style={{ color: `rgba(${accent},1)` }} /></div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Localização</span>
                      <span className="text-sm font-bold text-slate-200 uppercase tracking-tighter">{empresa.municipio} / {empresa.uf}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-800/50 rounded-2xl border border-white/5"><Calendar size={18} aria-hidden="true" style={{ color: `rgba(${accent},1)` }} /></div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Constituição</span>
                      <span className="text-sm font-bold text-slate-200 uppercase tracking-tighter">{empresa.dataConstituicao}</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              <button
                onClick={abrirPreviewGeral}
                className="cursor-pointer group relative flex items-center justify-center px-6 py-3 font-bold text-white transition-all duration-300 bg-slate-800 rounded-xl hover:bg-slate-900 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
              >
                <Eye size={20} aria-hidden="true" className="mr-2 text-blue-400 group-hover:scale-110 transition-transform" />
                <span className="tracking-wide">Visualizar e Exportar Relatório</span>
              </button>
            </div>
          </header>

          <button
            onClick={() => setModalPeriodoAberto(true)}
            style={{ background: `rgba(${accent},1)`, boxShadow: `0 25px 50px -12px rgba(${accent},0.2)` }}
            className="w-full group relative overflow-hidden p-10 rounded-[3rem] transition-all duration-500 active:scale-[0.99] hover:brightness-110"
          >
            <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:rotate-12 transition-transform duration-700">
              <TrendingUp size={120} aria-hidden="true" />
            </div>
            <div className="cursor-pointer relative z-10 flex items-center justify-between">
              <div className="text-left space-y-1">
                <h3 className="text-4xl font-black text-white uppercase italic tracking-tighter group-hover:translate-x-2 transition-transform">+ Adicionar Mês de Análise</h3>
                <p className="text-[11px] text-white uppercase font-bold tracking-[0.3em] opacity-70 italic">Clique para iniciar um novo ciclo cronológico de extratos</p>
              </div>
              <div className="h-16 w-16 rounded-3xl bg-white/20 flex items-center justify-center text-white backdrop-blur-md border border-white/30">
                <PlusCircle size={32} aria-hidden="true" />
              </div>
            </div>
          </button>

          <div className="space-y-6">
            {empresa.periodos.map((periodo) => {
              const estaAberto = periodosAbertos.includes(periodo.id);
              return (
                <div key={periodo.id} className="flex flex-col">
                  <div
                    onClick={() => togglePeriodo(periodo.id)}
                    style={estaAberto ? { borderColor: `rgba(${accent},0.4)` } : undefined}
                    className={`cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-6 px-10 py-8 bg-slate-900/60 border ${estaAberto ? "" : "border-white/5"} rounded-[3rem] backdrop-blur-xl relative overflow-hidden transition-all duration-500 group`}
                  >
                    <div
                      className="absolute top-0 left-0 h-full w-1 transition-all duration-500"
                      style={estaAberto ? { background: `rgba(${accent},1)`, boxShadow: `0 0 20px rgba(${accent},0.5)` } : undefined}
                    />
                    <div className="flex items-center gap-6">
                      <div
                        className="h-16 w-16 rounded-3xl flex items-center justify-center transition-all duration-500"
                        style={estaAberto ? { background: `rgba(${accent},1)`, color: "white" } : { background: `rgba(${accent},0.1)`, color: `rgba(${accent},1)` }}
                      >
                        <Calendar size={32} aria-hidden="true" />
                      </div>
                      <div>
                        <h3 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-none">
                          {periodo.mes} <span style={{ color: `rgba(${accent},1)` }}>/ {periodo.ano}</span>
                        </h3>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1 italic">
                          {periodo.bancos.length} Instituições Vinculadas
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPeriodoSelecionadoId(periodo.id);
                          setModalBancoAberto(true);
                        }}
                        className="px-8 py-4 bg-white/5 hover:bg-white/10 text-[10px] font-black text-white uppercase tracking-[0.2em] rounded-2xl border border-white/10 transition-all active:scale-95 flex items-center gap-2"
                      >
                        <Database size={16} aria-hidden="true" style={{ color: `rgba(${accent},1)` }} /> Vincular Instituição
                      </button>
                      <div className={`transition-transform duration-500 text-slate-500 ${estaAberto ? "rotate-180" : ""}`}>
                        <TrendingUp size={24} aria-hidden="true" className="opacity-20" />
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {estaAberto && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="grid grid-cols-1 gap-4 pl-12 border-l-2 ml-16 mt-6 pb-10" style={{ borderColor: `rgba(${accent},0.2)` }}>
                          {periodo.bancos.length > 0 ? (
                            periodo.bancos.map((banco) => (
                              <motion.div
                                key={banco.id}
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = `rgba(${accent},0.3)`; }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = ""; }}
                                className="group bg-slate-900/30 border border-white/5 rounded-[2.5rem] p-6 hover:bg-slate-900/50 transition-all flex flex-col xl:flex-row items-center justify-between gap-6"
                              >
                                <div className="flex items-center gap-6 flex-1 w-full">
                                  <div
                                    className="relative h-20 w-20 rounded-[1.5rem] bg-white/5 border border-white/10 p-4 flex items-center justify-center shadow-2xl transition-colors"
                                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = `rgba(${accent},0.5)`; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = ""; }}
                                  >
                                    <Image src={banco.logo} alt={banco.nomeBanco} fill sizes="80px" className="object-contain p-4 grayscale group-hover:grayscale-0 transition-all" unoptimized />
                                  </div>
                                  <div className="space-y-1">
                                    <h4 className="text-3xl font-black text-white uppercase italic tracking-tighter leading-none">{banco.nomeBanco}</h4>
                                    <div className="flex items-center gap-2">
                                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                      <p className="text-[14px] text-slate-500 font-bold uppercase tracking-widest">{banco.descricao || "Conta Principal"}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={() => {
                                        setContextoOCR({ bancoId: banco.id, banco: banco.nomeBanco, mes: `${periodo.mes}/${periodo.ano}` });
                                        setModalUploadAberto(true);
                                      }}
                                      aria-label={`Fazer upload de extrato para ${banco.nomeBanco}`}
                                      style={{ background: `rgba(${accent},0.1)`, color: `rgba(${accent},1)` }}
                                      onMouseEnter={(e) => { e.currentTarget.style.background = `rgba(${accent},1)`; e.currentTarget.style.color = "white"; }}
                                      onMouseLeave={(e) => { e.currentTarget.style.background = `rgba(${accent},0.1)`; e.currentTarget.style.color = `rgba(${accent},1)`; }}
                                      className="cursor-pointer h-14 w-14 flex items-center justify-center rounded-2xl transition-all shadow-lg"
                                    >
                                      <Upload size={20} aria-hidden="true" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setBancoSelecionadoId(banco.id);
                                        setModalVisualizarSalvos(true);
                                      }}
                                      className="group flex items-center gap-2 p-2.5 bg-emerald-500/5 hover:bg-emerald-500/20 border border-emerald-500/10 hover:border-emerald-500/40 rounded-xl transition-all duration-300"
                                      title="Ver dados salvos neste banco"
                                    >
                                      <Database size={18} aria-hidden="true" className="text-emerald-400 group-hover:scale-110 transition-transform" />
                                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Dados Salvos</span>
                                    </button>
                                    <button
                                      onClick={() => setBancoParaExcluir(banco)}
                                      aria-label={`Excluir instituição ${banco.nomeBanco}`}
                                      className="cursor-pointer h-14 w-14 flex items-center justify-center bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-2xl transition-all border border-rose-500/20 group/delete"
                                    >
                                      <Trash2 size={20} aria-hidden="true" className="group-hover/delete:scale-110 transition-transform" />
                                    </button>
                                    <div className="flex-1 xl:flex-none px-6 py-4 bg-black/40 rounded-2xl border border-white/5 min-w-[280px] lg:min-w-[400px]">
                                      <label htmlFor={`anotacao-${banco.id}`} className="text-[9px] font-black uppercase tracking-widest block mb-1" style={{ color: `rgba(${accent},1)` }}>Anotação Interna</label>
                                      <input
                                        id={`anotacao-${banco.id}`}
                                        type="text"
                                        defaultValue={banco.anotacao || ""}
                                        onBlur={async (e) => {
                                          if (e.target.value !== banco.anotacao) {
                                            const res = await AtualizarAnotacaoBanco(banco.id, e.target.value);
                                            if (res.success) toast.success("Nota salva");
                                          }
                                        }}
                                        placeholder="Clique para adicionar uma nota..."
                                        className="bg-transparent border-none p-0 text-[11px] font-bold text-slate-300 focus:ring-0 w-full uppercase outline-none"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            ))
                          ) : (
                            <div className="py-10 px-10 border-2 border-dashed border-white/5 rounded-[3rem] text-left">
                              <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em] italic leading-relaxed">Nenhuma conta vinculada.</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      <ModalVincularBanco isOpen={modalBancoAberto} onClose={() => setModalBancoAberto(false)} onSave={handleSalvarBanco} />
      <ModalNovoPeriodo isOpen={modalPeriodoAberto} onClose={() => setModalPeriodoAberto(false)} onSave={handleCriarPeriodo} />
      <ModalUploadExtrato
        isOpen={modalUploadAberto}
        onClose={() => setModalUploadAberto(false)}
        dadosContexto={contextoOCR}
        onSucesso={() => {
          setModalUploadAberto(false);
          void carregarDados();
        }}
      />

      <AlertDialog open={!!bancoParaExcluir} onOpenChange={(open) => !open && setBancoParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="text-rose-500" size={20} aria-hidden="true" />
              Excluir Instituição?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Isso apagará todos os dados vinculados ao banco <strong>{bancoParaExcluir?.nomeBanco}</strong>. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluirBanco} className="bg-rose-600 hover:bg-rose-500 text-white">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AnimatePresence>
        {showPreview && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4" style={{ perspective: 1200 }}>
            <ModalConferencia
              empresa={empresa}
              linhas={linhasPreview}
              onClose={() => setShowPreview(false)}
              onExport={(dadosFiltrados) => {
                exportarRelatorioExcel(dadosFiltrados, empresa.razaoSocial, empresa.cnpj);
                setShowPreview(false);
              }}
            />
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalVisualizarSalvos && bancoSelecionadoId && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-sm p-6" style={{ perspective: 1200 }}>
            <ModalTransacoesSalvas bancoId={bancoSelecionadoId} onClose={() => setModalVisualizarSalvos(false)} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
