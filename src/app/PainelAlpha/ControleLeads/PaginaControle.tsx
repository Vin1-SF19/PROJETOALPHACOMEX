"use client"

import React, { useEffect, useState } from 'react';
import {
    BarChart3, ArrowLeft,
    ClipboardList,
    Zap
} from 'lucide-react';

import Link from 'next/link';
import Grafico from './grafico';
import Lancamentos from './Lançamentos';
import { useSession } from 'next-auth/react';
import { getPerformanceAcumulada } from '@/actions/ComercialControle';
import { useSearchParams } from 'next/navigation';

// --- Tipos ---
type Aba = 'lancamento' | 'graficos';

interface Props {
    usuario: {
        nome?: string | null;
        userImage?: string | null;
    },
    temaConfig: any;
    podeAcompanharEquipe: boolean;
    closersAcompanhamento: Array<{ id: number; nome: string }>;
}

export default function PaginaControle({
    usuario,
    temaConfig,
    podeAcompanharEquipe,
    closersAcompanhamento,
}: Props) {
    const { data: session } = useSession();

    // Coerente com o gate real do backend (podeGerenciarMetas: TI/Admin/CEO/Lider Comercial)
    // aplicado em getPerformanceMarketing/getPerformanceEquipeCompleta.
    const TemPermissao = podeAcompanharEquipe;

    const [abaAtiva, setAbaAtiva] = useState<Aba>('lancamento');
    const userImage = session?.user?.imagemUrl;
    const fotoFinal = userImage || session?.user?.imagemUrl || (session?.user as any)?.image;
    const searchParams = useSearchParams();
    const canalAtual = searchParams.get('canal') || 'TRAFEGO_PAGO';
    const usuarioLogado = usuario?.nome || session?.user?.nome || "";
    const [colaboradoraSelecionada, setColaboradoraSelecionada] = useState(usuarioLogado);
    const modoAuditoria = Boolean(
        colaboradoraSelecionada && colaboradoraSelecionada !== usuarioLogado,
    );

    const [resumoLateral, setResumoLateral] = useState<{
        canais: any;
    } | null>(null);

    useEffect(() => {
        let cancelado = false;

        async function atualizarDados() {
            if (!colaboradoraSelecionada) return;

            const mes = parseInt(searchParams.get('mes') || new Date().getMonth().toString());
            const ano = parseInt(searchParams.get('ano') || new Date().getFullYear().toString());

            try {
                const novosDados = await getPerformanceAcumulada(colaboradoraSelecionada, mes, ano);

                if (!cancelado && novosDados) {
                    setResumoLateral(novosDados);
                }
            } catch {
                if (!cancelado) setResumoLateral(null);
            }
        }

        void atualizarDados();
        return () => {
            cancelado = true;
        };
    }, [colaboradoraSelecionada, searchParams]);


    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-all">

            {/* Header */}
            <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 sticky top-0 z-50">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/PainelAlpha" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                            <ArrowLeft size={20} />
                        </Link>
                        <h1 className={`text-xl font-black tracking-tight flex items-center gap-2 italic uppercase `}>
                            Controle de Leads <label className={`${temaConfig.text}`}>Alpha</label>
                        </h1>
                    </div>

                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                        <button onClick={() => setAbaAtiva('lancamento')} className={`cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${abaAtiva === 'lancamento' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500'}`}>
                            <ClipboardList size={14} /> LANÇAMENTO
                        </button>
                        <button onClick={() => setAbaAtiva('graficos')} className={`cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${abaAtiva === 'graficos' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500'}`}>
                            <BarChart3 size={14} /> GRÁFICOS
                        </button>
                    </div>


                    {TemPermissao && (

                        <a
                            href='/PainelAlpha/ControleLeads/Marketing'
                            className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group"
                        >
                            <div className="flex items-center justify-center">
                                <Zap
                                    size={14}
                                    className="text-indigo-500 group-hover:fill-indigo-500 transition-all duration-300"
                                />
                            </div>

                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider group-hover:text-indigo-500 transition-colors">
                                Marketing
                            </span>

                            <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700 group-hover:bg-indigo-400" />
                        </a>
                    )}

                    <div className="flex items-center gap-2">
                        <div className="text-right hidden sm:block">
                            <p className="text-[10px] font-bold text-slate-400 leading-none">OPERADOR</p>
                            <p className="text-sm font-black">{usuario?.nome || "Usuário"}</p>
                        </div>
                        <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center font-bold text-white uppercase border-2 border-white shadow-sm">
                            <img
                                key={fotoFinal}
                                src={fotoFinal}
                                alt="Perfil"
                                className="h-full w-full object-cover"
                            />
                        </div>
                    </div>

                </div>
            </nav>

            <main className="max-w-[1400px] mx-auto p-6">

                {podeAcompanharEquipe && (
                    <section className="mb-6 flex flex-col gap-3 rounded-3xl border border-indigo-500/20 bg-indigo-500/5 p-4 sm:flex-row sm:items-end sm:justify-between">
                        <div className="min-w-0 flex-1">
                            <label
                                htmlFor="closer-alpha-leads"
                                className="mb-2 block text-[10px] font-black uppercase tracking-widest text-indigo-500"
                            >
                                Acompanhar lançamentos da closer
                            </label>
                            <select
                                id="closer-alpha-leads"
                                value={colaboradoraSelecionada}
                                onChange={(evento) => {
                                    setResumoLateral(null);
                                    setColaboradoraSelecionada(evento.target.value);
                                }}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:max-w-xl"
                            >
                                <option value={usuarioLogado}>Meus lançamentos — {usuarioLogado}</option>
                                {closersAcompanhamento
                                    .filter((closer) => closer.nome !== usuarioLogado)
                                    .map((closer) => (
                                        <option key={closer.id} value={closer.nome}>
                                            {closer.nome}
                                        </option>
                                    ))}
                            </select>
                        </div>
                        <div
                            role="status"
                            aria-live="polite"
                            className={`shrink-0 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-wider ${
                                modoAuditoria
                                    ? "border border-amber-500/20 bg-amber-500/10 text-amber-500"
                                    : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                            }`}
                        >
                            {modoAuditoria ? "Consulta somente leitura" : "Edição dos meus dados"}
                        </div>
                    </section>
                )}

                {abaAtiva === 'lancamento' ? (
                    <Lancamentos
                        key={`${canalAtual}:${colaboradoraSelecionada}`}
                        canalAtual={canalAtual}
                        usuario={usuarioLogado}
                        colaboradoraId={colaboradoraSelecionada}
                        somenteLeitura={modoAuditoria}
                        dadosAcumulados={resumoLateral}
                    />
                ) : (
                    <Grafico
                        dadosAcumulados={resumoLateral}
                    />
                )}


            </main>
        </div>
    );
}
