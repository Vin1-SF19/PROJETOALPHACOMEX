"use client";

import { atualizarRadar } from "@/actions/PreAnalise";
import { fmtDateTime } from "@/lib/format-date";
import {
    ShieldCheck, BarChart3, MapPin,
    Users, Phone, Mail, Landmark, User, History
} from "lucide-react";
import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { FichaAlphaPDF } from "@/components/GerarFicha";
import { ModalPDF } from "@/components/ModalPdf";

interface Props {
    dados: any;
    visual: any;
    userName: string;
}

export default function BlocoResultados({ dados, visual, userName }: Props) {
    const rfb = dados.rfb?.dados || {};
    const empresaqui = dados.empresaqui?.dados || {};
    const [loadingRadar, setLoadingRadar] = useState(false);
    const [showModal, setShowModal] = useState(false);

    const radarSalvo = dados?.radar?.dados && typeof dados.radar.dados === "object" && Object.keys(dados.radar.dados).length > 0
        ? dados.radar.dados
        : null;

    const [etapas, setEtapas] = useState({
        radar: {
            status: radarSalvo ? "success" : "idle" as "success" | "idle" | "loading" | "error",
            dados: radarSalvo,
            consultadoEm: (dados?.radar as any)?.consultadoEm ?? null,
        }
    });

    const dadosExibicaoRadar = etapas.radar.dados || {};
    const historico = empresaqui.historico_regime || empresaqui.historicoRegime || [];

    const estadosBrasileiros: Record<string, string> = {
        AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará",
        DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão",
        MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará",
        PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro",
        RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima",
        SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins"
    };

    const consultaUnitaria = async (e?: React.MouseEvent) => {
        e?.preventDefault();
        const cnpjParaConsultar = rfb.cnpj?.replace(/\D/g, "");
        if (!cnpjParaConsultar || loadingRadar) return;

        setLoadingRadar(true);
        setEtapas(prev => ({ ...prev, radar: { ...prev.radar, status: "loading" } }));

        try {
            const response = await fetch(`/api/ConsultaRadar?cnpj=${cnpjParaConsultar}`);
            const resRadar = await response.json();
            const sucesso = !resRadar.error;
            const agora = sucesso ? new Date().toISOString() : null;

            setEtapas(prev => ({
                ...prev,
                radar: {
                    status: sucesso ? "success" : "error",
                    dados: resRadar,
                    consultadoEm: agora ?? prev.radar.consultadoEm,
                }
            }));

            if (sucesso) {
                const saveResult = await atualizarRadar(cnpjParaConsultar, resRadar);
                if (saveResult.error) console.error("Radar não salvo:", saveResult.error);
            }
        } catch {
            setEtapas(prev => ({ ...prev, radar: { ...prev.radar, status: "error", dados: null } }));
        } finally {
            setLoadingRadar(false);
        }
    };

    return (
        <>
            <div className="space-y-6 md:space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-1000">

                {/* HEADER: RAZÃO SOCIAL E STATUS */}
                <div className="p-6 md:p-12 rounded-[2rem] md:rounded-[4rem] bg-white/5 border border-white/10 backdrop-blur-3xl relative overflow-hidden">
                    <div className={`absolute top-0 right-0 w-96 h-96 ${visual.bg} opacity-10 blur-[120px]`} />

                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 relative z-10">
                        <div className="max-w-4xl space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-[1px] bg-indigo-500/50" />
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">
                                    Identificação Empresarial
                                </span>
                            </div>
                            <div className="relative">
                                <h2 className="text-4xl md:text-7xl font-black uppercase italic tracking-tighter text-white leading-[0.9] drop-shadow-2xl">
                                    {rfb.razaoSocial || "NÃO LOCALIZADO"}
                                </h2>
                                <div className="mt-6 flex flex-col md:flex-row md:items-center gap-4">
                                    <p className="text-slate-500 font-mono text-xs md:text-lg tracking-[0.2em] uppercase border-l-2 border-white/10 pl-4">
                                        {rfb.nomeFantasia !== "Sem nome fantasia"
                                            ? rfb.nomeFantasia
                                            : "NOME FANTASIA NÃO REGISTRADO"}
                                    </p>
                                    {rfb.cnpj && (
                                        <span className="text-[14px] font-bold bg-white/5 text-slate-400 px-3 py-1 rounded-full border border-white/5 w-fit uppercase">
                                            {rfb.cnpj}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Situação Cadastral</span>
                            <div className={`px-6 py-3 rounded-2xl border font-black text-sm md:text-base uppercase tracking-tighter transition-all ${
                                rfb.situacao === "ATIVA"
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.1)]"
                                    : "bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-[0_0_30px_rgba(244,63,94,0.1)]"
                            }`}>
                                {rfb.situacao || "N/A"}
                            </div>

                            <div className="mt-10 flex flex-col items-center">
                                <button
                                    onClick={() => { document.body.style.overflow = "hidden"; setShowModal(true); }}
                                    className="cursor-pointer flex items-center gap-2.5 px-6 py-3 bg-[#FF6B00] text-white font-semibold rounded-lg shadow-md hover:bg-[#E66000] transition-all"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Gerar Ficha em PDF
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">

                    {/* COLUNA ESQUERDA */}
                    <div className="lg:col-span-8 space-y-6 md:space-y-10">

                        {/* BLOCO 1: INFOS GERAIS */}
                        <div className="p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] bg-slate-900/40 border border-white/5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 md:gap-10">
                            <DataField label="Data de Abertura" value={rfb.dataConstituicao} />
                            <DataField label="Porte da Empresa" value={rfb.porte} />
                            <DataField
                                label="Capital Social"
                                value={rfb.capitalSocial
                                    ? Number(rfb.capitalSocial).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                                    : "R$ 0,00"}
                            />
                            <DataField label="Natureza Jurídica" value={rfb.natureza_juridica} fullWidth />

                            <div className="flex flex-col gap-4 pt-4 border-t border-white/5">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">CNAEs Identificados</span>

                                <div className="grid grid-cols-6 gap-4 w-200">
                                    {(() => {
                                        const principal = Array.isArray(rfb?.atividade_principal) ? rfb.atividade_principal : [];
                                        const secundarios = Array.isArray(rfb?.atividades_secundarias) ? rfb.atividades_secundarias : [];
                                        const listaCnaes = [...principal, ...secundarios];

                                        if (listaCnaes.length === 0) {
                                            return (
                                                <div className="w-full py-4 border border-dashed border-white/10 rounded-2xl text-center">
                                                    <span className="text-[10px] text-slate-600 font-black uppercase">Nenhum CNAE localizado</span>
                                                </div>
                                            );
                                        }

                                        return listaCnaes.map((cnae: any, i: number) => {
                                            const codigo = cnae.code || cnae.codigo;
                                            const descricao = cnae.text || cnae.descricao;
                                            const isPrincipal = i === 0;

                                            return (
                                                <div key={i} className="group relative">
                                                    <div className={`cursor-help px-3 py-1.5 rounded-lg border transition-all duration-300 flex items-center gap-2 ${
                                                        isPrincipal
                                                            ? "bg-indigo-500/10 border-indigo-500/30 hover:bg-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.1)]"
                                                            : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                                                    }`}>
                                                        {isPrincipal && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />}
                                                        <span className={`text-[10px] font-mono font-black tracking-wider ${isPrincipal ? "text-indigo-300" : "text-slate-400"}`}>
                                                            {codigo}
                                                        </span>
                                                    </div>
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-3 bg-[#0F172A] border border-white/10 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 z-[100]">
                                                        <p className="text-[9px] text-indigo-400 font-black uppercase mb-1 tracking-widest">
                                                            {isPrincipal ? "Atividade Principal" : "Atividade Secundária"}
                                                        </p>
                                                        <p className="text-[10px] leading-relaxed text-white font-bold uppercase italic">{descricao}</p>
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-[#0F172A]" />
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* BLOCO 2: QSA */}
                        <div className="p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] bg-slate-900/40 border border-white/5">
                            <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-6">
                                <Users size={24} className={visual.text} />
                                <h3 className="text-sm md:text-base font-black uppercase tracking-[0.2em] text-white">Quadro de Sócios e Administradores (QSA)</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {rfb.qsa?.length > 0
                                    ? rfb.qsa.map((socio: any, i: number) => (
                                        <div key={i} className="flex items-center gap-6 p-6 rounded-[1.5rem] bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                                            <div className="p-4 rounded-xl bg-white/5"><User size={20} className="text-slate-400" /></div>
                                            <div className="min-w-0">
                                                <p className="text-xs md:text-sm font-black text-white uppercase truncate">{socio.nome}</p>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase mt-1 italic tracking-widest">{socio.qual}</p>
                                            </div>
                                        </div>
                                    ))
                                    : <p className="text-xs text-slate-600 uppercase font-black tracking-widest p-4">Informação não disponível ou Individual</p>
                                }
                            </div>
                        </div>

                        {/* BLOCO 3: ENDEREÇO */}
                        <div className="p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] bg-slate-900/40 border border-white/5">
                            <div className="flex items-center gap-4 mb-8">
                                <MapPin size={24} className={visual.text} />
                                <h3 className="text-sm md:text-base font-black uppercase tracking-[0.2em] text-white">Localização Completa</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 md:gap-12">
                                <DataField label="Logradouro" value={`${rfb.logradouro}, ${rfb.numero}`} />
                                <DataField label="Bairro" value={rfb.bairro} />
                                <DataField label="Município" value={rfb.municipio} />
                                <DataField label="Estado (UF)" value={estadosBrasileiros[rfb.uf?.toUpperCase()] || rfb.uf || "---"} />
                                <DataField label="CEP" value={rfb.cep} />
                                <DataField label="País" value="BRASIL" />
                            </div>
                        </div>
                    </div>

                    {/* COLUNA DIREITA */}
                    <div className="lg:col-span-4 space-y-6 md:space-y-10">

                        {/* SISCOMEX / RADAR */}
                        <div className={`p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border transition-all duration-700 ${
                            etapas.radar.status === "idle"
                                ? "bg-white/[0.02] border-white/5"
                                : "bg-blue-500/5 border-blue-500/20 shadow-xl"
                        }`}>
                            {etapas.radar.status === "idle" ? (
                                <div className="py-12 flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-500">
                                    <div className="p-4 rounded-full bg-blue-500/10 mb-2">
                                        <ShieldCheck size={40} className="text-blue-500/50" />
                                    </div>
                                    <div className="text-center">
                                        <h4 className="text-white font-black uppercase tracking-widest text-sm">Habilitação Radar</h4>
                                        <p className="text-slate-500 text-[10px] uppercase mt-2">Consulta opcional sob demanda</p>
                                    </div>
                                    <button
                                        onClick={consultaUnitaria}
                                        className="px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-white shadow-lg w-full max-w-[250px] transition-all active:scale-95 cursor-pointer"
                                    >
                                        Iniciar Consulta
                                    </button>
                                </div>
                            ) : (
                                <div className="animate-in fade-in slide-in-from-top-4 duration-700 space-y-6">
                                    <div className="flex items-start justify-between mb-8 gap-4">
                                        <div className="flex items-start gap-4">
                                            <ShieldCheck size={24} className={etapas.radar.status === "error" ? "text-red-400" : "text-blue-400"} />
                                            <div>
                                                <h3 className="text-sm font-black uppercase tracking-widest text-white">Radar Siscomex</h3>
                                                {etapas.radar.consultadoEm ? (
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                                        Consultado em{" "}
                                                        <span className="text-blue-400">
                                                            {fmtDateTime(etapas.radar.consultadoEm)}
                                                        </span>
                                                    </p>
                                                ) : (
                                                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-1">
                                                        Data de consulta não disponível
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            onClick={consultaUnitaria}
                                            disabled={loadingRadar}
                                            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 transition-all cursor-pointer disabled:opacity-50 flex-shrink-0"
                                        >
                                            {loadingRadar ? "Consultando..." : "Reconsultar"}
                                        </button>
                                    </div>

                                    <div className="space-y-6">
                                        {etapas.radar.status === "error" ? (
                                            <div className="py-6 px-4 rounded-2xl bg-red-500/5 border border-red-500/20 text-center">
                                                <p className="text-red-400 text-[10px] font-black uppercase tracking-widest">Falha na consulta. Tente novamente.</p>
                                            </div>
                                        ) : (
                                            <div className={loadingRadar ? "opacity-40 animate-pulse pointer-events-none" : ""}>
                                                <DataField label="Submodalidade de Atuação" value={dadosExibicaoRadar?.submodalidade || "Não Habilitado"} />
                                                <DataField label="Status de Habilitação" value={dadosExibicaoRadar?.situacao || "---"} />
                                                <DataField label="Última Atualização" value={dadosExibicaoRadar?.dataSituacao || "---"} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* REGIME FISCAL */}
                        <div className={`p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border ${visual.border} bg-white/5 shadow-2xl backdrop-blur-sm`}>
                            <div className="flex items-center gap-4 mb-10">
                                <Landmark size={24} className={visual.text} />
                                <h3 className="text-sm md:text-base font-black uppercase tracking-[0.2em] text-white">Regime TRIBUTÁRIO</h3>
                            </div>
                            <div className="space-y-6">
                                <StatusRow label="Simples Nacional" active={rfb.optante_simples} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <DataField label="Data de Opção (Simples)" value={rfb.data_opcao || "N/A"} />
                                    <DataField label="Data de Exclusão (Simples)" value={rfb.data_exclusaoSimples || "N/A"} />
                                </div>
                                <div className="h-[1px] bg-white/5 my-6" />
                                <StatusRow label="MEI (Microempreendedor)" active={rfb.optante_simei} />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <DataField label="Data de Opção (MEI)" value={rfb.data_opcaoSimei || "N/A"} />
                                    <DataField label="Data de Exclusão (MEI)" value={rfb.data_exclusaoSimei || "N/A"} />
                                </div>
                            </div>
                        </div>

                        {/* EMPRESAQUI */}
                        <div className="p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] bg-purple-500/5 border border-purple-500/20 shadow-xl">
                            <div className="flex items-center gap-4 mb-8">
                                <BarChart3 size={24} className="text-purple-400" />
                                <h3 className="text-sm md:text-base font-black uppercase tracking-[0.2em] text-white">Analise Empresaqui</h3>
                            </div>
                            <div className="space-y-6">
                                <DataField label="Regime Identificado" value={empresaqui.regimeEA} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* EVOLUÇÃO TRIBUTÁRIA */}
                {historico.length > 0 && (
                    <div className="p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] bg-slate-900/40 border border-white/5">
                        <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-6">
                            <History size={24} className={visual.text} />
                            <h3 className="text-sm md:text-base font-black uppercase tracking-[0.2em] text-white">Evolução Tributária Anual</h3>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4">
                            {[2021, 2022, 2023, 2024, 2025].map(ano => {
                                const registro = historico.find((h: any) =>
                                    String(h.Ano || h.ano || h.periodo).includes(String(ano))
                                );
                                return (
                                    <div key={ano} className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center hover:bg-white/10 transition-all">
                                        <span className="block text-xs font-black text-slate-500 mb-3">{ano}</span>
                                        <span className={`text-[10px] font-black uppercase leading-tight ${registro ? "text-white" : "text-slate-700"}`}>
                                            {registro?.Regime || registro?.regime || "---"}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* CONTATOS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <ContactInfo icon={<Mail size={20} />} label="Canal de E-mail" value={rfb.email} />
                    <ContactInfo icon={<Phone size={20} />} label="Terminal Telefônico" value={rfb.telefone} />
                </div>
            </div>

            <ModalPDF
                isOpen={showModal}
                onClose={() => { document.body.style.overflow = "unset"; setShowModal(false); }}
                dados={dados}
                radarDados={etapas.radar.dados}
                user={userName}
            />
        </>
    );
}

function DataField({ label, value, fullWidth = false }: { label: string; value?: string | null; fullWidth?: boolean }) {
    return (
        <div className={`${fullWidth ? "col-span-1 sm:col-span-2 md:col-span-4" : ""} min-w-0`}>
            <p className="text-[10px] md:text-[11px] font-black text-slate-600 uppercase tracking-[0.2em] mb-2">{label}</p>
            <p className="text-sm md:text-lg font-bold text-slate-100 uppercase italic leading-tight break-words">{value || "---"}</p>
        </div>
    );
}

function StatusRow({ label, active }: { label: string; active: boolean }) {
    return (
        <div className="flex justify-between items-center gap-4">
            <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{label}</span>
            <span className={`text-[11px] font-black px-5 py-2 rounded-lg ${
                active
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
            }`}>
                {active ? "SIM" : "NÃO"}
            </span>
        </div>
    );
}

function ContactInfo({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
    return (
        <div className="p-8 rounded-[2rem] bg-white/5 border border-white/5 flex items-center gap-6 group hover:bg-white/[0.08] transition-all">
            <div className="text-slate-500 group-hover:text-white transition-colors">{icon}</div>
            <div className="min-w-0">
                <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-xs md:text-sm font-bold text-white truncate uppercase italic">{value || "---"}</p>
            </div>
        </div>
    );
}
