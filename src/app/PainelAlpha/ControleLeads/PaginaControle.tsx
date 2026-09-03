"use client"

import React, { useEffect, useState } from 'react';
import {
    BarChart3, ArrowLeft,
    ClipboardList,
    ChevronDown,
    UsersRound,
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

const NOMES_CURTOS_CLOSERS: Record<string, string> = {
    'GISELLE GLEYCE SOUZA SANTOS': 'Giselle',
    'SHEILA ANGELICA BAHRI': 'Sheila',
    'NATHALIA FERNANDA FORTES': 'Nathalia',
    'DOUGLAS WESLEI RIBEIRO MACEDO': 'Douglas',
};

function nomeCurtoCloser(nome: string) {
    return NOMES_CURTOS_CLOSERS[nome] ?? nome;
}

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
    const closerInicial = closersAcompanhamento.some((closer) => closer.nome === usuarioLogado)
        ? usuarioLogado
        : closersAcompanhamento[0]?.nome ?? usuarioLogado;
    const [colaboradoraSelecionada, setColaboradoraSelecionada] = useState(closerInicial);
    const nomeCloserSelecionada = nomeCurtoCloser(colaboradoraSelecionada);
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
                    <section className="mb-6 overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-white via-indigo-50/70 to-violet-50 shadow-sm dark:from-slate-900 dark:via-indigo-950/30 dark:to-slate-900">
                        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
                                    <UsersRound size={20} aria-hidden="true" />
                                </div>
                                <div className="min-w-0">
                                    <label
                                        htmlFor="closer-alpha-leads"
                                        className="block text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400"
                                    >
                                        Acompanhar lançamentos da closer
                                    </label>
                                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                                        Selecione uma pessoa para consultar lançamentos e resultados.
                                    </p>
                                </div>
                            </div>

                            <div
                                role="status"
                                aria-live="polite"
                                className={`w-fit shrink-0 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-wider ${
                                    modoAuditoria
                                        ? "border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                        : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                }`}
                            >
                                {modoAuditoria ? "Consulta somente leitura" : "Edição dos meus dados"}
                            </div>
                        </div>

                        <div className="border-t border-indigo-500/10 bg-white/65 p-5 backdrop-blur-sm dark:bg-slate-950/25">
                            <div className="relative max-w-2xl">
                                <div className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-sm font-black text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                                        {nomeCloserSelecionada.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <select
                                    id="closer-alpha-leads"
                                    value={colaboradoraSelecionada}
                                    onChange={(evento) => {
                                        setResumoLateral(null);
                                        setColaboradoraSelecionada(evento.target.value);
                                    }}
                                    className="h-14 w-full cursor-pointer appearance-none rounded-2xl border border-slate-200 bg-white pl-16 pr-12 text-sm font-black text-slate-800 shadow-sm outline-none transition hover:border-indigo-300 hover:shadow-md focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-indigo-500/60"
                                >
                                    {closersAcompanhamento.length === 0 && (
                                        <option value={usuarioLogado}>Nenhuma closer disponível</option>
                                    )}
                                    {closersAcompanhamento.map((closer) => (
                                        <option key={closer.id} value={closer.nome}>
                                            {nomeCurtoCloser(closer.nome)}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown
                                    size={18}
                                    aria-hidden="true"
                                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-indigo-500"
                                />
                            </div>
                            <p className="mt-2 pl-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                                Giselle, Sheila, Nathalia e Douglas disponíveis para acompanhamento.
                            </p>
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
