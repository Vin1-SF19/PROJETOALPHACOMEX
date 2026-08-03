'use client';

import { useState, useEffect, useTransition } from 'react';
import { motion } from 'framer-motion';
import { Bell, BellRing, Lock, Clock } from 'lucide-react';
import { toast } from 'sonner';
import {
  dispararAlerteInicial,
  dispararAlerteFinal,
  getEstadoAlerta,
  type EstadoAlerta,
} from '@/actions/HoleriteAlertas';
import { isAdminRole } from '@/lib/roles';

const ROLES_ALERTA = ['FINANCEIRO', 'RECURSOS HUMANOS'];

interface Props {
  role: string;
}

function diasRestantes(primeiroAlertaEm: string): number {
  const inicio = new Date(primeiroAlertaEm);
  const alvo = new Date(inicio);
  alvo.setDate(alvo.getDate() + 4);
  const diff = alvo.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function HoleriteAlertButtons({ role }: Props) {
  const [estado, setEstado] = useState<EstadoAlerta | null>(null);
  const [pendingInicial, startInicial] = useTransition();
  const [pendingFinal, startFinal] = useTransition();

  const podeVer = isAdminRole(role) || ROLES_ALERTA.includes(role);

  useEffect(() => {
    if (!podeVer) return;
    getEstadoAlerta().then(setEstado);
  }, [podeVer]);

  if (!podeVer || !estado) return null;

  const diasFalta = estado.primeiroAlertaEm
    ? diasRestantes(estado.primeiroAlertaEm)
    : null;
  const button2Locked = !estado.podeEnviarFinal;

  function handleInicial() {
    startInicial(async () => {
      const res = await dispararAlerteInicial();
      if (res.ok) {
        toast.success('Alerta inicial enviado para todos os colaboradores');
        getEstadoAlerta().then(setEstado);
      } else {
        toast.error(res.error ?? 'Erro ao enviar alerta');
      }
    });
  }

  function handleFinal() {
    startFinal(async () => {
      const res = await dispararAlerteFinal();
      if (res.ok) {
        toast.success('Alerta final enviado para todos os colaboradores');
        getEstadoAlerta().then(setEstado);
      } else {
        toast.error(res.error ?? 'Erro ao enviar alerta');
      }
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center gap-3 p-4 rounded-2xl border border-white/5 bg-slate-900/40"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">
          Alertas Globais
        </p>
        <p className="text-[11px] text-slate-400 font-bold">
          Notifique todos os colaboradores sobre os holerites
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Botão 1 — Alerta Inicial */}
        <button
          onClick={handleInicial}
          disabled={pendingInicial}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-wider hover:bg-amber-500/20 hover:border-amber-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Bell size={13} />
          {pendingInicial ? 'Enviando...' : 'Notificar Holerites Disponíveis'}
        </button>

        {/* Botão 2 — Alerta Final */}
        <div className="relative group">
          <button
            onClick={handleFinal}
            disabled={button2Locked || pendingFinal}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
              button2Locked
                ? 'bg-slate-800/50 border border-white/5 text-slate-600 cursor-not-allowed'
                : 'bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/40 disabled:opacity-50'
            }`}
          >
            {button2Locked ? <Lock size={13} /> : <BellRing size={13} />}
            {pendingFinal ? 'Enviando...' : 'Enviar Alerta Final'}
          </button>

          {button2Locked && diasFalta !== null && (
            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-[9px] font-bold text-slate-400 whitespace-nowrap shadow-xl">
              <Clock size={10} />
              {diasFalta === 0 ? 'Disponível em breve' : `Disponível em ${diasFalta} dia${diasFalta !== 1 ? 's' : ''}`}
            </div>
          )}

          {button2Locked && !estado.primeiroAlertaEm && (
            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-[9px] font-bold text-slate-400 whitespace-nowrap shadow-xl">
              <Lock size={10} />
              Envie o alerta inicial primeiro
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
