'use client'

import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

import type { Documento } from '../_types'
import { PopPdfToolbar } from './PopPdfToolbar'
import { PopPdfSkeleton } from './PopPdfSkeleton'
import { PopPdfErrorState } from './PopPdfErrorState'
import { PopWatermark } from './PopWatermark'
import { useSecurityShortcuts } from '../_hooks/useSecurityShortcuts'

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface Props {
  doc: Documento
  userName: string
}

export function PopPdfViewer({ doc, userName }: Props) {
  const [numPages, setNumPages] = useState(0)
  const [pageAtual, setPageAtual] = useState(1)
  const [scale, setScale] = useState(1.2)

  const protegido = doc.protecao === 'ATIVO'

  useSecurityShortcuts(protegido)

  if (doc.tipo === 'VIDEO') {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <video controls className="w-full h-full max-h-full" src={doc.url} />
      </div>
    )
  }

  return (
    <div className={`relative w-full h-full flex flex-col bg-slate-950 ${protegido ? 'select-none' : ''}`}>
      <PopPdfToolbar
        pageAtual={pageAtual}
        numPages={numPages}
        scale={scale}
        onPageChange={(p) => { setPageAtual(p) }}
        onScaleChange={setScale}
      />
      <div className="flex-1 overflow-auto p-4 flex justify-center">
        <Document
          file={doc.url}
          externalLinkTarget="_blank"
          onLoadSuccess={({ numPages: n }) => { setNumPages(n); setPageAtual(1) }}
          loading={<PopPdfSkeleton />}
          error={<PopPdfErrorState titulo={doc.titulo} />}
        >
          <Page
            pageNumber={pageAtual}
            scale={scale}
            renderTextLayer={!protegido}
            renderAnnotationLayer={true}
            className="shadow-2xl"
          />
        </Document>
      </div>
      {protegido && <PopWatermark userName={userName} />}
    </div>
  )
}
