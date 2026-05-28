'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ChevronUp, ChevronDown, Edit3, Check, X, Trash2, GripVertical } from 'lucide-react'
import { renomearPasta } from '@/actions/RenamePastas'
import type { Documento } from '../_types'

interface Props {
  pasta: string
  ficharioAtivo: string
  documentos: Documento[]
  onClose: () => void
  onSalvar: (docsReordenados: Documento[]) => Promise<void>
  onExcluir: (doc: Documento) => void
  onRenomear: (nomeNovo: string) => void
}

export function PopModalConfigurarPasta({
  pasta, ficharioAtivo, documentos, onClose, onSalvar, onExcluir, onRenomear,
}: Props) {
  const [docsLocais, setDocsLocais] = useState<Documento[]>(documentos)
  const [editandoNome, setEditandoNome] = useState(false)
  const [novoNome, setNovoNome] = useState(pasta)
  const [salvando, setSalvando] = useState(false)

  const moverUp = (index: number) => {
    if (index === 0) return
    const lista = [...docsLocais]
    ;[lista[index - 1], lista[index]] = [lista[index], lista[index - 1]]
    setDocsLocais(lista)
  }

  const moverDown = (index: number) => {
    if (index === docsLocais.length - 1) return
    const lista = [...docsLocais]
    ;[lista[index + 1], lista[index]] = [lista[index], lista[index + 1]]
    setDocsLocais(lista)
  }

  const handleSalvarNome = async () => {
    const res = await renomearPasta(ficharioAtivo, pasta, novoNome)
    if (res.success && (res.count ?? 0) > 0) {
      toast.success("Pasta renomeada!")
      onRenomear(novoNome.toUpperCase().trim())
      setEditandoNome(false)
    } else {
      toast.error("Erro ao renomear pasta.")
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md">
      <div className="bg-slate-900 border border-white/10 w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl">
        <header className="flex flex-col items-center mb-8 text-center">
          <div className="h-1.5 w-16 bg-blue-600 rounded-full mb-6" />
          <div className="flex items-center gap-3">
            {editandoNome ? (
              <div className="flex items-center gap-2 bg-black/40 border border-blue-500/50 rounded-2xl p-2">
                <input
                  autoFocus
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value.toUpperCase())}
                  className="bg-transparent border-none text-lg font-black uppercase text-white px-4 outline-none"
                />
                <button onClick={handleSalvarNome} className="p-3 bg-emerald-600 rounded-xl text-white">
                  <Check size={18} />
                </button>
                <button onClick={() => setEditandoNome(false)} className="p-3 bg-white/5 rounded-xl text-slate-400">
                  <X size={18} />
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-black uppercase text-white">Configurar: {pasta}</h2>
                <Edit3
                  size={18}
                  onClick={() => { setEditandoNome(true); setNovoNome(pasta) }}
                  className="cursor-pointer text-slate-500 hover:text-blue-400"
                />
              </>
            )}
          </div>
        </header>

        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
          {docsLocais.map((doc, index) => (
            <div key={doc.id} className="flex items-center gap-4 p-4 bg-black/40 border border-white/5 rounded-2xl group">
              <div className="flex flex-col gap-1">
                <button onClick={() => moverUp(index)} className="text-slate-600 hover:text-blue-400">
                  <ChevronUp size={16} />
                </button>
                <button onClick={() => moverDown(index)} className="text-slate-600 hover:text-blue-400">
                  <ChevronDown size={16} />
                </button>
              </div>
              <div className="flex-1 text-xs font-black uppercase text-slate-200">{doc.titulo}</div>
              <button
                onClick={() => onExcluir(doc)}
                className="px-4 py-2 bg-red-600/10 text-red-500 rounded-xl text-[9px] font-black uppercase border border-red-600/20"
              >
                <Trash2 size={14} />
              </button>
              <GripVertical size={14} className="text-slate-700" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 mt-10">
          <button onClick={onClose} className="py-5 bg-white/5 text-slate-400 rounded-[1.5rem] text-[10px] font-black uppercase hover:bg-white/10 transition-colors">
            Descartar
          </button>
          <button
            disabled={salvando}
            onClick={async () => {
              setSalvando(true)
              await onSalvar(docsLocais)
              setSalvando(false)
            }}
            className="py-5 bg-blue-600 text-white rounded-[1.5rem] text-[10px] font-black uppercase shadow-xl shadow-blue-900/40 hover:bg-blue-500 transition-colors disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
      </div>
    </div>
  )
}
