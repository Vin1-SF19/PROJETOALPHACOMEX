'use client'

import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import { desativarDocumento } from '@/actions/DesativarDocumento'
import type { Documento } from '../_types'

interface Props {
  doc: Documento
  onClose: () => void
  onSuccess: (id: number) => void
}

export function PopModalExcluir({ doc, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)

  const handleConfirmar = async () => {
    setLoading(true)
    const res = await desativarDocumento(doc.id)
    setLoading(false)
    if (res.success) {
      toast.success("Documento desativado com sucesso!")
      onSuccess(doc.id)
    } else {
      toast.error(res.error ?? "Erro ao desativar documento")
    }
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-6 backdrop-blur-2xl bg-black/90">
      <div className="relative bg-slate-950 border-2 border-red-500/20 p-8 rounded-[3rem] max-w-sm w-full">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="p-4 bg-red-500/10 rounded-full mb-4 border border-red-500/20">
            <ShieldAlert size={44} className="text-red-500 animate-bounce" />
          </div>
          <h2 className="text-[14px] font-black uppercase text-white italic">
            Desativar <span className="text-red-500">Documento</span>
          </h2>
          <p className="text-[10px] text-slate-500 font-black uppercase mt-4 max-w-[220px] break-words">
            &ldquo;{doc.titulo}&rdquo; será desativado. Ação registrada em auditoria.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="py-4 bg-slate-900 text-slate-400 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-800 transition-colors"
          >
            Abortar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={loading}
            className="py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl shadow-red-900/40 hover:bg-red-500 transition-colors disabled:opacity-50"
          >
            {loading ? "Desativando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  )
}
