'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { Lock, ShieldAlert, Globe, Folder, FileText, Video, ChevronRight, PlayCircle, BookCheck, CheckCircle2 } from 'lucide-react'

import { buscarOrdemPastas, salvarOrdemPastas } from '@/actions/OrdemPastas'
import { getAcessosDoUsuario } from '@/actions/PopAcessos'
import ModalGerenciamentoAcessos from '@/components/pop/ModalGerenciamentoAcessos'

import type { Documento, AcessosPop, OrdemTipo } from './_types'
import { PopHeader } from './_components/PopHeader'
import { PopSidebarPastas } from './_components/PopSidebarPastas'
import { PopPdfViewer } from './_components/PopPdfViewer'
import { PopModalExcluir } from './_components/PopModalExcluir'
import { PopModalConfigurarPasta } from './_components/PopModalConfigurarPasta'
import { PopModalConfirmarLeitura } from './_components/PopModalConfirmarLeitura'
import { EmptyStateDoc } from './_components/EmptyStateDoc'
import { isSameRole } from '@/lib/roles'

interface Props {
  documentosIniciais: Documento[]
  documentosConfirmadosIniciais?: number[]
}

export default function DocsAlphaClient({ documentosIniciais, documentosConfirmadosIniciais = [] }: Props) {
  const { data: session, status } = useSession()
  const [documentos, setDocumentos] = useState<Documento[]>(documentosIniciais)
  const [setorAtivo, setSetorAtivo] = useState("Diretrizes")
  const [docSelecionado, setDocSelecionado] = useState<Documento | null>(null)
  const [busca, setBusca] = useState("")
  const [ordemPastas, setOrdemPastas] = useState<string[]>([])
  const [pastasAbertas, setPastasAbertas] = useState<Record<string, boolean>>({})
  const [ordem, setOrdem] = useState<OrdemTipo>("PADRAO")
  const [docParaExcluir, setDocParaExcluir] = useState<Documento | null>(null)
  const [pastaConfig, setPastaConfig] = useState<string | null>(null)
  const [modalAcessosAberto, setModalAcessosAberto] = useState(false)
  const [docParaConfirmarLeitura, setDocParaConfirmarLeitura] = useState<Documento | null>(null)
  const [documentosConfirmados, setDocumentosConfirmados] = useState<Set<number>>(
    new Set(documentosConfirmadosIniciais)
  )
  const [acessosPop, setAcessosPop] = useState<AcessosPop>({
    setoresAcessiveis: [],
    podeUpload: false,
    podeGerenciar: false,
    ehAdminUser: false,
  })

  const roleUser = (session?.user?.role as string | undefined)?.toUpperCase().trim() ?? "USER"
  const userName = (session?.user?.nome as string | undefined) ?? "ALPHA"

  useEffect(() => {
    if (status !== "authenticated") return
    getAcessosDoUsuario().then((res) => {
      if (res.success) {
        setAcessosPop({
          setoresAcessiveis: res.setoresAcessiveis,
          podeUpload: res.podeUpload,
          podeGerenciar: res.podeGerenciar,
          ehAdminUser: res.ehAdminUser,
        })
      }
    })
  }, [status])

  const documentosAgrupados = useMemo(() => {
    const filtrados = documentos.filter(d => {
      const setorDoc = d.setor
      if (!d.titulo.toLowerCase().includes(busca.toLowerCase())) return false
      if (!isSameRole(setorDoc, setorAtivo)) return false
      const setores = acessosPop.setoresAcessiveis
      if (setores.includes("*")) return true
      return setores.some(s => isSameRole(s, setorDoc))
    })

    const agrupados = filtrados.reduce((acc, doc) => {
      const nomePasta = (doc.PastaArquivos || doc.tipo).toUpperCase()
      if (!acc[nomePasta]) acc[nomePasta] = []
      acc[nomePasta].push(doc)
      return acc
    }, {} as Record<string, Documento[]>)

    Object.keys(agrupados).forEach(pasta => {
      agrupados[pasta].sort((a, b) => {
        if (ordem === "PADRAO") return (a.ordem_manual || 0) - (b.ordem_manual || 0)
        if (ordem === "recentes") return new Date(b.data_criacao).getTime() - new Date(a.data_criacao).getTime()
        if (ordem === "az") return a.titulo.localeCompare(b.titulo)
        if (ordem === "za") return b.titulo.localeCompare(a.titulo)
        return 0
      })
    })

    return agrupados
  }, [documentos, setorAtivo, busca, acessosPop, ordem])

  useEffect(() => {
    const sincronizar = async () => {
      const ordemSalva = await buscarOrdemPastas(setorAtivo)
      const pastasExistentes = Object.keys(documentosAgrupados)
      if (ordemSalva && Array.isArray(ordemSalva)) {
        const ordemFiltrada = (ordemSalva as string[]).filter(p => pastasExistentes.includes(p))
        const novasPastas = pastasExistentes.filter(p => !(ordemSalva as string[]).includes(p))
        setOrdemPastas([...ordemFiltrada, ...novasPastas])
      } else {
        setOrdemPastas(pastasExistentes)
      }
    }
    if (setorAtivo) sincronizar()
  }, [setorAtivo, documentosAgrupados])

  const handleDragDrop = async (deIndex: number, paraIndex: number) => {
    const novaLista = [...ordemPastas]
    const [item] = novaLista.splice(deIndex, 1)
    novaLista.splice(paraIndex, 0, item)
    setOrdemPastas(novaLista)
    await salvarOrdemPastas(setorAtivo, novaLista)
    toast.success("Ordem salva!")
  }

  const handleSalvarOrdemDocs = async (docsReordenados: Documento[]) => {
    try {
      await fetch('/api/documentos/ordenar', {
        method: 'POST',
        body: JSON.stringify({
          documentos: docsReordenados.map((d, i) => ({ id: d.id, titulo: d.titulo, ordem: i })),
        }),
      })
      toast.success("Pasta sincronizada!")
      setPastaConfig(null)
    } catch {
      toast.error("Erro ao salvar")
    }
  }

  const handleExcluirSuccess = (id: number) => {
    setDocumentos(prev => prev.filter(d => d.id !== id))
    setDocParaExcluir(null)
    if (docSelecionado?.id === id) setDocSelecionado(null)
  }

  const handleConfirmarLeituraSuccess = (id: number) => {
    setDocumentosConfirmados(prev => new Set(prev).add(id))
    setDocParaConfirmarLeitura(null)
  }

  function renderBotaoConfirmarLeitura(doc: Documento) {
    const jaConfirmado = documentosConfirmados.has(doc.id)
    if (jaConfirmado) {
      return (
        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[8px] font-black uppercase tracking-widest whitespace-nowrap">
          <CheckCircle2 size={12} /> Leitura Confirmada
        </span>
      )
    }
    return (
      <button
        onClick={() => setDocParaConfirmarLeitura(doc)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:border-indigo-500/40 hover:text-indigo-400 text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap"
      >
        <BookCheck size={12} /> Confirmar Leitura
      </button>
    )
  }

  const handleRenomearPasta = (nomeAntigo: string, nomeNovo: string) => {
    setDocumentos(prev =>
      prev.map(d =>
        d.PastaArquivos?.toUpperCase() === nomeAntigo.toUpperCase()
          ? { ...d, PastaArquivos: nomeNovo.toUpperCase() }
          : d
      )
    )
    setPastaConfig(null)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 select-none overflow-x-hidden">
      <style dangerouslySetInnerHTML={{ __html: `@media print { body { display: none !important; } }` }} />

      <div className="max-w-7xl mx-auto space-y-6">
        <PopHeader
          roleUser={roleUser}
          setorAtivo={setorAtivo}
          acessosPop={acessosPop}
          onSetorChange={(s) => { setSetorAtivo(s); setDocSelecionado(null) }}
          onAcessosOpen={() => setModalAcessosAberto(true)}
        />

        {/* Mobile layout */}
        <div className="lg:hidden flex flex-col gap-4 min-h-[60vh]">
          {!docSelecionado ? (
            <div className="space-y-3">
              {ordemPastas.map((pasta) => {
                const docs = documentosAgrupados[pasta]
                if (!docs) return null
                return (
                  <div key={pasta} className="bg-slate-900/60 border border-white/5 rounded-[2rem] overflow-hidden">
                    <button
                      onClick={() => setPastasAbertas(p => ({ ...p, [pasta]: !p[pasta] }))}
                      className="w-full flex items-center justify-between p-6 active:bg-white/5"
                    >
                      <div className="flex items-center gap-4">
                        <Folder size={24} className={pastasAbertas[pasta] ? "text-blue-500" : "text-slate-600"} />
                        <span className="text-xs font-black uppercase tracking-widest text-slate-200">{pasta}</span>
                      </div>
                      <ChevronRight size={20} className={`transition-transform ${pastasAbertas[pasta] ? "rotate-90" : ""} text-slate-700`} />
                    </button>
                    {pastasAbertas[pasta] && (
                      <div className="bg-black/20 border-t border-white/5 p-2 space-y-2">
                        {docs.map(doc => (
                          <button
                            key={doc.id}
                            onClick={() => setDocSelecionado(doc)}
                            className="w-full flex items-center justify-between p-5 rounded-2xl bg-white/5"
                          >
                            <div className="flex items-center gap-4">
                              {doc.tipo === 'VIDEO' ? <Video size={18} className="text-blue-400" /> : <FileText size={18} className="text-slate-400" />}
                              <span className="text-[10px] font-bold uppercase text-slate-300 text-left">{doc.titulo}</span>
                            </div>
                            <PlayCircle size={20} className="text-blue-600/50" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col">
              <div className="p-6 bg-black/40 border-b border-white/10 flex items-center justify-between flex-shrink-0">
                <button
                  onClick={() => setDocSelecionado(null)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full text-[10px] font-black uppercase text-blue-400"
                >
                  <ChevronRight size={16} className="rotate-180" /> Voltar
                </button>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-[9px] font-black text-white uppercase truncate max-w-[150px]">{docSelecionado.titulo}</p>
                    <p className="text-[7px] text-slate-500 uppercase">Segurança Ativa</p>
                  </div>
                  {renderBotaoConfirmarLeitura(docSelecionado)}
                </div>
              </div>
              <div className="flex-1 overflow-hidden relative">
                <PopPdfViewer doc={docSelecionado} userName={userName} />
              </div>
            </div>
          )}
        </div>

        {/* Desktop layout */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-8 h-[750px]">
          <PopSidebarPastas
            ordemPastas={ordemPastas}
            documentosAgrupados={documentosAgrupados}
            pastasAbertas={pastasAbertas}
            docSelecionado={docSelecionado}
            busca={busca}
            ordem={ordem}
            onBuscaChange={setBusca}
            onOrdemChange={setOrdem}
            onTogglePasta={(p) => setPastasAbertas(prev => ({ ...prev, [p]: !prev[p] }))}
            onSelectDoc={setDocSelecionado}
            onDragDrop={handleDragDrop}
            onConfigPasta={setPastaConfig}
          />

          <div className="lg:col-span-8 bg-slate-900/40 rounded-[2rem] border border-white/5 overflow-hidden flex flex-col relative shadow-2xl">
            {docSelecionado ? (
              <>
                <div className="p-4 bg-black/60 border-b border-white/5 flex justify-between items-center px-8 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <Lock
                      size={14}
                      className={docSelecionado.protecao === "ATIVO" ? "text-blue-500" : "text-emerald-500"}
                    />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                      docSelecionado.protecao === "ATIVO" ? "text-blue-400" : "text-emerald-400"
                    }`}>
                      {docSelecionado.titulo}
                    </span>
                    {renderBotaoConfirmarLeitura(docSelecionado)}
                  </div>
                  <div className="flex items-center gap-2 text-[8px] font-black uppercase">
                    {docSelecionado.protecao === "ATIVO"
                      ? <><ShieldAlert size={12} className="text-red-500" /> Restrito</>
                      : <><Globe size={12} className="text-emerald-500" /> Público</>
                    }
                  </div>
                </div>
                <div className="flex-1 overflow-hidden relative">
                  <PopPdfViewer doc={docSelecionado} userName={userName} />
                </div>
              </>
            ) : (
              <EmptyStateDoc />
            )}
          </div>
        </div>
      </div>

      {docParaExcluir && (
        <PopModalExcluir
          doc={docParaExcluir}
          onClose={() => setDocParaExcluir(null)}
          onSuccess={handleExcluirSuccess}
        />
      )}

      {pastaConfig && (
        <PopModalConfigurarPasta
          pasta={pastaConfig}
          ficharioAtivo={setorAtivo}
          documentos={documentosAgrupados[pastaConfig] ?? []}
          onClose={() => setPastaConfig(null)}
          onSalvar={handleSalvarOrdemDocs}
          onExcluir={(doc) => { setDocParaExcluir(doc); setPastaConfig(null) }}
          onRenomear={(nomeNovo) => handleRenomearPasta(pastaConfig, nomeNovo)}
        />
      )}

      {modalAcessosAberto && (
        <ModalGerenciamentoAcessos onClose={() => setModalAcessosAberto(false)} />
      )}

      {docParaConfirmarLeitura && (
        <PopModalConfirmarLeitura
          doc={docParaConfirmarLeitura}
          onClose={() => setDocParaConfirmarLeitura(null)}
          onSuccess={handleConfirmarLeituraSuccess}
        />
      )}

      {/* Page watermark */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.07] overflow-hidden flex flex-wrap gap-20 p-10 rotate-[-15deg]">
        {Array.from({ length: 40 }).map((_, i) => (
          <span key={i} className="text-red-500 font-black text-2xl uppercase">
            {userName}
          </span>
        ))}
      </div>
    </div>
  )
}
