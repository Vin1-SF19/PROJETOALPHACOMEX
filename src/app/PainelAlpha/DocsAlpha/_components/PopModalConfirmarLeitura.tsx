'use client'

import { useState } from 'react'
import { BookCheck } from 'lucide-react'
import { toast } from 'sonner'
import { confirmarLeituraDocumento } from '@/actions/ConfirmacaoLeituraDocumento'
import type { Documento } from '../_types'

interface Props {
  doc: Documento
  onClose: () => void
  onSuccess: (id: number) => void
}

export function PopModalConfirmarLeitura({ doc, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)

  const handleConfirmar = async () => {
    setLoading(true)
    const res = await confirmarLeituraDocumento(doc.id)
    setLoading(false)
    if (res.success) {
      toast.success('Leitura confirmada!')
      onSuccess(doc.id)
    } else {
      toast.error(res.error ?? 'Erro ao confirmar leitura')
    }
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-6 backdrop-blur-2xl bg-black/90">
      <div className="relative bg-slate-950 border-2 border-emerald-500/20 p-8 rounded-[3rem] max-w-sm w-full">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="p-4 bg-emerald-500/10 rounded-full mb-4 border border-emerald-500/20">
            <BookCheck size={44} className="text-emerald-500" />
          </div>
          <h2 className="text-[14px] font-black uppercase text-white italic">
            Confirmar <span className="text-emerald-500">Leitura</span>
          </h2>
          <p className="text-[10px] text-slate-500 font-black uppercase mt-4 max-w-[240px] break-words">
            Você confirma a leitura do documento &ldquo;{doc.titulo}&rdquo;?
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="py-4 bg-slate-900 text-slate-400 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={loading}
            className="py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl shadow-emerald-900/40 hover:bg-emerald-500 transition-colors disabled:opacity-50"
          >
            {loading ? 'Confirmando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
