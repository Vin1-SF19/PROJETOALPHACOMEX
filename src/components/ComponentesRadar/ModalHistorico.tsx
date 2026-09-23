"use client";

import { useEffect, useState } from "react";
import {
    X,
    Search,
    Calendar,
    FileSpreadsheet,
    ArrowUpDown,
    CheckCircle2,
    LoaderCircle,
    Trash2,
    Database,
    CheckSquare,
    Square
} from "lucide-react";
import * as XLSX from "xlsx";
import { excluirCnpjsEmLote } from "@/actions/RadarAction";
import { toast } from "sonner";



const baixarArquivoEDados = async (id: number, nomeBase: string) => {
    try {
        const res = await fetch(`/api/DownloadArquivos?id=${id}`);
        const dados = await res.json();

        if (dados.error) return alert(dados.error);

        const dadosExcel = dados.map((r: Record<string, string>, index: number) => ({
            "Nº": index + 1,
            "Data Consulta": r.data_consulta ? new Date(r.data_consulta).toLocaleDateString("pt-BR") : "",
            "CNPJ": r.cnpj,
            "Contribuinte": r.contribuinte || "",
            "Situação": r.situacao_radar || "",
            "Data Situação": r.data_situacao ? new Date(r.data_situacao).toLocaleDateString("pt-BR") : "",
            "Submodalidade": r.submodalidade || "",
            "Razão Social": r.razao_social || "",
            "Nome Fantasia": r.nome_fantasia || "",
            "Município": r.municipio || "",
            "UF": r.uf || "",
            "Data Constituição": r.data_constituicao ? new Date(r.data_constituicao).toLocaleDateString("pt-BR") : "",
            "Regime Tributário": r.regime_tributario || "",
            "Data Opcao": r.data_opcao ? new Date(r.data_opcao).toLocaleString("pt-BR") : "",
            "Capital Social": r.capital_social || ""
        }));

        const worksheet = XLSX.utils.json_to_sheet(dadosExcel);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Dados Radar");


        const nomeFinal = nomeBase || "historico_radar";
        XLSX.writeFile(workbook, `${nomeFinal}.xlsx`);

    } catch (error) {
        console.error("Erro ao baixar:", error);
        alert("Erro ao processar o download.");
    }
};







/* =======================
   TIPOS
======================= */

interface ConsultaRadar {
    id: number;
    cnpj: string;
    razao_social: string;
    nome_fantasia?: string | null;
    data_consulta: string;
    situacao_radar?: string | null;
    municipio?: string | null;
    uf?: string | null;
}

interface ArquivoRadar {
    id: number;
    nome_arquivo: string;
    data_upload: string;
    total_registros: number;
}


type Props = {
    onImportar: (ids: number[]) => void;
    onClose: () => void;
};

/* =======================
   COMPONENTE
======================= */

export default function ModalHistorico({ onClose, onImportar }: Props) {
    const [dados, setDados] = useState<ConsultaRadar[]>([]);
    const [busca, setBusca] = useState("");
    const [ordem, setOrdem] = useState<"asc" | "desc">("desc");
    const [selecionados, setSelecionados] = useState<number[]>([]);


    const [abaAtiva, setAbaAtiva] = useState<"individuais" | "arquivos">("arquivos");
    const [resultadoArquivos, setResultadoArquivos] = useState<{ chave: string; dados: ArquivoRadar[] } | null>(null);

    const [dadosAvulsos, setDadosAvulsos] = useState<ConsultaRadar[]>([]);


    const chaveArquivos = `${busca}\u0000${ordem}`;
    const loading = abaAtiva === "arquivos" && resultadoArquivos?.chave !== chaveArquivos;
    const arquivos = resultadoArquivos?.chave === chaveArquivos ? resultadoArquivos.dados : [];

    useEffect(() => {
        if (abaAtiva === "arquivos") {
            const controller = new AbortController();
            fetch(`/api/ListarArquivos?nome=${encodeURIComponent(busca)}&ordem=${ordem}`, { signal: controller.signal })
                .then(res => res.json())
                .then(data => {
                    setResultadoArquivos({ chave: chaveArquivos, dados: data });
                })
                .catch(() => { if (!controller.signal.aborted) setResultadoArquivos({ chave: chaveArquivos, dados: [] }); });
            return () => controller.abort();
        }
    }, [abaAtiva, busca, ordem, chaveArquivos]);

    useEffect(() => {
        if (abaAtiva === "individuais") {
            fetch("/api/HistoricoRadar")
                .then(res => res.json())
                .then(setDadosAvulsos);
        }
    }, [abaAtiva]);

    // Filtro para consultas avulsas (Frontend)
    const avulsosFiltrados = dadosAvulsos
        .filter(d =>
            d.cnpj.includes(busca) ||
            d.razao_social?.toLowerCase().includes(busca.toLowerCase())
        )
        .sort((a, b) => {
            const da = new Date(a.data_consulta).getTime();
            const db = new Date(b.data_consulta).getTime();
            return ordem === "desc" ? db - da : da - db;
        });

    const toggleSelecao = (id: number) => {
        setSelecionados(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleSelecionarTudo = () => {
        // Se todos já estiverem selecionados, limpamos tudo
        if (selecionados.length === avulsosFiltrados.length && avulsosFiltrados.length > 0) {
            setSelecionados([]);
        } else {
            // Caso contrário, pegamos todos os IDs da lista que está na tela 
            const todosIds = avulsosFiltrados.map(item => item.id);
            setSelecionados(todosIds);
        }
    };




    const [usersList, setUsersList] = useState<unknown[]>([]);

    useEffect(() => {
        async function fetchData() {
            const response = await fetch('/api/ConsultaCompleta');
            const data = await response.json();
            setUsersList(data);
        }

        fetchData();
    }, []);

    useEffect(() => {
        async function carregar() {
            const res = await fetch("/api/HistoricoRadar");
            const json = await res.json();
            setDados(json);
        }
        carregar();
    }, []);

    const filtrados = dados
        .filter(d =>
            d.cnpj.includes(busca) ||
            d.razao_social.toLowerCase().includes(busca.toLowerCase())
        )
        .sort((a, b) => {
            const da = new Date(a.data_consulta).getTime();
            const db = new Date(b.data_consulta).getTime();
            return ordem === "desc" ? db - da : da - db;
        });

    function toggle(id: number) {
        setSelecionados(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
    }



    const handleExcluirDoBanco = async () => {
        if (selecionados.length === 0) return;

        if (!confirm(`Deseja remover ${selecionados.length} registros?`)) return;

        const toastId = toast.loading("Removendo do banco...");
        try {
            const res = await excluirCnpjsEmLote(selecionados);

            if (res.success) {
                toast.success("Registros excluídos!", { id: toastId });
                setSelecionados([]); // Limpa a seleção

                onClose();
            } else {
                toast.error("Erro ao excluir", { id: toastId });
            }
        } catch (err) {
            toast.error("Erro de conexão", { id: toastId });
        }
    };







    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* BACKDROP */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

            <div className="relative z-10 w-full max-w-4xl h-[650px] flex flex-col bg-slate-950 border border-slate-800 rounded-[2.5rem] shadow-2xl overflow-hidden">

                {/* HEADER COM ABAS */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/20">
                    <div className="flex gap-6">
                        <button
                            onClick={() => { setAbaAtiva("arquivos"); setBusca(""); }}
                            className={`pb-2 text-sm font-black uppercase tracking-widest transition-all ${abaAtiva === "arquivos" ? "text-blue-500 border-b-2 border-blue-500" : "text-slate-600"}`}
                        >
                            Histórico de Arquivos
                        </button>
                        <button
                            onClick={() => { setAbaAtiva("individuais"); setBusca(""); }}
                            className={`pb-2 text-sm font-black uppercase tracking-widest transition-all ${abaAtiva === "individuais" ? "text-blue-500 border-b-2 border-blue-500" : "text-slate-600"}`}
                        >
                            Consultas Avulsas
                        </button>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/5 transition-colors"><X size={20} className="text-slate-500" /></button>
                </div>



                {/* TOOLBAR */}
                <div className="p-4 flex gap-4 bg-slate-900/40">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                        <input
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            placeholder={abaAtiva === "arquivos" ? "Buscar por nome do arquivo..." : "Buscar por CNPJ ou Razão Social..."}
                            className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-3 text-sm text-white focus:border-blue-500 transition-all outline-none"
                        />
                    </div>
                    <button
                        onClick={() => setOrdem(prev => prev === "desc" ? "asc" : "desc")}
                        className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-5 py-3 rounded-2xl text-xs font-bold text-slate-300 hover:border-blue-500/50 transition-all"
                    >
                        <ArrowUpDown size={16} className="text-blue-500" />
                        {ordem === "desc" ? "Mais Novos" : "Mais Antigos"}
                    </button>
                {abaAtiva === "individuais" && (
                    <button
                        onClick={handleSelecionarTudo}
                        className={`flex items-center gap-2 border px-5 py-3 rounded-2xl text-xs font-bold transition-all ${selecionados.length === avulsosFiltrados.length && avulsosFiltrados.length > 0
                                ? "bg-blue-600 border-blue-500 text-white"
                                : "bg-slate-900 border-slate-800 text-slate-300 hover:border-blue-500/50"
                            }`}
                    >
                        {selecionados.length === avulsosFiltrados.length && avulsosFiltrados.length > 0 ? (
                            <CheckSquare size={16} />
                        ) : (
                            <Square size={16} />
                        )}
                        {selecionados.length === avulsosFiltrados.length && avulsosFiltrados.length > 0 ? "Desmarcar Todos" : "Selecionar Todos"}
                    </button>
                )}
                </div>

                {/* LISTAGEM DINÂMICA */}
                {loading ? (
                    <div className="flex justify-center items-center h-40">
                        <LoaderCircle className="animate-spin h-8 w-8 text-blue-500" />
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">

                        {abaAtiva === "arquivos" ? (
                            arquivos.map((arq: ArquivoRadar) => (
                                <div key={arq.id} className="group p-4 rounded-3xl bg-slate-900/40 border border-slate-800 hover:border-blue-500/30 transition-all flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-2xl bg-blue-600/10 text-blue-500"><FileSpreadsheet size={24} /></div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-100">{arq.nome_arquivo}</p>
                                            <div className="flex items-center gap-3 text-[10px] text-slate-500 uppercase font-black mt-1">
                                                <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(arq.data_upload).toLocaleDateString()}</span>
                                                <span className="w-1 h-1 bg-slate-700 rounded-full" />
                                                <span>{arq.total_registros} registros</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => baixarArquivoEDados(arq.id, arq.nome_arquivo)}
                                        className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20"
                                    >
                                        Baixar Planilha
                                    </button>

                                </div>
                            ))
                        ) : (
                            avulsosFiltrados.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => toggleSelecao(item.id)}
                                    className={`p-4 rounded-3xl border transition-all cursor-pointer flex justify-between items-center ${selecionados.includes(item.id) ? "bg-blue-600/10 border-blue-500" : "bg-slate-900/40 border-slate-800 hover:border-slate-700"
                                        }`}
                                >
                                    <div className="flex flex-col gap-1">
                                        <p className="text-sm font-bold text-slate-200">
                                            {item.razao_social || "Sem Razão Social"}
                                        </p>
                                        <div className="flex items-center gap-3">
                                            <p className="text-xs text-blue-500 font-mono">{item.cnpj}</p>
                                            <span className="text-slate-700">|</span>
                                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-black uppercase">
                                                <Calendar size={12} className="text-slate-600" />
                                                {new Date(item.data_consulta).toLocaleDateString('pt-BR')}
                                            </div>
                                        </div>
                                    </div>

                                    {selecionados.includes(item.id) ? (
                                        <CheckCircle2 size={20} className="text-blue-500" />
                                    ) : (
                                        <div className="w-5 h-5 rounded-full border-2 border-slate-800" />
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* FOOTER PARA IMPORTAÇÃO AVULSA */}
                {abaAtiva === "individuais" && selecionados.length > 0 && (
                    <div className="p-6 border-t border-slate-800 bg-slate-900/20 flex justify-between items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-white">{selecionados.length} selecionados</span>
                            <span className="text-[10px] text-slate-500 uppercase font-black">Ações disponíveis</span>
                        </div>

                        <div className="flex gap-3">
                            {/* BOTÃO EXCLUIR DO BANCO */}
                            <button
                                onClick={handleExcluirDoBanco}
                                className="flex bg-violet-500 hover:bg-violet-400 active:scale-95 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-violet-500/20 border-t border-white/20 animate-in fade-in zoom-in duration-200 whitespace-nowrap"
                            >
                                <Database size={14} />
                                Excluir do Banco
                            </button>

                            {/* SEU BOTÃO DE IMPORTAR JÁ EXISTENTE */}
                            <button
                                onClick={() => onImportar(selecionados)}
                                className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20 border-t border-white/10"
                            >
                                Importar Consultas
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
