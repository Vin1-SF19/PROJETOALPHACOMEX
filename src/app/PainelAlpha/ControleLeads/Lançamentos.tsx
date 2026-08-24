"use client"

import { getExportData, getExportDataColaborador, getPerformanceAcumulada, getPerformanceDiaria, upsertPerformance } from "@/actions/ComercialControle";
import { Calendar, Download, Zap } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import XLSX from 'xlsx-js-style';

type Canal = 'TRAFEGO_PAGO' | 'CALLIX' | 'INDICACAO' | 'EVENTOS' | 'CHINA';
type Servico = 'REVISAO' | 'HABILITACAO';

export default function Lancamentos({ dadosAcumulados }: any) {
    const { data: session } = useSession();
    const usuarioNome = session?.user?.nome;
    const router = useRouter();
    const [status, setStatus] = useState<'idle' | 'saving' | 'success'>('idle');
    const [servico, setServico] = useState<Servico>('REVISAO');
    const searchParams = useSearchParams();
    const [canal, setCanal] = useState<Canal>((searchParams.get('canal') as Canal) || 'TRAFEGO_PAGO');
    const canalAtual = searchParams.get('canal') || 'TRAFEGO_PAGO';
    const [loading, setLoading] = useState(true);
    const [metricas, setMetricas] = useState({
        leads_recebidos: 0,
        leads_desqualificados: 0,
        no_show: 0,
        reunioes_agendadas: 0,
        reunioes_realizadas: 0,
        contratos_Habilit: 0,
        contratos_Revisao: 0,
        HotLeadsRevisao: 0,
        HotLeadsHabilitacao: 0
    });
    const [resumoLateral, setResumoLateral] = useState(dadosAcumulados);
    const v = { leads: 0, agendadas: 0, realizadas: 0, noShow: 0, habilitacao: 0, revisao: 0, leadsDesqualificados: 0 };
    const mesAtualUrl = parseInt(searchParams.get('mes') || new Date().getMonth().toString());
    const anoAtualUrl = parseInt(searchParams.get('ano') || new Date().getFullYear().toString());
    const meses = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const dataUrl = searchParams.get('data') || new Date().toISOString().split('T')[0];



    const dadosMensaisTotais = {
        leads_recebidos: Object.values(resumoLateral?.canais || {}).reduce((acc: number, v: any) => acc + (v.leads || 0), 0),
        leads_desqualificados: Object.values(resumoLateral?.canais || {}).reduce((acc: number, v: any) => acc + (v.leadsDesqualificados || 0), 0),
        no_show: Object.values(resumoLateral?.canais || {}).reduce((acc: number, v: any) => acc + (v.noShow || 0), 0),
        reunioes_agendadas: Object.values(resumoLateral?.canais || {}).reduce((acc: number, v: any) => acc + (v.agendadas || 0), 0),
        reunioes_realizadas: Object.values(resumoLateral?.canais || {}).reduce((acc: number, v: any) => acc + (v.realizadas || 0), 0),
        contratos_Habilit: Object.values(resumoLateral?.canais || {}).reduce((acc: number, v: any) => acc + (v.habilitacao || 0), 0),
        contratos_Revisao: Object.values(resumoLateral?.canais || {}).reduce((acc: number, v: any) => acc + (v.revisao || 0), 0),

        HotLeadsHabilitacao: Object.values(resumoLateral?.canais || {}).reduce((acc: number, v: any) => acc + (v.HotLeadsHabilitacao || 0), 0),
        HotLeadsRevisao: Object.values(resumoLateral?.canais || {}).reduce((acc: number, v: any) => acc + (v.HotLeadsRevisao || 0), 0),
    };


    useEffect(() => {
        setLoading(true);


        setMetricas({
            leads_recebidos: 0,
            leads_desqualificados: 0,
            reunioes_agendadas: 0,
            reunioes_realizadas: 0,
            no_show: 0,
            contratos_Habilit: 0,
            contratos_Revisao: 0,
            HotLeadsHabilitacao: 0,
            HotLeadsRevisao: 0
        });

        async function carregarNovoCanal() {
            if (usuarioNome) {
                setLoading(true);

                const dataObjeto = new Date(dataUrl + 'T12:00:00');

                const diario = await getPerformanceDiaria(usuarioNome, dataObjeto, canalAtual);
                setMetricas(diario || {
                    leads_recebidos: 0,
                    leads_desqualificados: 0,
                    reunioes_agendadas: 0,
                    reunioes_realizadas: 0,
                    no_show: 0,
                    contratos_Habilit: 0,
                    contratos_Revisao: 0,
                    HotLeadsHabilitacao: 0,
                    HotLeadsRevisao: 0

                });

                const acumulado = await getPerformanceAcumulada(
                    usuarioNome,
                    dataObjeto.getMonth(),
                    dataObjeto.getFullYear()
                );
                setResumoLateral(acumulado);

                setLoading(false);
            }

        }
        carregarNovoCanal();
    }, [canalAtual, dataUrl, mesAtualUrl, usuarioNome]);


    useEffect(() => {
        const canalNaUrl = searchParams.get('canal') as Canal;
        if (canalNaUrl) {
            setCanal(canalNaUrl);
        }
    }, [searchParams]);

    const handleMesChange = (novoMes: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('mes', novoMes);

        const novaData = new Date(anoAtualUrl, parseInt(novoMes), 1).toISOString().split('T')[0];
        params.set('data', novaData);

        router.push(`?${params.toString()}`, { scroll: false });
    };

    const handleDataChange = (novaData: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('data', novaData);
        router.push(`?${params.toString()}`, { scroll: false });
    };


    const handleSave = async () => {
        setStatus('saving');
        try {
            const payload = {
                dataRegistro: new Date(dataUrl + 'T12:00:00'),
                canal: canalAtual,
                servico,
                leadsRecebidos: metricas.leads_recebidos,
                leadsDesqualificados: metricas.leads_desqualificados,
                reunioesAgendadas: metricas.reunioes_agendadas,
                reunioesRealizadas: metricas.reunioes_realizadas,
                noShow: metricas.no_show,
                contratosHabilitacao: metricas.contratos_Habilit,
                contratosRevisao: metricas.contratos_Revisao,
                HotLeadsHabilitacao: metricas.HotLeadsHabilitacao,
                HotLeadsRevisao: metricas.HotLeadsRevisao
            };

            const response = await upsertPerformance(payload);
            if (response.success) {
                setStatus('success');
                const novoAcumulado = await getPerformanceAcumulada(session?.user?.nome || "SISTEMA", mesAtualUrl, anoAtualUrl);
                setResumoLateral(novoAcumulado);
                router.refresh();
                setTimeout(() => setStatus('idle'), 2000);
            }
        } catch (error) {
            alert("Erro ao salvar.");
            setStatus('idle');
        }
    };

    const handleCanalChange = (novoCanal: Canal) => {
        setCanal(novoCanal);
        router.push(`?canal=${novoCanal}`);
    };

    const handleInputChange = (field: string, value: string) => {
        setMetricas(prev => ({ ...prev, [field]: parseInt(value) || 0 }));
    };

    const exportarRelatorioPessoal = async () => {
        if (!usuarioNome) return alert("Usuário não identificado.");

        try {
            const dadosBrutos = await getExportDataColaborador(usuarioNome, mesAtualUrl, anoAtualUrl);
            if (!dadosBrutos || dadosBrutos.length === 0) return alert("Sem dados.");

            // Configuração de Cores
            const canaisConfig = [
                { id: "TRAFEGO_PAGO", label: "TRÁFEGO PAGO", cor: "C6EFCE" }, // Verde claro
                { id: "CALLIX", label: "CALLIX", cor: "DDEBF7" },           // Azul claro
                { id: "INDICACAO", label: "INDICAÇÃO", cor: "FCE4D6" },      // Laranja claro
                { id: "EVENTOS", label: "EVENTOS", cor: "F2DCDB" },         // Rosa/Pêssego
                { id: "CHINA", label: "CHINA", cor: "E7E6E6" }              // Cinza
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
                        {
                            v: idx === 0 ? canal.label : "", s: {
                                alignment: { vertical: "center", horizontal: "center" },
                                fill: { fgColor: { rgb: canal.cor } },
                                font: { bold: true, sz: 10 }
                            }
                        },
                        { v: metrica.label, s: { fill: { fgColor: { rgb: canal.cor } }, font: { sz: 9 } } }
                    ];

                    let somaTotal = 0;
                    for (let dia = 1; dia <= 31; dia++) {
                        const reg = dadosBrutos.find((d: any) =>
                            new Date(d.dataRegistro).getUTCDate() === dia && d.canal === canal.id
                        );
                        const valor = reg ? (reg as any)[metrica.chave] || 0 : 0;

                        rowData.push({
                            v: valor, s: {
                                alignment: { horizontal: "center" },
                                fill: { fgColor: { rgb: canal.cor } },
                                border: { bottom: { style: "thin", color: { rgb: "FFFFFF" } } }
                            }
                        });
                        somaTotal += valor;
                    }

                    // Coluna do Total
                    rowData.push({
                        v: somaTotal, s: {
                            font: { bold: true },
                            fill: { fgColor: { rgb: "D9D9D9" } },
                            alignment: { horizontal: "center" }
                        }
                    });

                    matrizFinal.push(rowData);
                });

                merges.push({
                    s: { r: linhaInicial, c: 0 },
                    e: { r: linhaInicial + metricasLabel.length - 1, c: 0 }
                });

                matrizFinal.push(Array(34).fill(""));
            });

            const ws = XLSX.utils.aoa_to_sheet(matrizFinal);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Relatório Geral");

            // Aplicar merges e larguras
            ws['!merges'] = merges;
            ws['!cols'] = [
                { wch: 18 }, // Canal
                { wch: 25 }, // Métrica
                ...Array(31).fill({ wch: 4 }), // Dias
                { wch: 15 }  // Total
            ];

            XLSX.writeFile(wb, `${usuarioNome}_Relatorio_Leads.xlsx`);

        } catch (error) {
            console.error(error);
            alert("Erro na geração da planilha colorida.");
        }
    };



    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 font-black text-xs uppercase tracking-widest text-slate-400">Carregando {canalAtual}...</span>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="lg:col-span-3 space-y-4 lg:sticky lg:top-24 animate-in fade-in slide-in-from-left-4 duration-700">

                <CardResumoLateral
                    titulo={`Relatorio de ${meses[mesAtualUrl]}`}
                    tipo="mensal"
                    icon={<Zap size={14} className="text-blue-500 fill-blue-500" />}
                    dados={dadosMensaisTotais}
                />

                <button
                    onClick={exportarRelatorioPessoal}
                    className="cursor-pointer w-full py-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-[2rem] flex items-center justify-center gap-3 transition-all group"
                >
                    <div className="h-8 w-8 bg-blue-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Download size={16} className="text-white" />
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Relatório Pessoal</p>
                        <p className="text-xs font-bold text-white uppercase italic">Exportar meus dados completos</p>
                    </div>
                </button>

            </div>

            <div className="lg:col-span-6">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-black tracking-tighter flex items-center gap-2">
                            <Calendar className="text-blue-500" /> Registro Diário
                        </h2>

                        <div className="relative group">
                            <label className="absolute -top-6 right-0 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                Data do Registro
                            </label>
                            <input
                                type="date"
                                value={dataUrl}
                                onChange={(e) => handleDataChange(e.target.value)}
                                className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider outline-none border-2 border-transparent focus:border-blue-500 transition-all cursor-pointer"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 pb-10 border-b border-slate-100 dark:border-slate-800 items-end">

                        {/* Bloco do Canal de Entrada */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">
                                Canal de Entrada
                            </label>
                            <select
                                value={canal}
                                onChange={(e) => handleCanalChange(e.target.value as Canal)}
                                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl outline-none focus:border-blue-500 font-bold transition-all"
                            >
                                <option value="TRAFEGO_PAGO">Tráfego Pago</option>
                                <option value="CALLIX">Callix</option>
                                <option value="INDICACAO">Indicação</option>
                                <option value="EVENTOS">EVENTOS</option>
                                <option value="CHINA">CHINA</option>
                            </select>
                        </div>

                        {/* Bloco do Histórico de Mês (Estilizado para combinar) */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-1 tracking-widest">
                                Período de Referência
                            </label>
                            <div className="flex items-center justify-between p-[14px] bg-gray-600 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-blue-600 uppercase leading-none mb-1">Mês Selecionado</span>
                                    <select
                                        value={mesAtualUrl}
                                        onChange={(e) => handleMesChange(e.target.value)}
                                        className="bg-transparent font-black text-sm outline-none appearance-none cursor-pointer text-slate-900 dark:text-slate-700"
                                    >
                                        {meses.map((mes, index) => (
                                            <option key={index} value={index}>{mes}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="w-[1px] h-8 bg-slate-100 dark:bg-slate-800"></div>
                                    <div className="text-right pr-2">
                                        <p className="text-[9px] font-bold text-slate-400 leading-none">ANO</p>
                                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">{anoAtualUrl}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>



                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputMetrica label="Leads Diario" value={metricas.leads_recebidos} onChange={(v: string) => handleInputChange('leads_recebidos', v)} color="blue" />
                        <InputMetrica label="Leads Desqualificados" value={metricas.leads_desqualificados} onChange={(v: string) => handleInputChange('leads_desqualificados', v)} color="red" />
                        <InputMetrica label="Reuniões Agendadas" value={metricas.reunioes_agendadas} onChange={(v: string) => handleInputChange('reunioes_agendadas', v)} color="purple" />
                        <InputMetrica label="Reuniões Realizadas" value={metricas.reunioes_realizadas} onChange={(v: string) => handleInputChange('reunioes_realizadas', v)} color="indigo" />
                        <InputMetrica label="No Show (Faltas)" value={metricas.no_show} onChange={(v: string) => handleInputChange('no_show', v)} color="orange" />


                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-4">
                            <InputMetrica label="Venda Habilit." value={metricas.contratos_Habilit} onChange={(v: string) => handleInputChange('contratos_Habilit', v)} color="cyan" flat />
                            <InputMetrica label="Venda Revisão" value={metricas.contratos_Revisao} onChange={(v: string) => handleInputChange('contratos_Revisao', v)} color="emerald" flat />
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-4">
                            <InputMetrica
                                label="Hot Habilit."
                                value={metricas.HotLeadsHabilitacao}
                                onChange={(v: string) => handleInputChange('HotLeadsHabilitacao', v)}
                                color="amber"
                                flat
                            />
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-4">
                            <InputMetrica
                                label="Hot Revisão"
                                value={metricas.HotLeadsRevisao}
                                onChange={(v: string) => handleInputChange('HotLeadsRevisao', v)}
                                color="pink"
                                flat
                            />
                        </div>

                    </div>


                    <button
                        onClick={handleSave}
                        disabled={status === 'saving'}
                        className={`w-full mt-10 py-5 rounded-2xl font-black text-lg transition-all ${status === 'success'
                            ? 'bg-green-500 text-white'
                            : 'bg-blue-600 text-white shadow-xl shadow-blue-500/20 hover:bg-blue-700 hover:-translate-y-1'
                            }`}
                    >
                        {status === 'saving' ? (
                            'PROCESSANDO...'
                        ) : status === 'success' ? (
                            'DADOS SINCRONIZADOS!'
                        ) : (

                            `SALVAR NO SISTEMA (${canalAtual?.toUpperCase() || 'GERAL'})`
                        )}
                    </button>


                </div>
            </div>

            <div className="lg:col-span-3 space-y-4 lg:sticky lg:top-24">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Resumo Mensal / Canal</h3>

                {(Object.keys(resumoLateral.canais) as Canal[]).map((key) => {
                    const dadosCanal = resumoLateral.canais[key];
                    return (
                        <CardCanalSimples
                            key={key}
                            titulo={key.replace('_', ' ')}
                            cor={key === 'TRAFEGO_PAGO' ? 'blue' : key === 'CALLIX' ? 'orange' : key === 'INDICACAO' ? 'emerald' : key === 'EVENTOS' ? 'pink' : 'red'}
                            leads={dadosCanal.leads}
                            desq={dadosCanal.leadsDesqualificados}
                            agendadas={dadosCanal.agendadas}
                            Realizadas={dadosCanal.realizadas}
                            NoShow={dadosCanal.noShow}
                            VendasHabilit={dadosCanal.habilitacao}
                            vendasRevisao={dadosCanal.revisao}
                            HotLeadsHabilitacao={dadosCanal.HotLeadsHabilitacao}
                            HotLeadsRevisao={dadosCanal.HotLeadsRevisao}
                        />
                    );
                })}
            </div>
        </div>
    )

    function CardCanalSimples({ titulo, leads, desq, agendadas, Realizadas, NoShow, vendasRevisao, VendasHabilit, HotLeadsHabilitacao, HotLeadsRevisao, cor }: any) {
        const colorClasses: any = {
            blue: 'text-blue-600 border-blue-100 bg-blue-50/30',
            orange: 'text-orange-600 border-orange-100 bg-orange-50/30',
            emerald: 'text-emerald-600 border-emerald-100 bg-emerald-50/30',
            pink: 'text-pink-500 border-rose-700 bg-pink-50/10 dark:border-pink-900/50',
            amber: 'text-amber-600 border-amber-100 bg-amber-50/30',
            red: 'text-red-600 border-red-100 bg-red-50/30',
        };

        return (
            <div className={`p-4 rounded-3xl border ${colorClasses[cor]} dark:bg-slate-900/40 dark:border-slate-800 transition-all hover:scale-[1.02]`}>
                <p className="text-[10px] font-black uppercase mb-3 italic tracking-widest">{titulo}</p>
                <div className="grid grid-cols-3 gap-y-3 gap-x-1 text-center">
                    <div><p className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-1">Leads</p><p className="text-xs font-black dark:text-white">{leads}</p></div>
                    <div>
                        <p className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-1">Leads desq.</p>
                        <p className="text-xs font-black dark:text-white">
                            {Number.isNaN(Number(desq)) ? 0 : desq}
                        </p>
                    </div>
                    <div><p className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-1">Agend.</p><p className="text-xs font-black dark:text-white">{agendadas}</p></div>
                    <div><p className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-1">Real.</p><p className="text-xs font-black dark:text-white">{Realizadas}</p></div>
                    <div><p className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-1">Faltas</p><p className="text-xs font-black dark:text-white">{NoShow}</p></div>
                    <div><p className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-1">Habilit.</p><p className="text-xs font-black dark:text-white">{VendasHabilit}</p></div>
                    <div><p className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-1">Revisão</p><p className="text-xs font-black dark:text-white">{vendasRevisao}</p></div>

                    <div><p className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-1">Hot Habilit.</p><p className="text-xs font-black dark:text-white">{HotLeadsHabilitacao}</p></div>
                    <div><p className="text-[7px] font-bold text-slate-400 uppercase leading-none mb-1">Hot Revisão</p><p className="text-xs font-black dark:text-white">{HotLeadsRevisao}</p></div>
                </div>
            </div>
        );
    }

    function CardResumoLateral({ titulo, dados, icon }: any) {
        return (
            <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2 mb-6">
                    {icon}
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-600">{titulo}</h4>
                </div>
                <div className="space-y-4">
                    <ItemResumo label="Leads" valor={dados.leads_recebidos} color="text-blue-500" />
                    <ItemResumo label="Desq." valor={dados.leads_desqualificados} color="text-red-500" />
                    <ItemResumo label="No Show" valor={dados.no_show} color="text-orange-500" />
                    <ItemResumo label="Agend." valor={dados.reunioes_agendadas} color="text-purple-500" />
                    <ItemResumo label="Realiz." valor={dados.reunioes_realizadas} color="text-indigo-500" />
                    <ItemResumo label="CF - HABILITAÇÃO" valor={dados.contratos_Habilit} color="text-green-500" />
                    <ItemResumo label="CF - REVISÃO" valor={dados.contratos_Revisao} color="text-red-500" />
                    <ItemResumo label="Hot Leads - HABILITAÇÃO" valor={dados.HotLeadsHabilitacao} color="text-pink-500" />
                    <ItemResumo label="Hot Leads - REVISÃO" valor={dados.HotLeadsRevisao} color="text-purple-500" />
                </div>
            </div>
        );
    }

    function ItemResumo({ label, valor, color }: any) {
        return (
            <div className="flex justify-between items-end border-b border-slate-100 dark:border-slate-800 pb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">{label}</span>
                <span className={`text-xl font-black leading-none ${color}`}>{valor || 0}</span>
            </div>
        );
    }
}

function InputMetrica({ label, value, onChange, color, flat }: any) {
    const colors: any = {
        blue: 'focus-within:border-blue-500 text-blue-600',
        red: 'focus-within:border-red-500 text-red-600',
        purple: 'focus-within:border-purple-500 text-purple-600',
        indigo: 'focus-within:border-indigo-500 text-indigo-600',
        orange: 'focus-within:border-orange-500 text-orange-600',
        green: 'focus-within:border-green-500 text-green-600',
        emerald: 'focus-within:border-emerald-500 text-emerald-600',
        pink: 'focus-within:border-pink-500 text-pink-600',
        cyan: 'focus-within:border-cyan-500 text-cyan-600',
        amber: 'focus-within:border-amber-500 text-amber-600',
    };

    return (
        <div className={`transition-all ${flat ? '' : 'bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 p-4 rounded-2xl shadow-sm'} ${colors[color] || colors.blue}`}>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 leading-none">
                {label}
            </label>
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                className="w-full bg-transparent text-3xl font-black outline-none appearance-none"
            />
        </div>
    );
}
