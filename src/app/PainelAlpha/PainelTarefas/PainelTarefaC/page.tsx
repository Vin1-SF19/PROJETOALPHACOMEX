"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft, ChevronRight, CheckCircle2,
    Circle, Star, Clock, Calendar as CalendarIcon, CheckCircle,
    Loader2, CalendarDays, Info, Trash2, Filter, XCircle, AlertTriangle, ShoppingCart
} from 'lucide-react';
import { useSession } from 'next-auth/react';

import { BuscarTarefasPorUsuario, AlternarStatusTarefa } from '@/actions/Tarefas';
import { toast } from 'sonner';
import { buscarReservasAtivas, BuscarTodasDiretrizes } from '@/actions/Reservas';
import { buscarListaCompra, buscarProdutos } from "@/actions/Estoque";

export default function PainelTarefas() {
    const { data: session } = useSession();

    const [agora, setAgora] = useState(new Date());
    const [dataSelecionada, setDataSelecionada] = useState<Date>(new Date());
    const [tarefas, setTarefas] = useState<any[]>([]);
    const [reservas, setReservas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState<'todas' | 'pendentes' | 'concluidas'>('pendentes');
    const [modalConfirmacao, setModalConfirmacao] = useState<{ show: boolean, tarefa: any | null }>({ show: false, tarefa: null });
    const [modalDescricao, setModalDescricao] = useState<{ show: boolean, tarefa: any | null }>({ show: false, tarefa: null });
    const [isPending, setIsPending] = useState(false);
    const [abaAtual, setAbaAtual] = useState<"TAREFAS" | "COMPRAS">("TAREFAS");

    const [produtos, setProdutos] = useState<any[]>([]);
    const [listaCompraDoBanco, setListaCompraDoBanco] = useState<any[]>([]);

    useEffect(() => {
        async function carregarEstoque() {
            const dados = await buscarProdutos();
            setProdutos(dados);
        }
        carregarEstoque();
    }, []);




    useEffect(() => {
        const timer = setInterval(() => setAgora(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const pulse = (horarioTarefa: string, isReserva: boolean) => {
        if (!isReserva || !horarioTarefa) return false;

        const [horas, minutos] = horarioTarefa.split(':').map(Number);
        const dataTarefa = new Date(dataSelecionada);
        dataTarefa.setHours(horas, minutos, 0, 0);

        const diferencaMilissegundos = dataTarefa.getTime() - agora.getTime();
        const diferencaMinutos = diferencaMilissegundos / (1000 * 60);

        return diferencaMinutos <= 30 && diferencaMinutos > 0;
    };


    const [mounted, setMounted] = useState(false);

    const [diretrizes, setDiretrizes] = useState<any[]>([]); const [modalDiretriz, setModalDiretriz] = useState<{
        show: boolean;
        tarefa: {
            texto: string;
            id: string;
            descricao: string;
            horario: string;
            responsavel: string;
        } | null;
    }>({ show: false, tarefa: null });

    const [reservasConcluidas, setReservasConcluidas] = useState<string[]>([]);

    const toggleConcluirReserva = (id: string) => {
        setReservasConcluidas(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    useEffect(() => {
        carregarTudo();

        const intervalo = setInterval(() => {
            console.log("Sincronizando painel...");
            carregarTudo();
        }, 40000);

        return () => clearInterval(intervalo);
    }, [session]);

    useEffect(() => {
        setMounted(true);
    }, []);

    const DIAS = [
        { nome: "Segunda-feira", curto: "SEG" },
        { nome: "Terça-feira", curto: "TER" },
        { nome: "Quarta-feira", curto: "QUA" },
        { nome: "Quinta-feira", curto: "QUI" },
        { nome: "Sexta-feira", curto: "SEX" },
        { nome: "Sábado", curto: "SAB" },
    ];

    const carregarTudo = async () => {
        const currentUserId = (session?.user as any)?.id;
        if (!currentUserId) return;
        const user = session?.user as any;
        if (!user?.id) return;


        setLoading(true);
        try {
            const [dadosTarefas, dadosDiretrizes] = await Promise.all([
                BuscarTarefasPorUsuario(String(currentUserId), user.role),
                BuscarTodasDiretrizes()
            ]);

            setTarefas(dadosTarefas);
            setDiretrizes(dadosDiretrizes);
        } catch (error) {
            toast.error("Erro ao sincronizar dados");
        } finally {
            setLoading(false);
        }
    };


    const carregarTarefas = async () => {
        if (!session?.user?.id) return;
        const user = session?.user as any;
        if (!user?.id) return;


        setLoading(true);
        try {
            const idLimpo = String(session.user.id).replace('.0', '');
            const data = await BuscarTarefasPorUsuario(idLimpo, user.role);
            setTarefas(data || []);
        } catch (error) {
            toast.error("Erro ao sincronizar.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarTarefas();
        const timer = setInterval(() => setAgora(new Date()), 1000);
        return () => clearInterval(timer);
    }, [session]);

    const tarefasExibidas = useMemo(() => {
        const dataAlvo = new Date(dataSelecionada);
        dataAlvo.setHours(0, 0, 0, 0);
        const dataAlvoTime = dataAlvo.getTime();

        const anoAlvo = dataAlvo.getFullYear();
        const mesAlvo = dataAlvo.getMonth();
        const diaAlvo = dataAlvo.getDate();

        const reservasComoTarefas = reservas
            .filter(res => {
                const dRes = new Date(res.inicio);
                return dRes.getFullYear() === anoAlvo &&
                    dRes.getMonth() === mesAlvo &&
                    dRes.getDate() === diaAlvo &&
                    res.tipo === "Cliente";
            })
            .map(res => {
                const diretrizDaSala = diretrizes.find(d => d.sala === res.sala);
                const infoCopa = res.paoDeQueijo ? "🥐 COM PÃO DE QUEIJO" : "SEM PÃO DE QUEIJO";
                return {
                    id: `reserva-${res.id}`,
                    texto: `OCUPAÇÃO: ${res.sala.toUpperCase()}`,
                    descricao: `${infoCopa} | ${diretrizDaSala?.descricao || `RESERVADO POR @${res.usuario.toUpperCase()}`}`,
                    responsavel: res.usuario,
                    feita: false,
                    prioridade: "media",
                    horario: new Date(res.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                    isReserva: true,
                    temCopa: res.paoDeQueijo
                };
            });

        const tarefasFiltradas = tarefas.reduce((acc: any[], t) => {
            let concluidaNoDia = false;

            if (t.feita && t.concluidaEm) {
                const dConcl = new Date(t.concluidaEm);
                concluidaNoDia = dConcl.getFullYear() === anoAlvo &&
                    dConcl.getMonth() === mesAlvo &&
                    dConcl.getDate() === diaAlvo;
            }

            const passaFiltroStatus =
                filtro === 'todas' ? true :
                    filtro === 'pendentes' ? !concluidaNoDia :
                        filtro === 'concluidas' ? concluidaNoDia : true;

            if (!passaFiltroStatus) return acc;

            let deveAparecer = false;

            if (t.fixa && t.diaSemana !== null && !t.intervaloDias) {
                const diaSemanaAlvo = dataAlvo.getDay() === 0 ? 6 : dataAlvo.getDay() - 1;
                if (Number(t.diaSemana) === diaSemanaAlvo) deveAparecer = true;
            } else if (t.dataInicio) {
                const dataLimpa = String(t.dataInicio).split('T')[0];
                let dataOcorrencia = new Date(dataLimpa + 'T00:00:00');

                if (!t.intervaloDias || t.intervaloDias === 0) {
                    if (dataOcorrencia.getFullYear() === anoAlvo &&
                        dataOcorrencia.getMonth() === mesAlvo &&
                        dataOcorrencia.getDate() === diaAlvo) deveAparecer = true;
                } else if (dataAlvoTime >= dataOcorrencia.getTime()) {
                    let tempOcorrencia = new Date(dataOcorrencia);
                    while (tempOcorrencia.getTime() <= dataAlvoTime) {
                        if (tempOcorrencia.getTime() === dataAlvoTime) {
                            deveAparecer = true;
                            break;
                        }
                        tempOcorrencia.setDate(tempOcorrencia.getDate() + Number(t.intervaloDias));
                        if (tempOcorrencia.getDay() === 6) tempOcorrencia.setDate(tempOcorrencia.getDate() - 1);
                        if (tempOcorrencia.getDay() === 0) tempOcorrencia.setDate(tempOcorrencia.getDate() + 1);
                    }
                }
            }

            if (deveAparecer) {
                acc.push({ ...t, feita: concluidaNoDia });
            }

            return acc;
        }, []);

        return [...tarefasFiltradas, ...reservasComoTarefas].sort((a, b) => {
            if (a.isReserva && !b.isReserva) return -1;
            if (!a.isReserva && b.isReserva) return 1;
            if (a.feita !== b.feita) return a.feita ? 1 : -1;
            if (a.horario && b.horario) return a.horario.localeCompare(b.horario);
            const pesos: Record<string, number> = { urgente: 4, alta: 3, media: 2, baixa: 1 };
            return (pesos[b.prioridade?.toLowerCase()] || 0) - (pesos[a.prioridade?.toLowerCase()] || 0);
        });
    }, [tarefas, reservas, diretrizes, dataSelecionada, filtro]);

    const navegarDias = (direcao: number) => {
        const novaData = new Date(dataSelecionada);
        novaData.setDate(novaData.getDate() + direcao);

        if (novaData.getDay() === 0) {
            novaData.setDate(novaData.getDate() + direcao);
        }

        setDataSelecionada(novaData);
    };

    const confirmarAcao = async () => {
        if (!modalConfirmacao.tarefa) return;
        setIsPending(true);

        try {
            const res = await AlternarStatusTarefa(
                modalConfirmacao.tarefa.id,
                !modalConfirmacao.tarefa.feita
            );

            if (res.success) {

                toast.success(modalConfirmacao.tarefa.feita ? "Estornado!" : "Concluído!");
                setModalConfirmacao({ show: false, tarefa: null });
                window.location.reload();
            }


            setIsPending(false);
        } catch (error) {
            toast.error("Erro ao processar.");
        }
    };

    useEffect(() => {
        carregarTudo();
    }, [dataSelecionada, session]);



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

    const statsDia = useMemo(() => {
        const dataAlvo = new Date(dataSelecionada);
        dataAlvo.setHours(0, 0, 0, 0);
        const dataAlvoTime = dataAlvo.getTime();
        const dataAlvoISO = dataAlvo.toISOString().split('T')[0];

        const todasDoDia = tarefas.filter(t => {
            if (t.fixa && t.diaSemana !== null && !t.intervaloDias) {
                const diaSemanaAlvo = dataAlvo.getDay() === 0 ? 6 : dataAlvo.getDay() - 1;
                return Number(t.diaSemana) === diaSemanaAlvo;
            }
            if (t.dataInicio) {
                const dataLimpa = String(t.dataInicio).split('T')[0];
                let dOcorrencia = new Date(dataLimpa + 'T00:00:00');
                if (!t.intervaloDias || t.intervaloDias === 0) {
                    return dOcorrencia.getTime() === dataAlvoTime;
                }
                if (dataAlvoTime < dOcorrencia.getTime()) return false;
                let temp = new Date(dOcorrencia);
                while (temp.getTime() <= dataAlvoTime) {
                    if (temp.getTime() === dataAlvoTime) return true;
                    temp.setDate(temp.getDate() + Number(t.intervaloDias));
                    if (temp.getDay() === 6) temp.setDate(temp.getDate() - 1);
                    if (temp.getDay() === 0) temp.setDate(temp.getDate() + 1);
                }
            }
            return false;
        });

     

        const total = todasDoDia.length;

        const concluidasTarefas = todasDoDia.filter(t => {
            if (!t.feita || !t.concluidaEm) return false;
            return String(t.concluidaEm).split('T')[0] === dataAlvoISO;
        }).length;


        const concluidas = concluidasTarefas;

        return {
            total,
            concluidas,
            percent: total > 0 ? Math.round((concluidas / total) * 100) : 0
        };
    }, [tarefas, reservas, dataSelecionada]);



    return (
        <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-10 min-h-screen pb-20">
                <>
                    <header className="space-y-6 mb-10">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="flex items-center gap-4">
                                <div className="relative group">
                                    <img
                                        src={session?.user.imagemUrl || '/panda.png'}
                                        alt='Avatar'
                                        className="w-14 h-14 object-cover rounded-[1.3rem] border-2 border-indigo-500/20 shadow-lg"
                                    />
                                    <div className="absolute inset-0 rounded-[1.3rem] bg-indigo-500/20 blur-md -z-10" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Operador(a):</p>
                                    <h1 className="text-xl font-black text-white uppercase italic tracking-tighter leading-none">
                                        {session?.user.nome || "Usuário"}
                                    </h1>
                                    <span className='text-indigo-400 font-bold text-[12px] uppercase tracking-widest'>
                                        {session?.user.role}
                                    </span>
                                </div>
                            </div>

                            <div className="bg-white/5 border border-white/10 p-4 rounded-[2rem] min-w-[220px] text-right relative group cursor-pointer hover:bg-white/[0.08] transition-all">
                                <input
                                    type="date"
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                    onChange={(e) => setDataSelecionada(new Date(e.target.value + 'T00:00:00'))}
                                />
                                <div className="text-xl font-black text-indigo-400 font-mono flex items-center justify-center gap-2">
                                    <Clock size={18} />
                                    {mounted ? (
                                        agora.toLocaleTimeString('pt-BR', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            second: '2-digit'
                                        })
                                    ) : (
                                        "00:00:00"
                                    )}
                                </div>
                            </div>
                        </div>


                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex bg-[#050a18]/60 p-1.5 rounded-full border border-white/5 backdrop-blur-md shadow-inner">
                                {(['pendentes', 'concluidas', 'todas'] as const).map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setFiltro(f)}
                                        className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${filtro === f
                                            ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)] scale-105'
                                            : 'text-slate-500 hover:text-slate-300'
                                            }`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>

                            <div className="flex-1 min-w-[200px] bg-white/[0.03] border border-white/5 p-4 rounded-[2rem] relative overflow-hidden group">
                                <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-500/5 blur-3xl rounded-full transition-opacity group-hover:opacity-100 opacity-50" />
                                <div className="flex items-center justify-between mb-2 px-1">
                                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] italic">
                                        Performance <span className="text-emerald-500/50">Sincronizada</span>
                                    </p>
                                    <span className="text-[10px] font-black text-emerald-500 italic tracking-tighter">
                                        {statsDia.percent}%
                                    </span>
                                </div>
                                <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden shadow-inner">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${statsDia.percent}%` }}
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
                                                className={`w-1 h-1 rounded-full ${i < (statsDia.percent / 20) ? 'bg-emerald-500' : 'bg-white/5'}`}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-[7px] font-bold text-slate-600 uppercase tracking-tighter">
                                        {statsDia.concluidas}/{statsDia.total} Tarefas
                                    </p>
                                </div>
                            </div>
                        </div>
                    </header>


                    <div className="flex items-center justify-between bg-white/5 border border-white/10 p-2 rounded-[3rem] shadow-2xl">
                        <button onClick={() => navegarDias(-1)} className="p-4 hover:bg-white/10 rounded-full text-slate-400 transition-all active:scale-90"><ChevronLeft /></button>
                        <div className="text-center">
                            <span className="text-[10px] font-black tracking-[0.4em] text-indigo-500 uppercase">
                                {dataSelecionada.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                            <h2 className="text-lg font-black text-white uppercase italic leading-tight">
                                {dataSelecionada.toDateString() === new Date().toDateString()
                                    ? `Hoje - ${DIAS[dataSelecionada.getDay() - 1].nome}`
                                    : (dataSelecionada.getDay() === 0 ? "Domingo" : DIAS[dataSelecionada.getDay() - 1].nome)
                                }
                            </h2>
                        </div>
                        <button onClick={() => navegarDias(1)} className="p-4 hover:bg-white/10 rounded-full text-slate-400 transition-all active:scale-90"><ChevronRight /></button>
                    </div>

                    <div className="grid gap-4">
                        {loading ? (
                            <div className="flex justify-center p-20"><Loader2 className="animate-spin text-indigo-500" /></div>
                        ) : tarefasExibidas.length > 0 ? (
                            <AnimatePresence mode="popLayout">
                                {tarefasExibidas.map((tarefa) => {
                                    const isConcluida = reservasConcluidas.includes(tarefa.id);

                                    const devePulsar = () => {
                                        if (!tarefa.isReserva || !tarefa.horario || isConcluida) return false;
                                        const [horas, minutos] = tarefa.horario.split(':').map(Number);
                                        const dataTarefa = new Date(dataSelecionada);
                                        dataTarefa.setHours(horas, minutos, 0, 0);
                                        const diferencaMinutos = (dataTarefa.getTime() - agora.getTime()) / (1000 * 60);
                                        return diferencaMinutos <= 30 && diferencaMinutos > 0;
                                    };

                                    const alertaAtivo = devePulsar();

                                    return (
                                        <motion.div
                                            layout
                                            key={tarefa.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            onClick={() => {
                                                if (tarefa.isReserva) {
                                                    setModalDiretriz({ show: true, tarefa });
                                                } else {
                                                    setModalDescricao({ show: true, tarefa });
                                                }
                                            }}
                                            className={`cursor-pointer group p-6 rounded-[2.5rem] border transition-all relative overflow-hidden ${isConcluida
                                                ? 'bg-emerald-500/10 border-emerald-500 animate-[pulse_2s_infinite] shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                                                : alertaAtivo
                                                    ? 'bg-rose-500/20 border-rose-500 animate-pulse shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                                                    : tarefa.isReserva
                                                        ? 'bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/20'
                                                        : tarefa.feita
                                                            ? 'bg-emerald-500/5 border-emerald-500/20 opacity-80'
                                                            : 'bg-white/5 border-white/10 hover:border-indigo-500/40 hover:bg-white/[0.07]'
                                                }`}
                                        >
                                            <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-500 ${isConcluida
                                                ? 'bg-emerald-500 shadow-[2px_0_10px_rgba(16,185,129,0.6)]'
                                                : alertaAtivo
                                                    ? 'bg-rose-500 shadow-[2px_0_10px_rgba(244,63,94,0.6)]'
                                                    : tarefa.isReserva
                                                        ? 'bg-indigo-500 shadow-[2px_0_10px_rgba(99,102,241,0.4)]'
                                                        : tarefa.prioridade === 'urgente'
                                                            ? 'bg-rose-600 shadow-[2px_0_10px_rgba(225,29,72,0.4)]'
                                                            : tarefa.prioridade === 'alta'
                                                                ? 'bg-orange-500'
                                                                : tarefa.prioridade === 'media'
                                                                    ? 'bg-amber-500'
                                                                    : 'bg-emerald-500'
                                                }`} />

                                            <div className="flex items-center gap-5">
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); !tarefa.isReserva && setModalConfirmacao({ show: true, tarefa }); }}
                                                    className={`transition-all duration-500 ${isConcluida
                                                        ? 'text-emerald-500'
                                                        : alertaAtivo
                                                            ? 'text-rose-500'
                                                            : tarefa.isReserva
                                                                ? 'text-indigo-400 opacity-50'
                                                                : tarefa.feita
                                                                    ? 'text-emerald-500 active:scale-75'
                                                                    : 'text-slate-700 hover:text-indigo-400 active:scale-75'
                                                        }`}
                                                >
                                                    {isConcluida ? (
                                                        <CheckCircle2 size={28} strokeWidth={3} />
                                                    ) : alertaAtivo ? (
                                                        <AlertTriangle size={28} className="animate-bounce" />
                                                    ) : tarefa.isReserva ? (
                                                        <CalendarIcon size={28} />
                                                    ) : tarefa.feita ? (
                                                        <CheckCircle2 size={28} />
                                                    ) : (
                                                        <Circle size={28} />
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                        {tarefa.isReserva ? (
                                                            <span className={`text-white text-[7px] px-2 py-0.5 rounded-md font-black uppercase border transition-colors duration-500 ${isConcluida
                                                                ? 'bg-emerald-500 border-emerald-400'
                                                                : alertaAtivo ? 'bg-rose-600 border-rose-400' : 'bg-indigo-500 border-indigo-400'
                                                                }`}>
                                                                {isConcluida ? 'Concluído' : alertaAtivo ? 'Início Próximo' : 'Reserva de Sala'}
                                                            </span>
                                                        ) : (
                                                            <>
                                                                {tarefa.intervaloDias && (
                                                                    <span className="bg-indigo-500/10 text-indigo-400 text-[7px] px-2 py-0.5 rounded-md font-black uppercase border border-indigo-500/20">
                                                                        Ciclo {tarefa.intervaloDias}d
                                                                    </span>
                                                                )}
                                                                {!tarefa.fixa && (
                                                                    <span className="bg-amber-500/10 text-amber-500 text-[7px] px-2 py-0.5 rounded-md font-black uppercase border border-amber-500/20">
                                                                        Eventual
                                                                    </span>
                                                                )}
                                                            </>
                                                        )}
                                                        <span className="text-[7px] font-black uppercase text-slate-500 tracking-tighter ml-auto">
                                                            {tarefa.isReserva ? 'Ocupação Técnica' : `Nível ${tarefa.prioridade || 'Prioridade'}`}
                                                        </span>
                                                    </div>
                                                    <p className={`text-[13px] font-bold uppercase tracking-tight leading-snug truncate transition-all ${(tarefa.feita || (tarefa.isReserva && isConcluida)) ? 'line-through text-slate-600 italic' : 'text-white'
                                                        }`}>
                                                        {tarefa.texto}
                                                    </p>
                                                    <div className="flex items-center gap-3 mt-1">
                                                        {tarefa.horario && (
                                                            <span className={`flex items-center gap-1 text-[10px] font-black uppercase transition-colors ${isConcluida ? 'text-emerald-500/50' : alertaAtivo ? 'text-rose-400' : 'text-slate-400'
                                                                }`}>
                                                                <Clock size={12} className={
                                                                    isConcluida ? 'text-emerald-500' : alertaAtivo ? 'text-rose-500' : tarefa.isReserva ? "text-indigo-400" : "text-emerald-400"
                                                                } />
                                                                {tarefa.horario}
                                                            </span>
                                                        )}
                                                        {tarefa.isReserva && (
                                                            <span className={`text-[9px] font-black uppercase italic truncate transition-colors ${isConcluida ? 'text-emerald-500/40' : alertaAtivo ? 'text-rose-400/80' : 'text-indigo-400/60'
                                                                }`}>
                                                                {isConcluida ? 'Tarefa Finalizada' : tarefa.descricao}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {!tarefa.isReserva && <ChevronRight size={16} className="text-white/10 group-hover:text-white/30 transition-colors" />}
                                                {tarefa.isReserva && isConcluida && <CheckCircle2 size={16} className="text-emerald-500/50" />}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        ) : (
                            <div className="p-20 text-center border-2 border-dashed border-white/5 rounded-[3.5rem]">
                                <CalendarIcon size={32} className="mx-auto text-white/5 mb-4" />
                                <p className="text-[10px] font-black text-slate-700 uppercase italic">Cronograma vazio para esta data</p>
                            </div>
                        )}
                    </div>

                    <AnimatePresence>
                        {modalConfirmacao.show && (
                            <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setModalConfirmacao({ show: false, tarefa: null })} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
                                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-xs bg-slate-950 border border-white/10 p-10 rounded-[3rem] text-center shadow-2xl">
                                    <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-6 ${modalConfirmacao.tarefa?.feita ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                        {modalConfirmacao.tarefa?.feita ? <Clock size={40} /> : <CheckCircle size={40} />}
                                    </div>
                                    <h2 className="text-xl font-black text-white uppercase italic tracking-tighter mb-2">{modalConfirmacao.tarefa?.feita ? "Estornar a tarefa: " : "Concluir a tarefa: "}</h2>
                                    <h1 className="text-2x1 font-bold  text-gray-200 uppercase italic tracking-tighter mb-5">{modalConfirmacao.tarefa.texto}</h1>
                                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-8 leading-relaxed">
                                        {modalConfirmacao.tarefa?.feita ? "A atividade voltará para a lista de pendências." : "O RH registrará sua conclusão imediatamente."}
                                    </p>
                                    <div className="flex flex-col gap-3">
                                        <button
                                            onClick={confirmarAcao}
                                            disabled={isPending}
                                            className={`cursor-pointer w-full py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl
                                    ${isPending ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-400'} 
                                    ${modalConfirmacao.tarefa?.feita ? 'bg-amber-600' : 'bg-emerald-600'} 
                                    text-white`}
                                        >
                                            {isPending ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    Processando...
                                                </span>
                                            ) : (
                                                "Confirmar"
                                            )}
                                        </button>
                                        <button onClick={() => setModalConfirmacao({ show: false, tarefa: null })} className="cursor-pointer w-full hover:text-red-600 py-4 text-[11px] font-black uppercase text-slate-500">Cancelar</button>
                                    </div>
                                </motion.div>
                            </div>
                        )}

                        {modalDescricao.show && modalDescricao.tarefa && (
                            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">

                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setModalDescricao({ show: false, tarefa: null })}
                                    className="absolute inset-0 bg-black/95 backdrop-blur-md"
                                />

                                <motion.div
                                    initial={{ y: 50, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: 50, opacity: 0 }}
                                    className="relative w-full max-w-md bg-slate-950 border border-white/10 p-6 sm:p-10 rounded-[2.5rem] sm:rounded-[3.5rem] shadow-2xl flex flex-col max-h-[90vh]"
                                >
                                    {/* Área de conteúdo com Scroll */}
                                    <div className="overflow-y-auto pr-2 custom-scrollbar">
                                        <div className="flex justify-between items-start mb-8 sticky top-0 bg-slate-950 z-10 pt-2 pb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-8 bg-indigo-500 rounded-full" />
                                                <h2 className="text-xl sm:text-2xl font-black text-white uppercase italic tracking-tighter leading-none">
                                                    Diretriz<br /><span className="text-indigo-500 text-2xl sm:text-3xl">Técnica</span>
                                                </h2>
                                            </div>
                                            <div className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase border shrink-0 ${modalDescricao.tarefa.prioridade === 'urgente' ? 'bg-rose-500/10 text-rose-500 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.2)]' : 'bg-white/5 text-slate-500 border-white/10'}`}>
                                                {modalDescricao.tarefa.prioridade || 'baixa'}
                                            </div>
                                        </div>

                                        <div className="space-y-6 sm:space-y-8">
                                            <div>
                                                <p className="text-lg font-bold text-white uppercase italic leading-tight mb-2">
                                                    {modalDescricao.tarefa.texto}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <Clock size={12} className="text-indigo-500" />
                                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                                        {modalDescricao.tarefa.intervaloDias ? `Frequência: Ciclo de ${modalDescricao.tarefa.intervaloDias} dias` : 'Demanda Pontual'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="bg-white/5 border border-white/5 p-5 sm:p-6 rounded-[2rem]">
                                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Especificações:</p>
                                                <p className="text-slate-300 text-sm font-medium leading-relaxed italic whitespace-pre-wrap">
                                                    {modalDescricao.tarefa.descricao || "Executar conforme diretrizes gerais da unidade de operação."}
                                                </p>
                                            </div>

                                            <div className="bg-white/5 border border-white/5 p-5 sm:p-6 rounded-[2rem]">
                                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Horário previsto para início:</p>
                                                <p className="flex items-center gap-2 text-slate-300 text-sm font-medium leading-relaxed italic">
                                                    <Clock size={12} className="text-indigo-500" />
                                                    {modalDescricao.tarefa.horario || "Sem horário de início"}
                                                </p>
                                            </div>

                                            {modalDescricao.tarefa.dataInicio && (
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="bg-white/[0.02] p-4 sm:p-5 rounded-2xl border border-white/5">
                                                        <p className="text-[8px] font-black text-slate-600 uppercase mb-1">Iniciado Em</p>
                                                        <p className="text-xs sm:text-sm font-black text-white">
                                                            {new Date(String(modalDescricao.tarefa.dataInicio).split('T')[0] + 'T00:00:00').toLocaleDateString('pt-BR')}
                                                        </p>
                                                    </div>
                                                    <div className="bg-indigo-600/10 p-4 sm:p-5 rounded-2xl border border-indigo-500/20">
                                                        <p className="text-[8px] font-black text-indigo-400 uppercase mb-1 text-center">Próximo Salto</p>
                                                        <div className="text-center">
                                                            {(() => {
                                                                const intervalo = Number(modalDescricao.tarefa?.intervaloDias);
                                                                if (!intervalo) return <p className="text-xs sm:text-sm font-black text-white">Único</p>;

                                                                let proxima = new Date(String(modalDescricao.tarefa?.dataInicio).split('T')[0] + 'T00:00:00');
                                                                const ref = new Date(dataSelecionada);
                                                                ref.setHours(0, 0, 0, 0);

                                                                while (proxima <= ref) {
                                                                    proxima.setDate(proxima.getDate() + intervalo);
                                                                    if (proxima.getDay() === 6) proxima.setDate(proxima.getDate() - 1);
                                                                    if (proxima.getDay() === 0) proxima.setDate(proxima.getDate() + 1);
                                                                }
                                                                return (
                                                                    <>
                                                                        <p className="text-xs sm:text-sm font-black text-white">{proxima.toLocaleDateString('pt-BR')}</p>
                                                                        <p className="text-[9px] font-bold text-indigo-400/60 uppercase italic">Salto Programado</p>
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-6 mt-auto">
                                        <button
                                            onClick={() => setModalDescricao({ show: false, tarefa: null })}
                                            className="cursor-pointer w-full py-4 sm:py-5 bg-indigo-600 hover:bg-indigo-500 rounded-2xl text-[12px] font-black uppercase text-white shadow-xl shadow-indigo-500/20 transition-all active:scale-95"
                                        >
                                            Fechar Diretriz
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>


                    <AnimatePresence>
                        {modalDiretriz.show && modalDiretriz.tarefa && (
                            <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setModalDiretriz({ show: false, tarefa: null })}
                                    className="absolute inset-0 bg-black/90 backdrop-blur-md"
                                />
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.9, opacity: 0 }}
                                    className="relative w-full max-w-lg bg-[#050a18] border border-indigo-500/20 p-10 rounded-[3rem] shadow-2xl overflow-hidden"
                                >
                                    <div className={`absolute top-0 left-0 w-full h-1.5 transition-colors ${reservasConcluidas.includes(modalDiretriz.tarefa.id) ? 'bg-emerald-500' : 'bg-indigo-500'}`} />

                                    <div className="flex justify-between items-start mb-8">
                                        <div>
                                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Diretriz de Ambiente</span>
                                            <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mt-1">
                                                {modalDiretriz.tarefa.texto.replace("OCUPAÇÃO: ", "")}
                                            </h2>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="bg-indigo-500/5 border border-indigo-500/10 p-6 rounded-3xl">
                                            <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                <Info size={14} /> Rotina
                                            </p>
                                            <p className="text-slate-300 text-sm leading-relaxed font-medium whitespace-pre-wrap">
                                                {modalDiretriz.tarefa.descricao}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between px-2">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-indigo-400">
                                                    <Clock size={14} />
                                                </div>
                                                <div>
                                                    <p className="text-[8px] font-black text-slate-500 uppercase">Horário Reservado</p>
                                                    <p className="text-[10px] font-bold text-white uppercase">{modalDiretriz.tarefa.horario}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[8px] font-black text-slate-500 uppercase">Responsável</p>
                                                <p className="text-[10px] font-bold text-indigo-400 uppercase italic">@{modalDiretriz.tarefa.responsavel}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mt-10">
                                        <button
                                            onClick={() => setModalDiretriz({ show: false, tarefa: null })}
                                            className="cursor-pointer py-5 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/5"
                                        >
                                            Fechar
                                        </button>
                                        <button
                                            onClick={() => {
                                                toggleConcluirReserva(modalDiretriz.tarefa!.id);
                                                setModalDiretriz({ show: false, tarefa: null });
                                            }}
                                            className={`cursor-pointer py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-lg ${reservasConcluidas.includes(modalDiretriz.tarefa.id)
                                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-500'
                                                : 'bg-emerald-600 border-emerald-400 text-white shadow-emerald-500/20'
                                                }`}
                                        >
                                            {reservasConcluidas.includes(modalDiretriz.tarefa.id) ? 'Reabrir' : 'Concluir'}
                                        </button>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>
                </>
        </div>
    );
}