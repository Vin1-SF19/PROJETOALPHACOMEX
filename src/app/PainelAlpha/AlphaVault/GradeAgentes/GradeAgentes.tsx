"use client";

import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { CardAgente } from "./CardAgentes";
import type { ColaboradorVault, RecursoVault, SistemaVault } from "../types";

interface GradeAgentesProps {
    colaboradores: ColaboradorVault[];
    sistemas: SistemaVault[];
    recursos: RecursoVault[];
}

export function GradeAgentes({ colaboradores, sistemas, recursos }: GradeAgentesProps) {
    const [busca, setBusca] = useState("");

    const filtrados = colaboradores.filter((c) =>
        c.nome.toLowerCase().includes(busca.toLowerCase()) ||
        c.role?.toLowerCase().includes(busca.toLowerCase()) ||
        c.cargo?.toLowerCase().includes(busca.toLowerCase())
    );

    return (
        <>
            <div className="bg-slate-900/40 border border-white/5 p-4 rounded-3xl mb-8 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="PESQUISAR AGENTE..."
                        className="w-full bg-black/40 border border-white/5 rounded-2xl h-12 pl-12 pr-4 text-[10px] font-black uppercase tracking-widest outline-none focus:border-white/20 transition-all text-white"
                    />
                </div>
                <button className="h-12 px-6 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3 text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <SlidersHorizontal size={16} /> {filtrados.length} AGENTES
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtrados.map((colab) => (
                    <CardAgente 
                        key={colab.id} 
                        colab={colab} 
                        sistemas={sistemas} 
                        recursos={recursos.filter((r) => String(r.colaborador_id) === String(colab.id))}
                    />
                ))}
            </div>
        </>
    );
}
