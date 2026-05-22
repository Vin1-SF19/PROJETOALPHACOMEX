"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    Search, Database, BarChart3, RefreshCw,
    Fingerprint, ArrowRight, History, X, Building2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { upsertConsulta, buscarHistorico } from "@/actions/PreAnalise";
import BlocoResultados from "./BlocoResultados";
import ProgressCard from "./ProgressCard";


type StatusConsulta = "idle" | "loading" | "success" | "error";
type Fase = "input" | "loading" | "results";

interface EtapasState {
    rfb: { status: StatusConsulta; dados: any };
    radar: { status: StatusConsulta; dados: any; consultadoEm: string | null };
    empresaqui: { status: StatusConsulta; dados: any };
}

interface SessionUser {
    nome?: string | null;
    role?: string | null;
}

interface Props {
    sessionUser: SessionUser;
    visual: any;
}

export default function SistemaPreAnaliseClient({ sessionUser, visual }: Props) {
    const [cnpj, setCnpj] = useState("");
    const [fase, setFase] = useState<Fase>("input");
    const [historico, setHistorico] = useState<any[]>([]);
    const [modalHistorico, setModalHistorico] = useState(false);
    const [loadingHistorico, setLoadingHistorico] = useState(false);
    const [cnpjHistorico, setCnpjHistorico] = useState<any | null>(null);
    const [confirmarNovaConsulta, setConfirmarNovaConsulta] = useState(false);
    const savedRef = useRef(false);

    const [etapas, setEtapas] = useState<EtapasState>({
        rfb: { status: "idle", dados: null },
        radar: { status: "idle", dados: null, consultadoEm: null },
        empresaqui: { status: "idle", dados: null }
    });

    useEffect(() => {
        buscarHistorico().then(res => {
            if (res.data) setHistorico(res.data);
        });
    }, []);

    useEffect(() => {
        if (!modalHistorico) return;
        setLoadingHistorico(true);
        buscarHistorico().then(res => {
            if (res.data) setHistorico(res.data);
            setLoadingHistorico(false);
        });
    }, [modalHistorico]);

    // Auto-save e auto-navega quando ambas as APIs terminam
    useEffect(() => {
        if (fase !== "loading") return;

        const rfbDone = etapas.rfb.status === "success" || etapas.rfb.status === "error";
        const eaDone = etapas.empresaqui.status === "success" || etapas.empresaqui.status === "error";

        if (!rfbDone || !eaDone) return;
        if (savedRef.current) return;

        savedRef.current = true;

        const shouldNavigate = etapas.rfb.status === "success" && etapas.empresaqui.status === "success";

        upsertConsulta({
            rfb: { dados: etapas.rfb.dados },
            empresaqui: { dados: etapas.empresaqui.dados },
            radar: { dados: etapas.radar.dados },
            extra: {}
        }).then(() => {
            if (shouldNavigate) setFase("results");
        }).catch(err => {
            console.error(err);
            if (shouldNavigate) setFase("results");
        });
    }, [etapas.rfb.status, etapas.empresaqui.status, fase]);

    const executarConsulta = async (cleanCnpj: string) => {
        savedRef.current = false;
        setFase("loading");
        setEtapas({
            rfb: { status: "loading", dados: null },
            empresaqui: { status: "loading", dados: null },
            radar: { status: "idle", dados: null, consultadoEm: null }
        });

        await Promise.allSettled([
            (async () => {
                try {
                    const res = await fetch(`/api/ReceitaFederal?cnpj=${cleanCnpj}`);
                    const data = await res.json();
                    setEtapas(prev => ({ ...prev, rfb: { status: data.error ? "error" : "success", dados: data } }));
                } catch {
                    setEtapas(prev => ({ ...prev, rfb: { status: "error", dados: null } }));
                }
            })(),
            (async () => {
                try {
                    const res = await fetch(`/api/RadarFiscal?cnpj=${cleanCnpj}`);
                    const data = await res.json();
                    setEtapas(prev => ({ ...prev, empresaqui: { status: data.error ? "error" : "success", dados: data } }));
                } catch {
                    setEtapas(prev => ({ ...prev, empresaqui: { status: "error", dados: null } }));
                }
            })()
        ]);
    };

    const reconsultarIndividual = async (chave: "rfb" | "empresaqui") => {
        savedRef.current = false;
        setEtapas(prev => ({ ...prev, [chave]: { ...prev[chave], status: "loading" } }));

        const cnpjLimpo = cnpj.replace(/\D/g, "");
        const endpoint = chave === "rfb" ? "ReceitaFederal" : "RadarFiscal";

        try {
            const res = await fetch(`/api/${endpoint}?cnpj=${cnpjLimpo}`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            setEtapas(prev => ({ ...prev, [chave]: { status: data.error ? "error" : "success", dados: data } }));
        } catch {
            setEtapas(prev => ({ ...prev, [chave]: { ...prev[chave], status: "error" } }));
        }
    };

    const handleConsultar = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanCnpj = cnpj.replace(/\D/g, "");
        if (cleanCnpj.length < 14) return;

        const itemNoHistorico = historico.find(h => (h.cnpj || "").replace(/\D/g, "") === cleanCnpj);
        if (itemNoHistorico) {
            setCnpjHistorico(itemNoHistorico);
            return;
        }

        await executarConsulta(cleanCnpj);
    };

    const reabrirConsulta = (dadosSalvos: any) => {
        try {
            const payload = typeof dadosSalvos.dadosBrutos === "string"
                ? JSON.parse(dadosSalvos.dadosBrutos)
                : dadosSalvos.dadosBrutos;

            const radarDados = payload.radar?.dados || null;
            const radarTemDados = radarDados && typeof radarDados === "object" && Object.keys(radarDados).length > 0;

            setEtapas({
                rfb: { status: "success", dados: payload.rfb?.dados || payload.rfb },
                empresaqui: { status: "success", dados: payload.empresaqui?.dados || payload.empresaqui },
                radar: {
                    status: radarTemDados ? "success" : "idle",
                    dados: radarTemDados ? radarDados : null,
                    consultadoEm: payload.radar?.consultadoEm ?? null
                }
            });

            savedRef.current = true;
            setFase("results");
            setModalHistorico(false);
        } catch {
            toast.error("Erro ao reabrir: dados corrompidos.");
        }
    };

    const novaConsulta = useCallback(() => {
        savedRef.current = false;
        setFase("input");
        setCnpj("");
        setEtapas({
            rfb: { status: "idle", dados: null },
            radar: { status: "idle", dados: null, consultadoEm: null },
            empresaqui: { status: "idle", dados: null }
        });
    }, []);

    const ambosFinalizados =
        (etapas.rfb.status === "success" || etapas.rfb.status === "error") &&
        (etapas.empresaqui.status === "success" || etapas.empresaqui.status === "error");
    const temErro = etapas.rfb.status === "error" || etapas.empresaqui.status === "error";

    return (
        <div className="min-h-screen bg-[#020617] text-white selection:bg-white/10">

            <header className="fixed top-0 left-0 w-full h-20 border-b border-white/5 bg-slate-950/50 backdrop-blur-2xl z-40 flex items-center px-8">
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${visual.bg} ${visual.shadow} animate-pulse-slow`}>
                                <Fingerprint size={22} className="text-white" />
                            </div>
                            <h1 className="text-xl font-black italic tracking-tighter text-white">
                                Sistema de pré <span className={visual.text}>Analise</span>
                            </h1>
                        </div>

                        <div className="h-8 w-[1px] bg-white/10 hidden md:block" />

                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm">
                            <div className={`w-2 h-2 rounded-full ${visual.bg} animate-pulse`} />
                            <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">USUARIO:</span>
                            <span className="text-sm font-medium text-zinc-200 tracking-tight">
                                {sessionUser.nome || "SEM LOGIN!!"}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setModalHistorico(true)}
                            className="cursor-pointer flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all text-slate-300"
                        >
                            <History size={14} className={visual.text} /> Historico
                        </button>

                        {fase === "results" && (
                            <button
                                onClick={() => setConfirmarNovaConsulta(true)}
                                className="cursor-pointer flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all text-white"
                            >
                                <RefreshCw size={14} className={visual.text} /> Nova Consulta
                            </button>
                        )}
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-6 pt-32 pb-20">
                <AnimatePresence mode="wait">

                    {/* TELA 1: INPUT */}
                    {fase === "input" && (
                        <motion.div
                            key="input"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="max-w-3xl mx-auto text-center mt-20"
                        >
                            <h2 className="text-5xl md:text-6xl font-black italic uppercase tracking-tighter mb-12">
                                Realizar <span className={visual.text}>Analise</span>
                            </h2>
                            <form onSubmit={handleConsultar} className="w-full max-w-2xl mx-auto">
                                <input
                                    type="text"
                                    value={cnpj}
                                    onChange={(e) => setCnpj(e.target.value)}
                                    placeholder="00.000.000/0000-00"
                                    className="w-full bg-white/5 border border-white/10 rounded-[2.5rem] px-10 py-8 text-2xl font-mono text-center focus:border-white/20 transition-all placeholder:text-slate-800 uppercase tracking-[0.2em]"
                                />
                                <button
                                    type="submit"
                                    disabled={cnpj.replace(/\D/g, "").length < 14}
                                    className={`cursor-pointer mt-10 px-16 py-5 rounded-[1.5rem] ${visual.bg} ${visual.shadow} text-white font-black uppercase tracking-[0.3em] text-[12px] flex items-center gap-4 mx-auto hover:scale-105 active:scale-95 transition-all disabled:opacity-30`}
                                >
                                    <Search size={18} />
                                    PESQUISAR
                                </button>
                            </form>
                        </motion.div>
                    )}

                    {/* TELA 2: LOADING */}
                    {fase === "loading" && (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center gap-10 mt-10"
                        >
                            <div className="text-center space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Consultando</p>
                                <p className="text-2xl font-black font-mono text-white tracking-[0.15em]">{cnpj || "—"}</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl mx-auto">
                                <ProgressCard
                                    label="Cartão CNPJ RFB"
                                    status={etapas.rfb.status}
                                    icon={<Database size={26} />}
                                    onRetry={() => reconsultarIndividual("rfb")}
                                />
                                <ProgressCard
                                    label="Regime Tributário"
                                    status={etapas.empresaqui.status}
                                    icon={<BarChart3 size={26} />}
                                    onRetry={() => reconsultarIndividual("empresaqui")}
                                />
                            </div>

                            <AnimatePresence>
                                {ambosFinalizados && temErro && (
                                    <motion.button
                                        key="ver-parcial"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        onClick={() => setFase("results")}
                                        className="cursor-pointer group flex items-center gap-4 px-12 py-5 rounded-[1.5rem] bg-white text-black font-black uppercase tracking-[0.3em] text-sm hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(255,255,255,0.15)]"
                                    >
                                        Ver Resultados Parciais
                                        <ArrowRight size={20} className="group-hover:translate-x-2 transition-transform" />
                                    </motion.button>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}

                    {/* TELA 3: RESULTADOS */}
                    {fase === "results" && (
                        <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <BlocoResultados
                                key={etapas.rfb?.dados?.cnpj || "resultado"}
                                dados={etapas}
                                visual={visual}
                                userName={sessionUser.nome || "Não Identificado"}
                            />
                        </motion.div>
                    )}

                </AnimatePresence>
            </main>

            {/* MODAL HISTÓRICO */}
            {modalHistorico && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-[#0A0A0A] border border-white/10 w-full max-w-4xl max-h-[80vh] overflow-hidden rounded-[2.5rem] shadow-2xl flex flex-col">
                        <div className="p-8 border-b border-white/5 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">
                                    Histórico de <span className="text-orange-500">Consultas</span>
                                </h2>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                    Últimas 20 empresas analisadas
                                </p>
                            </div>
                            <button onClick={() => setModalHistorico(false)} className="cursor-pointer p-3 hover:bg-white/5 rounded-full text-slate-500 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            {loadingHistorico ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-orange-500 animate-spin" />
                                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Carregando histórico...</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {historico.length === 0 ? (
                                        <p className="text-center text-slate-600 font-bold uppercase text-xs">Nenhuma consulta encontrada</p>
                                    ) : (
                                        historico.map((item: any) => (
                                            <div key={item.id} className="group bg-white/5 border border-white/5 hover:border-white/10 p-6 rounded-[1.5rem] transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                                <div className="flex items-center gap-5">
                                                    <div className="p-4 rounded-2xl bg-slate-900 border border-white/5 text-slate-400 group-hover:text-white group-hover:border-orange-500/30 transition-all">
                                                        <Building2 size={20} />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-black text-white uppercase italic tracking-tight">{item.razaoSocial}</h3>
                                                        <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-slate-500">
                                                            <span>{item.cnpj}</span>
                                                            <span className="w-1 h-1 rounded-full bg-slate-700" />
                                                            <span>{new Date(item.updatedAt).toLocaleString("pt-BR")}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 w-full md:w-auto">
                                                    <div className={`px-4 py-2 rounded-lg border text-[10px] font-black uppercase ${
                                                        item.situacao === "ATIVA"
                                                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                                            : "bg-red-500/10 border-red-500/20 text-red-400"
                                                    }`}>
                                                        {item.situacao || "N/A"}
                                                    </div>
                                                    <button
                                                        onClick={() => reabrirConsulta(item)}
                                                        className="cursor-pointer flex-1 md:flex-none px-6 py-2.5 rounded-xl bg-white text-black text-[10px] font-black uppercase hover:bg-slate-200 transition-all"
                                                    >
                                                        Reabrir
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-white/5 bg-white/[0.02] flex justify-center">
                            <button className="cursor-pointer text-[10px] font-black text-slate-600 uppercase tracking-widest hover:text-rose-500 transition-all">
                                Limpar todo o histórico
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CONFIRMAR NOVA CONSULTA */}
            {confirmarNovaConsulta && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#0D0D0D] border border-white/10 w-full max-w-sm rounded-[2rem] shadow-2xl p-8 text-center">
                        <div className={`mx-auto w-16 h-16 rounded-full ${visual.bg} flex items-center justify-center mb-6 shadow-lg`}>
                            <RefreshCw size={28} className="text-white" />
                        </div>
                        <h3 className="text-xl font-black italic uppercase tracking-tighter text-white mb-2">Nova Consulta?</h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-tight leading-relaxed mb-8">
                            Os dados da análise atual serão perdidos. Deseja continuar?
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => { setConfirmarNovaConsulta(false); novaConsulta(); }}
                                className="cursor-pointer w-full py-4 rounded-xl bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-200 transition-all"
                            >
                                Sim, Iniciar Nova
                            </button>
                            <button
                                onClick={() => setConfirmarNovaConsulta(false)}
                                className="cursor-pointer w-full py-4 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL CNPJ JÁ CONSULTADO */}
            {cnpjHistorico && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#0D0D0D] border border-white/10 w-full max-w-sm rounded-[2rem] shadow-2xl p-8 text-center">
                        <div className="mx-auto w-16 h-16 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mb-6">
                            <History size={28} className="text-orange-400" />
                        </div>
                        <h3 className="text-xl font-black italic uppercase tracking-tighter text-white mb-1">CNPJ já consultado</h3>
                        <p className="text-sm font-bold text-white mt-3 mb-1 truncate px-2">{cnpjHistorico.razaoSocial}</p>
                        <p className="text-[10px] font-mono text-slate-500 mb-1">{cnpjHistorico.cnpj}</p>
                        <p className="text-[10px] text-slate-600 mb-8">
                            Consultado em {new Date(cnpjHistorico.updatedAt).toLocaleString("pt-BR")}
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => { reabrirConsulta(cnpjHistorico); setCnpjHistorico(null); }}
                                className="cursor-pointer w-full py-4 rounded-xl bg-orange-500 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-orange-400 transition-all flex items-center justify-center gap-2"
                            >
                                <History size={14} /> Puxar do Histórico (Grátis)
                            </button>
                            <button
                                onClick={() => { const clean = cnpj.replace(/\D/g, ""); setCnpjHistorico(null); executarConsulta(clean); }}
                                className="cursor-pointer w-full py-4 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all"
                            >
                                Nova Consulta (consome saldo)
                            </button>
                            <button
                                onClick={() => setCnpjHistorico(null)}
                                className="cursor-pointer text-[10px] text-slate-600 uppercase tracking-widest hover:text-slate-400 transition-all pt-1"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
