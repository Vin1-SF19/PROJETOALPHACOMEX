"use client"

import { useState, useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { Users, TrendingUp, Award, Target, Zap, BarChart3, Download } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

import XLSX from 'xlsx-js-style';
import { getExportDataColaborador } from '@/actions/ComercialControle';

function MetricCard({ label, valor, cor }: any) {
    return (
        <div className="bg-white/[0.03] p-8 rounded-[2rem] border border-white/5 flex flex-col justify-center transition-all hover:bg-white/[0.05]">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">{label}</p>
            <p className={`text-4xl font-black ${cor} tabular-nums tracking-tighter`}>{valor}</p>
        </div>
    );
}

function CardDestaque({ titulo, valor, sub, icon, gradient }: any) {
    return (
        <div className={`bg-slate-900/40 border border-white/5 p-6 rounded-[2rem] shadow-xl relative overflow-hidden group hover:border-white/20 transition-all duration-500 bg-gradient-to-br ${gradient}`}>
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{titulo}</span>
                    <div className="p-2 bg-black/20 rounded-xl">{icon}</div>
                </div>
                <p className="text-2xl font-black text-white uppercase truncate italic tracking-tight">{valor}</p>
                <p className="text-[10px] text-slate-500 font-bold mt-2 uppercase tracking-widest">{sub}</p>
            </div>
        </div>
    );
}

function PieChartIndividual({ data, titulo }: any) {
    const total = data.reduce((a: any, b: any) => a + (Number(b.value) || 0), 0);
    return (
        <div className="bg-white/[0.02] border border-white/5 p-6 rounded-[2.5rem] h-[300px] flex flex-col items-center group hover:bg-white/[0.04] transition-all">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 text-center">{titulo}</p>
            <div className="flex-1 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={data} innerRadius={55} outerRadius={75} paddingAngle={5} dataKey="value" stroke="none">
                            {data.map((entry: any, index: number) => <Cell key={index} fill={entry.color} />)}
                        </Pie>
                        <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', fontSize: '10px' }}
                            itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[45%] text-center pointer-events-none">
                    <p className="text-2xl font-black text-white leading-none tabular-nums">{total}</p>
                    <p className="text-[7px] text-slate-500 uppercase font-black mt-1 tracking-tighter">Registros</p>
                </div>
            </div>
        </div>
    );
}

function MiniCardComparativo({ titulo, atual, anteriores }: any) {
    return (
        <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 text-center">{titulo}</p>
            <div className="flex justify-around items-center">
                <div className="text-center">
                    <p className="text-[8px] text-slate-500 uppercase font-bold">Mês Atual</p>
                    <p className="text-xl font-black text-white tabular-nums">{atual}</p>
                </div>
                <div className="h-8 w-px bg-white/5" />
                <div className="text-center">
                    <p className="text-[8px] text-slate-500 uppercase font-bold">Mês anterior</p>
                    <p className="text-xl font-black text-indigo-400 tabular-nums">{anteriores}</p>
                </div>
            </div>
        </div>
    );
}

function CardColaborador({ colab, anterior, mesAnteriorLabel }: any) {
    const totalContratosRev = (Number(colab.revisao) || 0);
    const totalContratosHab = (Number(colab.habilitacao) || 0);
    const naoAgendadas = Math.max(0, (Number(colab.leads) || 0) - (Number(colab.agendadas) || 0) - (Number(colab.leadsDesqualificados) || 0));

    const totalDesqualificados = useMemo(() => {
        return (Number(colab.leadsDesqualificados) || 0)
    }, [colab]);

    const dataFunilGeral = useMemo(() => [
        { name: 'Leads', valor: Number(colab.leads) || 0, color: '#3b82f6' },
        { name: 'Agendas', valor: Number(colab.agendadas) || 0, color: '#8b5cf6' },
        { name: 'Realiz.', valor: Number(colab.realizadas) || 0, color: '#10b981' },
        { name: 'No Show', valor: Number(colab.noShow || colab.no_show) || 0, color: '#f43f5e' },
        { name: 'Vendas', valor: totalContratosHab + totalContratosRev, color: '#fbbf24' }
    ], [colab, totalContratosHab, totalContratosRev]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="bg-slate-900/40 border border-white/5 rounded-[3rem] p-8 lg:p-12 shadow-2xl">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-white/5 pb-10 mb-10">
                    <div className="space-y-2">
                        <div className="flex items-center gap-4">
                            <h3 className="font-black text-4xl lg:text-5xl text-white uppercase tracking-tighter italic">{colab.nome}</h3>
                            <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                        </div>
                        <p className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.5em] flex items-center gap-2">
                            <BarChart3 size={14} /> Análise de Performance Global
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-16">
                    <div className="h-[400px] w-full bg-black/20 rounded-[2rem] p-6 border border-white/5 relative overflow-hidden">
                        <div className="absolute top-6 right-8 opacity-10 text-4xl font-black italic select-none uppercase text-white">FUNIL GLOBAL</div>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dataFunilGeral} margin={{ left: 0, top: 20, right: 20, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12, fontWeight: '700', fill: '#94a3b8' }}
                                    dy={10}
                                />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#475569' }} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '16px', color: '#fff' }}
                                />
                                <Bar dataKey="valor" radius={[12, 12, 0, 0]} barSize={55}>
                                    {dataFunilGeral.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-2 gap-4 h-fit">
                        <MetricCard label="Hot Habilitação" valor={Number(colab.hotLeadsHabilitacao) || 0} cor="text-orange-400" />
                        <MetricCard label="Hot Revisão" valor={Number(colab.hotLeadsRevisao) || 0} cor="text-amber-400" />
                        <MetricCard label="Contratos Hab." valor={Number(colab.habilitacao) || 0} cor="text-emerald-400" />
                        <MetricCard label="Contratos Rev." valor={Number(colab.revisao) || 0} cor="text-rose-400" />
                    </div>

                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-10 border-t border-white/5">
                    <PieChartIndividual titulo="Canais de Entrada" data={[
                        { name: 'Tráfego', value: Number(colab.TRAFEGO_PAGO) || 0, color: '#3b82f6' },
                        { name: 'Callix', value: Number(colab.CALLIX) || 0, color: '#8b5cf6' },
                        { name: 'Indicação', value: Number(colab.INDICACAO) || 0, color: '#10b981' },
                        { name: 'Eventos', value: Number(colab.EVENTOS) || 0, color: '#f59e0b' },
                        { name: 'China', value: Number(colab.CHINA) || 0, color: '#e2e8f0' }
                    ]} />
                    <PieChartIndividual titulo="Origem Habilitação" data={[
                        { name: 'Tráfego', value: Number(colab.hab_TRAFEGO) || 0, color: '#3b82f6' },
                        { name: 'Callix', value: Number(colab.hab_CALLIX) || 0, color: '#8b5cf6' },
                        { name: 'Indicação', value: Number(colab.hab_INDICACAO) || 0, color: '#10b981' },
                        { name: 'Eventos', value: Number(colab.hab_EVENTOS) || 0, color: '#f59e0b' },
                        { name: 'China', value: Number(colab.hab_CHINA) || 0, color: '#e2e8f0' }
                    ]} />
                    <PieChartIndividual titulo="Origem Revisão" data={[
                        { name: 'Tráfego', value: Number(colab.rev_TRAFEGO) || 0, color: '#3b82f6' },
                        { name: 'Callix', value: Number(colab.rev_CALLIX) || 0, color: '#8b5cf6' },
                        { name: 'Indicação', value: Number(colab.rev_INDICACAO) || 0, color: '#10b981' },
                        { name: 'Eventos', value: Number(colab.rev_EVENTOS) || 0, color: '#f59e0b' },
                        { name: 'China', value: Number(colab.rev_CHINA) || 0, color: '#e2e8f0' }
                    ]} />
                    <PieChartIndividual titulo="Qualidade Total" data={[
                        { name: 'Hot Leads', value: (Number(colab.hotLeadsHabilitacao) || 0) + (Number(colab.hotLeadsRevisao) || 0), color: '#f59e0b' },
                        { name: 'Geral', value: Math.max(0, (Number(colab.leads) || 0) - ((Number(colab.hotLeadsHabilitacao) || 0) + (Number(colab.hotLeadsRevisao) || 0))), color: '#1e293b' }
                    ]} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-4">
                    <div className="flex items-center gap-2 mb-4 px-2">
                        <div className="h-2 w-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                            Comparativo MoM: {mesAnteriorLabel}
                        </span>
                    </div>
                    <MiniCardComparativo
                        titulo="Contratos Revisão"
                        atual={colab.revisao || 0}
                        anteriores={anterior?.revisao || 0}
                    />
                    <MiniCardComparativo
                        titulo="Contratos Habilitação"
                        atual={colab.habilitacao || 0}
                        anteriores={anterior?.habilitacao || 0}
                    />

                    <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl flex justify-between items-center">
                        <div>
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Leads Qualificados</p>
                            <p className="text-xl font-black text-emerald-400">{Math.max(0, (Number(colab.leads) || 0) - totalDesqualificados)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Desqualificados</p>
                            <p className="text-xl font-black text-rose-500">{colab.leadsDesqualificados || 0}</p>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-slate-900/40 border border-white/5 rounded-[3rem] p-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                        <TrendingUp size={120} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Fluxo de Reuniões & Leads</p>
                    <div className="grid grid-cols-2 gap-y-10 gap-x-4">
                        <div className="border-l-2 border-indigo-500/30 pl-4">
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Reuniões Agendadas</p>
                            <p className="text-4xl font-black text-white italic tracking-tighter">{colab.agendadas || 0}</p>
                        </div>
                        <div className="border-l-2 border-emerald-500/30 pl-4">
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Reuniões Realizadas</p>
                            <p className="text-4xl font-black text-white italic tracking-tighter">{colab.realizadas || 0}</p>
                        </div>
                        <div className="border-l-2 border-rose-500/30 pl-4">
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">No Show (Faltas)</p>
                            <p className="text-4xl font-black text-white italic tracking-tighter">{colab.noShow || 0}</p>
                        </div>
                        <div className="border-l-2 border-slate-500/30 pl-4">
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Leads não agendados</p>
                            <p className="text-4xl font-black text-white italic tracking-tighter">{naoAgendadas}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function MarketingDashboard({ dadosEquipe = [], dadosEquipeAnterior = [] }: any) {
    const [colaboradorAtivo, setColaboradorAtivo] = useState<string>("GERAL");
    const router = useRouter();
    const searchParams = useSearchParams();

    const mesAtualUrl = parseInt(searchParams.get('mes') || new Date().getMonth().toString());
    const anoAtualUrl = parseInt(searchParams.get('ano') || new Date().getFullYear().toString());
    const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    const rankingVendas = useMemo(() => {
        return [...dadosEquipe].map((c: any) => ({
            id: c.id,
            nome: c.nome || 'Usuário',
            vendas: (Number(c.habilitacao) || 0) + (Number(c.revisao) || 0)
        })).sort((a: any, b: any) => b.vendas - a.vendas);
    }, [dadosEquipe]);

    const statsGerais = useMemo(() => {
        return dadosEquipe.reduce((acc: any, curr: any) => ({
            nome: "VISÃO GERAL DA EQUIPE",
            leads: acc.leads + (Number(curr.leads) || 0),
            agendadas: acc.agendadas + (Number(curr.agendadas) || 0),
            realizadas: acc.realizadas + (Number(curr.realizadas) || 0),
            noShow: acc.noShow + (Number(curr.noShow || curr.no_show) || 0),
            habilitacao: acc.habilitacao + (Number(curr.habilitacao) || 0),
            revisao: acc.revisao + (Number(curr.revisao) || 0),
            leadsDesqualificados: acc.leadsDesqualificados + (Number(curr.leadsDesqualificados) || 0),
            hotLeadsHabilitacao: acc.hotLeadsHabilitacao + (Number(curr.hotLeadsHabilitacao) || 0),
            hotLeadsRevisao: acc.hotLeadsRevisao + (Number(curr.hotLeadsRevisao) || 0),
            TRAFEGO_PAGO: acc.TRAFEGO_PAGO + (Number(curr.TRAFEGO_PAGO) || 0),
            CALLIX: acc.CALLIX + (Number(curr.CALLIX) || 0),
            INDICACAO: acc.INDICACAO + (Number(curr.INDICACAO) || 0),
            EVENTOS: acc.EVENTOS + (Number(curr.EVENTOS) || 0),
            CHINA: acc.CHINA + (Number(curr.CHINA) || 0),
            hab_TRAFEGO: acc.hab_TRAFEGO + (Number(curr.hab_TRAFEGO) || 0),
            hab_CALLIX: acc.hab_CALLIX + (Number(curr.hab_CALLIX) || 0),
            hab_INDICACAO: acc.hab_INDICACAO + (Number(curr.hab_INDICACAO) || 0),
            hab_EVENTOS: acc.hab_EVENTOS + (Number(curr.hab_EVENTOS) || 0),
            rev_TRAFEGO: acc.rev_TRAFEGO + (Number(curr.rev_TRAFEGO) || 0),
            rev_CALLIX: acc.rev_CALLIX + (Number(curr.rev_CALLIX) || 0),
            rev_INDICACAO: acc.rev_INDICACAO + (Number(curr.rev_INDICACAO) || 0),
            rev_EVENTOS: acc.rev_EVENTOS + (Number(curr.rev_EVENTOS) || 0),
            rev_CHINA: acc.rev_CHINA + (Number(curr.rev_CHINA) || 0),

        }), {
            leads: 0, agendadas: 0, realizadas: 0, noShow: 0, habilitacao: 0, revisao: 0, leadsDesqualificados: 0,
            hotLeadsHabilitacao: 0, hotLeadsRevisao: 0, TRAFEGO_PAGO: 0, CALLIX: 0, INDICACAO: 0,
            EVENTOS: 0, CHINA: 0, hab_TRAFEGO: 0, hab_CALLIX: 0, hab_INDICACAO: 0, hab_EVENTOS: 0,
            hab_CHINA: 0, rev_TRAFEGO: 0, rev_CALLIX: 0, rev_INDICACAO: 0, rev_EVENTOS: 0, rev_CHINA: 0,
        });
    }, [dadosEquipe]);

    const statsGeraisAnterior = useMemo(() => {
        return dadosEquipeAnterior.reduce((acc: any, curr: any) => ({
            revisao: acc.revisao + (Number(curr.revisao) || 0),
            habilitacao: acc.habilitacao + (Number(curr.habilitacao) || 0),
        }), { revisao: 0, habilitacao: 0 });
    }, [dadosEquipeAnterior]);

    const dadosSelecionados = useMemo(() => {
        if (colaboradorAtivo === "GERAL") return statsGerais;
        return dadosEquipe.find((c: any) => c.id === colaboradorAtivo);
    }, [dadosEquipe, colaboradorAtivo, statsGerais]);

    const dadosAnterioresSelecionados = useMemo(() => {
        if (colaboradorAtivo === "GERAL") return statsGeraisAnterior;
        return dadosEquipeAnterior.find((c: any) => c.id === colaboradorAtivo) || null;
    }, [colaboradorAtivo, dadosEquipeAnterior, statsGeraisAnterior]);

    const mesAnteriorIndex = useMemo(() => mesAtualUrl === 0 ? 11 : mesAtualUrl - 1, [mesAtualUrl]);

    const exportarDados = async () => {
        const isGeral = colaboradorAtivo === "GERAL";
        const nomeAlvo = isGeral ? "GERAL" : dadosSelecionados?.nome;
        if (!nomeAlvo) return alert("Especialista não identificado.");
        try {
            let dadosBrutos: any[] = [];
            if (isGeral) {
                const promessas = rankingVendas.map(colab => getExportDataColaborador(colab.nome, mesAtualUrl, anoAtualUrl));
                const resultados = await Promise.all(promessas);
                dadosBrutos = resultados.flat().filter(d => d !== null);
            } else {
                dadosBrutos = await getExportDataColaborador(nomeAlvo, mesAtualUrl, anoAtualUrl);
            }
            if (!dadosBrutos || dadosBrutos.length === 0) return alert("Sem dados para este filtro.");
            const canaisConfig = [
                { id: "TRAFEGO_PAGO", label: "TRÁFEGO PAGO", cor: "C6EFCE" },
                { id: "CALLIX", label: "CALLIX", cor: "DDEBF7" },
                { id: "INDICACAO", label: "INDICAÇÃO", cor: "FCE4D6" },
                { id: "EVENTOS", label: "EVENTOS", cor: "F2DCDB" },
                { id: "CHINA", label: "CHINA", cor: "E7E6E6" },
                { id: "TOTAL", label: "TOTAL GERAL", cor: "BDBDBD" }
            ];
            const metricasLabel = [
                { label: "Leads Recebidos", chave: "leadsRecebidos" },
                { label: "Leads Desqualificados", chave: "leadsDesqualificados" },
                { label: "Agendamentos", chave: "reunioesAgendadas" },
                { label: "Realizadas", chave: "reunioesRealizadas" },
                { label: "No Show", chave: "noShow" },
                { label: "Contratos Habilitação", chave: "contratosHabilitacao" },
                { label: "Contratos Revisão", chave: "contratosRevisao" },
                { label: "Hot Habilitação", chave: "HotLeadsHabilitacao" },
                { label: "Hot Revisão", chave: "HotLeadsRevisao" },
            ];
            const matrizFinal: any[] = [];
            const merges: any[] = [];
            const headerRow = ["CANAL:", "MÉTRICAS:"];
            for (let i = 1; i <= 31; i++) headerRow.push(String(i));
            headerRow.push("SOMA TOTAL");
            matrizFinal.push(headerRow);
            canaisConfig.forEach((canal) => {
                const linhaInicial = matrizFinal.length;
                metricasLabel.forEach((metrica, idx) => {
                    const rowData: any[] = [
                        { v: idx === 0 ? canal.label : "", s: { alignment: { vertical: "center", horizontal: "center" }, fill: { fgColor: { rgb: canal.cor } }, font: { bold: true, sz: 10 } } },
                        { v: metrica.label, s: { fill: { fgColor: { rgb: canal.cor } }, font: { sz: 9 } } }
                    ];
                    let somaTotalLinha = 0;
                    for (let dia = 1; dia <= 31; dia++) {
                        const registrosDia = dadosBrutos.filter((d: any) => {
                            const date = new Date(d.dataRegistro);
                            const diaMatch = date.getUTCDate() === dia;
                            if (canal.id === "TOTAL") return diaMatch;
                            return diaMatch && d.canal === canal.id;
                        });
                        const valor = registrosDia.reduce((sum: number, r: any) => sum + (Number(r[metrica.chave]) || 0), 0);
                        rowData.push({ v: valor, s: { alignment: { horizontal: "center" }, fill: { fgColor: { rgb: canal.cor } }, border: { bottom: { style: "thin", color: { rgb: "FFFFFF" } } } } });
                        somaTotalLinha += valor;
                    }
                    rowData.push({ v: somaTotalLinha, s: { font: { bold: true }, fill: { fgColor: { rgb: "D9D9D9" } }, alignment: { horizontal: "center" } } });
                    matrizFinal.push(rowData);
                });
                merges.push({ s: { r: linhaInicial, c: 0 }, e: { r: linhaInicial + metricasLabel.length - 1, c: 0 } });
                matrizFinal.push(Array(34).fill(""));
            });
            const ws = XLSX.utils.aoa_to_sheet(matrizFinal);
            const wb = XLSX.utils.book_new();
            ws['!merges'] = merges;
            ws['!cols'] = [{ wch: 18 }, { wch: 25 }, ...Array(31).fill({ wch: 4 }), { wch: 15 }];
            XLSX.utils.book_append_sheet(wb, ws, "Dados Performance");
            XLSX.writeFile(wb, `Performance_${nomeAlvo}_${meses[mesAtualUrl]}.xlsx`);
        } catch (error) {
            console.error(error);
            alert("Erro na geração da planilha.");
        }
    };

    return (
        <div className="min-h-screen text-slate-200 p-4 lg:p-8 space-y-8 pb-24 bg-[#020617]">
            <header className="flex flex-col lg:flex-row items-center justify-between bg-slate-900/40 backdrop-blur-xl p-6 rounded-[2.5rem] border border-white/5 shadow-2xl">
                <div className="flex items-center gap-5">
                    <div className="h-14 w-14 bg-gradient-to-br from-emerald-400 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <Users className="text-white" size={28} />
                    </div>
                    <h1 className="text-2xl font-black tracking-tight text-white uppercase italic">Performance Marketing</h1>
                </div>

                <div className="mt-6 lg:mt-0 flex flex-wrap items-center gap-4">
                    <button
                        onClick={exportarDados}
                        className="cursor-pointer h-12 px-5 bg-white/[0.03] hover:bg-blue-500/10 border border-white/5 hover:border-blue-500/30 rounded-2xl flex items-center gap-3 transition-all group"
                    >
                        <Download size={16} className="text-blue-400 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black text-slate-300 group-hover:text-white uppercase tracking-[0.15em] italic">
                            Exportar {colaboradorAtivo === "GERAL" ? "Equipe" : "Colaborador"}
                        </span>
                    </button>
                    <label htmlFor="mes-performance-marketing" className="sr-only">Mês da performance</label>
                    <select id="mes-performance-marketing" value={mesAtualUrl} onChange={(e) => {
                        const params = new URLSearchParams(searchParams.toString());
                        params.set('mes', e.target.value);
                        router.push(`?${params.toString()}`);
                    }} className="bg-black/20 border border-white/10 p-3 rounded-2xl text-[11px] font-black text-white outline-none uppercase">
                        {meses.map((nome, index) => <option key={index} value={index} className="bg-slate-900">{nome}</option>)}
                    </select>
                    <label htmlFor="closer-performance-marketing" className="sr-only">Filtrar performance por closer</label>
                    <select id="closer-performance-marketing" value={colaboradorAtivo} onChange={(e) => setColaboradorAtivo(e.target.value)} className="bg-black/20 border border-white/10 p-3 rounded-2xl text-[11px] font-black text-white outline-none uppercase min-w-[220px]">
                        <option value="GERAL" className="bg-slate-900 text-emerald-400 font-bold">VISÃO GERAL (EQUIPE)</option>
                        {rankingVendas.map((colab) => <option key={colab.id} value={colab.id} className="bg-slate-900">{colab.nome}</option>)}
                    </select>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <CardDestaque titulo="Performance" valor={rankingVendas[0]?.nome || "---"} sub="Top Vendas Mensal" icon={<Award className="text-yellow-400" />} gradient="from-yellow-500/10 to-transparent" />
                <CardDestaque titulo="Volume" valor={statsGerais.leads} sub="Total Leads Mês" icon={<TrendingUp className="text-blue-400" />} gradient="from-blue-500/10 to-transparent" />
                <CardDestaque titulo="Conversão" valor={statsGerais.habilitacao + statsGerais.revisao} sub="Contratos Alpha" icon={<Target className="text-emerald-400" />} gradient="from-emerald-500/10 to-transparent" />
                <CardDestaque titulo="Hot Leads" valor={statsGerais.hotLeadsHabilitacao + statsGerais.hotLeadsRevisao} sub="Alta Intenção" icon={<Zap className="text-orange-400" />} gradient="from-orange-500/10 to-transparent" />
            </div>

            {dadosSelecionados ? (
                <CardColaborador
                    colab={dadosSelecionados}
                    anterior={dadosAnterioresSelecionados}
                    mesAnteriorLabel={meses[mesAnteriorIndex]}
                />
            ) : colaboradorAtivo !== "GERAL" ? (
                <div className="bg-slate-900/40 border border-white/5 rounded-[2rem] p-12 text-center">
                    <p className="text-sm font-black text-slate-400 uppercase tracking-widest">
                        Nenhum lead lançado por este closer em {meses[mesAtualUrl]}.
                    </p>
                </div>
            ) : null}
        </div>
    );
}
