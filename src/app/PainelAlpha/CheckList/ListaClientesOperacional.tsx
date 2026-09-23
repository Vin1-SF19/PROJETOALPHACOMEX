"use client"

import { useState, useMemo } from 'react';
import { Search, ExternalLink, ArrowUpRight, MoreHorizontal, Plus } from 'lucide-react';
import ModalCadastroCliente from './Modais/CadastroCliente';
import Link from 'next/link';

type ClienteLista = {
    id: string;
    clienteId?: string | null;
    donoNome?: string | null;
    donoEmail?: string | null;
    cliente?: { nome?: string | null; email?: string | null } | null;
    status: string;
    razaoSocial: string;
    nomeFantasia?: string | null;
    cnpj: string;
    progresso: number;
    mesProtocolo?: string | null;
    linkGrupo?: string | null;
};
type ClienteAcesso = { id: string; nome: string; email: string };

const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
        "ATIVO": "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        "PENDENTE": "bg-amber-500/10 text-amber-500 border-amber-500/20",
        "FINALIZADO": "bg-blue-500/10 text-blue-500 border-blue-500/20",
    };
    return (
        <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${styles[status] || styles["PENDENTE"]}`}>
            {status}
        </span>
    );
};

export default function ListaClientesOperacional({
    dadosIniciais,
    usuariosAcesso
}: {
    dadosIniciais: ClienteLista[],
    usuariosAcesso: ClienteAcesso[]
}) {
    const [busca, setBusca] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);


    const listaUsuariosAcesso = useMemo(() => {
        const mapeados = dadosIniciais.map(d => ({
            id: d.clienteId, 
            nome: d.donoNome || d.cliente?.nome, 
            email: d.donoEmail || d.cliente?.email
        }));

        return Array.from(new Map(mapeados.map(item => [item.id, item])).values())
            .filter(i => i.id); 
    }, [dadosIniciais]);


    const clientesFiltrados = useMemo(() => {
        return dadosIniciais.filter(c =>
            c.razaoSocial.toLowerCase().includes(busca.toLowerCase()) ||
            c.cnpj.includes(busca)
        );
    }, [busca, dadosIniciais]);

    return (
        <div className="space-y-4">
            {/* Container do Filtro e Botão */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="relative w-full lg:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input
                        type="text"
                        placeholder="Filtrar por nome ou CNPJ..."
                        className="w-full bg-white/[0.03] border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-sm outline-none focus:border-blue-500/50 transition-all text-white"
                        onChange={(e) => setBusca(e.target.value)}
                    />
                </div>

                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-bold text-sm transition-all shadow-lg shadow-blue-600/20 whitespace-nowrap"
                >
                    <Plus size={18} />
                    <span>Novo Cliente</span>
                </button>
            </div>

            {/* Tabela */}
            <div className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-md">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.01]">
                                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Status</th>
                                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Razão SOcial</th>
                                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Fantasia</th>
                                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">CNPJ</th>
                                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Progresso</th>
                                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Protocolo</th>
                                <th className="p-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {clientesFiltrados.map((cliente) => (
                                <tr key={cliente.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="p-6"><StatusBadge status={cliente.status} /></td>

                                    <th className="p-6 italic font-black text-slate-400 text-[11px] uppercase tracking-tighter">
                                        <Link href={`/PainelAlpha/CheckList/${cliente.id}`}>
                                            <p className="text-sm font-bold text-white hover:text-blue-400 transition-colors cursor-pointer">
                                                {cliente.razaoSocial}
                                            </p>
                                        </Link>
                                    </th>

                                    <th className="p-6 italic font-black text-slate-400 text-[11px] uppercase tracking-tighter">
                                        <p className="text-[10px] text-slate-500 font-medium uppercase mt-0.5">
                                            {cliente.nomeFantasia || '---'}
                                        </p>
                                    </th>
                                    <td className="p-6 text-sm tabular-nums text-slate-400 font-medium">{cliente.cnpj}</td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[11px] font-black text-white tabular-nums">{cliente.progresso}%</span>
                                        </div>
                                    </td>
                                    <td className="p-6 italic font-black text-slate-400 text-[11px] uppercase tracking-tighter">
                                        {cliente.mesProtocolo || '---'}
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-2">
                                            {cliente.linkGrupo && (
                                                <a href={cliente.linkGrupo} target="_blank" className="p-2 hover:bg-emerald-500/20 text-emerald-500 rounded-xl">
                                                    <ExternalLink size={16} />
                                                </a>
                                            )}
                                            <button className="p-2 hover:bg-white/10 text-white rounded-xl"><ArrowUpRight size={16} /></button>
                                            <button className="p-2 hover:bg-white/10 text-slate-500 rounded-xl"><MoreHorizontal size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <ModalCadastroCliente
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                clientesExistentes={usuariosAcesso}
            />
        </div>
    );
}
