"use client";

import { useState, type ReactNode } from "react";
import type { TemaAlpha } from "@/lib/temas";
import type { LucideIcon } from "lucide-react";
import { X, Search, Building2, ShieldCheck, History, Check, Loader2, MapPin, Landmark, Calendar, Activity } from "lucide-react";
import { toast } from "sonner";
import { protocolarNoRadarAction } from "@/actions/RadarFiscal";


type HistoricoRegime = { Ano?: string | number; ano?: string | number; Regime?: string; regime?: string };
type DadosConsulta = {
    cnpj?: string;
    consultaStatus?: string;
    razaoSocial?: string;
    nomeFantasia?: string;
    situacao?: string;
    municipio?: string;
    uf?: string;
    abertura?: string;
    capitalSocial?: string | number;
    capital_social?: string | number;
    regimeReceita?: string;
    regimeEA?: string;
    dataOpcao?: string;
    dataExclusao?: string;
    divida_tributaria?: number;
    perse?: string;
    perse_anexo?: string;
    perse_motivo?: string;
    anexo?: string;
    historicoRegime?: HistoricoRegime[];
};

export function ModalConsultarCNPJ({ isOpen, onClose, style }: { isOpen: boolean; onClose: () => void; style: TemaAlpha }) {
    const [cnpj, setCnpj] = useState("");
    const [dados, setDados] = useState<DadosConsulta | null>(null);
    const [loading, setLoading] = useState(false);
    const [salvando, setSalvando] = useState(false);


    const handleProtocolar = async () => {
        if (!dados?.cnpj) {
            toast.error("CNPJ NÃO ENCONTRADO");
            return;
        }
        if (dados.consultaStatus !== "completa") {
            toast.error("Consulta tributária parcial. Consulte novamente antes de protocolar.");
            return;
        }
    
        setSalvando(true);
    
        try {
            const payload = {
                ...dados,
                perse: dados.perse || "NÃO",
                anexo: dados.perse_anexo || dados.anexo || "NENHUM",
                capitalSocial: String(dados.capital_social || dados.capitalSocial || "0"),
                divida_tributaria: Number(dados.divida_tributaria || 0)
            };
    
            const res = await protocolarNoRadarAction(payload);
    
            if (res.success) {
                toast.success("AGENTE PROTOCOLADO NO RADAR!");
                if (onClose) onClose();
            } else {
                console.error("Erro Action:", res.error);
                toast.error(`FALHA AO PROTOCOLAR: ${res.error || 'ERRO DESCONHECIDO'}`);
            }
        } catch (error) {
            console.error("Erro Handle:", error);
            toast.error("ERRO CRÍTICO AO PROCESSAR PROTOCOLO");
        } finally {
            setSalvando(false);
        }
    };
    

    const handleConsultar = async () => {
        const cnpjLimpo = cnpj.replace(/\D/g, "");
        setDados(null);
        if (cnpjLimpo.length !== 14) return toast.error("CNPJ INVÁLIDO");
    
        setLoading(true);
        try {
            const resRadar = await fetch(`/api/RadarFiscal?cnpj=${cnpjLimpo}&forcar=true`);
            const dataRadar = await resRadar.json();
            if (!resRadar.ok || dataRadar.error) throw new Error(dataRadar.error || "Consulta indisponível");
    
            setDados(dataRadar);
            if (dataRadar.consultaStatus === "completa") toast.success("Análise Alpha Concluída!");
            else toast.warning("Consulta parcial: regime e qualificação não confirmados.");
    
        } catch (e: unknown) {
            console.error("Erro na consulta:", e);
            toast.error(e instanceof Error ? e.message : "FALHA NA CONEXÃO");
        } finally {
            setLoading(false);
        }
    };
    

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-[#020617] border border-white/10 p-1 rounded-[3.5rem] max-w-5xl w-full shadow-2xl relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-full h-1.5 ${style.bg} shadow-[0_0_20px_rgba(255,255,255,0.3)]`} />

                <div className="bg-[#0f172a] rounded-[3.4rem] p-10 max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-10">
                        <h2 className="text-2xl font-black uppercase italic tracking-tighter text-white flex items-center gap-3">
                            <Activity className={style.text} size={28} /> Inteligência de Dados
                        </h2>
                        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={30} /></button>
                    </div>

                    <div className="flex gap-4 mb-12 bg-black/20 p-4 rounded-[2.5rem] border border-white/5">
                        <input
                            value={cnpj}
                            onChange={(e) => { setCnpj(e.target.value.replace(/\D/g, "")); setDados(null); }}
                            placeholder="DIGITE O CNPJ PARA ANÁLISE..."
                            className="flex-1 bg-transparent px-6 text-lg font-black tracking-[0.2em] text-white outline-none"
                        />
                        <button
                            onClick={handleConsultar}
                            disabled={loading}
                            className={`px-12 h-16 ${style.bg} rounded-2xl font-black uppercase text-xs tracking-widest hover:brightness-110 transition-all active:scale-95 flex items-center gap-3 shadow-xl`}
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                            Analisar
                        </button>
                    </div>

                    <div className={`space-y-10 transition-all duration-500 ${!dados ? 'opacity-30 grayscale pointer-events-none' : 'opacity-100'}`}>

                        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <InfoCard label="Razão Social" value={dados?.razaoSocial || "---"} icon={Building2} />
                            <InfoCard label="Nome Fantasia" value={dados?.nomeFantasia || "---"} icon={Building2} />
                            <InfoCard label="Situação" value={dados?.situacao || "---"} icon={ShieldCheck} status />
                            <InfoCard label="Município / UF" value={dados ? `${dados.municipio} - ${dados.uf}` : "---"} icon={MapPin} />
                            <InfoCard label="Abertura" value={dados?.abertura || "---"} icon={Calendar} />
                            <InfoCard
                                label="Capital Social"
                                value={Number(dados?.capitalSocial).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                icon={Landmark}
                            />

                        </section>

                        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-black/30 p-8 rounded-[2.5rem] border border-white/5 space-y-4 shadow-inner">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 border-b border-white/5 pb-2">Receita Federal</h3>
                                <InfoRow label="Regime" value={dados?.regimeReceita || "---"} />
                                <InfoRow label="Opção Simples" value={dados?.dataOpcao || "---"} />
                                <InfoRow label="Exclusão Simples" value={dados?.dataExclusao || "---"} />
                            </div>

                            <div className="bg-black/30 p-8 rounded-[2.5rem] border border-white/5 space-y-4 shadow-inner">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 border-b border-white/5 pb-2">EmpresAqui</h3>
                                <InfoRow label="Regime" value={dados?.regimeEA || "---"} highlight style={style} />
                                <InfoRow
                                    label="Dívida Ativa"
                                    value={
                                        (dados?.divida_tributaria ?? 0) > 0
                                            ? `R$ ${Number(dados?.divida_tributaria ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                            : (dados ? "NÃO POSSUI DÍVIDAS" : "---")
                                    }
                                    color={(dados?.divida_tributaria ?? 0) > 0 ? "text-red-500" : "text-emerald-500"}
                                />
                            </div>
                        </section>

                        <section className="bg-black/40 p-8 rounded-[2.5rem] border border-white/10 relative overflow-hidden group">
                            {dados?.perse === "SIM" && (
                                <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 blur-[100px] pointer-events-none" />
                            )}

                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                <div className="space-y-1">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Veredito Fiscal</h3>
                                    <h4 className="text-xl font-black italic uppercase tracking-tighter text-white">Programa Verificador (PERSE)</h4>
                                </div>

                                <div className="flex items-center gap-4 bg-black/40 p-4 rounded-3xl border border-white/5 w-full md:w-auto justify-center">
                                    <div className="text-right">
                                        <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest">Enquadramento</span>
                                        <span className={`text-sm font-black uppercase ${dados?.perse === "SIM" ? "text-emerald-400" : "text-red-500"}`}>
                                            {dados?.perse || "---"}
                                        </span>
                                    </div>
                                    <div className={`w-px h-8 bg-white/10`} />
                                    <div className="text-left">
                                        <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest">Lista de Atividades</span>
                                        <span className="text-sm font-black uppercase text-white">
                                            {dados?.perse_anexo || "NÃO"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {dados && dados.perse === "NÃO" && (
                                <div className="mt-6 p-4 bg-red-500/5 border border-red-500/10 rounded-2xl">
                                    <p className="text-[10px] font-bold text-red-400/80 uppercase tracking-widest text-center">
                                        Inabilitado: {dados.perse_motivo || "Critérios técnicos não atingidos"}
                                    </p>
                                </div>
                            )}
                        </section>


                        <section>
                            <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-6 flex items-center gap-3">
                                <History size={16} className={style.text} /> Evolução Tributária Anual (2018 - 2023)
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                                {[2018, 2019, 2020, 2021, 2022, 2023].map(ano => {
                                    const registro = dados?.historicoRegime?.find((h: HistoricoRegime) =>
                                        String(h.Ano) === String(ano) || String(h.ano) === String(ano)
                                    );

                                    return (
                                        <div key={ano} className="bg-white/5 border border-white/5 rounded-2xl p-4 text-center group hover:border-white/20 transition-all">
                                            <span className="block text-[10px] font-black text-slate-600 mb-2">{ano}</span>
                                            <span className="text-[9px] font-black text-white uppercase leading-tight">
                                                {registro?.Regime || registro?.regime || "SEM INFORMAÇÃO"}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                        </section>

                        <button
                            onClick={handleProtocolar}
                            disabled={salvando}
                            className={`w-full h-20 ${style.bg} rounded-[2rem] text-xs font-black uppercase tracking-[0.5em] hover:brightness-110 transition-all shadow-2xl flex items-center justify-center gap-4`}
                        >
                            {salvando ? <Loader2 className="animate-spin" size={24} /> : <Check size={24} />}
                            Protocolar no Radar Fiscal
                        </button>

                    </div>
                </div>
            </div>
        </div>
    );
}

function InfoCard({ label, value, icon: Icon, status }: { label: string; value: ReactNode; icon: LucideIcon; status?: boolean }) {
    return (
        <div className="bg-black/40 border border-white/5 p-6 rounded-[2rem] space-y-2">
            <div className="flex items-center gap-2 text-slate-600 uppercase font-black text-[9px] tracking-widest">
                <Icon size={14} /> {label}
            </div>
            <p className={`text-[11px] font-black uppercase truncate ${status && value === 'ATIVA' ? 'text-emerald-500' : 'text-white'}`}>
                {value}
            </p>
        </div>
    );
}

function InfoRow({ label, value, highlight, color, style }: { label: string; value: ReactNode; highlight?: boolean; color?: string; style?: TemaAlpha }) {
    return (
        <div className="flex justify-between items-center py-3 border-b border-white/[0.03]">
            <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">{label}</span>
            <span className={`text-[11px] font-black uppercase ${color || (highlight ? (style?.text || 'text-blue-400') : 'text-slate-300')}`}>{value}</span>
        </div>
    );
}
