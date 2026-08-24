"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { fmtDate, fmtTimeFull } from "@/lib/format-date";
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CriarTarefa, BuscarTarefasPorUsuario, DeletarTarefa, EditarTarefa } from '@/actions/Tarefas';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';
import { CheckCircle, Clock, Info, Plus, Search, Trash2, UserCheck, BarChart3, ChevronDown, Calendar, AlertCircle, X, Settings, Loader2, ChevronRight, ChevronLeft, Edit3 } from 'lucide-react';
import { BuscarDiretrizPorSala, SalvarDiretrizSala } from '@/actions/Reservas';
import { ButtonLoading } from '@/components/ButtonLoading';

const DIAS_NOMES = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const StatCard = ({ label, valor, icon, color }: any) => (
    <div className="bg-slate-900/40 border border-white/5 p-6 rounded-[2rem] relative overflow-hidden">
        <div className={`text-${color}-500 mb-3`}>{icon}</div>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
        <h3 className="text-3xl font-black text-white italic">{valor}</h3>
    </div>
);

export default function AdminTarefas() {
    const searchParams = useSearchParams();
    const userIdUrl = searchParams.get('id');
    const { data: session } = useSession();

    const [tarefas, setTarefas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [busca, setBusca] = useState("");
    const [filtroStatus, setFiltroStatus] = useState('todas');
    const [showModalAdd, setShowModalAdd] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [diaFiltro, setDiaFiltro] = useState<Date>(new Date());
    const [showModalRotina, setShowModalRotina] = useState(false);
    const [configSala, setConfigSala] = useState({ sala: "Sala de Reuniões", descricao: "" });
    const [isPending, setIsPending] = useState(false);
    const [loadingDados, setLoadingDados] = useState(false);
    const [periodoEficiencia, setPeriodoEficiencia] = useState<'dia' | 'semana' | 'mes'>('dia');
    const [reservas, setReservas] = useState<any[]>([]);
    const [reservasConcluidas, setReservasConcluidas] = useState<string[]>([]);
    const [dataSelecionada, setDataSelecionada] = useState(new Date());
    const [editandoId, setEditandoId] = useState<string | null>(null);
    const [modoHistorico, setModoHistorico] = useState(false);



    const [novaTarefa, setNovaTarefa] = useState({
        texto: "",
        descricao: "",
        fixa: false,
        diasSemana: [] as number[],
        intervaloDias: null as number | null,
        dataInicio: new Date(),
        prioridade: "baixa",
        horario: ""
    });




    const carregarDados = async () => {
        if (!userIdUrl) return;

        setLoading(true);
        try {
            const userRole = session?.user?.role || "USER";

            const data = await BuscarTarefasPorUsuario(String(userIdUrl), userRole);



            setTarefas(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error(error);
            toast.error("Erro na sincronização.");
        } finally {
            setLoading(false);
        }
    };


    useEffect(() => { carregarDados(); }, [userIdUrl]);

    const calcularOcorrencia = (t: any, dataAlvo: Date) => {
        const alvo = new Date(dataAlvo);
        alvo.setHours(0, 0, 0, 0);

        if (t.fixa && t.diaSemana !== null && (!t.intervaloDias || t.intervaloDias === 0)) {
            const diaSemanaAlvo = alvo.getDay() === 0 ? 6 : alvo.getDay() - 1;
            const diasConfigurados = Array.isArray(t.diaSemana) ? t.diaSemana : [Number(t.diaSemana)];
            return diasConfigurados.includes(diaSemanaAlvo);
        }

        if (t.dataInicio) {
            const dataLimpa = String(t.dataInicio).split('T')[0];
            let dataOcorrencia = new Date(dataLimpa + 'T00:00:00');

            if (!t.intervaloDias || t.intervaloDias === 0) {
                return dataOcorrencia.getTime() === alvo.getTime();
            }

            if (alvo < dataOcorrencia) return false;

            while (dataOcorrencia < alvo) {
                dataOcorrencia.setDate(dataOcorrencia.getDate() + Number(t.intervaloDias));
                const ds = dataOcorrencia.getDay();
                if (ds === 6) dataOcorrencia.setDate(dataOcorrencia.getDate() - 1);
                if (ds === 0) dataOcorrencia.setDate(dataOcorrencia.getDate() + 1);
            }
            return dataOcorrencia.getTime() === alvo.getTime();
        }
        return false;
    };

    const statsPeriodo = useMemo(() => {
        const dataReferencia = new Date(diaFiltro);
        dataReferencia.setHours(23, 59, 59, 999);

        const dataInicioP = new Date(diaFiltro);
        dataInicioP.setHours(0, 0, 0, 0);

        if (periodoEficiencia === 'semana') {
            const diaSemana = dataInicioP.getDay();
            const diff = diaSemana === 0 ? -6 : 1 - diaSemana;
            dataInicioP.setDate(dataInicioP.getDate() + diff);
        } else if (periodoEficiencia === 'mes') {
            dataInicioP.setDate(1);
        }

        let acumuladorTotal = 0;
        let acumuladorConcluidas = 0;
        let dataCursor = new Date(dataInicioP);

        while (dataCursor <= dataReferencia) {
            const tarefasDoDia = (tarefas || []).filter(t => calcularOcorrencia(t, dataCursor));

            const reservasDoDia = (reservas || []).filter((res: any) => {
                const dRes = new Date(res.inicio);
                return dRes.getFullYear() === dataCursor.getFullYear() &&
                    dRes.getMonth() === dataCursor.getMonth() &&
                    dRes.getDate() === dataCursor.getDate();
            });

            acumuladorTotal += tarefasDoDia.length + reservasDoDia.length;

            acumuladorConcluidas += tarefasDoDia.filter(t => t.feita).length;
            acumuladorConcluidas += reservasDoDia.filter((res: any) =>
                (reservasConcluidas || []).includes(String(res.id)) ||
                (reservasConcluidas || []).includes(`reserva-${res.id}`)
            ).length;

            dataCursor.setDate(dataCursor.getDate() + 1);
        }

        const percent = acumuladorTotal > 0 ? Math.round((acumuladorConcluidas / acumuladorTotal) * 100) : 0;

        return {
            percent,
            concluidas: acumuladorConcluidas,
            total: acumuladorTotal
        };
    }, [tarefas, reservas, reservasConcluidas, periodoEficiencia, diaFiltro]);

    const alternarPeriodo = (direcao: 'prox' | 'prev') => {
        const ordem: ('dia' | 'semana' | 'mes')[] = ['dia', 'semana', 'mes'];
        const indexAtual = ordem.indexOf(periodoEficiencia);
        if (direcao === 'prox') {
            setPeriodoEficiencia(ordem[(indexAtual + 1) % 3]);
        } else {
            setPeriodoEficiencia(ordem[(indexAtual - 1 + 3) % 3]);
        }
    };



    const tarefasFiltradas = useMemo(() => {
        if (!tarefas || !Array.isArray(tarefas)) return [];

        const dataAlvo = new Date(diaFiltro);
        dataAlvo.setHours(0, 0, 0, 0);
        const dataAlvoISO = dataAlvo.toISOString().split('T')[0];

        const filtradas = tarefas.reduce((acc: any[], t) => {
            let concluidaNoDia = false;
            if (t.feita && t.concluidaEm) {
                const dConcl = new Date(t.concluidaEm);
                concluidaNoDia = dConcl.toISOString().split('T')[0] === dataAlvoISO;
            }

            const correspondeBusca =
                (t.texto?.toLowerCase().includes(busca.toLowerCase()) ||
                    t.descricao?.toLowerCase().includes(busca.toLowerCase()));

            const correspondeStatus =
                filtroStatus === 'todas' ? true :
                    filtroStatus === 'pendentes' ? !concluidaNoDia :
                        filtroStatus === 'concluidas' ? concluidaNoDia :
                            filtroStatus === 'fixas' ? t.fixa : true;

            const correspondeData = modoHistorico ? true : calcularOcorrencia(t, diaFiltro);

            if (correspondeBusca && correspondeStatus && correspondeData) {
                acc.push({
                    ...t,
                    feita: modoHistorico ? t.feita : concluidaNoDia,
                    horarioReal: concluidaNoDia ? t.concluidaEm : null
                });
            }
            return acc;
        }, []);

        if (modoHistorico) {
            const vistos = new Set();
            return filtradas.filter(t => {
                const chaveUnica = t.texto?.trim().toLowerCase();
                if (vistos.has(chaveUnica)) return false;
                vistos.add(chaveUnica);
                return true;
            });
        }

        return filtradas;
    }, [tarefas, busca, filtroStatus, diaFiltro, modoHistorico]);

    const statsGeral = useMemo(() => {
        if (!tarefas || !Array.isArray(tarefas)) return { total: 0, concluidas: 0, percent: 0 };
        const total = tarefas.length;
        const concluidas = tarefas.filter(t => t.feita).length;
        return { total, concluidas, percent: total > 0 ? Math.round((concluidas / total) * 100) : 0 };
    }, [tarefas]);

    const statsDia = useMemo(() => {
        const dataAlvo = new Date(diaFiltro);
        dataAlvo.setHours(0, 0, 0, 0);
        const dataAlvoISO = dataAlvo.toISOString().split('T')[0];

        const tarefasDoDia = tarefas.filter(t => calcularOcorrencia(t, diaFiltro));
        const total = tarefasDoDia.length;

        const concluidas = tarefasDoDia.filter(t => {
            if (!t.feita || !t.concluidaEm) return false;
            return new Date(t.concluidaEm).toISOString().split('T')[0] === dataAlvoISO;
        }).length;

        return {
            total,
            concluidas,
            percent: total > 0 ? Math.round((concluidas / total) * 100) : 0
        };
    }, [tarefas, diaFiltro]);

    const handleCriar = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsPending(true);
        const isEventoUnico = !novaTarefa.fixa;
        const temFrequenciaRecorrente = novaTarefa.diasSemana.length > 0 || novaTarefa.intervaloDias !== null;

        if (!userIdUrl || (!isEventoUnico && !temFrequenciaRecorrente)) {
            toast.error("Defina a frequência ou dias da semana!");
            return;
        }

        try {
            if (novaTarefa.intervaloDias) {
                await CriarTarefa({ ...novaTarefa, diaSemana: null, userId: String(userIdUrl) });
            } else if (!novaTarefa.fixa) {
                await CriarTarefa({ ...novaTarefa, diaSemana: null, intervaloDias: null, userId: String(userIdUrl) });
            } else {
                const promessas = novaTarefa.diasSemana.map(dia =>
                    CriarTarefa({ ...novaTarefa, diaSemana: dia, intervaloDias: null, userId: String(userIdUrl) })
                );
                await Promise.all(promessas);
            }
            toast.success("Diretriz lançada!");
            setShowModalAdd(false);
            setIsPending(false);
            setNovaTarefa({ texto: "", descricao: "", fixa: false, diasSemana: [], intervaloDias: null, dataInicio: new Date(), prioridade: "baixa", horario: "" });
            carregarDados();
        } catch (error) {
            toast.error("Falha ao comunicar com o servidor.");
        }
    };

    const handleDeletar = async (id: string) => {
        if (!confirm("Remover diretriz?")) return;
        const res = await DeletarTarefa(id);
        if (res.success) {
            toast.success("Removida");
            carregarDados();
        }
    };

    useEffect(() => {
        if (showModalRotina) {
            const carregarTextoExistente = async () => {
                setLoadingDados(true);
                const diretriz = await BuscarDiretrizPorSala(configSala.sala);
                setConfigSala(prev => ({
                    ...prev,
                    descricao: diretriz?.descricao || ""
                }));
                setLoadingDados(false);
            };
            carregarTextoExistente();
        }
    }, [configSala.sala, showModalRotina]);

    const handleSalvarDiretriz = async () => {
        setIsPending(true);
        const res = await SalvarDiretrizSala(configSala.sala, configSala.descricao);
        if (res.success) {
            toast.success("Diretriz atualizada com sucesso!");
            setShowModalRotina(false);
            carregarDados();
        }
        setIsPending(false);
    };

    const handleAbrirEdicao = (tarefa: any) => {
        setEditandoId(tarefa.id);
        setNovaTarefa({
            texto: tarefa.texto,
            descricao: tarefa.descricao || "",
            prioridade: tarefa.prioridade,
            fixa: tarefa.fixa,
            intervaloDias: tarefa.intervaloDias,
            diasSemana: tarefa.diasSemana || [],
            dataInicio: new Date(tarefa.dataInicio),
            horario: tarefa.horario || ""
        });
        setShowModalAdd(true);
    };

    const handleEditar = async (id: string) => {
        try {
            const res = await EditarTarefa(id, novaTarefa);

            if (res.success) {
                toast.success("Diretriz atualizada com sucesso!");
                setShowModalAdd(false);
                setEditandoId(null);
                carregarDados();
            } else {
                toast.error("Erro ao processar atualização no banco.");
            }
        } catch (error) {
            console.error(error);
            toast.error("Falha catastrófica na edição.");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsPending(true);

        try {
            if (editandoId) {
                await handleEditar(editandoId);
            } else {
                await handleCriar(e);
            }
        } finally {
            setIsPending(false);
        }
    };


    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8 min-h-screen pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white/[0.02] border border-white/5 p-8 rounded-[3rem] backdrop-blur-xl shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-500">
                        <UserCheck size={28} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">
                            Gestão de <span className="text-indigo-500">Diretrizes</span>
                        </h1>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
                            Rotina para: <span className="text-indigo-400 uppercase">{}</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">

                    <div className="flex items-center gap-2 bg-black/20 p-1.5 rounded-[1.5rem] border border-white/5 backdrop-blur-xl shadow-2xl">

                        <button
                            onClick={() => setDiaFiltro(new Date(diaFiltro.setDate(diaFiltro.getDate() - 1)))}
                            className="cursor-pointer p-3 hover:bg-white/5 rounded-xl text-slate-500 hover:text-indigo-400 transition-all"
                        >
                            <ChevronLeft size={16} />
                        </button>

                        <div className="relative flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-xl min-w-[200px] group hover:border-indigo-500/50 transition-all cursor-pointer">
                            <Calendar size={16} className="text-indigo-500 group-hover:scale-110 transition-transform" />

                            <div className="flex flex-col" >
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter leading-none mb-1">
                                    Data de Consulta
                                </span>
                                <input
                                    type="date"
                                    value={diaFiltro instanceof Date ? diaFiltro.toISOString().split('T')[0] : ''}
                                    onChange={(e) => setDiaFiltro(new Date(e.target.value + 'T00:00:00'))}
                                    className="bg-transparent text-white text-[16px] font-black uppercase outline-none cursor-pointer [color-scheme:dark] appearance-none"
                                />
                            </div>

                            {diaFiltro.toDateString() !== new Date().toDateString() && (
                                <button
                                    onClick={() => setDiaFiltro(new Date())}
                                    className="cursor-pointer absolute -top-2 -right-2 bg-indigo-600 hover:bg-green-700 text-[8px] font-black px-2 py-1 rounded-md shadow-lg animate-in fade-in zoom-in duration-300"
                                >
                                    HOJE
                                </button>
                            )}
                        </div>

                        <button
                            onClick={() => setDiaFiltro(new Date(diaFiltro.setDate(diaFiltro.getDate() + 1)))}
                            className="cursor-pointer p-3 hover:bg-white/5 rounded-xl text-slate-500 hover:text-indigo-400 transition-all"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <button
                        onClick={() => setShowModalAdd(true)}
                        className="cursor-pointer flex items-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20"
                    >
                        <Plus size={18} /> Nova Ordem
                    </button>
                    <button
                        onClick={() => setShowModalRotina(true)}
                        className="cursor-pointer flex items-center gap-3 bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20"
                    >
                        <Settings size={18} /> Rotina para salas de reuniões
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Base Total" valor={statsGeral.total} icon={<Clock size={20} />} color="indigo" />
                <StatCard label="Finalizadas" valor={statsGeral.concluidas} icon={<CheckCircle size={20} />} color="emerald" />
                <div className="flex-1 min-w-[240px] bg-white/[0.03] border border-white/5 p-4 rounded-[2rem] relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-500/5 blur-3xl rounded-full opacity-50" />

                    <div className="flex items-center justify-between mb-2 px-1">
                        <div className="flex items-center gap-2">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] italic">
                                Eficiência <span className="text-emerald-500/50">{periodoEficiencia === 'dia' ? 'Diária' : periodoEficiencia === 'semana' ? 'Semanal' : 'Mensal'}</span>
                            </p>
                            <div className="flex gap-1 ml-1">
                                <button onClick={() => alternarPeriodo('prev')} className="cursor-pointer hover:text-white text-slate-600 transition-colors">
                                    <ChevronLeft size={14} />
                                </button>
                                <button onClick={() => alternarPeriodo('prox')} className="cursor-pointer hover:text-white text-slate-600 transition-colors">
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                        <span className="text-[10px] font-black text-emerald-500 italic tracking-tighter">
                            {statsPeriodo.percent}%
                        </span>
                    </div>

                    <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden shadow-inner">
                        <motion.div
                            key={periodoEficiencia}
                            initial={{ width: 0 }}
                            animate={{ width: `${statsPeriodo.percent}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"
                        >
                            <div className="absolute right-0 top-0 bottom-0 w-8 bg-white/20 blur-sm" />
                        </motion.div>
                    </div>

                    <div className="flex justify-between mt-2 px-1">
                        <div className="flex gap-1">
                            {[...Array(5)].map((_, i) => (
                                <div
                                    key={i}
                                    className={`w-1 h-1 rounded-full transition-colors duration-500 ${i < (statsPeriodo.percent / 20) ? 'bg-emerald-500' : 'bg-white/5'}`}
                                />
                            ))}
                        </div>
                        <p className="text-[7px] font-bold text-slate-600 uppercase tracking-tighter">
                            {statsPeriodo.concluidas}/{statsPeriodo.total} Entregas
                        </p>
                    </div>
                </div>


                <div className="bg-indigo-600 border border-indigo-400 p-6 rounded-[2rem] relative overflow-hidden shadow-xl shadow-indigo-500/20">
                    <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">Visualizando:</p>
                    <h3 className="text-xl font-black text-white uppercase italic">
                        {diaFiltro.toLocaleDateString('pt-BR', { weekday: 'long' })}
                    </h3>
                    <BarChart3 className="absolute -right-2 -bottom-2 text-white/10" size={80} />
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex flex-col lg:flex-row gap-4 bg-black/20 p-3 rounded-3xl border border-white/5 backdrop-blur-md">
                    {/* SEARCH */}
                    <div className="relative flex-1">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                        <input
                            type="text"
                            placeholder="FILTRAR POR TEXTO OU DESCRIÇÃO..."
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            className="w-full bg-white/5 border border-white/5 rounded-2xl py-4 pl-14 text-[11px] font-bold text-white uppercase outline-none focus:border-indigo-500/30 transition-all"
                        />
                    </div>

                    {/* BOTÃO HISTÓRICO (MODO GLOBAL) */}
                    <button
                        onClick={() => setModoHistorico(!modoHistorico)}
                        className={`flex items-center gap-2 px-6 py-4 rounded-2xl border transition-all duration-300 ${modoHistorico
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                            : 'bg-white/5 border-white/5 text-slate-500 hover:text-white'
                            }`}
                    >
                        <Clock size={16} className={modoHistorico ? "animate-pulse" : ""} />
                        <span className="text-[9px] font-black uppercase tracking-widest">
                            {modoHistorico ? "Ver Agenda" : "Ver Histórico"}
                        </span>
                    </button>

                    {/* FILTROS DE STATUS */}
                    <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
                        {['todas', 'pendentes', 'concluidas', 'fixas'].map((f) => (
                            <button
                                key={f}
                                onClick={() => {
                                    setModoHistorico(false);
                                    setFiltroStatus(f);
                                }}
                                className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${filtroStatus === f ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'
                                    }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-white/[0.01] border border-white/5 rounded-[3rem] overflow-hidden backdrop-blur-sm">
                {loading ? (
                    <div className="p-20 text-center text-slate-600 font-black uppercase text-[10px] tracking-widest animate-pulse">Sincronizando...</div>
                ) : tarefasFiltradas.length > 0 ? (
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02] text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                <th className="px-10 py-7">Status</th>
                                <th className="px-10 py-7">Diretriz</th>
                                <th className="px-10 py-7 text-center">Referência</th>
                                <th className="px-10 py-7 text-center">Horario de Termino</th>
                                <th className="px-10 py-7 text-center">Prioridade</th>
                                <th className="px-10 py-7 text-right">Ação</th>
                                <th className='px-10 py-7 text-right'>Edição</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.02]">
                            {tarefasFiltradas.map((t) => {
                                const pKey = (t.prioridade?.toLowerCase() || 'baixa');
                                return (
                                    <React.Fragment key={t.id}>
                                        <tr
                                            onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                                            className="group hover:bg-white/[0.02] transition-all cursor-pointer border-l-4 border-transparent"
                                        >
                                            <td className="px-10 py-6">
                                                <div className={`flex items-center gap-2 text-[9px] font-black uppercase ${t.feita ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                    <div className={`w-1.5 h-1.5 rounded-full ${t.feita ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-amber-500 animate-pulse'}`} />
                                                    {t.feita ? 'Finalizado' : 'Aberto'}
                                                </div>
                                            </td>
                                            <td className="px-10 py-6">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-white uppercase italic">{t.texto}</span>
                                                    <span className="text-[9px] font-bold text-slate-500 uppercase mt-1">
                                                        {t.intervaloDias ? `Ciclo ${t.intervaloDias} dias` : t.fixa ? 'Rotina Semanal' : 'Evento Único'}
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="px-10 py-6 text-center min-w-[180px]">
                                                <div className="flex justify-center items-center h-full">
                                                    {(() => {
                                                        if (!t.fixa && (!t.intervaloDias || t.intervaloDias === 0)) {
                                                            return (
                                                                <span className="whitespace-nowrap text-[10px] font-black px-4 py-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 uppercase tracking-widest shadow-sm">
                                                                    Única - Hoje
                                                                </span>
                                                            );
                                                        }

                                                        if (t.fixa && t.diaSemana !== null && (!t.intervaloDias || t.intervaloDias === 0)) {
                                                            const diasMapa: { [key: number]: string } = { 0: 'SEG', 1: 'TER', 2: 'QUA', 3: 'QUI', 4: 'SEX', 5: 'SAB' };
                                                            const diasArray = Array.isArray(t.diaSemana) ? t.diaSemana : [Number(t.diaSemana)];
                                                            const diasTexto = diasArray.map((d: number) => diasMapa[d]).join(' / ');

                                                            return (
                                                                <span className="whitespace-nowrap text-[10px] font-black px-4 py-2 rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 uppercase tracking-widest shadow-sm">
                                                                    Rotina
                                                                </span>
                                                            );
                                                        }

                                                        if (t.intervaloDias && t.intervaloDias > 0) {
                                                            const hoje = new Date();
                                                            hoje.setHours(0, 0, 0, 0);
                                                            let proximaData = "";

                                                            for (let i = 0; i < 90; i++) {
                                                                const dataTeste = new Date(hoje);
                                                                dataTeste.setDate(hoje.getDate() + i);

                                                                if (calcularOcorrencia(t, dataTeste)) {
                                                                    proximaData = i === 0 ? "Hoje" : dataTeste.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                                                                    break;
                                                                }
                                                            }

                                                            return (
                                                                <div className="flex flex-col items-center gap-2 min-w-max">
                                                                    <span className="whitespace-nowrap text-[10px] font-black px-4 py-2 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-500 uppercase tracking-widest shadow-sm">
                                                                        A cada {t.intervaloDias} dias
                                                                    </span>
                                                                </div>
                                                            );
                                                        }

                                                        return <span className="text-slate-700 font-black">--</span>;
                                                    })()}
                                                </div>
                                            </td>

                                            <td className="px-10 py-6 text-center font-mono">
                                                {t.feita && (t.concluidaEm || t.concluidaem) ? (
                                                    <span className="text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 text-[11px] font-black">
                                                        {fmtTimeFull(t.concluidaEm || t.concluidaem)}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-700 italic text-[10px]">--:--:--</span>
                                                )}
                                            </td>

                                            <td className="px-10 py-6 text-center">
                                                <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase border ${pKey === 'urgente' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                                                    pKey === 'alta' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-white/5 text-slate-500 border-white/10'
                                                    }`}>
                                                    {pKey}
                                                </span>
                                            </td>
                                            <td className="px-10 py-6 text-right">
                                                <button onClick={(e) => { e.stopPropagation(); handleDeletar(t.id); }} className="text-slate-700 hover:text-rose-500 transition-colors p-2">
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                            <td className="px-10 py-6 text-right">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleAbrirEdicao(t); }}
                                                    className="p-3 bg-white/5 hover:bg-amber-500/20 border border-white/10 hover:border-amber-500/50 rounded-xl text-slate-500 hover:text-amber-500 transition-all group"
                                                    title="Editar Diretriz"
                                                >
                                                    <Edit3 size={18} className="group-active:scale-90 transition-transform" />
                                                </button>
                                            </td>
                                        </tr>
                                        <AnimatePresence>
                                            {expandedId === t.id && (
                                                <tr>
                                                    <td colSpan={5} className="p-0">
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="overflow-hidden bg-white/[0.01]"
                                                        >
                                                            <div className="px-10 py-8 border-l-4 border-indigo-500/50">
                                                                <div className="grid grid-cols-2 gap-8">
                                                                    <div className="space-y-4">
                                                                        <div>
                                                                            <h4 className="text-[10px] font-black text-indigo-400 uppercase mb-3 tracking-widest">Descrição Técnica:</h4>
                                                                            <p className="text-slate-300 text-sm leading-relaxed">{t.descricao || "Sem detalhes."}</p>
                                                                        </div>

                                                                    </div>

                                                                    <div className="bg-white/5 rounded-[2rem] p-6 border border-white/5 space-y-4">
                                                                        <h4 className="text-[10px] font-black text-slate-500 uppercase mb-2 tracking-widest">Configurações de Cronograma:</h4>

                                                                        <div className="grid grid-cols-1 gap-3">
                                                                            <div className="flex justify-between items-center p-3 bg-black/20 rounded-xl border border-white/5 text-[11px]">
                                                                                <span className="text-slate-500 font-bold uppercase">Data de Início:</span>
                                                                                <span className="text-white font-black">{t.dataInicio ? fmtDate(t.dataInicio) : '--'}</span>
                                                                            </div>

                                                                            {t.intervaloDias > 0 && (
                                                                                <div className="flex justify-between items-center p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-[11px]">
                                                                                    <span className="text-emerald-500/70 font-bold uppercase">Ciclo de Repetição:</span>
                                                                                    <span className="text-emerald-500 font-black">{t.intervaloDias} Dias</span>
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                    </div>

                                                                </div>

                                                            </div>
                                                        </motion.div>
                                                    </td>

                                                </tr>
                                            )}
                                        </AnimatePresence>
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <div className="p-32 text-center text-slate-700 font-black uppercase text-[10px] tracking-[0.5em]">Nenhuma diretriz encontrada</div>
                )}
            </div>

            <AnimatePresence>
                {showModalRotina && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModalRotina(false)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md bg-slate-950 border border-white/10 p-8 rounded-[2.5rem] space-y-6 shadow-2xl">

                            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                                <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Rotina <span className="text-indigo-500">Técnica</span></h2>
                                <button onClick={() => setShowModalRotina(false)} className="cursor-pointer text-slate-500 hover:text-white"><X size={20} /></button>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-500 uppercase px-1">Selecione o Ambiente</label>
                                    <select
                                        value={configSala.sala}
                                        onChange={e => setConfigSala({ ...configSala, sala: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-white text-[10px] font-black uppercase outline-none focus:border-indigo-500 transition-all"
                                    >
                                        <option value="Sala de Reuniões">SALA DE REUNIÕES</option>
                                        <option value="Sala Xangai">SALA XANGAI</option>
                                        <option value="Sala Los Angeles">SALA LOS ANGELES</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-500 uppercase px-1">
                                        Instruções de Preparação
                                    </label>
                                    <div className="relative">
                                        <textarea
                                            disabled={isPending || loadingDados}
                                            placeholder={loadingDados ? "Consultando banco de dados..." : "Descreva a rotina..."}
                                            value={configSala.descricao}
                                            onChange={e => setConfigSala({ ...configSala, descricao: e.target.value })}
                                            className={`w-full bg-white/5 border border-white/10 p-5 rounded-2xl text-white text-xs font-medium h-40 outline-none focus:border-indigo-500 transition-all resize-none ${loadingDados ? 'opacity-50' : ''}`}
                                        />
                                        {loadingDados && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Loader2 size={20} className="animate-spin text-indigo-500" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleSalvarDiretriz}
                                disabled={isPending}
                                className="cursor-pointer w-full bg-indigo-600 hover:bg-indigo-500 p-5 rounded-2xl text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-indigo-500/20 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                            >
                                {isPending ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Processando...
                                    </>
                                ) : (
                                    "Salvar Configuração"
                                )}
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {showModalAdd && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => { setShowModalAdd(false); setEditandoId(null); }}
                            className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl"
                        />

                        <motion.form
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            onSubmit={handleSubmit}
                            className={`relative w-full max-w-lg bg-slate-900 border ${editandoId ? 'border-amber-500/30' : 'border-indigo-500/30'} p-8 rounded-[3rem] space-y-6 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] max-h-[90vh] overflow-y-auto custom-scrollbar`}
                        >
                            <div className="flex items-center justify-between border-b border-white/5 pb-6">
                                <div>
                                    <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">
                                        {editandoId ? 'Ajustar' : 'Nova'} <span className={`${editandoId ? 'text-amber-500' : 'text-indigo-500'}`}>Diretriz</span>
                                    </h2>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">
                                        {editandoId ? 'Modificando parâmetros existentes' : 'Lançamento de nova instrução'}
                                    </p>
                                </div>
                                <button type="button" onClick={() => { setShowModalAdd(false); setEditandoId(null); }} className="cursor-pointer h-10 w-10 flex items-center justify-center rounded-full bg-white/5 text-slate-500 hover:text-white transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="group">
                                    <label className="text-[9px] font-black text-slate-500 uppercase px-4 mb-2 block tracking-widest">O que deve ser feito?</label>
                                    <input required placeholder="TÍTULO DA TAREFA..." value={novaTarefa.texto} onChange={e => setNovaTarefa({ ...novaTarefa, texto: e.target.value })} className="w-full bg-black/40 border border-white/5 p-5 rounded-2xl text-white text-xs font-black uppercase outline-none focus:border-indigo-500 focus:bg-black/60 transition-all shadow-inner" />
                                </div>

                                <div className="group">
                                    <label className="text-[9px] font-black text-slate-500 uppercase px-4 mb-2 block tracking-widest">Instruções Técnicas</label>
                                    <textarea placeholder="DETALHAMENTO DO PROCESSO..." value={novaTarefa.descricao} onChange={e => setNovaTarefa({ ...novaTarefa, descricao: e.target.value })} className="w-full bg-black/40 border border-white/5 p-5 rounded-2xl text-white text-xs font-medium h-24 outline-none focus:border-indigo-500 focus:bg-black/60 transition-all resize-none shadow-inner" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div className="relative">
                                    <select value={novaTarefa.prioridade} onChange={(e) => setNovaTarefa({ ...novaTarefa, prioridade: e.target.value })} className="w-full bg-black/40 border border-white/5 p-5 rounded-2xl text-[10px] font-black uppercase text-white outline-none appearance-none focus:border-indigo-500">
                                        <option value="baixa">🟢 Baixa Prioridade</option>
                                        <option value="media">🟡 Prioridade Média</option>
                                        <option value="alta">🟠 Alta Prioridade</option>
                                        <option value="urgente">🔴 Urgência Máxima</option>
                                    </select>
                                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" size={16} />
                                </div>
                            </div>

                            <div className={`space-y-4 p-6 rounded-[2.5rem] border transition-colors ${editandoId ? 'bg-amber-500/5 border-amber-500/10' : 'bg-indigo-500/5 border-indigo-500/10'}`}>
                                <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                                    {[{ l: "Única", v: 0 }, { l: "Rotina", v: 7 }, { l: "10D", v: 10 }, { l: "15D", v: 15 }, { l: "30D", v: 30 }, { l: "45D", v: 45 }].map((opt) => (
                                        <button key={opt.v} type="button" onClick={() => setNovaTarefa({ ...novaTarefa, fixa: opt.v > 0, intervaloDias: (opt.v > 0 && opt.v !== 7) ? opt.v : null, diasSemana: opt.v === 7 ? [new Date().getDay()] : [], dataInicio: new Date() })} className={`py-3 rounded-xl text-[8px] font-black uppercase border transition-all ${((opt.v === 0 && !novaTarefa.fixa) || (opt.v === 7 && novaTarefa.fixa && !novaTarefa.intervaloDias) || (opt.v === novaTarefa.intervaloDias)) ? (editandoId ? 'bg-amber-600 border-amber-400 text-white shadow-lg' : 'bg-indigo-600 border-indigo-400 text-white shadow-lg') : 'bg-black/20 border-white/5 text-slate-500 hover:border-white/20'}`}>{opt.l}</button>
                                    ))}
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                                    <div className="space-y-2">
                                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Horário</label>
                                        <input
                                            type="time"
                                            value={novaTarefa.horario || ""}
                                            onChange={e => setNovaTarefa({ ...novaTarefa, horario: e.target.value })}
                                            className="w-full bg-black/40 border border-white/5 p-4 rounded-xl text-white text-[10px] font-black outline-none focus:border-indigo-500 [color-scheme:dark]"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Data Início / Única</label>
                                        <input
                                            type="date"
                                            required
                                            value={novaTarefa.dataInicio instanceof Date ? novaTarefa.dataInicio.toISOString().split('T')[0] : ''}
                                            onChange={(e) => setNovaTarefa({ ...novaTarefa, dataInicio: new Date(e.target.value + 'T00:00:00') })}
                                            className="w-full bg-black/40 border border-white/5 p-4 rounded-xl text-white text-[10px] font-black outline-none focus:border-indigo-500 [color-scheme:dark]"
                                        />
                                    </div>
                                </div>

                                {novaTarefa.fixa && (
                                    <div className="space-y-3 pt-4 border-t border-white/5">
                                        <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest px-1">Repetir nos dias:</label>
                                        <div className="grid grid-cols-6 gap-1">
                                            {['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'].map((dia, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => {
                                                        const novos = novaTarefa.diasSemana.includes(idx)
                                                            ? novaTarefa.diasSemana.filter(d => d !== idx)
                                                            : [...novaTarefa.diasSemana, idx];
                                                        setNovaTarefa({ ...novaTarefa, diasSemana: novos, intervaloDias: null });
                                                    }}
                                                    className={`h-10 rounded-lg text-[9px] font-black border transition-all ${novaTarefa.diasSemana.includes(idx)
                                                        ? (editandoId ? 'bg-amber-600 border-amber-400 text-white' : 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_10px_rgba(79,70,229,0.3)]')
                                                        : 'bg-black/20 border-white/5 text-slate-600 hover:border-white/20'
                                                        }`}
                                                >
                                                    {dia}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            </div>

                            <ButtonLoading
                                type="submit"
                                isLoading={isPending}
                                className="w-full"
                            >
                                Lançar Diretriz
                            </ButtonLoading>
                        </motion.form>
                    </div>
                )}
            </AnimatePresence>


        </div>
    );
}
