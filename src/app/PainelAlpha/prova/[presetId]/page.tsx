'use client';

import React, { useState, useEffect, use, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle2,
    ArrowRight,
    XCircle,
    Loader2,
    Trophy,
    Target,
    Zap,
    RefreshCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { getPresetCompletoAction, salvarResultadoProva } from '@/actions/questoes';
import { useSession } from 'next-auth/react';

export default function PaginaProva({ params }: { params: Promise<{ presetId: string }> }) {
    const { data: session, status: sessionStatus } = useSession();
    const userId = Number(session?.user?.id);
    const [loading, setLoading] = useState(true);
    const [questoesFiltradas, setQuestoesFiltradas] = useState<any[]>([]);
    const [indiceAtual, setIndiceAtual] = useState(0);
    const [respostas, setRespostas] = useState<Record<string, string>>({});
    const [provaFinalizada, setProvaFinalizada] = useState(false);
    const [resultado, setResultado] = useState({ acertos: 0, total: 0, nota: 0 });
    const [enviandoResultado, setEnviandoResultado] = useState(false);

    const resolvedParams = use(params);
    const presetId = resolvedParams.presetId;

    useEffect(() => {
        if (sessionStatus === "loading" || !Number.isInteger(userId) || userId <= 0) return;

        async function carregarProva() {
            try {
                const preset = await getPresetCompletoAction(presetId);

                if (preset && preset.tags) {
                    const poolTotal = preset.tags.flatMap((tag: any) =>
                        (tag.perguntas || [])
                            .filter((p: any) => p.opcoes && p.opcoes !== "[]" && p.opcoes !== "")
                            .map((p: any) => ({ ...p, tagNome: tag.nome }))
                    );

                    const shuffled = [...poolTotal].sort(() => Math.random() - 0.5);

                    const tentativasAnteriores = preset.ResultadoProva?.filter((r: any) => r.userId === userId).length || 0;

                    const offset = (tentativasAnteriores % 2 === 0) ? 0 : 10;

                    let selecionadas = shuffled.slice(offset, offset + 10);

                    if (selecionadas.length === 0) {
                        selecionadas = shuffled.slice(0, 10);
                    }

                    setQuestoesFiltradas(selecionadas);
                }
            } catch (err) {
                toast.error("Erro ao carregar protocolo de avaliação");
            } finally {
                setLoading(false);
            }
        }
        carregarProva();
    }, [presetId, sessionStatus, userId]);

    const handleResposta = (perguntaId: string, letra: string) => {
        if (enviandoResultado) return;
        setRespostas(prev => ({ ...prev, [perguntaId]: letra }));
    };

    const proximaQuestao = () => {
        if (indiceAtual < questoesFiltradas.length - 1) {
            setIndiceAtual(indiceAtual + 1);
        } else {
            finalizarProva();
        }
    };

    const finalizarProva = async () => {
        setEnviandoResultado(true);

        // Comparação automática (Sem descritivas)
        const resultadoCalculado = questoesFiltradas.map(q => {
            const marcado = String(respostas[q.id] || "").trim().toUpperCase();
            const correto = String(q.respostaCorreta || "").trim().toUpperCase();
            return { acertou: marcado === correto };
        });

        const totalAcertos = resultadoCalculado.filter(r => r.acertou).length;
        const totalQuestoes = questoesFiltradas.length;
        const notaFinal = totalQuestoes > 0 ? (totalAcertos / totalQuestoes) * 100 : 0;
        const aprovado = notaFinal >= 70;

        try {
            await salvarResultadoProva({
                userId: userId,
                presetId: presetId,
                nota: notaFinal,
                aprovado: aprovado
            });

            setResultado({ acertos: totalAcertos, total: totalQuestoes, nota: notaFinal });
            setProvaFinalizada(true);

            if (aprovado) toast.success("Acesso Alpha Concedido • Sincronizado");
            else toast.error("Protocolo de Retreinamento Ativado");
        } catch (error) {
            toast.error("Erro de sincronização com o banco");
        } finally {
            setEnviandoResultado(false);
        }
    };

    if (loading) return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-[#050505] gap-6">
            <div className="relative">
                <Loader2 className="animate-spin text-orange-500" size={60} />
                <div className="absolute inset-0 blur-2xl bg-orange-500/20 animate-pulse" />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.5em] text-orange-500/50 animate-pulse">Gerando Grade de Performance</p>
        </div>
    );

    if (provaFinalizada) {
        const aprovado = (resultado.nota >= 70);

        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
                    className="max-w-xl w-full bg-[#0c0c0c] border border-white/5 rounded-[4rem] p-12 text-center relative overflow-hidden shadow-2xl"
                >
                    <div className={`absolute top-0 left-0 w-full h-2 ${aprovado ? 'bg-green-500' : 'bg-red-500'} blur-sm`} />

                    <div className={`mx-auto w-24 h-24 rounded-3xl flex items-center justify-center mb-8 rotate-12 border ${aprovado ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                        {aprovado ? <Trophy size={48} /> : <Zap size={48} />}
                    </div>

                    <h2 className="text-5xl font-black italic uppercase tracking-tighter text-white mb-2">
                        {aprovado ? "Elite Alpha" : "Falha Crítica"}
                    </h2>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-12">Avaliação Finalizada</p>

                    <div className="grid grid-cols-2 gap-6 mb-12">
                        <div className="bg-white/[0.02] p-8 rounded-[2.5rem] border border-white/5 relative">
                            <Target className="absolute top-4 right-4 text-white/5" size={20} />
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Aproveitamento</p>
                            <p className={`text-4xl font-black ${aprovado ? 'text-green-500' : 'text-red-500'}`}>{resultado.nota.toFixed(0)}%</p>
                        </div>
                        <div className="bg-white/[0.02] p-8 rounded-[2.5rem] border border-white/5 relative">
                            <CheckCircle2 className="absolute top-4 right-4 text-white/5" size={20} />
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Acertos</p>
                            <p className="text-4xl font-black text-white">{resultado.acertos}<span className="text-sm text-slate-700">/{resultado.total}</span></p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <button onClick={() => window.location.href = '/PainelAlpha'} className="w-full py-6 bg-white text-black font-black uppercase text-xs rounded-2xl hover:bg-orange-500 hover:text-white transition-all transform hover:scale-[1.02]">
                            Retornar ao Painel
                        </button>
                        {!aprovado && (
                            <button onClick={() => window.location.reload()} className="w-full py-4 text-slate-500 font-black uppercase text-[9px] tracking-widest hover:text-white transition-colors flex items-center justify-center gap-2">
                                <RefreshCcw size={12} /> Reiniciar Protocolo (Questões Rotacionadas)
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        );
    }

    const q = questoesFiltradas[indiceAtual];
    let opcoes = [];
    try {
        opcoes = q?.opcoes ? JSON.parse(q.opcoes) : [];
    } catch (e) {
        opcoes = [];
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 flex flex-col items-center overflow-hidden">
            <div className="max-w-4xl w-full space-y-10 relative">

                {/* HEADER COM STATUS ALPHA */}
                <div className="flex justify-between items-end border-b border-white/5 pb-8">
                    <div className="flex items-center gap-6">
                        <div className="text-6xl font-black italic text-white/5 select-none">
                            #{String(indiceAtual + 1).padStart(2, '0')}
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-orange-500 uppercase tracking-[0.4em] mb-1">Ambiente de Prova</p>
                            <h2 className="text-xl font-black uppercase italic tracking-tighter">{q?.tagNome || "Módulo Geral"}</h2>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <p className="text-[9px] font-black text-slate-600 uppercase">Progresso da Tentativa</p>
                        <div className="flex gap-1">
                            {questoesFiltradas.map((_, i) => (
                                <div
                                    key={i}
                                    className={`h-1 w-6 rounded-full transition-all duration-500 ${i <= indiceAtual ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]' : 'bg-white/10'}`}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={q?.id}
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -30 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="space-y-12"
                    >
                        <h1 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-[0.95] max-w-3xl">
                            {q?.enunciado}
                        </h1>

                        <div className="grid grid-cols-1 gap-4">
                            {opcoes.map((opcao: string, i: number) => {
                                const letra = String.fromCharCode(65 + i);
                                const isSelected = respostas[q?.id] === letra;
                                return (
                                    <button
                                        key={i}
                                        disabled={enviandoResultado}
                                        onClick={() => handleResposta(q.id, letra)}
                                        className={`group flex items-center gap-8 p-8 rounded-[2.5rem] border transition-all duration-500 relative overflow-hidden ${isSelected ? 'bg-white border-white' : 'bg-white/[0.02] border-white/5 hover:border-white/20'
                                            }`}
                                    >
                                        {isSelected && <motion.div layoutId="glow" className="absolute inset-0 bg-orange-500/10 blur-xl" />}

                                        <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center font-black italic text-lg transition-all ${isSelected ? 'bg-black border-black text-white' : 'bg-black border-white/10 text-slate-500 group-hover:text-white'
                                            }`}>
                                            {letra}
                                        </div>
                                        <span className={`text-lg font-bold uppercase tracking-tight text-left ${isSelected ? 'text-black' : 'text-slate-300'}`}>
                                            {opcao}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                </AnimatePresence>

                {/* CONTROLES INFERIORES */}
                <div className="flex justify-between items-center pt-10 border-t border-white/5">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic">Terminal Alpha Ativo</span>
                    </div>

                    <button
                        onClick={proximaQuestao}
                        disabled={!respostas[q?.id] || enviandoResultado}
                        className={`group px-16 py-6 rounded-[2rem] font-black uppercase text-xs tracking-[0.2em] flex items-center gap-4 transition-all ${respostas[q?.id] && !enviandoResultado
                            ? 'bg-orange-500 text-black hover:scale-105 shadow-[0_20px_40px_-15px_rgba(249,115,22,0.4)]'
                            : 'bg-white/5 text-slate-700 cursor-not-allowed'
                            }`}
                    >
                        {enviandoResultado ? (
                            <Loader2 className="animate-spin" size={18} />
                        ) : (
                            <>
                                {indiceAtual === questoesFiltradas.length - 1 ? 'Finalizar Exame' : 'Próxima Questão'}
                                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
