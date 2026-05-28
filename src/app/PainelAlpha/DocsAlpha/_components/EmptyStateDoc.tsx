'use client'

import { Eye } from 'lucide-react'

export function EmptyStateDoc() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center opacity-20">
      <Eye size={80} className="mb-4" />
      <p className="text-[12px] font-black uppercase tracking-[0.5em]">Aguardando Seleção</p>
    </div>
  )
}
