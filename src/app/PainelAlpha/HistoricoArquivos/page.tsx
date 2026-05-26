"use client";

import React, { useState, useEffect } from "react";
import { fmtDate } from "@/lib/format-date";
import {
    History,
    Download,
    User,
    Calendar,
    FileText,
    Search,
    ArrowLeft,
    ExternalLink,
    Clock,
    RefreshCw,
    Video,
    FolderPlus,
    UploadCloud,
    ShieldCheck
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { uploadDocumento } from "@/actions/UploadDocs";
import { Switch } from "@/components/ui/switch";

interface HistoricoDoc {
    id: number;
    titulo: string;
    url: string;
    setor: string;
    PastaArquivos: string;
    data_criacao: string;
    tipo: string;
    criado_por?: string;
    status: string;
    protecao: string;
}

const SETORES = ["REGRAS GERAIS", "OPERACIONAL", "COMERCIAL", "RECURSOS HUMANOS", "FINANCEIRO", "JURÍDICO", "PARCEIRO", "SERVIÇOES GERAIS"];

const PASTAS_ESTATICAS: Record<string, string[]> = {
    "REGRAS GERAIS": ["MANUAIS", "POLÍTICAS", "CÓDIGO DE CONDUTA"],
    "OPERACIONAL": ["PROCEDIMENTOS", "CHECKLISTS", "LOGÍSTICA"],
    "COMERCIAL": ["TABELAS DE PREÇOS", "APRESENTAÇÕES", "PROPOSTAS"],
    "RECURSOS HUMANOS": ["CONTRATOS", "CURRÍCULOS", "TREINAMENTOS"],
    "FINANCEIRO": ["NOTAS FISCAIS", "RELATÓRIOS", "COMPROVANTES"],
    "JURÍDICO": ["PROCESSOS", "PROCURAÇÕES", "ESTATUTOS"],
    "PARCEIRO": ["CONTRATOS PJ", "TABELAS COMISSÃO", "CADASTROS"],
    "SERVIÇOES GERAIS": ["lIMPAR SALA DE REUNIÕES", "JANELAS", "SALA COMERCIAL"]
};


export default function PaginaHistorico() {
    const [documentos, setDocumentos] = useState<HistoricoDoc[]>([]);
    const [busca, setBusca] = useState("");
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const router = useRouter();


    const [modalEdicao, setModalEdicao] = useState<HistoricoDoc | null>(null);
    const [newFile, setNewFile] = useState<File | null>(null);
    const [isPastasModalOpen, setIsPastasModalOpen] = useState(false);
    const [pastasDoBanco, setPastasDoBanco] = useState<string[]>([]);
    const [salvando, setSalvando] = useState(false);

    const [ordem, setOrdem] = useState("recentes");




    useEffect(() => {
        async function carregarPastas() {
            if (!modalEdicao?.setor) return;
            try {
                const res = await fetch("/api/documentos");
                const docs = await res.json();
                if (Array.isArray(docs)) {
                    const filtradas = docs
                        .filter((d: any) => d.setor?.toUpperCase() === modalEdicao.setor.toUpperCase())
                        .map((d: any) => (d.PastaArquivos || d.tipo || "").toUpperCase().trim())
                        .filter((p: string) => p !== "" && p !== "PDF" && p !== "VIDEO");
                    setPastasDoBanco(Array.from(new Set(filtradas)));
                }
            } catch (err) { console.error(err); }
        }
        carregarPastas();
    }, [modalEdicao?.setor]);

    const handleSalvarEdicao = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!modalEdicao) return;
        setSalvando(true);

        try {
            const formData = new FormData();
            formData.append("id", modalEdicao.id.toString());
            formData.append("titulo", modalEdicao.titulo);
            formData.append("setor", modalEdicao.setor);
            formData.append("tipo_pasta", modalEdicao.PastaArquivos);
            formData.append("status", modalEdicao.status);
            formData.append("protecao", modalEdicao.protecao);

            if (newFile) {
                formData.append("file", newFile);
                const resUpload = await uploadDocumento(formData);
                if (!resUpload.success) throw new Error(resUpload.error);
            } else {
                const res = await fetch('/api/documentos', {
                    method: 'PATCH',
                    body: JSON.stringify({
                        id: modalEdicao.id,
                        titulo: modalEdicao.titulo,
                        setor: modalEdicao.setor,
                        PastaArquivos: modalEdicao.PastaArquivos,
                        status: modalEdicao.status,
                        protecao: modalEdicao.protecao
                    }),
                    headers: { 'Content-Type': 'application/json' }
                });
                if (!res.ok) throw new Error("Erro ao atualizar banco");
            }

            toast.success("Alterações salvas com sucesso!");
            carregarHistorico();
            setModalEdicao(null);
            setNewFile(null);
        } catch (err: any) {
            toast.error(err.message || "Erro na sincronização.");
        } finally {
            setSalvando(false);
        }
    };


    async function carregarHistorico(silencioso = false) {
        if (!silencioso) setLoading(true);
        else setIsRefreshing(true);

        try {
            const res = await fetch("/api/documentos?todos=true");
            const data = await res.json();
            if (Array.isArray(data)) {
                setDocumentos(data);
            }
        } catch (err) {
            console.error("Erro ao sincronizar histórico:", err);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }

    const handleReativar = async (docId: number) => {
        try {
            const res = await fetch(`/api/documentos`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: docId, status: 'ATIVO' })
            });

            if (!res.ok) throw new Error();

            setDocumentos(prev => prev.filter(d => d.id !== docId));
            toast.success("Documento reativado e enviado para a Sala Principal!");
        } catch (err) {
            toast.error("Erro ao reativar documento no banco.");
        }
    };

    const handleExcluirPermanente = async (id: number) => {
        const confirmar = confirm("ATENÇÃO: Esta ação não pode ser desfeita. O arquivo será removido permanentemente do banco de dados. Deseja continuar?");

        if (!confirmar) return;

        setSalvando(true);
        try {
            const res = await fetch(`/api/documentos?id=${id}`, {
                method: 'DELETE',
            });

            if (!res.ok) throw new Error();

            toast.success("Documento excluído permanentemente!");
            setDocumentos(prev => prev.filter(d => d.id !== id));
            setModalEdicao(null);
        } catch (err) {
            toast.error("Erro ao excluir do banco de dados.");
        } finally {
            setSalvando(false);
        }
    };

    const docsFiltrados = documentos
        .filter(d =>
            d.titulo.toLowerCase().includes(busca.toLowerCase()) ||
            d.setor.toLowerCase().includes(busca.toLowerCase())
        )
        .sort((a, b) => {
            if (ordem === "recentes") return new Date(b.data_criacao).getTime() - new Date(a.data_criacao).getTime();
            if (ordem === "antigos") return new Date(a.data_criacao).getTime() - new Date(b.data_criacao).getTime();
            if (ordem === "az") return a.titulo.localeCompare(b.titulo);
            if (ordem === "za") return b.titulo.localeCompare(a.titulo);
            return 0;
        });




    useEffect(() => {
        carregarHistorico();
        const intervalo = setInterval(() => carregarHistorico(true), 5000);
        return () => clearInterval(intervalo);
    }, []);


    return (
        <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* HEADER */}
                <header className="relative overflow-hidden bg-slate-900/40 p-8 rounded-[2.5rem] border border-white/5 backdrop-blur-xl shadow-2xl">
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-5">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-700 shadow-lg shadow-orange-900/20">
                                <History size={32} />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black uppercase tracking-tighter leading-none">GERENCIAMENTO DO POP</h1>
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                                    <span className={`h-1.5 w-1.5 rounded-full bg-amber-500 ${isRefreshing ? "animate-spin" : "animate-pulse"}`}></span>
                                    Sincronização em Tempo Real Ativa
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => router.back()}
                            className="group flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all"
                        >
                            <ArrowLeft size={16} className="text-slate-400 group-hover:text-white" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Voltar</span>
                        </button>
                    </div>
                </header>

                {/* BUSCA */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative group w-full max-w-md">
                        <Search className="absolute left-5 top-4 text-slate-600 group-focus-within:text-amber-500 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="FILTRAR HISTÓRICO..."
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-[10px] font-bold uppercase tracking-[0.2em] outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                        />
                    </div>

                    {/* ORDENAÇÃO */}
                    <div className="flex items-center gap-3 w-full md:w-auto bg-slate-900/50 border border-white/5 p-2 rounded-2xl">
                        <Clock size={16} className="text-amber-500 ml-3" />
                        <select
                            value={ordem}
                            onChange={(e) => setOrdem(e.target.value)}
                            className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none pr-4 cursor-pointer text-slate-300 hover:text-white transition-colors"
                        >
                            <option value="recentes" className="bg-slate-950">Mais Recentes</option>
                            <option value="antigos" className="bg-slate-950">Mais Antigos</option>
                            <option value="az" className="bg-slate-950">Alfabética (A-Z)</option>
                            <option value="za" className="bg-slate-950">Alfabética (Z-A)</option>
                        </select>
                    </div>
                </div>


                {/* LISTA DE ARQUIVOS */}
                <div className="space-y-3">
                    {loading ? (
                        <div className="flex flex-col items-center py-20 opacity-20 animate-pulse">
                            <RefreshCw size={40} className="animate-spin mb-4" />
                            <p className="text-[10px] font-black uppercase tracking-[0.3em]">Acessando Banco Turso...</p>
                        </div>
                    ) : docsFiltrados.length > 0 ? (
                        docsFiltrados.map((doc) => (
                            <div
                                key={doc.id}
                                className="group relative flex flex-col md:flex-row items-center justify-between p-6 bg-slate-900/30 border border-white/5 rounded-[2rem] hover:bg-slate-900/60 hover:border-amber-500/20 transition-all duration-500 animate-in fade-in slide-in-from-bottom-4"
                            >
                                <div className="flex items-center gap-6 w-full md:w-auto">
                                    <div className={`p-4 rounded-2xl ${doc.status === 'INATIVO' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                        {doc.tipo === "VIDEO" ? (
                                            <Video size={24} />
                                        ) : (
                                            <FileText size={24} />
                                        )}
                                    </div>

                                    <div className="space-y-1">
                                        <h3 className="text-sm font-black uppercase tracking-tight text-slate-200 group-hover:text-white transition-colors">{doc.titulo}</h3>
                                        <div className="flex flex-wrap gap-4 items-center">
                                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase">
                                                <Calendar size={12} className="text-amber-500/50" />
                                                {fmtDate(doc.data_criacao)}
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 uppercase">
                                                <User size={12} className="text-amber-500/50" />
                                                {doc.criado_por || "ADMIN SISTEMA"}
                                            </div>
                                            <div className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[8px] font-black text-blue-400 uppercase">
                                                {doc.setor}
                                            </div>
                                            <div className={`px-2 py-0.5 rounded border text-[8px] font-black uppercase ${doc.status === 'INATIVO' ? 'border-red-500/30 text-red-500 bg-red-500/5' : 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5'}`}>
                                                {doc.status}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 mt-4 md:mt-0 w-full md:w-auto">
                                    <a
                                        href={`${doc.url}`}
                                        target="_blank"
                                        download={doc.titulo}
                                        className="target flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-amber-900/20 transition-all active:scale-95"
                                    >
                                         Ver
                                    </a>

                                    <button
                                        onClick={() => setModalEdicao(doc)}
                                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-white/5 hover:bg-blue-600 hover:text-white border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                                    >
                                        <RefreshCw size={14} /> Editar
                                    </button>

                                    <a
                                        href={`${doc.url}?download=1`}
                                        download={doc.titulo}
                                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-amber-900/20 transition-all active:scale-95"
                                    >
                                        <Download size={14} /> Download
                                    </a>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="py-40 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
                            <History size={48} className="mx-auto mb-4 opacity-10" />
                            <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30">Nenhum registro encontrado</p>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL DE EDIÇÃO */}
            {modalEdicao && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl">
                    <div className="bg-slate-900 border border-white/10 w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
                        <header className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-black uppercase tracking-tighter text-white">Editar Registro</h2>
                            <button onClick={() => setModalEdicao(null)} className="p-2 hover:bg-white/5 rounded-full"><ArrowLeft size={20} /></button>
                        </header>

                        <form onSubmit={handleSalvarEdicao} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-amber-500 ml-1">Título</label>
                                    <input
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-amber-500"
                                        value={modalEdicao.titulo}
                                        onChange={e => setModalEdicao({ ...modalEdicao, titulo: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-amber-500 ml-1">Setor</label>
                                    <select
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold uppercase outline-none"
                                        value={modalEdicao.setor}
                                        onChange={e => setModalEdicao({ ...modalEdicao, setor: e.target.value, PastaArquivos: "" })}
                                    >
                                        {SETORES.map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-amber-500 ml-1">Pasta Destino</label>
                                <div
                                    onClick={() => setIsPastasModalOpen(true)}
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-white/5"
                                >
                                    <span className="text-xs font-bold uppercase">{modalEdicao.PastaArquivos || "SELECIONAR PASTA..."}</span>
                                    <FolderPlus size={18} className="text-amber-500" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-amber-500 ml-1">Substituir Arquivo (Opcional)</label>
                                <div className="relative group border-2 border-dashed border-white/10 rounded-2xl p-6 flex flex-col items-center hover:bg-white/5 transition-all">
                                    <input type="file" onChange={e => setNewFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" />
                                    <UploadCloud size={24} className="text-slate-500 mb-2" />
                                    <span className="text-[10px] font-bold uppercase text-slate-400">
                                        {newFile ? newFile.name : "Clique para trocar o arquivo atual"}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                                <div className="flex items-center gap-3">
                                    <ShieldCheck size={20} className={modalEdicao.protecao === "ATIVO" ? "text-amber-500" : "text-slate-500"} />
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-white">Proteção Alpha</p>
                                        <p className="text-[8px] font-bold uppercase text-slate-500">Bloquear cópia e download</p>
                                    </div>
                                </div>
                                <Switch
                                    checked={modalEdicao.protecao === "ATIVO"}
                                    onCheckedChange={(checked) => setModalEdicao({ ...modalEdicao, protecao: checked ? "ATIVO" : "INATIVO" })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-amber-500 ml-1">Status</label>
                                <div className="flex gap-4">
                                    {['ATIVO', 'INATIVO'].map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setModalEdicao({ ...modalEdicao, status: s })}
                                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${modalEdicao.status === s ? 'bg-amber-600 border-amber-600 text-white' : 'bg-transparent border-white/10 text-slate-500'}`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleExcluirPermanente(modalEdicao!.id)}
                                    disabled={salvando}
                                    className="cursor-pointer w-full py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
                                >
                                    Excluir do Banco de Dados Permanentemente
                                </button>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setModalEdicao(null)} className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={salvando} className="flex-[2] py-4 bg-amber-600 hover:bg-amber-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-amber-900/20">
                                    {salvando ? <RefreshCw className="animate-spin mx-auto" size={18} /> : "Confirmar Alterações"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isPastasModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl">
                        <h2 className="text-[12px] font-black uppercase tracking-[0.3em] text-amber-500 text-center mb-6">Mudar Pasta</h2>
                        <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {Array.from(new Set([...(PASTAS_ESTATICAS[modalEdicao?.setor || ""] || []), ...pastasDoBanco])).map(pasta => (
                                <button
                                    key={pasta}
                                    onClick={() => { setModalEdicao({ ...modalEdicao!, PastaArquivos: pasta }); setIsPastasModalOpen(false); }}
                                    className="w-full py-4 px-6 rounded-2xl text-[10px] font-bold uppercase tracking-widest bg-black/40 text-slate-400 hover:bg-white/5 text-left flex items-center gap-3"
                                >
                                    <FolderPlus size={14} className="text-amber-500" /> {pasta}
                                </button>


                            ))}

                        </div>
                        <button onClick={() => setIsPastasModalOpen(false)} className="w-full mt-6 py-4 bg-white/5 text-slate-400 rounded-2xl text-[10px] font-black uppercase">Fechar</button>

                    </div>
                </div>
            )}

        </div>
    );
}
