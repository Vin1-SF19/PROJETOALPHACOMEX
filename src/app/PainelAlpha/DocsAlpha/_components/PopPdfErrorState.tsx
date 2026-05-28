'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'

interface Props {
  titulo: string
}

export function PopPdfErrorState({ titulo }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center px-6">
      <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20">
        <AlertCircle size={32} className="text-red-400" />
      </div>
      <p className="text-xs font-black uppercase text-red-400">Erro ao carregar</p>
      <p className="text-[10px] text-slate-500 uppercase font-bold max-w-[200px] truncate">{titulo}</p>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl text-[10px] font-black text-slate-400 hover:text-white transition-all"
      >
        <RefreshCw size={12} /> Tentar novamente
      </button>
    </div>
  )
}
