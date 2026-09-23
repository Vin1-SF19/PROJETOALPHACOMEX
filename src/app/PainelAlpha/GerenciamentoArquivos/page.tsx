"use client";

import React, { useState, useEffect } from "react";
import { UploadCloud, FileCheck, Loader2, ShieldCheck, ChevronLeft, FolderPlus, Edit3, History, FileText, Video } from "lucide-react";
import { uploadDocumento } from "@/actions/UploadDocs";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react"
import { Switch } from "@/components/ui/switch";
import { upload } from '@vercel/blob/client';

type DocumentoPasta = { setor?: string; PastaArquivos?: string; tipo?: string };

const SETORES = ["Diretrizes", "T.I", "OPERACIONAL", "COMERCIAL", "RECURSOS HUMANOS", "FINANCEIRO", "JURÍDICO", "PARCEIRO", "SERVIÇOS GERAIS"];

const PASTAS_ESTATICAS: Record<string, string[]> = {
  "Diretrizes": ["MANUAIS", "POLÍTICAS", "CÓDIGO DE CONDUTA"],
  "T.I": ["MANUAIS", "PADROES", "CODIGOS LIVRES"],
  "OPERACIONAL": ["PROCEDIMENTOS", "CHECKLISTS", "LOGÍSTICA"],
  "COMERCIAL": ["TABELAS DE PREÇOS", "APRESENTAÇÕES", "PROPOSTAS"],
  "RECURSOS HUMANOS": ["CONTRATOS", "CURRÍCULOS", "TREINAMENTOS"],
  "FINANCEIRO": ["NOTAS FISCAIS", "RELATÓRIOS", "COMPROVANTES"],
  "JURÍDICO": ["PROCESSOS", "PROCURAÇÕES", "ESTATUTOS"],
  "PARCEIRO": ["CONTRATOS PJ", "TABELAS COMISSÃO", "CADASTROS"],
  "SERVIÇOS GERAIS": ["lIMPAR SALA DE REUNIÕES", "JANELAS", "SALA COMERCIAL"]
};

export default function AdminUploadDocs() {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [setorSelecionado, setSetorSelecionado] = useState("");
  const [tipoSelecionado, setTipoSelecionado] = useState("");
  const [tipoPersonalizado, setTipoPersonalizado] = useState("");
  const [pastasDoBanco, setPastasDoBanco] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [comProtecao, setComProtecao] = useState(true);
  const [midiaTipo, setMidiaTipo] = useState<"PDF" | "VIDEO">("PDF");

  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    async function carregarPastas() {
      if (!setorSelecionado) return;
      try {
        const res = await fetch("/api/documentos");
        const docs = await res.json() as DocumentoPasta[];
        if (Array.isArray(docs)) {
          const filtradas = docs
            .filter((d) => d.setor?.toUpperCase() === setorSelecionado.toUpperCase())
            .map((d) => (d.PastaArquivos || d.tipo || "").toUpperCase().trim())
            .filter((p: string) => p !== "" && p !== "PDF" && p !== "VIDEO");

          setPastasDoBanco(Array.from(new Set(filtradas)));
        }
      } catch (err) {
        console.error("Erro ao carregar histórico de pastas:", err);
      }
    }
    carregarPastas();
  }, [setorSelecionado]);

  const todasAsPastas = Array.from(new Set([
    ...(PASTAS_ESTATICAS[setorSelecionado] || []),
    ...pastasDoBanco
  ])).sort();

  const valorFinalTipo = tipoSelecionado === "PERSONALIZAR" ? tipoPersonalizado : tipoSelecionado;


  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file || !setorSelecionado || !valorFinalTipo) {
      return toast.error("Por favor, preencha todos os campos!", {
        style: { background: '#020617', color: '#ef4444', border: '1px solid #ef444450', fontWeight: '900', fontSize: '10px', textTransform: 'uppercase' }
      });
    }

    setLoading(true);
    const formOriginal = new FormData(e.currentTarget);
    const tituloDigitado = formOriginal.get("titulo")?.toString();

    try {
      const newBlob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      });

      const dataParaBanco = new FormData();
      dataParaBanco.append("url", newBlob.url);
      dataParaBanco.append("titulo", tituloDigitado || file.name);
      dataParaBanco.append("setor", setorSelecionado);
      dataParaBanco.append("tipo_pasta", valorFinalTipo);
      dataParaBanco.append("tipo_midia", midiaTipo);
      dataParaBanco.append("criado_por", session?.user?.nome || "SISTEMA");
      dataParaBanco.append("protecao", comProtecao ? "ATIVO" : "INATIVO");
      dataParaBanco.append("ordem_manual", "0");

      const res = await uploadDocumento(dataParaBanco);

      if (res.success) {
        toast.success(`${midiaTipo} PUBLICADO COM SUCESSO!`, {
          style: { background: '#020617', color: '#10b981', border: '1px solid #10b98150', fontWeight: '900', fontSize: '10px', textTransform: 'uppercase' }
        });
        setFile(null);
        setTipoSelecionado("");
        setTipoPersonalizado("");
        (e.target as HTMLFormElement).reset();
      } else {
        toast.error(res.error || "ERRO AO GRAVAR NO BANCO");
      }
    } catch (err: unknown) {
      console.error("ERRO_FINAL:", err);
      toast.error("FALHA NA COMUNICAÇÃO ALPHA.");
    } finally {
      setLoading(false);
    }
  }





  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 text-white font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="relative overflow-hidden bg-slate-900/40 p-8 rounded-[2rem] border border-white/5 backdrop-blur-xl shadow-2xl">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-5">
              <div className={`flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg transition-all duration-500 ${midiaTipo === "PDF" ? "bg-gradient-to-br from-blue-600 to-blue-800 shadow-blue-900/40" : "bg-gradient-to-br from-purple-600 to-purple-800 shadow-purple-900/40"}`}>
                <ShieldCheck size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">Upload POP</h1>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${midiaTipo === "PDF" ? "bg-blue-500" : "bg-purple-500"}`}></span>
                  Diretório {midiaTipo}
                </p>
              </div>
            </div>
            <button onClick={() => router.back()} className="group flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all duration-300">
              <ChevronLeft size={16} className="text-slate-400 group-hover:text-white" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-white">Voltar</span>
            </button>
          </div>
        </header>

        <div className="bg-slate-900/40 p-8 rounded-[2rem] border border-white/5 backdrop-blur-md shadow-2xl relative overflow-hidden">
          <form onSubmit={handleUpload} className="space-y-8">
            <div className="grid grid-cols-2 gap-4 p-2 bg-black/40 rounded-3xl border border-white/5">
              <button
                type="button"
                onClick={() => setMidiaTipo("PDF")}
                className={`flex items-center justify-center gap-3 py-4 rounded-2xl transition-all duration-500 ${midiaTipo === "PDF" ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40" : "text-slate-600 hover:bg-white/5"}`}
              >
                <FileText size={20} />
                <span className="text-[10px] font-black uppercase tracking-widest">Documentos</span>
              </button>
              <button
                type="button"
                onClick={() => setMidiaTipo("VIDEO")}
                className={`flex items-center justify-center gap-3 py-4 rounded-2xl transition-all duration-500 ${midiaTipo === "VIDEO" ? "bg-purple-600 text-white shadow-lg shadow-purple-900/40" : "text-slate-600 hover:bg-white/5"}`}
              >
                <Video size={20} />
                <span className="text-[10px] font-black uppercase tracking-widest">Vídeos</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 ml-1">Título</label>
                <input name="titulo" required placeholder="NOME DO ARQUIVO..." className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-xs font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-blue-600/50 transition-all" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 ml-1">Setor Destino</label>
                <select
                  name="setor"
                  required
                  value={setorSelecionado}
                  onChange={(e) => { setSetorSelecionado(e.target.value); setTipoSelecionado(""); }}
                  className="w-full bg-black/40 border border-white/5 rounded-2xl px-5 py-4 text-xs font-bold uppercase tracking-widest outline-none appearance-none cursor-pointer"
                >
                  <option value="" className="bg-slate-950 text-slate-500">SELECIONE O SETOR...</option>
                  {SETORES.map(s => <option key={s} value={s} className="bg-slate-950">{s}</option>)}
                </select>
              </div>
            </div>

            <div className={`space-y-2 transition-all duration-500 ${!setorSelecionado ? "opacity-30 pointer-events-none scale-[0.98]" : "opacity-100"}`}>
              <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 ml-1">Pasta de Armazenamento</label>
              <div
                onClick={() => setorSelecionado && setIsModalOpen(true)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <FolderPlus size={18} className="text-blue-500" />
                  <span className={`text-xs font-bold uppercase tracking-widest ${valorFinalTipo ? "text-white" : "text-slate-600"}`}>
                    {valorFinalTipo || "SELECIONAR OU CRIAR PASTA..."}
                  </span>
                </div>
                <Edit3 size={14} className="text-slate-600 group-hover:text-blue-400" />
              </div>
            </div>

            <div className="relative group">
              <input type="file" name="file" accept={midiaTipo === "PDF" ? ".pdf,.doc,.docx" : "video/mp4,mkv,video/webm"} onChange={(e) => setFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
              <div className={`border-2 border-dashed rounded-[2rem] p-12 flex flex-col items-center justify-center transition-all duration-500 ${file ? "border-emerald-500/40 bg-emerald-500/5 shadow-2xl" : "border-white/10 group-hover:border-blue-500/40 group-hover:bg-blue-500/5"}`}>
                {file ? (
                  <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                    {midiaTipo === "PDF" ? <FileCheck className="text-emerald-500 mb-4" size={40} /> : <Video className="text-emerald-500 mb-4" size={40} />}
                    <span className="text-xs font-black text-emerald-400 uppercase tracking-widest text-center">{file.name}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <UploadCloud className="text-slate-500 group-hover:text-blue-500 mb-4 transition-colors" size={40} />
                    <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Upload do {midiaTipo}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center gap-3">
                <ShieldCheck size={20} className={comProtecao ? "text-blue-500" : "text-slate-500"} />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-white">Proteção Alpha</p>
                  <p className="text-[8px] font-bold uppercase text-slate-500">Bloquear cópia, print e download</p>
                </div>
              </div>
              <Switch
                checked={comProtecao}
                onCheckedChange={setComProtecao}
                name="protecao_switch"
              />
            </div>

            <button type="submit" disabled={loading} className={`w-full py-5 rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 shadow-2xl active:scale-[0.98] ${midiaTipo === "PDF" ? "bg-blue-600 hover:bg-blue-500 shadow-blue-900/40" : "bg-purple-600 hover:bg-purple-500 shadow-purple-900/40"}`}>
              {loading ? <><Loader2 className="animate-spin" size={18} /><span>Sincronizando...</span></> : <><UploadCloud size={18} /><span>Finalizar e Publicar</span></>}
            </button>
          </form>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-slate-900 border border-white/10 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in duration-200 overflow-hidden">
            <div className="flex flex-col items-center mb-6 text-center">
              <div className="h-1 w-12 bg-blue-600/50 rounded-full mb-4"></div>
              <h2 className="text-[12px] font-black uppercase tracking-[0.3em] text-blue-400">Pastas de {setorSelecionado}</h2>
              <p className="text-[9px] text-slate-500 font-bold uppercase mt-1 tracking-widest">Escolha uma existente ou crie uma nova</p>
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {todasAsPastas.map(pasta => (
                <button
                  key={pasta}
                  onClick={() => { setTipoSelecionado(pasta); setIsModalOpen(false); }}
                  className={`w-full py-4 px-6 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all text-left flex items-center justify-between group ${tipoSelecionado === pasta ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "bg-black/40 text-slate-400 hover:bg-white/5"}`}
                >
                  <div className="flex items-center gap-3">
                    {pastasDoBanco.includes(pasta) ? <History size={12} className="text-blue-500" /> : <FolderPlus size={12} className="opacity-40" />}
                    {pasta}
                  </div>
                </button>
              ))}

              <button
                onClick={() => setTipoSelecionado("PERSONALIZAR")}
                className={`w-full py-4 px-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border border-blue-600/30 transition-all mt-2 ${tipoSelecionado === "PERSONALIZAR" ? "bg-blue-600 text-white" : "bg-blue-600/10 text-blue-400 hover:bg-blue-600/20"}`}
              >
                + CRIAR PASTA PERSONALIZADA
              </button>
            </div>

            {tipoSelecionado === "PERSONALIZAR" && (
              <div className="mt-6 space-y-3 animate-in slide-in-from-bottom-4 duration-300">
                <input
                  autoFocus
                  placeholder="NOME DA NOVA PASTA..."
                  value={tipoPersonalizado}
                  onChange={(e) => setTipoPersonalizado(e.target.value.toUpperCase())}
                  className="w-full bg-black border border-blue-500/30 rounded-2xl px-6 py-5 text-[11px] font-bold uppercase tracking-widest outline-none focus:ring-4 focus:ring-blue-600/20"
                />
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all"
                >
                  Confirmar e Salvar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
