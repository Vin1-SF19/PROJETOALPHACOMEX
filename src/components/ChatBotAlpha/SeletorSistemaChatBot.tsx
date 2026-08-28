'use client';

import { Database, Layers3, Mail, LoaderCircle } from 'lucide-react';
import type { SistemaChatBot } from '@/actions/ChatBotAlpha';

const OPCOES: { id: SistemaChatBot; label: string; desc: string; icon: typeof Database }[] = [
  { id: 'adminer', label: 'Adminer', desc: 'Cliente do banco de dados (Postgres).', icon: Database },
  { id: 'redis', label: 'Redis', desc: 'Console do cache/fila (RedisInsight).', icon: Layers3 },
  { id: 'mailhog', label: 'MailHog', desc: 'Caixa de e-mails de teste capturados.', icon: Mail },
];

interface SeletorSistemaChatBotProps {
  onEscolher: (sistema: SistemaChatBot) => void;
  carregando: boolean;
  erro: string | null;
}

export function SeletorSistemaChatBot({ onEscolher, carregando, erro }: SeletorSistemaChatBotProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 bg-[#020617] p-6">
      <div className="text-center">
        <h1 className="text-lg font-black uppercase italic tracking-tight text-white">ChatBot Alpha</h1>
        <p className="text-xs text-slate-500 mt-1">Escolha o sistema que deseja acessar.</p>
      </div>

      {erro && (
        <p className="text-xs text-red-400 font-medium">{erro}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
        {OPCOES.map(({ id, label, desc, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onEscolher(id)}
            disabled={carregando}
            className="flex flex-col items-center gap-3 p-6 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-wait"
          >
            {carregando ? (
              <LoaderCircle size={28} className="text-emerald-400 animate-spin" />
            ) : (
              <Icon size={28} className="text-emerald-400" />
            )}
            <span className="text-sm font-black uppercase tracking-tight text-white">{label}</span>
            <span className="text-[11px] text-slate-500 text-center leading-snug">{desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
