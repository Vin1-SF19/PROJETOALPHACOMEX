"use client"

import { useState } from 'react';
import { ChevronDown, Info, FileText, CheckCircle2 } from 'lucide-react';
import { getTema } from '@/lib/temas';

type EmpresaEmbasamento = {
    razaoSocial: string;
    cnpj?: string | null;
    cliente?: { nome?: string | null } | null;
    regimeTributario?: string | null;
    submodalidade?: string | null;
    progresso?: number | null;
};

export default function EmbasamentoRetomada({ empresa, configBanco }: { empresa: EmpresaEmbasamento, configBanco?: { tema?: string | null } | null }) {
    const temaNome = configBanco?.tema || "blue";

    const style = getTema(temaNome);

    return (
        <>
            <div className="fixed inset-0 pointer-events-none">

                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[100px] rounded-full" />
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com')] opacity-[0.03]" />
                <img
                    src="/Plano de Fundo (1).png"
                    alt="Background"
                    className="w-full h-full object-cover opacity-30"
                />
            </div>


            <div className="max-w-6xl mx-auto space-y-6 pb-20 font-sans z-10">
                <div className={`bg-gray-1000 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl`}>

                    {/* HEADER COM VELOCÍMETRO */}
                    <div className={`bg-blue-900 border-white/10 p-8 flex flex-col md:flex-row items-center justify-between gap-6`}>
                        <div className="text-center md:text-left">
                            <h1 className="text-2xl font-black text-white uppercase tracking-tighter italic">
                                Checklist para revisão de radar
                            </h1>
                            <p className={`${style.text} text-[10px] font-black uppercase tracking-[0.3em] mt-2`}>
                                (Início ou a retomada das atividades Operacionais)
                            </p>
                        </div>

                    </div>

                    {/* GRID DE INFORMAÇÕES DA EMPRESA (Inalterado) */}
                    <div className="grid grid-cols-1 md:grid-cols-4 bg-white/[0.01]">
                        <Cell label="Empresa" value={empresa.razaoSocial} className="md:col-span-3" />
                        <Cell label="CNPJ" value={empresa.cnpj} />

                        <Cell label="Responsável" value={empresa.cliente?.nome || "Analista Responsável"} className="md:col-span-2" />
                        <Cell label="Regime Tributário" value={empresa.regimeTributario} />
                        <Cell label="Situação CPF Sócio" value="Regular" isEditable />

                        <Cell label="Radar Atual" value={empresa.submodalidade} isEditable />

                        <SelectCell
                            label="Radar Pretendido"
                            options={["Limitado (US$ 50k)", "Limitado (US$ 150k)", "Ilimitado"]}
                            accent
                        />

                        <SelectCell
                            label="Mês para Protocolar"
                            options={[
                                "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                                "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
                            ]}
                            accent
                        />

                        <div className="relative flex flex-col items-center">
                            <Velocimetro valor={empresa.progresso || 15} />
                            <div className="absolute bottom-1 text-center">
                                <span className="text-white font-black text-xl leading-none">
                                    {empresa.progresso || 15}%
                                </span>
                                <p className="text-[8px] text-slate-500 font-black uppercase tracking-tighter">Concluído</p>
                            </div>
                        </div>

                    </div>
                </div>

                {/* --- SEÇÃO 1.0: DOCUMENTAÇÃO --- */}
                <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <div className="p-6 bg-white/[0.03] border-b border-white/10 flex items-center gap-4">
                        <div className="bg-blue-600 p-2 rounded-lg">
                            <FileText size={18} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-widest">Documentos Gerais</h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase">Verificação de regularidade e atos constitutivos</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-black/20 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                    <th className="p-4 border-b border-white/5 text-center w-16">Item</th>
                                    <th className="p-4 border-b border-white/5">Descrição do Requisito</th>
                                    <th className="p-4 border-b border-white/5 text-center w-40">Status</th>
                                    <th className="p-4 border-b border-white/5">Observações</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs">
                                <PlanilhaRow
                                    id="1.1"
                                    label="Habilitação da procuração eletronica no e-CAC"
                                    info="obrigatorio"
                                />
                                <PlanilhaRow
                                    id="1.2"
                                    label="Opção pelo Domilicio Tributario Eletrônica (DTE) no portal e-CAC"
                                    info="obrigatorio"
                                />
                                
                            </tbody>
                        </table>
                    </div>
                </div>


                <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <div className="p-6 bg-white/[0.03] border-b border-white/10 flex items-center gap-4">
                        <div className="bg-blue-600 p-2 rounded-lg">
                            <FileText size={18} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-widest">Documentos Gerais</h3>
                            <p className="text-[10px] text-slate-500 font-bold uppercase">Verificação de regularidade e atos constitutivos</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-black/20 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
                                    <th className="p-4 border-b border-white/5 text-center w-16">Item</th>
                                    <th className="p-4 border-b border-white/5">Descrição do Requisito</th>
                                    <th className="p-4 border-b border-white/5 text-center w-40">Status</th>
                                    <th className="p-4 border-b border-white/5">Observações</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs">
                                <PlanilhaRow
                                    id="1.1"
                                    label="Documentos pessoais dos Socios"
                                    info="obrigatorio"
                                />
                                <PlanilhaRow
                                    id="1.2"
                                    label="Procuração"
                                    info="obrigatorio"
                                />
                                <PlanilhaRow
                                    id="1.3"
                                    label="Contrato Social e Alterações"
                                    info="obrigatorio"
                                />
                                <PlanilhaRow
                                    id="1.4"
                                    label="Certidão Simplificada da junta comercial"
                                    info="obrigatorio"
                                />
                            </tbody>
                        </table>
                    </div>
                </div>

                
            </div>
        </>
    );
}

/* --- SUBCOMPONENTE: CÉLULA DE DADOS --- */
function Cell({ label, value, className = "", isEditable = false }: { label: string; value?: string | null; className?: string; isEditable?: boolean }) {
    return (
        <div className={`border-r border-b border-white/5 p-5 flex flex-col gap-1 transition-colors hover:bg-white/[0.02] ${className}`}>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em]">{label}</span>
            <div className={`text-xs font-bold uppercase truncate ${isEditable ? 'text-blue-400' : 'text-slate-200'}`}>
                {value || "N/A"}
            </div>
        </div>
    );
}

/* --- SUBCOMPONENTE: CÉLULA DE SELEÇÃO --- */
function SelectCell({ label, options, accent = false }: { label: string; options: string[]; accent?: boolean }) {
    return (
        <div className={`border-r border-b border-white/5 p-5 flex flex-col gap-1 ${accent ? 'bg-blue-600/5' : ''}`}>
            <span className={`text-[9px] font-black uppercase tracking-[0.15em] ${accent ? 'text-blue-400' : 'text-slate-500'}`}>
                {label}
            </span>
            <div className="relative group">
                <select className="w-full bg-transparent text-xs font-black text-white outline-none cursor-pointer uppercase appearance-none pr-4">
                    <option className="bg-slate-900 text-slate-500">Selecionar...</option>
                    {options.map((opt: string) => (
                        <option key={opt} value={opt} className="bg-slate-900 text-white">{opt}</option>
                    ))}
                </select>
                <ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none group-hover:text-blue-400" />
            </div>
        </div>
    );
}

/* --- SUBCOMPONENTE: LINHA DA PLANILHA --- */
function PlanilhaRow({ id, label, info }: { id: string, label: string, info: string }) {
    return (
        <tr className="border-b border-white/5 hover:bg-white/[0.02] group transition-all">
            <td className="p-4 text-center font-mono text-[10px] text-slate-600 border-r border-white/5 bg-black/10">
                {id}
            </td>
            <td className="p-4">
                <div className="flex flex-col gap-1">
                    <span className="font-bold text-slate-300 uppercase tracking-tight">{label}</span>
                    <div className="flex items-center gap-1.5 text-slate-600 italic">
                        <Info size={16} className="text-red-500/50" />
                        <span className="text-[14px] font-medium leading-none text-red-700">{info}</span>
                    </div>
                </div>
            </td>
            <td className="p-4 border-l border-r border-white/5 bg-white/[0.01]">
                <select className="w-full bg-slate-800/50 border border-white/10 rounded-lg py-2 px-2 text-[10px] font-black text-center text-blue-400 outline-none focus:border-blue-500/50 cursor-pointer uppercase">
                    <option className="bg-slate-900 text-slate-400">PENDENTE</option>
                    <option className="bg-slate-900 text-emerald-500">OK</option>
                    <option className="bg-slate-900 text-rose-500">ERRO</option>
                </select>
            </td>
            <td className="p-2">
                <textarea
                    rows={1}
                    placeholder="Adicionar nota técnica..."
                    className="w-full bg-transparent border border-transparent hover:border-white/5 focus:border-white/10 focus:bg-white/[0.02] rounded-xl p-3 text-[10px] text-slate-400 outline-none transition-all resize-none italic placeholder:text-slate-800"
                />
            </td>
        </tr>
    );
}

function Velocimetro({ valor }: { valor: number }) {

    const radius = 40;
    const circumference = Math.PI * radius;
    const offset = circumference - (valor / 100) * circumference;

    return (
        <svg width="120" height="70" viewBox="0 0 100 60" className="transform rotate-0">
            {/* Fundo do Trilho */}
            <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="10"
                strokeLinecap="round"
            />
            {/* Progresso Ativo */}
            <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="url(#gradient-blue)"
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
            />
            <defs>
                <linearGradient id="gradient-blue" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#2563eb" />
                    <stop offset="100%" stopColor="#60a5fa" />
                </linearGradient>
            </defs>
        </svg>
    );
}
