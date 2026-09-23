"use client"

import { useState } from 'react';

type EmpresaEmbasamento = { razaoSocial: string; cnpj?: string | null; cliente?: { nome?: string | null } | null; status?: string | null };

export default function EmbasamentoDAS({ empresa }: { empresa: EmpresaEmbasamento }) {
    return (
        <div className="max-w-5xl mx-auto bg-slate-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl font-sans">
            
            {/* TÍTULO CENTRALIZADO (Estilo Cabeçalho Planilha) */}
            <div className="bg-blue-600/20 border-b border-white/10 p-6 text-center">
                <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">
                    Checklist para revisão de radar <br />
                    <span className="text-blue-400 text-sm font-medium">
                        (Início ou a retomada das atividades Operacionais)
                    </span>
                </h1>
            </div>

            {/* GRID DE DADOS DA EMPRESA */}
            <div className="grid grid-cols-1 md:grid-cols-4 border-b border-white/5">
                
                {/* Linha 1 */}
                <Cell label="Razão Social" value={empresa.razaoSocial} className="md:col-span-3" />
                <Cell label="CNPJ" value={empresa.cnpj} />

                {/* Linha 2 */}
                <Cell label="Responsável" value={empresa.cliente?.nome || "Não definido"} className="md:col-span-2" />
                <Cell label="Regime Tributário" value="Lucro Presumido" isEditable /> {/* Exemplo: pode ser vindo do banco tb */}
                <Cell label="Situação CPF Sócio" value="Regular" isEditable />

                {/* Linha 3 (Controles do Analista) */}
                <Cell label="Radar Atual" value="Limitado (US$ 50k)" isEditable />
                
                <SelectCell 
                    label="Radar Pretendido" 
                    options={["Limitado (US$ 50k)", "Limitado (US$ 150k)", "Ilimitado"]} 
                />
                
                <SelectCell 
                    label="Mês para Protocolar" 
                    options={[
                        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
                    ]} 
                />

                <Cell label="Status" value={empresa.status} className="text-emerald-500 font-black" />
            </div>
        </div>
    );
}

/* Componente Auxiliar para Células de Texto */
function Cell({ label, value, className = "", isEditable = false }: { label: string; value?: string | null; className?: string; isEditable?: boolean }) {
    return (
        <div className={`border-r border-b border-white/5 p-4 flex flex-col gap-1 ${className}`}>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
            <div className={`text-sm font-bold text-slate-200 uppercase truncate ${isEditable ? 'text-blue-400' : ''}`}>
                {value || "---"}
            </div>
        </div>
    );
}

/* Componente Auxiliar para Células de Seleção (Analista) */
function SelectCell({ label, options }: { label: string, options: string[] }) {
    return (
        <div className="border-r border-b border-white/5 p-4 flex flex-col gap-1 bg-blue-500/5">
            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{label}</span>
            <select className="bg-transparent text-sm font-bold text-white outline-none cursor-pointer uppercase">
                <option className="bg-slate-900">Selecionar...</option>
                {options.map(opt => (
                    <option key={opt} value={opt} className="bg-slate-900">{opt}</option>
                ))}
            </select>
        </div>
    );
}
