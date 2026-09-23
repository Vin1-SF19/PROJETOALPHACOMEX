import * as XLSX from "xlsx";
import { useRef } from "react";

type EmpresaImportada = {
    cnpj: string;
    dataConsulta: string;
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
    capitalSocial: string;
    optante: boolean;
};

type Props = {
    onImportar: (dados: EmpresaImportada[]) => void;
    processando: boolean;
    onCancelar: () => void;
    statusLote?: string;      
    processadas?: number;
    totalLote?: number;
};

export default function ImportarPlanilha({ onImportar, processando, onCancelar }: Props) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const tratarDataExcel = (valor: unknown) => {
        if (!valor || valor === "" || valor === "N/A" || valor === "undefined") return "";
        if (valor instanceof Date) return valor.toISOString();
        return String(valor).trim();
    };

    async function handleArquivoSelecionado(event: React.ChangeEvent<HTMLInputElement>) {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const empresasImportadas: EmpresaImportada[] = [];

        for (const file of Array.from(files)) {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

            rows.forEach((row) => {
                const valorCnpj = row["CNPJ"] || row["cnpj"] || Object.values(row)[0];
                const cnpjLimpo = String(valorCnpj || "").replace(/\D/g, "").padStart(14, "0").substring(0, 14);

                if (cnpjLimpo.length < 11 || cnpjLimpo === "00000000000000") return;

                empresasImportadas.push({
                    cnpj: cnpjLimpo,
                    dataConsulta: tratarDataExcel(row["Data Consulta"] || row["dataConsulta"]),
                    contribuinte: String(row["Contribuinte"] || row["contribuinte"] || "").toUpperCase(),
                    situacao: String(row["Situação"] || row["Situacao"] || row["situacao"] || "").toUpperCase(),
                    dataSituacao: tratarDataExcel(row["Data Situacao"] || row["dataSituacao"] || row["Data"]),
                    submodalidade: String(row["Submodalidade"] || row["submodalidade"] || "").toUpperCase(),
                    razaoSocial: String(row["Razão Social"] || row["Razao Social"] || row["razaoSocial"] || "").toUpperCase(),
                    nomeFantasia: String(row["Nome Fantasia"] || row["nomeFantasia"] || "").toUpperCase(),
                    municipio: String(row["Município"] || row["Municipio"] || row["municipio"] || "").toUpperCase(),
                    uf: String(row["UF"] || row["uf"] || "").toUpperCase(),
                    dataConstituicao: tratarDataExcel(row["Data Constituição"] || row["dataConstituicao"]),
                    regimeTributario: String(row["Regime Tributário"] || row["Regime Tributario"] || row["regimeTributario"] || ""),
                    data_opcao: tratarDataExcel(row["Data Opção"] || row["data_opcao"] || row["DataSimples"]),
                    capitalSocial: String(row["Capital Social"] || row["capitalSocial"] || row["Capital"] || "0"),
                    optante: false,
                });
            });
        }

        if (empresasImportadas.length > 0) onImportar(empresasImportadas);
        event.target.value = "";
    }

    return (
        <div className="pt-6 border-t border-white/5 space-y-4">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-2">
                {processando ? "Status do Processamento" : "Carga de Dados em Lote"}
            </label>
            <div className="relative group">
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleArquivoSelecionado} />
                <button
                    onClick={() => processando ? onCancelar() : fileInputRef.current?.click()}
                    className="w-full h-16 rounded-[1.5rem] flex items-center justify-between px-8 transition-all duration-500 border border-white/10 bg-white/5 hover:bg-white/10"
                >
                    <span className="text-xs font-bold text-slate-300">
                        {processando ? "CANCELAR PROCESSAMENTO" : "SELECIONAR PLANILHA"}
                    </span>
                </button>
                {processando && (
                    <div className="absolute -bottom-1 left-0 h-[2px] bg-red-500 w-full animate-pulse shadow-[0_0_10px_#ef4444]" />
                )}
            </div>
        </div>
    );
}
