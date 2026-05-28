'use client'

import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'

interface Props {
  pageAtual: number
  numPages: number
  scale: number
  onPageChange: (page: number) => void
  onScaleChange: (scale: number) => void
}

export function PopPdfToolbar({ pageAtual, numPages, scale, onPageChange, onScaleChange }: Props) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-white/5 flex-shrink-0">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, pageAtual - 1))}
          disabled={pageAtual <= 1}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all text-slate-400"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-[10px] font-black text-slate-400 uppercase tabular-nums">
          {pageAtual} / {numPages || '—'}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(numPages, pageAtual + 1))}
          disabled={pageAtual >= numPages || numPages === 0}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all text-slate-400"
        >
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onScaleChange(Math.max(0.5, parseFloat((scale - 0.2).toFixed(1))))}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-slate-400"
        >
          <ZoomOut size={14} />
        </button>
        <span className="text-[10px] font-black text-slate-400 uppercase tabular-nums w-10 text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() => onScaleChange(Math.min(3, parseFloat((scale + 0.2).toFixed(1))))}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-all text-slate-400"
        >
          <ZoomIn size={14} />
        </button>
      </div>
    </div>
  )
}
