"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from "next-auth/react";
import { Calendar as CalendarIcon, Clock, User as UserIcon, LayoutDashboard, Edit3, Trash2, ArrowRight, XCircle, AlertCircle, Coffee } from 'lucide-react';
import { toast } from 'sonner';
import { DayPicker } from 'react-day-picker';
import { ptBR } from 'date-fns/locale';
import 'react-day-picker/dist/style.css';
import { agendarSala, buscarReservasAtivas, cancelarReserva, buscarHistoricoReservas, editarReserva as editarReservaAction } from '@/actions/Reservas';

import { getTema } from '@/lib/temas';
import { isAdminRole } from '@/lib/roles';

export default function ReservaSalas() {
  const { data: session, status } = useSession();
  const [reservas, setReservas] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [reservaEditando, setReservaEditando] = useState<any>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [isPending, setIsPending] = useState(false);

  const temaNome = (session?.user as any)?.tema_interface || "blue";
  const style = getTema(temaNome);
  const usuarioLogado = session?.user?.nome || (session?.user as any)?.usuario || "Usuário";
  const isAdmin = isAdminRole(session?.user?.role);

  const atualizar = useCallback(async () => {
    const [ativos, passados] = await Promise.all([buscarReservasAtivas(), buscarHistoricoReservas()]);
    setReservas(ativos);
    setHistorico(passados);
  }, []);

  const [form, setForm] = useState({
    sala: "",
    inicio: "09:00",
    fim: "10:00",
    tipo: "",
    paoDeQueijo: true,
    motivo: ""
  });

  useEffect(() => {
    if (status === "authenticated") atualizar();
  }, [status, atualizar]);

  const handleInicioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const novoInicio = e.target.value;
    const [horas, minutos] = novoInicio.split(':').map(Number);
    const novaHoraFim = `${String((horas + 1) % 24).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
    setForm({ ...form, inicio: novoInicio, fim: novaHoraFim });
  };

  const handleEditInicioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const novoInicio = e.target.value;
    const [horas, minutos] = novoInicio.split(':').map(Number);
    const novaHoraFim = `${String((horas + 1) % 24).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
    setReservaEditando({ ...reservaEditando, inicioStr: novoInicio, fimStr: novaHoraFim });
  };

  const handleAgendar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    const novosErros = [];
    if (!form.sala) novosErros.push('sala');
    if (!form.tipo) novosErros.push('tipo');
    if (!form.motivo) novosErros.push('motivo');

    if (novosErros.length > 0) {
      setErros(novosErros);
      toast.error("Preencha todos os campos obrigatórios");

      setIsPending(false);
      return;
    }

    setErros([]);

    if (!selectedDate) return toast.error("Selecione uma data");

    const dataAjustada = selectedDate.toLocaleDateString('en-CA');
    const res = await agendarSala({
      ...form,
      data: dataAjustada,
    });

    if (res.success) {
      toast.success("Protocolo de Reserva Confirmado!");
      setForm({ ...form, tipo: "", motivo: "" });

      setIsPending(false);
      atualizar();
    } else {
      toast.error(res.error || "Erro ao agendar");
      setErros(['inicio', 'fim']);
    }
  };

  const handleExcluir = async (id: number) => {
    if (!confirm("Deseja cancelar esta reserva?")) return;
    const res = await cancelarReserva(id);
    if (res.success) {
      setReservaEditando(null);
      toast.success("Reserva Removida!");
      atualizar();
    }
  };

  const formatarHora = (dataStr: string) => {
    return new Date(dataStr).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo'
    });
  };

  const formatarDataParaInput = (dataStr: string) => {
    return new Date(dataStr).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  };

  const reservasDoDia = reservas.filter(r => {
    const dataReserva = new Date(r.inicio).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const dataSelecionada = selectedDate?.toLocaleDateString('pt-BR');
    return dataReserva === dataSelecionada;
  }).sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());

  return (
    <div className="min-h-screen bg-[#020617] p-4 md:p-8 text-slate-200 selection:bg-alpha/30">
      <style>{`
        .rdp { --rdp-accent-color: rgb(var(--alpha-primary)); --rdp-background-color: #1e293b; margin: 0; }
        .rdp-day_selected { background-color: var(--rdp-accent-color) !important; font-weight: 900 !important; }
        .rdp-button:hover:not([disabled]):not(.rdp-day_selected) { background-color: rgba(var(--alpha-primary), 0.2); }
      `}</style>

      <div className={`mx-auto max-w-[1600px] mb-10 rounded-[2.5rem] border ${style.border} bg-slate-900/20 backdrop-blur-3xl p-8 flex flex-col lg:flex-row items-center justify-between gap-6 shadow-2xl ring-1 ring-white/5`}>
        <div className="flex items-center gap-6">
          <div className={`h-16 w-16 rounded-3xl ${style.bg} flex items-center justify-center text-white shadow-2xl`}>
            <LayoutDashboard size={32} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">
              Reserva de <span className={style.text}>Salas</span>
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <div className={`px-3 py-1 rounded-xl ${style.glow} border ${style.border} flex items-center gap-2`}>
                <UserIcon size={12} className={style.text} />
                <span className={`${style.text} font-black uppercase text-[10px] tracking-widest italic`}>@{usuarioLogado}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-[1600px] mx-auto">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900/40 border border-white/5 rounded-[3rem] p-8 shadow-2xl backdrop-blur-xl">
            <h2 className="text-xs font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-3 text-slate-500">
              <CalendarIcon size={18} className={style.text} /> Calendário Operacional
            </h2>
            <div className="flex justify-center bg-black/40 rounded-[2rem] border border-white/5 p-4 shadow-inner">
              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={ptBR}
                className="text-white font-bold"
              />
            </div>

            <form onSubmit={handleAgendar} className="mt-8 space-y-5">
              <div className="grid grid-cols-2 gap-3">

                <div className="group">
                  <label className={`text-[9px] uppercase font-black ml-1 tracking-widest ${erros.includes('sala') ? 'text-rose-500' : 'text-slate-500'}`}>Ambiente</label>
                  <select
                    className={`w-full h-14 bg-black/40 border ${erros.includes('sala') ? 'border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.1)]' : 'border-white/5'} rounded-2xl px-4 text-[10px] font-black uppercase text-white focus:border-alpha outline-none transition-all mt-1 appearance-none cursor-pointer`}
                    value={form.sala}
                    onChange={e => {
                      setForm({ ...form, sala: e.target.value });
                      setErros(erros.filter(item => item !== 'sala'));
                    }}
                  >
                    <option value="">SELECIONE A SALA...</option>
                    <option value="Sala de Reuniões">SALA DE REUNIÕES</option>
                    <option value="Sala Xangai">SALA XANGAI</option>
                    <option value="Sala Los Angeles">SALA LOS ANGELES</option>
                  </select>
                </div>

                <div className="group">
                  <label className={`text-[9px] uppercase font-black ml-1 tracking-widest ${erros.includes('tipo') ? 'text-rose-500' : 'text-slate-500'}`}>Tipo de Reserva</label>
                  <select
                    className={`w-full h-14 bg-black/40 border ${erros.includes('tipo') ? 'border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.1)]' : 'border-white/5'} rounded-2xl px-4 text-[10px] font-black uppercase text-white focus:border-alpha outline-none transition-all mt-1 appearance-none cursor-pointer`}
                    value={form.tipo}
                    onChange={e => {
                      setForm({ ...form, tipo: e.target.value });
                      setErros(erros.filter(item => item !== 'tipo'));
                    }}
                  >
                    <option value="">SELECIONE...</option>
                    <option value="Cliente">CLIENTE</option>
                    <option value="Equipe">EQUIPE</option>
                  </select>
                </div>
              </div>


              {form.tipo === "Cliente" && (
                <div className="bg-amber-500/5 border bor'der-amber-500/20 rounded-2xl p-4 flex items-center justify-between animate-in zoom-in duration-300">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-500">
                      <Coffee size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-white uppercase tracking-widest leading-none mb-1">Serviço de Copa</p>
                      <p className="text-[9px] font-bold text-amber-500/60 uppercase">Pão de queijo incluso?</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, paoDeQueijo: !form.paoDeQueijo })}
                    className={`w-12 h-6 rounded-full transition-all relative ${form.paoDeQueijo ? 'bg-amber-500' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${form.paoDeQueijo ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              )}

              <div className="group space-y-2">
                <label className={`text-[9px] uppercase font-black ml-1 tracking-widest transition-colors ${erros.includes('motivo') ? 'text-rose-500' : 'text-slate-500 group-focus-within:text-indigo-400'}`}>
                  Motivo do Agendamento
                </label>
                <div className="relative flex items-center">
                  <div className={`absolute left-5 ${erros.includes('motivo') ? 'text-rose-500' : 'text-slate-500 group-focus-within:text-indigo-500'}`}>
                    <Edit3 size={16} />
                  </div>
                  <input
                    type="text"
                    placeholder={erros.includes('motivo') ? "ESTE CAMPO É OBRIGATÓRIO" : "EX: REUNIÃO DE ALINHAMENTO..."}
                    value={form.motivo}
                    onChange={(e) => {
                      setForm({ ...form, motivo: e.target.value });
                      setErros(erros.filter(item => item !== 'motivo'));
                    }}
                    className={`w-full h-14 bg-black/40 border ${erros.includes('motivo') ? 'border-rose-500/50 placeholder:text-rose-500/50' : 'border-white/5'} rounded-2xl pl-14 pr-5 text-[11px] font-black  text-white outline-none focus:border-indigo-500/50 transition-all`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="group">
                  <label className={`text-[10px] uppercase font-black ml-1 tracking-widest ${erros.includes('inicio') ? 'text-rose-500' : 'text-slate-600'}`}>Início</label>
                  <input
                    type="time"
                    value={form.inicio}
                    onChange={handleInicioChange}
                    className={`w-full h-14 bg-black/40 border ${erros.includes('inicio') ? 'border-rose-500/50 text-rose-500' : 'border-white/5'} rounded-2xl px-5 text-[11px] font-black text-white focus:border-alpha outline-none transition-all mt-2`}
                  />
                </div>
                <div className="group">
                  <label className={`text-[10px] uppercase font-black ml-1 tracking-widest ${erros.includes('fim') ? 'text-rose-500' : 'text-slate-600'}`}>Término</label>
                  <input
                    type="time"
                    value={form.fim}
                    onChange={e => setForm({ ...form, fim: e.target.value })}
                    className={`w-full h-14 bg-black/40 border ${erros.includes('fim') ? 'border-rose-500/50 text-rose-500' : 'border-white/5'} rounded-2xl px-5 text-[11px] font-black text-white focus:border-alpha outline-none transition-all mt-2`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending || status !== "authenticated"}
                className={`cursor-pointer w-full h-16 ${style.bg} hover:brightness-110 text-white font-black rounded-2xl transition-all active:scale-95 shadow-xl uppercase text-[11px] tracking-[0.4em] flex items-center justify-center gap-3 group mt-4 disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processando...
                  </span>
                ) : status === "loading" ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Carregando sessão...
                  </span>
                ) : (
                  "Confirmar Reserva "
                )}
                {status === "authenticated" && !isPending && <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />}
              </button>

            </form>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <div className="bg-slate-900/20 border border-white/5 rounded-[3rem] p-10 min-h-[700px] backdrop-blur-xl shadow-2xl relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-64 h-64 ${style.glow} blur-[120px] opacity-10`} />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12">
              <h3 className="text-xl font-black text-white uppercase italic tracking-tighter flex items-center gap-3">
                <Clock className={style.text} size={24} /> Agenda do Dia
              </h3>
              <span className={`text-[10px] font-black ${style.text} ${style.glow} px-6 py-3 rounded-2xl border ${style.border} uppercase tracking-widest italic`}>
                {selectedDate?.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </span>
            </div>

            {/*QUADRO DE RESERVAS*/}
            <div className="space-y-4">
              {reservasDoDia.length > 0 ? (
                reservasDoDia.map(r => (
                  <div
                    key={r.id}
                    onClick={() => (isAdmin || r.usuario === usuarioLogado) && setReservaEditando({
                      ...r,
                      dataStr: formatarDataParaInput(r.inicio),
                      inicioStr: formatarHora(r.inicio),
                      fimStr: formatarHora(r.fim)
                    })}
                    className={`group relative ml-4 pl-8 py-6 border-l-4 ${style.border.replace('20', '100').replace('border-', 'border-l-')} bg-slate-900/40 hover:bg-slate-800/60 rounded-r-3xl transition-all cursor-pointer border-y border-r border-white/5 shadow-lg`}
                  >
                    <div className={`absolute -left-[11px] top-1/2 -translate-y-1/2 w-5 h-5 ${style.bg} rounded-full ring-4 ring-[#020617]`} />
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col gap-1.5">

                        {r.tipo && (
                          <div className="flex gap-1.5 animate-in fade-in zoom-in duration-500 mb-0.5">
                            <span className={`text-[8px] font-black px-2 py-0.5 rounded border uppercase tracking-widest ${r.tipo === 'Cliente'
                              ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                              : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                              }`}>
                              {r.tipo}
                            </span>

                            {r.tipo === 'Cliente' && (Number(r.paoDeQueijo) === 1) && (
                              <span className="bg-emerald-500/10 text-emerald-500 text-[8px] font-black px-2 py-0.5 rounded border border-emerald-500/20 uppercase flex items-center gap-1">
                                Copa OK <Coffee size={8} />
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex flex-col">
                          <p className="text-white font-black text-xl uppercase italic tracking-tighter leading-none flex items-baseline gap-2">

                            <span>{r.sala}</span>

                            {r.motivo && <span className="text-indigo-500/50 text-sm">/</span>}

                            {r.motivo && (
                              <span className="text-slate-400 text-sm font-bold normal-case tracking-normal italic opacity-80">
                                {r.motivo}
                              </span>
                            )}
                          </p>

                          <p className={`${style.text} font-black text-[10px] uppercase tracking-[0.2em] mt-2 opacity-80`}>
                            {formatarHora(r.inicio)} — {formatarHora(r.fim)}
                          </p>
                        </div>


                      </div>
                      <div className="flex items-center gap-6 pr-4">
                        <div className="text-right">
                          <p className="text-[9px] uppercase font-black text-slate-600 tracking-widest">Responsável</p>
                          <p className="text-xs font-black text-slate-300 italic">@{r.usuario}</p>
                        </div>
                        {(isAdmin || r.usuario === usuarioLogado) && <Edit3 size={18} className="text-slate-600 group-hover:text-white transition-colors" />}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-32 text-slate-700 italic">
                  <CalendarIcon size={64} className="mb-4 opacity-10" />
                  <p className="font-black uppercase text-xs tracking-[0.3em]">Nenhum protocolo agendado</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {reservaEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-[#0b1220] border border-white/10 p-10 rounded-[3rem] w-full max-w-md shadow-2xl relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-1 ${style.bg}`} />
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-black text-white uppercase italic tracking-tighter">Gerenciar Reserva</h2>
              <button onClick={() => setReservaEditando(null)} className="text-slate-500 hover:text-white transition-colors">
                <XCircle size={24} />
              </button>
            </div>
            <div className="space-y-5">
              <div className="group">
                <label className="text-[10px] uppercase font-black text-slate-600 ml-1 tracking-widest">Ambiente</label>
                <select
                  value={reservaEditando.sala}
                  onChange={e => setReservaEditando({ ...reservaEditando, sala: e.target.value })}
                  className="w-full h-14 bg-black/40 border border-white/5 rounded-2xl px-5 text-[11px] font-black uppercase text-white mt-2 outline-none focus:border-alpha transition-all"
                >
                  <option value="Sala de Reuniões">SALA DE REUNIÕES</option>
                  <option value="Sala Xangai">SALA XANGAI</option>
                  <option value="Sala Los Angeles">SALA LOS ANGELES</option>
                </select>

              </div>
              <div className="grid grid-cols-1 gap-5">
                <div className="group">
                  <label className="text-[10px] uppercase font-black text-slate-600 ml-1 tracking-widest">Data do Evento</label>
                  <input type="date" value={reservaEditando.dataStr} onChange={e => setReservaEditando({ ...reservaEditando, dataStr: e.target.value })} className="w-full h-14 bg-black/40 border border-white/5 rounded-2xl px-5 text-[11px] font-black text-white mt-2 outline-none focus:border-alpha" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="group">
                    <label className="text-[10px] uppercase font-black text-slate-600 ml-1 tracking-widest">Início</label>
                    <input type="time" value={reservaEditando.inicioStr} onChange={handleEditInicioChange} className="w-full h-14 bg-black/40 border border-white/5 rounded-2xl px-5 text-[11px] font-black text-white mt-2 outline-none focus:border-alpha" />
                  </div>
                  <div className="group">
                    <label className="text-[10px] uppercase font-black text-slate-600 ml-1 tracking-widest">Término</label>
                    <input type="time" value={reservaEditando.fimStr} onChange={e => setReservaEditando({ ...reservaEditando, fimStr: e.target.value })} className="w-full h-14 bg-black/40 border border-white/5 rounded-2xl px-5 text-[11px] font-black text-white mt-2 outline-none focus:border-alpha" />
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 pt-6">
                <button
                  onClick={() => editarReservaAction(reservaEditando.id, { data: reservaEditando.dataStr, inicio: reservaEditando.inicioStr, fim: reservaEditando.fimStr, sala: reservaEditando.sala }).then((res: any) => {
                    if (res.success) { toast.success("Protocolo Atualizado!"); setReservaEditando(null); atualizar(); } else { toast.error(res.error); }
                  })}
                  className={`cursor-pointer w-full h-14 ${style.bg} text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] hover:brightness-110 transition-all shadow-lg shadow-black/40`}
                >
                  Salvar Alterações
                </button>
                <button
                  onClick={() => handleExcluir(reservaEditando.id)}
                  className="cursor-pointer w-full h-14 bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-600 hover:text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.3em] flex items-center justify-center gap-3 transition-all"
                >
                  <AlertCircle size={16} /> Excluir Registro
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
