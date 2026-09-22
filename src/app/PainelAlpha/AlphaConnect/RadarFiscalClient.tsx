"use client";

import { useState, useCallback, useMemo } from "react"; 
import { HeaderRadar } from "./HeaderRadar";
import { TabelaRadar } from "./TabelaRadar";
import { toast } from "sonner";
import { excluirEmpresasAction } from "@/actions/RadarFiscal";

export default function RadarFiscalClient({ initialDados, style }: { initialDados: any[], style: any }) {
    const [filtro, setFiltro] = useState("todos");
    const [selecionados, setSelecionados] = useState<number[]>([]);

    const handleSelectionChange = useCallback((ids: number[]) => {
        setSelecionados(ids);
    }, []);

    const dadosFiltrados = useMemo(() => {
        const opcoesFixas = ["todos", "az", "za", "novos", "antigos", "divida_maior", "divida_minima", "anexo1", "anexo2", "premium", "qualificado", "desqualificado", "presumido", "real", "simples"];
        
        return [...initialDados]
            .filter(item => {
                const buscaNormalizada = filtro.trim().toUpperCase();
                
                if (!opcoesFixas.includes(filtro.toLowerCase()) && filtro !== "") {
                    const cnpjLimpo = (item.cnpj || "").replace(/\D/g, "");
                    const buscaCnpj = buscaNormalizada.replace(/\D/g, "");
                    const razao = (item.razao_social || item.razaoSocial || "").toUpperCase();
                    const fantasia = (item.nome_fantasia || item.nomeFantasia || "").toUpperCase();

                    return (buscaCnpj !== "" && cnpjLimpo.includes(buscaCnpj)) ||
                        razao.includes(buscaNormalizada) ||
                        fantasia.includes(buscaNormalizada);
                }

                if (filtro === "todos" || ["az", "za", "novos", "antigos", "divida_maior", "divida_minima"].includes(filtro)) return true;

                const qualif = (item.qualificacao || "").toUpperCase();
                const anexo = (item.perse_anexo || "").toUpperCase();
                const regime = (item.regime_ea || item.regimeEA || "").toUpperCase();

                if (filtro === "anexo1") return anexo.includes("1");
                if (filtro === "anexo2") return anexo.includes("2");
                if (filtro === "premium") return qualif === "PREMIUM";
                if (filtro === "qualificado") return qualif === "QUALIFICADO";
                if (filtro === "desqualificado") return ["NORMAL", "N/A", ""].includes(qualif) || !qualif;
                if (filtro === "presumido") return regime.includes("PRESUMIDO");
                if (filtro === "real") return regime.includes("REAL");
                if (filtro === "simples") return regime.includes("SIMPLES");

                return true;
            })
            .sort((a, b) => {
                const nomeA = (a.razao_social || a.razaoSocial || "").toUpperCase();
                const nomeB = (b.razao_social || b.razaoSocial || "").toUpperCase();
                const valorA = Number(a.divida_tributaria || 0);
                const valorB = Number(b.divida_tributaria || 0);
                const idA = Number(a.id || 0);
                const idB = Number(b.id || 0);

                switch (filtro) {
                    case "az": return nomeA.localeCompare(nomeB);
                    case "za": return nomeB.localeCompare(nomeA);
                    case "novos": return idB - idA;
                    case "antigos": return idA - idB;
                    case "divida_maior": return valorB - valorA;
                    case "divida_minima": return valorA - valorB;
                    default: return 0;
                }
            });
    }, [initialDados, filtro]);

    const handleExcluir = async () => {
        if (selecionados.length === 0) {
            toast.error("SELECIONE AO MENOS UMA EMPRESA");
            return;
        }
        if (!confirm(`DESEJA EXCLUIR AS ${selecionados.length} EMPRESAS SELECIONADAS?`)) return;
        const res = await excluirEmpresasAction(selecionados);
        if (res.success) {
            toast.success("EXCLUSÃO REALIZADA COM SUCESSO");
            setSelecionados([]);
        } else {
            toast.error("FALHA AO EXCLUIR REGISTROS");
        }
    };

    return (
        <main className="min-h-screen bg-[#020617] p-8 text-white relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-[600px] h-[600px] ${style.glow} opacity-5 blur-[150px]`} />
            <div className="max-w-[1600px] mx-auto relative z-10">
                <HeaderRadar
                    style={style}
                    dados={initialDados}
                    filtro={filtro}
                    onFilter={setFiltro}
                    onDelete={handleExcluir}
                    totalSelecionados={selecionados.length}
                />
                <div className="mt-8 bg-slate-900/40 border border-white/5 rounded-[2.5rem] backdrop-blur-md shadow-2xl overflow-hidden">
                    <TabelaRadar
                        dados={dadosFiltrados}
                        style={style}
                        selecionados={selecionados}
                        onSelectionChange={handleSelectionChange}
                    />
                </div>
            </div>
        </main>
    );
}
