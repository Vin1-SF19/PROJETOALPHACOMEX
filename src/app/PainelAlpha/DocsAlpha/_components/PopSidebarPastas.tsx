'use client'

import { Search, Folder, ChevronRight, FileText, Video, Star, Settings } from 'lucide-react'
import type { Documento, OrdemTipo } from '../_types'

const ORDENS: { valor: OrdemTipo; label: string }[] = [
  { valor: 'PADRAO', label: 'Padrão' },
  { valor: 'recentes', label: 'Recentes' },
  { valor: 'az', label: 'A-Z' },
  { valor: 'za', label: 'Z-A' },
]

interface Props {
  ordemPastas: string[]
  documentosAgrupados: Record<string, Documento[]>
  pastasAbertas: Record<string, boolean>
  docSelecionado: Documento | null
  busca: string
  ordem: OrdemTipo
  onBuscaChange: (v: string) => void
  onOrdemChange: (v: OrdemTipo) => void
  onTogglePasta: (pasta: string) => void
  onSelectDoc: (doc: Documento) => void
  onDragDrop: (deIndex: number, paraIndex: number) => void
  onConfigPasta: (pasta: string) => void
}

export function PopSidebarPastas({
  ordemPastas, documentosAgrupados, pastasAbertas, docSelecionado,
  busca, ordem, onBuscaChange, onOrdemChange, onTogglePasta,
  onSelectDoc, onDragDrop, onConfigPasta,
}: Props) {
  return (
    <div className="lg:col-span-4 bg-slate-900/40 rounded-[2rem] border border-white/5 p-6 flex flex-col backdrop-blur-md overflow-hidden">
      <div className="relative mb-4">
        <Search className="absolute left-4 top-3.5 text-slate-600" size={16} />
        <input
          type="text"
          placeholder="BUSCAR..."
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
          className="w-full bg-black/40 border border-white/5 rounded-xl py-3.5 pl-12 text-[10px] font-bold uppercase outline-none focus:ring-1 focus:ring-blue-600/50"
        />
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar">
        {ORDENS.map(({ valor, label }) => (
          <button
            key={valor}
            onClick={() => onOrdemChange(valor)}
            className={`flex items-center gap-1 px-4 py-2 rounded-lg text-[8px] font-black uppercase border whitespace-nowrap ${
              ordem === valor
                ? 'bg-blue-600 border-blue-600 text-white shadow-lg'
                : 'bg-white/5 border-white/5 text-slate-500'
            }`}
          >
            {valor === 'PADRAO' && <Star size={10} />}
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
        {ordemPastas.map((pasta, index) => {
          const docs = documentosAgrupados[pasta]
          if (!docs) return null
          return (
            <div
              key={pasta}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("index", index.toString())}
              onDrop={(e) => {
                e.preventDefault()
                onDragDrop(parseInt(e.dataTransfer.getData("index")), index)
              }}
              onDragOver={(e) => e.preventDefault()}
              className="group/pasta relative"
            >
              <button
                onClick={() => onTogglePasta(pasta)}
                className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-950/40 border border-white/5 hover:bg-slate-900"
              >
                <div className="flex items-center gap-3">
                  <Folder size={16} className={pastasAbertas[pasta] ? "text-blue-500" : "text-slate-600"} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{pasta}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Settings
                    onClick={(e) => { e.stopPropagation(); onConfigPasta(pasta) }}
                    size={14}
                    className="opacity-0 group-hover/pasta:opacity-100 text-slate-500 hover:text-blue-400"
                  />
                  <ChevronRight size={14} className={`transition-transform ${pastasAbertas[pasta] ? "rotate-90" : ""}`} />
                </div>
              </button>
              {pastasAbertas[pasta] && (
                <div className="ml-4 pl-4 border-l border-white/10 space-y-1 mt-1">
                  {docs.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => onSelectDoc(doc)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl text-[9px] font-black uppercase transition-all ${
                        docSelecionado?.id === doc.id
                          ? "bg-blue-600/20 text-blue-400"
                          : "text-slate-500 hover:bg-white/5"
                      }`}
                    >
                      {doc.tipo === 'VIDEO' ? <Video size={14} /> : <FileText size={14} />}
                      <span className="truncate">{doc.titulo}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
