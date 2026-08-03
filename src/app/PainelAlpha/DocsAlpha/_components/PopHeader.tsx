'use client'

import { ShieldCheck, Upload, History, KeyRound } from 'lucide-react'
import Link from 'next/link'
import type { AcessosPop } from '../_types'
import { isSameRole } from '@/lib/roles'

const SETORES = [
  "Diretrizes", "T.I", "OPERACIONAL", "COMERCIAL",
  "RECURSOS HUMANOS", "FINANCEIRO", "JURÍDICO", "PARCEIRO", "SERVIÇOS GERAIS",
]

interface Props {
  roleUser: string
  setorAtivo: string
  acessosPop: AcessosPop
  onSetorChange: (setor: string) => void
  onAcessosOpen: () => void
}

export function PopHeader({ roleUser, setorAtivo, acessosPop, onSetorChange, onAcessosOpen }: Props) {
  return (
    <div className="p-5 bg-slate-900/40 rounded-[2rem] border border-white/5 backdrop-blur-xl flex flex-col lg:flex-row justify-between items-center gap-6">
      <div className="flex items-center gap-5">
        <div className="h-14 w-14 flex items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/20">
          <ShieldCheck size={28} />
        </div>
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter">POP</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
              Acesso: <span className="text-blue-400">{roleUser}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-4 lg:gap-6">
        {SETORES.map(s => {
          const podeVer =
            acessosPop.setoresAcessiveis.includes("*") ||
            acessosPop.setoresAcessiveis.some(sv => isSameRole(sv, s))
          if (!podeVer) return null
          return (
            <button
              key={s}
              onClick={() => onSetorChange(s)}
              className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${
                isSameRole(setorAtivo, s) ? "bg-blue-600 text-white scale-105" : "text-slate-500 hover:bg-white/5"
              }`}
            >
              {s}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {acessosPop.podeUpload && (
          <Link
            href="/PainelAlpha/GerenciamentoArquivos"
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all text-[9px] font-black uppercase tracking-widest"
          >
            <Upload size={13} /> Upload
          </Link>
        )}
        {acessosPop.podeGerenciar && (
          <Link
            href="/PainelAlpha/HistoricoArquivos"
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all text-[9px] font-black uppercase tracking-widest"
          >
            <History size={13} /> Gerenciar
          </Link>
        )}
        {acessosPop.ehAdminUser && (
          <button
            onClick={onAcessosOpen}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:text-blue-300 hover:border-blue-500/40 transition-all text-[9px] font-black uppercase tracking-widest"
          >
            <KeyRound size={13} /> Acessos
          </button>
        )}
      </div>
    </div>
  )
}
