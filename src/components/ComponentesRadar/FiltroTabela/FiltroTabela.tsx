"use client";
import { useState, useRef, useEffect } from "react";
import {
    SlidersHorizontal,
    SortAsc,
    SortDesc,
    Calendar,
    CheckCircle2,
    XCircle,
    Ban,
    PauseCircle,
    ShieldCheck,
    Ghost
} from "lucide-react";

type Props = {
    ordem: "todos" | "asc" | "desc" | null;
    ordemData: "todos" | "recentes" | "antigos" | null;
    filtroStatus: "todos" | "erro" | "sucesso";
    filtroSituacao: "todos" | "DEFERIDA" | "NÃO HABILITADA" | "SUSPENSA" | "SEM STATUS";

    setOrdem: (v: "todos" | "asc" | "desc" | null) => void;
    setOrdemData: (v: "todos" | "recentes" | "antigos" | null) => void;
    setFiltroStatus: (v: "todos" | "erro" | "sucesso") => void;

    setFiltroSituacao: React.Dispatch<
        React.SetStateAction<
            "todos" | "DEFERIDA" | "NÃO HABILITADA" | "SUSPENSA" | "SEM STATUS"
        >
    >;

    totalSelecionados: number;

    onAlternarOrdemNome: () => void;
    onAlternarOrdemData: () => void;
    onRemoverSelecionados: () => void;
    onSelecionarTodos: () => void;
    todosSelecionados: boolean;
    filtroErro: boolean;
    setFiltroErro: (v: boolean) => void;
    loading: boolean;
    totalEmpresas: number;

    filtroSubmodalidade: "todos" | "LIMITADA (ATÉ US$ 50.000)" | "LIMITADA (ATÉ US$ 150.000)" | "ILIMITADA";
    setFiltroSubmodalidade: React.Dispatch<
        React.SetStateAction<
            "todos" | "LIMITADA (ATÉ US$ 50.000)" | "LIMITADA (ATÉ US$ 150.000)" | "ILIMITADA"
        >
    >;

};



type EmpresaRadar = {
    dataConsulta: string;
    cnpj: string;
    contribuinte: string;
    situacao: string;
    dataSituacao: string;
    submodalidade: string;
    razaoSocial: string;
    nomeFantasia: string;
    municipio: string;
    uf: string;
    dataConstituicao: string;
    regimeTributario: string;
    data_opcao: string;
    optante: boolean;
    capitalSocial: string;

    salvo?: boolean;
    origem?: string;
};

export default function FiltrosPopover({
    ordem,
    ordemData,
    filtroStatus,
    filtroSituacao,
    setOrdem,
    setOrdemData,
    setFiltroStatus,
    setFiltroSituacao,
    totalSelecionados,
    filtroSubmodalidade,
    setFiltroSubmodalidade,
}: Props) {
    const [aberto, setAberto] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const [empresas, setEmpresas] = useState<EmpresaRadar[]>([]);
    const normalize = (val: any) => String(val || "").toUpperCase();




    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setAberto(false);
            }
        }

        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, []);

    const temFiltroAtivo =
        ordem ||
        ordemData ||
        filtroStatus !== "todos" ||
        filtroSituacao !== "todos";




    return (
        <div className="relative inline-block" ref={ref}>
            {/* Botão principal */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setAberto(!aberto);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border ${temFiltroAtivo
                    ? "bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-900/40"
                    : "bg-slate-800/40 border-slate-700 text-slate-300 hover:bg-slate-800"
                    }`}
            >
                <SlidersHorizontal size={14} />
                Filtrar
            </button>

            {/* Popover */}
            {aberto && (
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-full mb-3 right-0 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-4 z-50"
                >
                    {/* Ordenação */}
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
                        Ordenação
                    </h3>

                    <div className="flex gap-2 mb-3">
                        <button
                            onClick={() => setOrdem(ordem === "asc" ? "todos" : "asc")}
                            className={`flex-1 px-3 py-2 rounded-lg border text-xs ${ordem === "asc"
                                ? "bg-blue-600 text-white border-blue-400"
                                : "bg-slate-800 border-slate-700 text-slate-400"
                                }`}
                        >
                            <SortAsc size={14} />
                            A-Z
                        </button>

                        <button
                            onClick={() => setOrdem(ordem === "desc" ? "todos" : "desc")}
                            className={`flex-1 px-3 py-2 rounded-lg border text-xs ${ordem === "desc"
                                ? "bg-blue-600 text-white border-blue-400"
                                : "bg-slate-800 border-slate-700 text-slate-400"
                                }`}
                        >
                            <SortDesc size={14} />
                            Z-A
                        </button>
                    </div>

                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => setOrdemData(ordemData === "recentes" ? "todos" : "recentes")}
                            className={`flex-1 px-3 py-2 rounded-lg border text-xs ${ordemData === "recentes"
                                ? "bg-blue-600 text-white border-blue-400"
                                : "bg-slate-800 border-slate-700 text-slate-400"
                                }`}
                        >
                            <Calendar size={14} />
                            Recentes
                        </button>

                        <button
                            onClick={() => setOrdemData(ordemData === "antigos" ? "todos" : "antigos")}
                            className={`flex-1 px-3 py-2 rounded-lg border text-xs ${ordemData === "antigos"
                                ? "bg-blue-600 text-white border-blue-400"
                                : "bg-slate-800 border-slate-700 text-slate-400"
                                }`}
                        >
                            <Calendar size={14} />
                            Antigos
                        </button>
                    </div>

                    {/* Status */}
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
                        Status
                    </h3>

                    <div className="grid grid-cols-2 gap-2 mb-4">
                        <button
                            onClick={() => setFiltroStatus(filtroStatus === "sucesso" ? "todos" : "sucesso")}
                            className={`flex-1 px-3 py-2 rounded-lg border text-xs ${filtroStatus === "sucesso"
                                ? "bg-emerald-600 text-white border-emerald-400"
                                : "bg-slate-800 border-slate-700 text-slate-400"
                                }`}
                        >
                            <CheckCircle2 size={14} />
                            Sucesso
                        </button>

                        <button
                            onClick={() => setFiltroStatus(filtroStatus === "erro" ? "todos" : "erro")}
                            className={`flex-1 px-3 py-2 rounded-lg border text-xs ${filtroStatus === "erro"
                                ? "bg-rose-600 text-white border-rose-400"
                                : "bg-slate-800 border-slate-700 text-slate-400"
                                }`}
                        >
                            <XCircle size={14} />
                            Erro
                        </button>

                    </div>


                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 mt-4">
                        Submodalidade
                    </h3>
                    <div className="flex flex-col gap-2 mb-4">
                        <button
                            onClick={() => {
                                const valor = filtroSubmodalidade === "LIMITADA (ATÉ US$ 50.000)" ? "todos" : "LIMITADA (ATÉ US$ 50.000)";
                                console.log("CLIQUE NO FILTRO SUB:", valor);
                                setFiltroSubmodalidade(valor);
                            }}
                            className={`px-3 py-2 rounded-lg border text-xs transition-all ${filtroSubmodalidade === "LIMITADA (ATÉ US$ 50.000)"
                                ? "bg-blue-600 text-white border-blue-400"
                                : "bg-slate-800 border-slate-700 text-slate-400"
                                }`}
                        >
                            50k
                        </button>

                        <button
                            onClick={() => setFiltroSubmodalidade(filtroSubmodalidade === "LIMITADA (ATÉ US$ 150.000)" ? "todos" : "LIMITADA (ATÉ US$ 150.000)")}
                            className={`px-3 py-2 rounded-lg border text-xs transition-all ${filtroSubmodalidade === "LIMITADA (ATÉ US$ 150.000)"
                                ? "bg-orange-600 text-white border-orange-400"
                                : "bg-slate-800 border-slate-700 text-slate-400"
                                }`}
                        >
                            150k
                        </button>

                        <button
                            onClick={() => setFiltroSubmodalidade(filtroSubmodalidade === "ILIMITADA" ? "todos" : "ILIMITADA")}
                            className={`px-3 py-2 rounded-lg border text-xs transition-all ${filtroSubmodalidade === "ILIMITADA"
                                ? "bg-purple-600 text-white border-purple-400"
                                : "bg-slate-800 border-slate-700 text-slate-400"
                                }`}
                        >
                            Ilimitada
                        </button>
                    </div>


                    {/* Situação */}
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
                        Situação
                    </h3>

                    <div className="flex flex-col gap-2 mb-4">
                        <button
                            onClick={() => setFiltroSituacao(filtroSituacao === "DEFERIDA" ? "todos" : "DEFERIDA")}
                            className={`px-3 py-2 rounded-lg border text-xs ${filtroSituacao === "DEFERIDA"
                                ? "bg-emerald-600 text-white border-emerald-400"
                                : "bg-slate-800 border-slate-700 text-slate-400"
                                }`}
                        >
                            <ShieldCheck size={14} />
                            DEFERIDA
                        </button>

                        <button
                            onClick={() => setFiltroSituacao(filtroSituacao === "NÃO HABILITADA" ? "todos" : "NÃO HABILITADA")}
                            className={`px-3 py-2 rounded-lg border text-xs ${filtroSituacao === "NÃO HABILITADA"
                                ? "bg-yellow-600 text-white border-yellow-400"
                                : "bg-slate-800 border-slate-700 text-slate-400"
                                }`}
                        >
                            <Ban size={14} />
                            NÃO HABILITADA
                        </button>

                        <button
                            onClick={() => setFiltroSituacao(filtroSituacao === "SUSPENSA" ? "todos" : "SUSPENSA")}
                            className={`px-3 py-2 rounded-lg border text-xs ${filtroSituacao === "SUSPENSA"
                                ? "bg-orange-600 text-white border-orange-400"
                                : "bg-slate-800 border-slate-700 text-slate-400"
                                }`}
                        >
                            <PauseCircle size={14} />
                            SUSPENSA
                        </button>

                        <button
                            onClick={() => setFiltroSituacao(filtroSituacao === "SEM STATUS" ? "todos" : "SEM STATUS")}
                            className={`px-3 py-2 rounded-lg border text-xs ${filtroSituacao === "SEM STATUS"
                                ? "bg-red-600 text-white border-red-400"
                                : "bg-slate-800 border-slate-700 text-slate-400"
                                }`}
                        >
                            <Ghost size={14} />
                            SEM STATUS
                        </button>
                    </div>

                    <button
                        onClick={() => {
                            setOrdem(null);
                            setOrdemData(null);
                            setFiltroStatus("todos");
                            setFiltroSituacao("todos");
                        }}
                        className="w-full py-2 rounded-lg text-xs font-bold uppercase tracking-widest bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
                    >
                        Limpar filtros
                    </button>
                </div>
            )}
        </div>
    );
}
