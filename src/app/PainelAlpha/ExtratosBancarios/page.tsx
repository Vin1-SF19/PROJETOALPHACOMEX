"use client";

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Plus,
    Filter,
    Search,
    TrendingUp,
    User,
    Calendar,
    FileChartLine,
    ArrowUpRight,
    Building2,
    ShieldCheck,
    Clock,
    Download,
    Landmark,
    Zap,
    Eye
} from "lucide-react";

import ModalCadastroCliente from "./ModalCadastros/modal";
import { ListarExtratos } from '@/actions/Extratos';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import PainelConferencia from './[Id]/Modais/ModalExtratos';
import { Transacao } from '@prisma/client';

export default function ExtratosBancarios() {
    const [extratos, setExtratos] = useState<any[]>([]);
    const [carregando, setCarregando] = useState(true);

    const [showPreview, setShowPreview] = useState(false);

    const [clienteSelecionado, setClienteSelecionado] = useState<any>(null);
    const [modalGestaoAberto, setModalGestaoAberto] = useState(false);
    const [modalFiltroAberto, setModalFiltroAberto] = useState(false);


    const [linhasExtraidas, setLinhasExtraidas] = useState<Transacao[]>([]);
    const [empresa, setEmpresa] = useState<any>(null);


    const totalTransacoes = extratos.reduce((acc: number, emp: any) => {
        const contagemPeriodo = (emp.periodos || []).reduce((accP: number, p: any) => {
            const contagemBancos = (p.bancos || []).reduce((accB: number, b: any) => {
                return accB + (b.transacoes?.length || 0);
            }, 0);
            return accP + contagemBancos;
        }, 0);
        return acc + contagemPeriodo;
    }, 0);

    // Cálculo de Bancos/Extratos
    const totalBancos = extratos.reduce((acc: number, emp: any) => {
        const bancosNoPeriodo = (emp.periodos || []).reduce((accP: number, p: any) => {
            return accP + (p.bancos?.length || 0);
        }, 0);
        return acc + bancosNoPeriodo;
    }, 0);


    const [modalAberto, setModalAberto] = useState(false);
    const [termoBusca, setTermoBusca] = useState("");
    const [ordenacao, setOrdenacao] = useState({ campo: 'razaoSocial', direcao: 'asc' });
    const router = useRouter();

    const carregarDados = async () => {
        setCarregando(true);
        try {
            const res = await ListarExtratos();

            if (res?.success === true && Array.isArray(res?.data)) {
                setExtratos(res.data);
            } else {
                setExtratos([]);
                if (res?.error) {
                    toast.error(String(res.error));
                }
            }
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
            setExtratos([]);
            toast.error("Falha na comunicação com o servidor");
        } finally {
            setCarregando(false);
        }
    };

    useEffect(() => { carregarDados(); }, []);

    const extratosFiltrados = useMemo(() => {
        return extratos.filter((c) => {
            const busca = termoBusca.toLowerCase();
            return (
                c.razaoSocial?.toLowerCase().includes(busca) ||
                c.cnpj?.includes(busca.replace(/\D/g, "")) ||
                c.analistaResponsavel?.toLowerCase().includes(busca)
            );
        }).sort((a, b) => {
            let valA = a[ordenacao.campo] || "";
            let valB = b[ordenacao.campo] || "";
            if (ordenacao.direcao === 'asc') return valA > valB ? 1 : -1;
            return valA < valB ? 1 : -1;
        });
    }, [termoBusca, extratos, ordenacao]);

    const formatarPeriodos = (periodos: any[]) => {
        if (!periodos || periodos.length === 0) return null;

        const ordemMeses: { [key: string]: number } = {
            'Janeiro': 1, 'Fevereiro': 2, 'Março': 3, 'Abril': 4, 'Maio': 5, 'Junho': 6,
            'Julho': 7, 'Agosto': 8, 'Setembro': 9, 'Outubro': 10, 'Novembro': 11, 'Dezembro': 12
        };

        const grupos: { [key: string]: string[] } = {};
        periodos.forEach(p => {
            if (!grupos[p.ano]) grupos[p.ano] = [];
            const mesAbv = p.mes.substring(0, 3).toLowerCase();
            if (!grupos[p.ano].includes(mesAbv)) grupos[p.ano].push(mesAbv);
        });

        return Object.keys(grupos)
            .sort((a, b) => Number(b) - Number(a))
            .map(ano => {
                const mesesOrdenados = grupos[ano].sort((a, b) => {
                    const nomeA = Object.keys(ordemMeses).find(m => m.toLowerCase().startsWith(a)) || "";
                    const nomeB = Object.keys(ordemMeses).find(m => m.toLowerCase().startsWith(b)) || "";
                    return ordemMeses[nomeA] - ordemMeses[nomeB];
                });

                return `${mesesOrdenados.join('/')} - ${ano}`;
            })
            .join(' | ');
    };

    const exportarRelatorioExcel = async (transacoes: any[], razaoSocial: string, cnpj: string) => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Relatório Radar');

        const paletaCores = [
            'FFF1F5FE',
            'FFFFF1F1',
            'FFF0FDF4',
            'FFFFFEF2',
            'FFF5F3FF',
            'FFFFF7ED',
            'FFECFEFF',
        ];

        const bancoCores: Record<string, string> = {};
        let corIndex = 0;

        transacoes.forEach(t => {
            const nome = (t.nomeBanco || "BANCO").toUpperCase();
            if (!bancoCores[nome]) {
                bancoCores[nome] = paletaCores[corIndex % paletaCores.length];
                corIndex++;
            }
        });

        worksheet.columns = [
            { key: 'mes', width: 20 },
            { key: 'banco', width: 22 },
            { key: 'data', width: 15 },
            { key: 'descricao', width: 55 },
            { key: 'valor', width: 18 },
            { key: 'justificativa', width: 40 },
        ];

        worksheet.mergeCells('A1:F1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = '15 5160: COMPROVANTE DE TRANSFERENCIA DE RECURSOS DISPONIVEIS (Artigo 6º, I, "c" da Portaria Coana nº 72/2020)';
        titleCell.font = { name: 'Arial', size: 10, bold: true };

        worksheet.getCell('A2').value = 'EMPRESA:';
        worksheet.getCell('B2').value = razaoSocial?.toUpperCase() || "NOME NÃO INFORMADO";
        worksheet.getCell('A3').value = 'CNPJ:';
        worksheet.getCell('B3').value = cnpj || "CNPJ NÃO INFORMADO";
        [worksheet.getCell('A2'), worksheet.getCell('A3')].forEach(c => c.font = { bold: true });

        const headerRow = worksheet.getRow(5);
        headerRow.values = ['MÊS REF.', 'BANCO', 'DATA', 'DESCRIÇÃO', 'VALOR (R$)', 'JUSTIFICATIVA'];
        headerRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '475569' } };
            cell.font = { bold: true, color: { argb: 'FFFFFF' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        const dadosOrdenados = [...transacoes].sort((a, b) => {
            const converterDataRef = (ref: string) => {
                const [mes, ano] = ref.split('/');
                const meses: any = { 'Janeiro': '01', 'Fevereiro': '02', 'Março': '03', 'Abril': '04', 'Maio': '05', 'Junho': '06', 'Julho': '07', 'Agosto': '08', 'Setembro': '09', 'Outubro': '10', 'Novembro': '11', 'Dezembro': '12' };
                return `${ano}${meses[mes] || '00'}`;
            };
            const refA = converterDataRef(a.mesReferencia);
            const refB = converterDataRef(b.mesReferencia);

            if (refA !== refB) return refB.localeCompare(refA);
            if (a.nomeBanco !== b.nomeBanco) return a.nomeBanco.localeCompare(b.nomeBanco);
            return new Date(a.data).getTime() - new Date(b.data).getTime();
        });

        dadosOrdenados.forEach((t) => {
            const nomeBanco = (t.nomeBanco || "BANCO").toUpperCase();
            const corHex = bancoCores[nomeBanco];

            const row = worksheet.addRow({
                mes: t.mesReferencia.toUpperCase(),
                banco: nomeBanco,
                data: t.data ? new Date(t.data).toLocaleDateString('pt-BR') : "",
                descricao: (t.descricao || "").toUpperCase(),
                valor: Number(t.valor || 0),
                justificativa: ""
            });

            row.eachCell((cell, colNumber) => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };

                if (colNumber === 1) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '94a3b8' } };
                    cell.font = { color: { argb: 'FFFFFF' }, bold: true };
                } else {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: corHex } };
                    if (colNumber === 5) {
                        cell.numFmt = '"R$ " #,##0.00';
                        cell.alignment = { horizontal: 'right' };
                        cell.font = { bold: true, color: { argb: Number(t.valor) < 0 ? 'BE123C' : '000000' } };
                    }
                }
            });
        });

        let inicioMergeMes = 6;
        let inicioMergeBanco = 6;

        for (let i = 6; i <= worksheet.rowCount; i++) {
            const mesAtual = worksheet.getCell(`A${i}`).value;
            const mesProximo = i < worksheet.rowCount ? worksheet.getCell(`A${i + 1}`).value : null;
            const bancoAtual = worksheet.getCell(`B${i}`).value;
            const bancoProximo = i < worksheet.rowCount ? worksheet.getCell(`B${i + 1}`).value : null;

            if (mesAtual !== mesProximo) {
                if (i > inicioMergeMes) worksheet.mergeCells(`A${inicioMergeMes}:A${i}`);
                inicioMergeMes = i + 1;
            }

            if (bancoAtual !== bancoProximo || mesAtual !== mesProximo) {
                if (i > inicioMergeBanco) worksheet.mergeCells(`B${inicioMergeBanco}:B${i}`);
                inicioMergeBanco = i + 1;
            }
        }

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Relatorio_Radar_${razaoSocial.replace(/\s+/g, '_')}.xlsx`);
    };

    return (
        <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-indigo-500/30 pb-20">
            <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-8 space-y-8">

                <header className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 p-10 rounded-[2.5rem] bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-white/5 backdrop-blur-xl shadow-2xl overflow-hidden">
                    <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                        <TrendingUp size={200} />
                    </div>

                    <div className="relative space-y-3">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-500/20 rounded-2xl border border-indigo-500/20">
                                <FileChartLine className="text-indigo-400 w-7 h-7" />
                            </div>
                            <div>
                                <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic leading-none">
                                    <span className="text-indigo-500">EXTRATOS</span>
                                </h1>
                                <p className="text-[10px] font-black text-indigo-500/60 uppercase tracking-[0.4em] mt-1 ml-1">
                                    SISTEMA DE ANÁLISE BANCÁRIA ALPHA
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 relative">
                        <button
                            onClick={() => setModalAberto(true)}
                            className="group flex items-center gap-3 px-8 py-4 bg-white text-black rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-indigo-500 hover:text-white active:scale-95 shadow-xl shadow-white/5"
                        >
                            <Plus size={16} strokeWidth={3} /> Iniciar Nova Análise
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {[
                        {
                            label: "Volume de Dados",
                            value: totalTransacoes.toLocaleString('pt-BR'),
                            sub: "Linhas Processadas",
                            icon: Zap,
                            color: "text-blue-400",
                            bg: "bg-blue-500/10"
                        },
                        {
                            label: "Fluxo de Extratos",
                            value: totalBancos,
                            sub: "Contas Mapeadas",
                            icon: Landmark,
                            color: "text-indigo-400",
                            bg: "bg-indigo-500/10"
                        },
                        {
                            label: "Base Alpha",
                            value: extratos.length,
                            sub: "Empresas Ativas",
                            icon: Building2,
                            color: "text-emerald-400",
                            bg: "bg-emerald-500/10"
                        }
                    ].map((stat, i) => (
                        <div key={i} className="bg-slate-900/40 border border-white/5 p-6 rounded-[2rem] flex items-center justify-between group hover:border-indigo-500/30 transition-all duration-500">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">{stat.label}</p>
                                <p className="text-4xl font-black text-white tracking-tighter">{stat.value}</p>
                                <p className="text-[9px] font-bold text-slate-600 uppercase mt-2 flex items-center gap-1">
                                    <span className={`w-1 h-1 rounded-full ${stat.color} animate-pulse`} />
                                    {stat.sub}
                                </p>
                            </div>
                            <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6`}>
                                <stat.icon size={28} strokeWidth={2.5} />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/20 p-4 rounded-3xl border border-white/5">
                    <div className="w-full md:w-96 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                        <input
                            type="text"
                            placeholder="BUSCAR CNPJ OU RAZÃO SOCIAL..."
                            value={termoBusca}
                            onChange={(e) => setTermoBusca(e.target.value)}
                            className="w-full bg-slate-950/50 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all"
                        />
                    </div>
                    <button onClick={() => setModalFiltroAberto(true)} className="flex items-center gap-2 px-6 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                        <Filter size={16} /> Filtros
                    </button>
                </div>

                <div className="bg-slate-900/30 border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-separate border-spacing-0">
                            <thead>
                                <tr className="bg-slate-900/80">
                                    <th className="px-8 py-6 text-[14px] font-black uppercase tracking-[0.2em] text-slate-500">Data de Criação</th>
                                    <th className="px-8 py-6 text-[14px] font-black uppercase tracking-[0.2em] text-slate-500">Empresa / CNPJ</th>
                                    <th className="px-8 py-6 text-[14px] font-black uppercase tracking-[0.2em] text-slate-500">Nome Fantasia</th>
                                    <th className="px-8 py-6 text-[14px] font-black uppercase tracking-[0.2em] text-slate-500">Localização</th>
                                    <th className="px-8 py-6 text-[14px] font-black uppercase tracking-[0.2em] text-slate-500">Regime</th>
                                    <th className="px-8 py-6 text-[14px] font-black uppercase tracking-[0.2em] text-slate-500 text-center">Meses</th>
                                    <th className="px-8 py-6 text-[14px] font-black uppercase tracking-[0.2em] text-slate-500 text-center">Download</th>
                                    <th className="px-8 py-6 text-[14px] font-black uppercase tracking-[0.2em] text-slate-500">Analista</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {carregando ? (
                                    <tr><td colSpan={5} className="py-20 text-center animate-pulse text-indigo-500 font-black text-[10px] uppercase tracking-[0.5em]">Sincronizando Base Alpha...</td></tr>
                                ) : extratosFiltrados.length === 0 ? (
                                    <tr><td colSpan={5} className="py-32 text-center text-slate-700 font-black uppercase text-[10px] tracking-[0.4em]">Vazio</td></tr>
                                ) : (
                                    extratosFiltrados.map((c) => (
                                        <tr key={c.id} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[20px] font-black text-white uppercase tracking-tighter">
                                                        {new Date(c.createdAt).toLocaleDateString('pt-BR', {
                                                            day: '2-digit',
                                                            month: '2-digit',
                                                            year: 'numeric'
                                                        })}
                                                    </span>
                                                    <span className="text-[16px] font-bold text-slate-500 uppercase tracking-widest">
                                                        {new Date(c.createdAt).toLocaleTimeString('pt-BR', {
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col gap-1">
                                                    <span
                                                        onClick={() => router.push(`/PainelAlpha/ExtratosBancarios/${c.id}`)}
                                                        className="text-sm font-black text-white uppercase truncate max-w-xs hover:text-emerald-500 transition-all cursor-pointer"
                                                    >{c.razaoSocial}</span>
                                                    <span className="text-[14px] font-bold text-slate-500 tracking-wider">CNPJ: {c.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[12px] font-bold text-slate-500 uppercase">{c.nomeFantasia || "Sem Nome Fantasia"}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-1 bg-slate-800 rounded text-[9px] font-black text-slate-400">{c.uf || "UF"}</span>
                                                    <span className="text-[12px] font-bold text-slate-500 uppercase">{c.municipio || "BRASIL"}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[12px] font-bold text-slate-500 uppercase">{c.regimeTributario || "Geral"}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        {(c.periodos || c.Periodos)?.length > 0 ? (
                                                            <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[11px] font-black text-emerald-400 uppercase tracking-tighter">
                                                                {formatarPeriodos(c.periodos || c.Periodos)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[9px] font-black text-slate-800 uppercase tracking-widest italic">
                                                                Nenhum período
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center justify-end">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();

                                                            const todasTransacoes = (c.periodos || []).flatMap((p: any) =>
                                                                (p.bancos || []).flatMap((b: any) =>
                                                                    (b.transacoes || []).map((t: any) => ({
                                                                        ...t,
                                                                        bancoId: b.id,
                                                                        mesReferencia: `${p.mes}/${p.ano}`,
                                                                        nomeBanco: b.nomeBanco || b.nome,
                                                                        selecionado: true
                                                                    }))
                                                                )
                                                            );

                                                            if (todasTransacoes.length === 0) {
                                                                toast.error("Este extrato ainda não possui transações processadas.");
                                                                return;
                                                            }

                                                            setLinhasExtraidas(todasTransacoes);

                                                            setEmpresa(c);
                                                            setShowPreview(true);
                                                        }}
                                                        className="cursor-pointer group relative flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl transition-all hover:bg-indigo-500/30 active:scale-95 shadow-lg shadow-indigo-500/5"
                                                    >
                                                        <div className="h-8 w-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                                                            <Eye size={14} strokeWidth={3} />
                                                        </div>
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[10px] font-black text-indigo-400">
                                                        {c.analistaResponsavel?.charAt(0) || <User size={12} />}
                                                    </div>
                                                    <span className="text-[12px] font-black uppercase text-slate-300">{c.criadoPorNome || "Usuario não encontrado"}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <ModalCadastroCliente isOpen={modalAberto} onClose={() => setModalAberto(false)} aoSucesso={carregarDados} />
            <AnimatePresence>
                {showPreview && empresa && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
                        <PainelConferencia
                            empresa={empresa}
                            linhas={linhasExtraidas}
                            setLinhasExtraidas={setLinhasExtraidas}
                            onClose={() => setShowPreview(false)}
                            onExport={(dadosFiltrados) => {
                                exportarRelatorioExcel(dadosFiltrados, empresa.razaoSocial, empresa.cnpj);
                                setShowPreview(false);
                            }}
                        />
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}