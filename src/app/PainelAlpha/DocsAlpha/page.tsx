"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
    FileText, Eye, Search, ShieldCheck, Globe, ChevronRight, Folder,
    Trash2, ShieldAlert, Lock, Video, Settings, Star, ChevronDown,
    ChevronUp, GripVertical, Edit3, Check, X, PlayCircle,
    Upload, History, KeyRound
} from "lucide-react";
import Link from "next/link";

import { toast } from "sonner";
import AntiCapture from 'react-anticapture';
import { buscarOrdemPastas, salvarOrdemPastas } from "@/actions/OrdemPastas";
import { renomearPasta } from "@/actions/RenamePastas";
import { getAcessosDoUsuario } from "@/actions/PopAcessos";
import ModalGerenciamentoAcessos from "@/components/pop/ModalGerenciamentoAcessos";


export const dynamic = 'force-dynamic';

interface Documento {
    id: number;
    titulo: string;
    data_criacao: string;
    url: string;
    setor: string;
    PastaArquivos: string;
    tipo: string;
    criado_por: string;
    protecao: string;
    ordem_manual: number;
}

const SETORES = ["Diretrizes", "T.I", "OPERACIONAL", "COMERCIAL", "RECURSOS HUMANOS", "FINANCEIRO", "JURÍDICO", "PARCEIRO", "SERVIÇOS GERAIS"];
const SENHA_MESTRA = "@Alpha2562";

export default function PaginaDocumentos() {
    const { data: session, status } = useSession();
    const [setorAtivo, setSetorAtivo] = useState("Diretrizes");
    const [documentos, setDocumentos] = useState<Documento[]>([]);
    const [docSelecionado, setDocSelecionado] = useState<Documento | null>(null);
    const [busca, setBusca] = useState("");
    const [loadingDocs, setLoadingDocs] = useState(true);
    const [modalExcluir, setModalExcluir] = useState(false);
    const [senhaInput, setSenhaInput] = useState("");
    const [isTouch, setIsTouch] = useState(false);
    const [pastaConfig, setPastaConfig] = useState<string | null>(null);
    const [ordemPastas, setOrdemPastas] = useState<string[]>([]);
    const [pastasAbertas, setPastasAbertas] = useState<Record<string, boolean>>({});
    const [ordem, setOrdem] = useState<"PADRAO" | "recentes" | "az" | "za">("PADRAO");
    const [editandoNomePasta, setEditandoNomePasta] = useState<string | null>(null);
    const [novoNomeInput, setNovoNomeInput] = useState("");
    const [docParaExcluir, setDocParaExcluir] = useState<Documento | null>(null);
    const [acessosPop, setAcessosPop] = useState({
        setoresAcessiveis: [] as string[],
        podeUpload: false,
        podeGerenciar: false,
        ehAdminUser: false,
    });
    const [modalAcessosAberto, setModalAcessosAberto] = useState(false);

    const roleUser = session?.user?.role?.toUpperCase().trim() || "USER";
    const ficharioAtivo = setorAtivo;

    useEffect(() => {
        const checkTouch = () => setIsTouch(window.innerWidth < 1024);
        checkTouch();
        window.addEventListener('resize', checkTouch);
        return () => window.removeEventListener('resize', checkTouch);
    }, []);

    useEffect(() => {
        carregarDocumentos();
    }, [status]);

    useEffect(() => {
        if (status !== "authenticated") return;
        getAcessosDoUsuario().then((res) => {
            if (res.success) {
                setAcessosPop({
                    setoresAcessiveis: res.setoresAcessiveis,
                    podeUpload: res.podeUpload,
                    podeGerenciar: res.podeGerenciar,
                    ehAdminUser: res.ehAdminUser,
                });
            }
        });
    }, [status]);

    useEffect(() => {
        const restoreScreen = () => {
            document.body.style.filter = "none";
            document.body.style.opacity = "1";
        };

        const handleSecurity = async (e: KeyboardEvent) => {
            const isPrintKey = e.key === 'PrintScreen' || e.keyCode === 44;
            const isForbiddenShortcut = e.ctrlKey && ['p', 'P', 's', 'S', 'u', 'U', 'c', 'C', 'v', 'V', 'x', 'X'].includes(e.key);
            const isDevTools = e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['i', 'I', 'j', 'J', 'c', 'C'].includes(e.key));
            const isSystemCapture = (e.metaKey && e.shiftKey);

            if (isPrintKey || isForbiddenShortcut || isDevTools || isSystemCapture) {
                e.preventDefault();
                try { await navigator.clipboard.writeText("ACESSO RESTRITO ALPHA"); } catch (err) { }
                toast.error("SEGURANÇA ALPHA", {
                    description: "AÇÃO BLOQUEADA: CONTEÚDO RESTRITO",
                    duration: 4000,
                    style: { background: '#450a0a', border: '2px solid #ff0000', color: '#fff' }
                });
                setTimeout(restoreScreen, 2000);
            }
        };

        const handleBlur = () => {
            setTimeout(() => {
                if (!document.activeElement?.classList.contains('documento-liberado')) {
                } else {
                    restoreScreen();
                }
            }, 150);
        };

        const disableRightClick = (e: MouseEvent) => e.preventDefault();

        window.addEventListener('keydown', handleSecurity);
        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', restoreScreen);
        window.addEventListener('contextmenu', disableRightClick);

        return () => {
            window.removeEventListener('keydown', handleSecurity);
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', restoreScreen);
            window.removeEventListener('contextmenu', disableRightClick);
        };
    }, []);

    async function carregarDocumentos() {
        try {
            const res = await fetch("/api/documentos");
            const data = await res.json();
            if (Array.isArray(data)) setDocumentos(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingDocs(false);
        }
    }

    const handleExcluirLogico = async () => {
        if (senhaInput !== SENHA_MESTRA) return toast.error("Senha Administrativa Incorreta!");
        if (!docParaExcluir?.id) return toast.error("Nenhum documento alvo identificado!");

        try {
            const idParaExcluir = docParaExcluir.id;
            const res = await fetch(`/api/documentos`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: idParaExcluir, status: 'INATIVO' })
            });

            if (!res.ok) throw new Error("Falha na resposta do servidor");
            setDocumentos(prev => prev.filter(d => d.id !== idParaExcluir));
            setDocParaExcluir(null);
            setModalExcluir(false);
            setSenhaInput("");
            toast.success("Documento desativado com sucesso!");
        } catch (err) {
            toast.error("Erro ao sincronizar com o banco de dados.");
            setSenhaInput("");
        }
    };

    const documentosAgrupados = useMemo(() => {
        const filtrados = documentos.filter(d => {
            const setorDoc = d.setor?.toUpperCase().trim();
            const abaSelecionada = setorAtivo?.toUpperCase().trim();

            if (!d.titulo.toLowerCase().includes(busca.toLowerCase())) return false;
            if (setorDoc !== abaSelecionada) return false;

            const setores = acessosPop.setoresAcessiveis;
            if (setores.includes("*")) return true;
            return setores.some(s => s.toUpperCase().trim() === setorDoc);
        });

        const agrupados = filtrados.reduce((acc, doc) => {
            const nomePasta = (doc.PastaArquivos || doc.tipo).toUpperCase();
            if (!acc[nomePasta]) acc[nomePasta] = [];
            acc[nomePasta].push(doc);
            return acc;
        }, {} as Record<string, Documento[]>);

        Object.keys(agrupados).forEach(pasta => {
            agrupados[pasta].sort((a, b) => {
                if (ordem === "PADRAO") return (a.ordem_manual || 0) - (b.ordem_manual || 0);
                if (ordem === "recentes") return new Date(b.data_criacao).getTime() - new Date(a.data_criacao).getTime();
                if (ordem === "az") return a.titulo.localeCompare(b.titulo);
                if (ordem === "za") return b.titulo.localeCompare(a.titulo);
                return 0;
            });
        });

        return agrupados;
    }, [documentos, setorAtivo, busca, acessosPop, ordem]);

    useEffect(() => {
        const sincronizarOrdem = async () => {
            const ordemSalva = await buscarOrdemPastas(ficharioAtivo);
            const pastasExistentes = Object.keys(documentosAgrupados);

            if (ordemSalva && Array.isArray(ordemSalva)) {
                const ordemFiltrada = ordemSalva.filter(p => pastasExistentes.includes(p));
                const novasPastas = pastasExistentes.filter(p => !ordemSalva.includes(p));
                setOrdemPastas([...ordemFiltrada, ...novasPastas]);
            } else {
                setOrdemPastas(pastasExistentes);
            }
        };
        if (ficharioAtivo) sincronizarOrdem();
    }, [ficharioAtivo, documentosAgrupados]);

    const handleSalvarNovoNome = async (nomeAntigo: string) => {
        const res = await renomearPasta(ficharioAtivo, nomeAntigo, novoNomeInput);
        if (res.success && res.count! > 0) {
            toast.success("Pasta renomeada com sucesso!");
            setPastaConfig(null);
            setEditandoNomePasta(null);
            await carregarDocumentos();
        } else {
            toast.error("Erro ao renomear pasta.");
        }
    };

    if (loadingDocs) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500 font-black animate-pulse">SINCRONIZANDO ESTRUTURA...</div>;

    return (
        <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 select-none overflow-x-hidden">
            <style dangerouslySetInnerHTML={{ __html: `@media print { body { display: none !important; } } .no-select { user-select: none; }` }} />

            <div className="max-w-7xl mx-auto space-y-6">
                <div className="p-5 bg-slate-900/40 rounded-[2rem] border border-white/5 backdrop-blur-xl flex flex-col lg:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-5">
                        <div className="h-14 w-14 flex items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/20">
                            <ShieldCheck size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black uppercase tracking-tighter">POP</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Acesso: <span className="text-blue-400">{roleUser}</span></p>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap justify-center gap-4 lg:gap-6">
                        {SETORES.map(s => {
                            const setores = acessosPop.setoresAcessiveis;
                            const podeVer = setores.includes("*") || setores.some(sv => sv.toUpperCase().trim() === s.toUpperCase().trim());
                            if (!podeVer) return null;
                            return (
                                <button key={s} onClick={() => { setSetorAtivo(s); setDocSelecionado(null); }} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${setorAtivo === s ? "bg-blue-600 text-white scale-105" : "text-slate-500 hover:bg-white/5"}`}>{s}</button>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {acessosPop.podeUpload && (
                            <Link
                                href="/PainelAlpha/GerenciamentoArquivos"
                                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all text-[9px] font-black uppercase tracking-widest"
                            >
                                <Upload size={13} /> Upload
                            </Link>
                        )}
                        {acessosPop.podeGerenciar && (
                            <Link
                                href="/PainelAlpha/HistoricoArquivos"
                                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all text-[9px] font-black uppercase tracking-widest"
                            >
                                <History size={13} /> Gerenciar
                            </Link>
                        )}
                        {acessosPop.ehAdminUser && (
                            <button
                                onClick={() => setModalAcessosAberto(true)}
                                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:text-blue-300 hover:border-blue-500/40 transition-all text-[9px] font-black uppercase tracking-widest"
                            >
                                <KeyRound size={13} /> Acessos
                            </button>
                        )}
                    </div>
                </div>

                {isTouch ? (
                    <div className="flex flex-col gap-4 min-h-[60vh]">
                        {!docSelecionado ? (
                            <div className="space-y-3">
                                {ordemPastas.map((pasta) => {
                                    const docs = documentosAgrupados[pasta];
                                    if (!docs) return null;
                                    return (
                                        <div key={pasta} className="bg-slate-900/60 border border-white/5 rounded-[2rem] overflow-hidden">
                                            <button onClick={() => setPastasAbertas(p => ({ ...p, [pasta]: !p[pasta] }))} className="w-full flex items-center justify-between p-6 active:bg-white/5">
                                                <div className="flex items-center gap-4">
                                                    <Folder size={24} className={pastasAbertas[pasta] ? "text-blue-500" : "text-slate-600"} />
                                                    <span className="text-xs font-black uppercase tracking-widest text-slate-200">{pasta}</span>
                                                </div>
                                                <ChevronRight size={20} className={`transition-transform ${pastasAbertas[pasta] ? "rotate-90" : ""} text-slate-700`} />
                                            </button>
                                            {pastasAbertas[pasta] && (
                                                <div className="bg-black/20 border-t border-white/5 p-2 space-y-2">
                                                    {docs.map(doc => (
                                                        <button key={doc.id} onClick={() => setDocSelecionado(doc)} className="w-full flex items-center justify-between p-5 rounded-2xl bg-white/5">
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
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col">
                                <div className="p-6 bg-black/40 border-b border-white/10 flex items-center justify-between">
                                    <button onClick={() => setDocSelecionado(null)} className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full text-[10px] font-black uppercase text-blue-400">
                                        <ChevronRight size={16} className="rotate-180" /> Voltar
                                    </button>
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-white uppercase truncate max-w-[150px]">{docSelecionado.titulo}</p>
                                        <p className="text-[7px] text-slate-500 uppercase">Segurança Ativa</p>
                                    </div>
                                </div>
                                <div className="flex-1 bg-white relative overflow-auto">
                                    <AntiCapture screenshotPrevent clipboardPrevent devtoolsPrevent userSelect={false}>
                                        {docSelecionado.tipo === "VIDEO" ? (
                                            <video controls className="w-full h-full bg-black" src={docSelecionado.url} />
                                        ) : (
                                            <iframe
                                                src={docSelecionado.protecao === "ATIVO"
                                                    ? `https://docs.google.com/viewer?url=${encodeURIComponent(docSelecionado.url)}&embedded=true`
                                                    : `https://docs.google.com/viewer?url=${encodeURIComponent(docSelecionado.url)}&embedded=true`
                                                }
                                                className="w-full h-full border-none"
                                                style={{
                                                    minHeight: '80vh',
                                                    pointerEvents: 'auto'
                                                }}
                                            />)}
                                    </AntiCapture>
                                    {docSelecionado.protecao === "ATIVO" && <div className="absolute inset-0 z-50 bg-transparent" onContextMenu={e => e.preventDefault()} />}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[750px]">
                        <div className="lg:col-span-4 bg-slate-900/40 rounded-[2rem] border border-white/5 p-6 flex flex-col backdrop-blur-md overflow-hidden">
                            <div className="relative mb-4">
                                <Search className="absolute left-4 top-3.5 text-slate-600" size={16} />
                                <input type="text" placeholder="BUSCAR..." value={busca} onChange={(e) => setBusca(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl py-3.5 pl-12 text-[10px] font-bold uppercase outline-none focus:ring-1 focus:ring-blue-600/50" />
                            </div>

                            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar">
                                <button onClick={() => setOrdem("PADRAO")} className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase border ${ordem === 'PADRAO' ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white/5 border-white/5 text-slate-500'}`}><Star size={10} className="inline mr-1" /> Padrão</button>
                                <button onClick={() => setOrdem("recentes")} className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase border ${ordem === 'recentes' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white/5 border-white/5 text-slate-500'}`}>Recentes</button>
                                <button onClick={() => setOrdem("az")} className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase border ${ordem === 'az' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white/5 border-white/5 text-slate-500'}`}>A-Z</button>
                                <button onClick={() => setOrdem("za")} className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase border ${ordem === 'za' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white/5 border-white/5 text-slate-500'}`}>Z-A</button>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                                {ordemPastas.map((pasta, index) => {
                                    const docs = documentosAgrupados[pasta];
                                    if (!docs) return null;
                                    return (
                                        <div key={pasta} draggable onDragStart={(e) => e.dataTransfer.setData("index", index.toString())} onDrop={async (e) => {
                                            const deIndex = parseInt(e.dataTransfer.getData("index"));
                                            const novaLista = [...ordemPastas];
                                            const [itemRemovido] = novaLista.splice(deIndex, 1);
                                            novaLista.splice(index, 0, itemRemovido);
                                            setOrdemPastas(novaLista);
                                            await salvarOrdemPastas(ficharioAtivo, novaLista);
                                            toast.success("Ordem salva!");
                                        }} onDragOver={e => e.preventDefault()} className="group/pasta relative">
                                            <button onClick={() => setPastasAbertas(p => ({ ...p, [pasta]: !p[pasta] }))} className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-950/40 border border-white/5 hover:bg-slate-900">
                                                <div className="flex items-center gap-3">
                                                    <Folder size={16} className={pastasAbertas[pasta] ? "text-blue-500" : "text-slate-600"} />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{pasta}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Settings onClick={(e) => { e.stopPropagation(); setPastaConfig(pasta); }} size={14} className="opacity-0 group-hover/pasta:opacity-100 text-slate-500 hover:text-blue-400" />
                                                    <ChevronRight size={14} className={`transition-transform ${pastasAbertas[pasta] ? "rotate-90" : ""}`} />
                                                </div>
                                            </button>
                                            {pastasAbertas[pasta] && (
                                                <div className="ml-4 pl-4 border-l border-white/10 space-y-1 mt-1">
                                                    {docs.map(doc => (
                                                        <button key={doc.id} onClick={() => setDocSelecionado(doc)} className={`w-full flex items-center gap-3 p-3 rounded-xl text-[9px] font-black uppercase transition-all ${docSelecionado?.id === doc.id ? "bg-blue-600/20 text-blue-400" : "text-slate-500 hover:bg-white/5"}`}>
                                                            {doc.tipo === 'VIDEO' ? <Video size={14} /> : <FileText size={14} />}
                                                            <span className="truncate">{doc.titulo}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="lg:col-span-8 bg-slate-900/40 rounded-[2rem] border border-white/5 overflow-hidden flex flex-col relative shadow-2xl">
                            {docSelecionado ? (
                                <>
                                    <div className="p-4 bg-black/60 border-b border-white/5 flex justify-between items-center px-8">
                                        <div className="flex items-center gap-3">
                                            <Lock size={14} className={docSelecionado.protecao === "ATIVO" ? "text-blue-500" : "text-emerald-500"} />
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${docSelecionado.protecao === "ATIVO" ? "text-blue-400" : "text-emerald-400"}`}>{docSelecionado.titulo}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[8px] font-black uppercase">
                                            {docSelecionado.protecao === "ATIVO" ? <><ShieldAlert size={12} className="text-red-500" /> Restrito</> : <><Globe size={12} className="text-emerald-500" /> Público</>}
                                        </div>
                                    </div>
                                    <div className="flex-1 bg-white relative overflow-auto">
                                        <AntiCapture screenshotPrevent clipboardPrevent devtoolsPrevent userSelect={false}>
                                            {docSelecionado.tipo === "VIDEO" ? (
                                                <video controls className="w-full h-full bg-black" src={docSelecionado.url} />
                                            ) : (
                                                <iframe src={docSelecionado.protecao === "ATIVO" ? `${docSelecionado.url}#toolbar=0&navpanes=0` : docSelecionado.url} className="w-full h-full border-none" style={{ height: '20000px', pointerEvents: docSelecionado.protecao === "ATIVO" ? 'none' : 'auto' }} />
                                            )}
                                        </AntiCapture>
                                        {docSelecionado.protecao === "ATIVO" && <div className="absolute inset-0 z-50 bg-transparent" onContextMenu={e => e.preventDefault()} />}
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center opacity-20"><Eye size={80} className="mb-4" /><p className="text-[12px] font-black uppercase tracking-[0.5em]">Aguardando Seleção</p></div>
                            )}
                        </div>
                    </div>
                )}

                {modalExcluir && (
                    <div className="fixed inset-0 z-[999] flex items-center justify-center p-6 backdrop-blur-2xl bg-black/90">
                        <div className="relative bg-slate-950 border-2 border-red-500/20 p-8 rounded-[3rem] max-w-sm w-full">
                            <div className="flex flex-col items-center mb-8 text-center">
                                <div className="p-4 bg-red-500/10 rounded-full mb-4 border border-red-500/20"><ShieldAlert size={44} className="text-red-500 animate-bounce" /></div>
                                <h2 className="text-[14px] font-black uppercase text-white italic">Autenticação <span className="text-red-500">Mestra</span></h2>
                                <p className="text-[10px] text-slate-500 font-black uppercase mt-4">Ação crítica. Insira a chave para desativar.</p>
                            </div>
                            <input type="password" placeholder="••••••••" value={senhaInput} onChange={e => setSenhaInput(e.target.value)} className="w-full bg-black border-2 border-white/5 rounded-[1.5rem] px-5 py-5 text-center text-white outline-none mb-6 focus:border-red-600" />
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => { setModalExcluir(false); setSenhaInput(""); }} className="py-4 bg-slate-900 text-slate-400 rounded-2xl text-[10px] font-black uppercase">Abortar</button>
                                <button onClick={handleExcluirLogico} className="py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl shadow-red-900/40">Confirmar</button>
                            </div>
                        </div>
                    </div>
                )}

                {pastaConfig && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-md">
                        <div className="bg-slate-900 border border-white/10 w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl">
                            <header className="flex flex-col items-center mb-8 text-center">
                                <div className="h-1.5 w-16 bg-blue-600 rounded-full mb-6"></div>
                                <div className="flex items-center gap-3">
                                    {editandoNomePasta === pastaConfig ? (
                                        <div className="flex items-center gap-2 bg-black/40 border border-blue-500/50 rounded-2xl p-2">
                                            <input autoFocus value={novoNomeInput} onChange={(e) => setNovoNomeInput(e.target.value.toUpperCase())} className="bg-transparent border-none text-lg font-black uppercase text-white px-4 outline-none" />
                                            <button onClick={() => handleSalvarNovoNome(pastaConfig)} className="p-3 bg-emerald-600 rounded-xl text-white"><Check size={18} /></button>
                                            <button onClick={() => setEditandoNomePasta(null)} className="p-3 bg-white/5 rounded-xl text-slate-400"><X size={18} /></button>
                                        </div>
                                    ) : (
                                        <>
                                            <h2 className="text-xl font-black uppercase text-white">Configurar: {pastaConfig}</h2>
                                            <Edit3 size={18} onClick={() => { setEditandoNomePasta(pastaConfig); setNovoNomeInput(pastaConfig); }} className="cursor-pointer text-slate-500 hover:text-blue-400" />
                                        </>
                                    )}
                                </div>
                            </header>
                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                                {documentosAgrupados[pastaConfig]?.map((doc, index) => (
                                    <div key={doc.id} className="flex items-center gap-4 p-4 bg-black/40 border border-white/5 rounded-2xl group">
                                        <div className="flex flex-col gap-1">
                                            <button onClick={() => {
                                                const lista = [...documentosAgrupados[pastaConfig!]];
                                                if (index === 0) return;
                                                [lista[index - 1], lista[index]] = [lista[index], lista[index - 1]];
                                                setDocumentos(documentos.map(d => {
                                                    const idx = lista.findIndex(item => item.id === d.id);
                                                    return idx !== -1 ? { ...d, ordem_manual: idx } : d;
                                                }));
                                            }} className="text-slate-600 hover:text-blue-400"><ChevronUp size={16} /></button>
                                            <button onClick={() => {
                                                const lista = [...documentosAgrupados[pastaConfig!]];
                                                if (index === lista.length - 1) return;
                                                [lista[index + 1], lista[index]] = [lista[index], lista[index + 1]];
                                                setDocumentos(documentos.map(d => {
                                                    const idx = lista.findIndex(item => item.id === d.id);
                                                    return idx !== -1 ? { ...d, ordem_manual: idx } : d;
                                                }));
                                            }} className="text-slate-600 hover:text-blue-400"><ChevronDown size={16} /></button>
                                        </div>
                                        <div className="flex-1 text-xs font-black uppercase text-slate-200">{doc.titulo}</div>
                                        <button onClick={() => { setDocParaExcluir(doc); setModalExcluir(true); }} className="px-4 py-2 bg-red-600/10 text-red-500 rounded-xl text-[9px] font-black uppercase border border-red-600/20"><Trash2 size={14} /></button>
                                        <GripVertical size={14} className="text-slate-700" />
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-10">
                                <button onClick={() => { setPastaConfig(null); carregarDocumentos(); }} className="py-5 bg-white/5 text-slate-400 rounded-[1.5rem] text-[10px] font-black uppercase">Descartar</button>
                                <button onClick={async () => {
                                    setLoadingDocs(true);
                                    try {
                                        await fetch('/api/documentos/ordenar', {
                                            method: 'POST',
                                            body: JSON.stringify({ documentos: documentosAgrupados[pastaConfig!].map((d, i) => ({ id: d.id, titulo: d.titulo, ordem: i })) }),
                                        });
                                        toast.success("Pasta sincronizada!");
                                        setPastaConfig(null);
                                    } catch (err) { toast.error("Erro ao salvar"); } finally { setLoadingDocs(false); }
                                }} className="py-5 bg-blue-600 text-white rounded-[1.5rem] text-[10px] font-black uppercase shadow-xl shadow-blue-900/40">Salvar Alterações</button>
                            </div>
                        </div>
                    </div>
                )}

                {modalAcessosAberto && (
                    <ModalGerenciamentoAcessos onClose={() => setModalAcessosAberto(false)} />
                )}

                <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.1] overflow-hidden flex flex-wrap gap-20 p-10 rotate-[-15deg]">
                    {Array.from({ length: 40 }).map((_, i) => (
                        <span key={i} className="text-red-500 font-black text-2xl uppercase">
                            {session?.user?.nome || "ACESSO RESTRITO ALPHA"}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}