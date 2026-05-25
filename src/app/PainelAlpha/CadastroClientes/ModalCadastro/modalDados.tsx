"use client";

import React, { useEffect, useState } from 'react';
import { X, Plus, ThumbsUp, ThumbsDown, Minus, Calendar, User, MessageSquare, Save, Star, Search, CheckCircle2, TrendingUp, LockOpen, Edit3, Check, Trash2, AlertTriangle } from "lucide-react";
import { adicionarSocio, atualizarLogCS, atualizarSocio, atualizarStatusCliente, excluirLogCS, excluirLogFeedback, salvarAlteracoesGeral, salvarAlteracoesGestao, salvarLogCS, salvarLogFeedback } from '@/actions/Clientes';
import { toast } from 'sonner';
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getTema } from '@/lib/temas';


interface ModalDadosProps {
    editandoDados: boolean;
    cnpj: string;
    setCnpj: (val: string) => void;
    razaoSocial: string;
    setRazaoSocial: (val: string) => void;
    nomeFantasia: string;
    setNomeFantasia: (val: string) => void;
    dataConstituicao: string;
    setDataConstituicao: (val: string) => void;
    regimeTributario: string;
    setRegimeTributario: (val: string) => void;
    uf: string;
    setUf: (val: string) => void;
    servicosSelecionados: string[];
    analistaSelecionado: string;
    style: any;
}




export default function ModalGestaoCliente({ isOpen, onClose, cliente, aoSalvar }: any) {
    const { data: session } = useSession();
    const style = getTema((session?.user as any)?.tema_interface || "blue");

    const [servicosSelecionados, setServicosSelecionados] = useState<string[]>([]);
    const [analistaSelecionado, setAnalistaSelecionado] = useState("");
    const [showConfirmarOcultar, setShowConfirmarOcultar] = useState(false);

    const router = useRouter();
    const [showNovoCS, setShowNovoCS] = useState(false);
    const [status, setStatus] = useState(cliente?.status || "Em Andamento");
    const [feedbackCS, setFeedbackCS] = useState<"pos" | "neg" | "na" | null>(null);
    const [sentimentoFeedback, setSentimentoFeedback] = useState<"pos" | "neg" | "na" | null>(null);
    const [obsCS, setObsCS] = useState("");
    const [enviandoCS, setEnviandoCS] = useState(false);

    const [nps, setNps] = useState<number | null>(cliente?.nps ?? null);
    const [feedbackSim, setFeedbackSim] = useState(cliente?.feedbackGoogle ?? false);
    const [nomeFeedback, setNomeFeedback] = useState("");
    const [showNovoFeedback, setShowNovoFeedback] = useState(false);

    const [listaLogsFeedback, setListaLogsFeedback] = useState<any[]>(cliente?.logFeedback ?? []);
    const [editandoDados, setEditandoDados] = useState(false);

    const [dataContratacao, setDataContratacao] = useState(cliente?.dataContratacao || "");

    const [analistaResponsavel, setAnalistaResponsavel] = useState(cliente?.analistaResponsavel || "");

    const [showServicos, setShowServicos] = useState(false);
    const [showAnalistas, setShowAnalistas] = useState(false);
    const [isCriandoServico, setIsCriandoServico] = useState(false);
    const [novoServicoNome, setNovoServicoNome] = useState("");

    const listaServicos = ["Habilitação RADAR - 50K", "Revisão RADAR - 150K", "Revisão RADAR - ILIMITADO", "TTD 409", "Recuperação AFRMM", "Outras Recuperaçoes Tributarias"];
    const listaAnalistas = ["Vitor", "Maria", "Kaline", "Marcelo"];
    const SERVICOS_COM_EMBASAMENTO = ["Revisão RADAR - 150K", "Revisão RADAR - ILIMITADO"];
    const embasamentoDesbloqueado = SERVICOS_COM_EMBASAMENTO.some(s => servicosSelecionados.includes(s));


    const [embasamento, setEmbasamento] = useState(cliente?.embasamento || "");
    const [origemLead, setOrigemLead] = useState(cliente?.origemLead || "");

    const listaEmbasamentos = ["Disponibilidade Financeira", "Início ou Retomada", "Receita Bruta (DAS)", "Receita Bruta (CPRB)"];
    const listaOrigensLead = ["Tráfego Pago (Meta - Instagram)", "Tráfego Pago (Google)", "Indicação Parceiro", "Indicação Cliente", "Evento", "China"];

    const [dataCS, setDataCS] = useState(new Date().toISOString().split('T')[0]);
    const [dataFeedback, setDataFeedback] = useState(new Date().toISOString().split('T')[0]);


    const [obsFeedback, setObsFeedback] = useState("");


    const [cnpj, setCnpj] = useState(cliente?.cnpj || "");
    const [razaoSocial, setRazaoSocial] = useState(cliente?.razaoSocial || "");
    const [nomeFantasia, setNomeFantasia] = useState(cliente?.nomeFantasia || "");
    const [dataConstituicao, setDataConstituicao] = useState(cliente?.dataConstituicao || "");
    const [regimeTributario, setRegimeTributario] = useState(cliente?.regimeTributario || "");
    const [uf, setUf] = useState(cliente?.uf || "");
    const [dataExitoManual, setDataExitoManual] = useState(
        cliente?.dataExito
            ? new Date(cliente.dataExito).toISOString().split("T")[0]
            : ""
    );


    const [listaLogsCS, setListaLogsCS] = useState<any[]>([]);

    const [listaSocios, setListaSocios] = useState<any[]>([]);
    const [showNovoSocio, setShowNovoSocio] = useState(false);
    const [novoSocio, setNovoSocio] = useState({ nome: "", telefone: "", dataNascimento: "", vinculo: "", obs: "" });
    const [enviandoFeedback, setEnviandoFeedback] = useState(false);

    // Edição inline de sócios
    const [editandoSocioId, setEditandoSocioId] = useState<number | null>(null);
    const [socioEditForm, setSocioEditForm] = useState({ nome: "", telefone: "", dataNascimento: "", vinculo: "", obs: "" });
    const [salvandoSocio, setSalvandoSocio] = useState(false);

    // Edição de log CS
    const [showEditCS, setShowEditCS] = useState(false);
    const [csEditando, setCsEditando] = useState<any>(null);
    const [csEditSentimento, setCsEditSentimento] = useState<"pos" | "neg" | "na" | null>(null);
    const [csEditObs, setCsEditObs] = useState("");
    const [csEditData, setCsEditData] = useState("");
    const [salvandoCS, setSalvandoCS] = useState(false);


    useEffect(() => {
        if (cliente) {
            setCnpj(cliente.cnpj || "");
            setRazaoSocial(cliente.razaoSocial || "");
            setServicosSelecionados(cliente.servicos?.split(",") || []);
            setAnalistaSelecionado(cliente.analista || "");
        }
    }, [cliente]);



    const isTextoValido = (texto: string) => texto.length >= 10 && texto.length <= 140;



    const handleSalvarCS = async () => {
        if (!feedbackCS || obsCS.length < 10) return toast.error("Dados inválidos");

        setEnviandoCS(true);

        const dataSelecionada = new Date(`${dataCS}T12:00:00`).toISOString();

        const novoLog = {
            sentimento: feedbackCS,
            observacao: obsCS,
            data_registro: dataSelecionada
        };

        const res = await salvarLogCS(cliente.id, novoLog);

        if (res.success) {
            toast.success("CS registrado!");

            setListaLogsCS((prev: any[]) => [novoLog, ...prev]);

            setShowNovoCS(false);
            setObsCS("");
            setFeedbackCS(null);

            setDataCS(new Date().toISOString().split('T')[0]);

            if (aoSalvar) aoSalvar();
        }
        setEnviandoCS(false);
    };

    const handleExcluirCS = async (logId: number) => {
        if (!confirm("Deseja realmente apagar este relato de CS?")) return;

        try {
            const res = await excluirLogCS(logId);

            if (res.success) {
                toast.success("Relato removido!");

                setListaLogsCS((prev: any[]) => prev.filter((log) => log.id !== logId));

                if (aoSalvar) aoSalvar();
            } else {
                toast.error("Erro ao excluir.");
            }
        } catch (error) {
            toast.error("Falha na conexão.");
        }
    };

    useEffect(() => {
        if (isOpen && cliente?.socios) {
            setListaSocios(cliente.socios);
        }
        return () => {
            setListaSocios([]);
            setShowNovoSocio(false);
        };
    }, [cliente?.id, isOpen]);

    const handleAdicionarSocio = async () => {
        if (!novoSocio.nome) return toast.error("Nome é obrigatório");

        const res = await adicionarSocio(cliente.id, novoSocio);

        if (res.success) {
            toast.success("Sócio adicionado!");

            const socioRender = {
                id: Math.random(),
                ...novoSocio
            };

            setListaSocios(prev => [...prev, socioRender]);
            setNovoSocio({ nome: "", telefone: "", dataNascimento: "", vinculo: "", obs: "" });
            setShowNovoSocio(false);

            if (aoSalvar) await aoSalvar();
        }
    };


    const handleIniciarEdicaoSocio = (s: any) => {
        setEditandoSocioId(s.id);
        setSocioEditForm({ nome: s.nome || "", telefone: s.telefone || "", dataNascimento: s.dataNascimento || "", vinculo: s.vinculo || "", obs: s.obs || "" });
    };

    const handleSalvarEdicaoSocio = async (socioId: number) => {
        if (!socioEditForm.nome) return toast.error("Nome é obrigatório");
        setSalvandoSocio(true);
        const res = await atualizarSocio(socioId, socioEditForm);
        if (res.success) {
            toast.success("Sócio atualizado!");
            setListaSocios(prev => prev.map(s => s.id === socioId ? { ...s, ...socioEditForm } : s));
            setEditandoSocioId(null);
            if (aoSalvar) await aoSalvar();
        } else {
            toast.error("Erro ao salvar.");
        }
        setSalvandoSocio(false);
    };

    const handleAbrirEditCS = (log: any) => {
        setCsEditando(log);
        setCsEditSentimento(log.sentimento || null);
        setCsEditObs(log.observacao || "");
        const dataRaw = log.data_registro || log.dataRegistro || log.createdAt;
        if (dataRaw) {
            const d = new Date(dataRaw);
            setCsEditData(!isNaN(d.getTime()) ? d.toISOString().split('T')[0] : "");
        }
        setShowEditCS(true);
    };

    const handleSalvarEditCS = async () => {
        if (!csEditSentimento || csEditObs.length < 10) return toast.error("Dados inválidos");
        setSalvandoCS(true);
        const res = await atualizarLogCS(csEditando.id, { sentimento: csEditSentimento, observacao: csEditObs, dataRegistro: csEditData });
        if (res.success) {
            toast.success("CS atualizado!");
            setListaLogsCS(prev => prev.map(l => l.id === csEditando.id
                ? { ...l, sentimento: csEditSentimento, observacao: csEditObs, data_registro: csEditData ? new Date(`${csEditData}T12:00:00`).toISOString() : l.data_registro }
                : l));
            setShowEditCS(false);
            setCsEditando(null);
            if (aoSalvar) await aoSalvar();
        } else {
            toast.error("Erro ao atualizar.");
        }
        setSalvandoCS(false);
    };

    useEffect(() => {
        if (status === "Deferido" && !dataExitoManual) {
            setDataExitoManual(new Date().toISOString().split('T')[0]);
        }
    }, [status]);

    useEffect(() => {
        if (cliente) {
            setCnpj(cliente.cnpj);
            setRazaoSocial(cliente.razaoSocial);
            setNomeFantasia(cliente.nomeFantasia || "");
            setDataConstituicao(cliente.dataConstituicao || "");
            setRegimeTributario(cliente.regimeTributario || "");
            setUf(cliente.uf || "");
            setEditandoDados(false);
        }
    }, [cliente]);


    useEffect(() => {
        setFeedbackSim(cliente?.feedbackGoogle ?? false);
        setNomeFeedback(cliente?.nomeGoogle ?? "");
        setListaLogsFeedback(cliente?.logFeedback ?? []);
    }, [cliente]);

    useEffect(() => {
        if (isOpen && cliente?.id) {
            const logsDoCliente = [...(cliente.log_cs || [])].sort((a, b) => {
                const dataA = new Date(a.dataRegistro || a.data_registro).getTime();
                const dataB = new Date(b.dataRegistro || b.data_registro).getTime();
                return dataB - dataA;
            });
            setListaLogsCS(logsDoCliente);
        }
        return () => setListaLogsCS([]);
    }, [cliente?.id, isOpen]);


    useEffect(() => {
        if (cliente) {
            setStatus(cliente.status || "Em Andamento");
            setNps(cliente.nps || 0);
            setFeedbackSim(cliente.feedbackGoogle || false);
            setNomeFeedback(cliente.nomeGoogle || "");
            setDataContratacao(cliente.dataContratacao || "");
        }
    }, [cliente, isOpen]);

    useEffect(() => {
        if (cliente && isOpen) {
            setAnalistaResponsavel(cliente.analistaResponsavel || "");
            setDataContratacao(cliente.dataContratacao || "");

            setCnpj(cliente.cnpj || "");
            setRazaoSocial(cliente.razaoSocial || "");
            setNomeFantasia(cliente.nomeFantasia || "");
            setDataConstituicao(cliente.dataConstituicao || "");
            setRegimeTributario(cliente.regimeTributario || "");
            setUf(cliente.uf || "");
            setEmbasamento(cliente.embasamento || "");
            setOrigemLead(cliente.origemLead || "");
            setServicosSelecionados(cliente.servicos ? cliente.servicos.split(",").map((s: string) => s.trim()) : []);

            setEditandoDados(false);
        }
    }, [cliente, isOpen]);





    const getStatusColor = (s: string) => {
        switch (s) {
            case "Deferido": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
            case "Em Andamento": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
            case "Stand By": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
            case "Cancelado": return "bg-rose-500/10 text-rose-500 border-rose-500/20";
            default: return "bg-slate-800 text-slate-400";
        }
    };

    const handleSalvarFeedback = async () => {
        if (!sentimentoFeedback || !isTextoValido(obsFeedback)) return;

        setEnviandoFeedback(true);

        const dataSelecionada = new Date(`${dataFeedback}T12:00:00`).toISOString();

        const novoLog = {
            sentimento: sentimentoFeedback,
            observacao: obsFeedback,
            data_registro: dataSelecionada
        };

        const res = await salvarLogFeedback(cliente.id, novoLog);

        if (res.success) {
            toast.success("Pedido registrado!");

            setListaLogsFeedback((prev: any[]) => [
                { ...novoLog, id: Date.now() },
                ...prev
            ]);

            setShowNovoFeedback(false);
            setObsFeedback("");
            setSentimentoFeedback(null);
            setDataFeedback(new Date().toISOString().split('T')[0]);

            if (aoSalvar) aoSalvar();
        } else {
            toast.error("Erro ao salvar no banco.");
        }
        setEnviandoFeedback(false);
    };

    const handleExcluirFeedback = async (logId: number) => {
        if (!logId) return toast.error("ID do log não encontrado");
        if (!confirm("Deseja realmente excluir este pedido de feedback?")) return;

        try {
            const res = await excluirLogFeedback(logId);

            if (res.success) {
                toast.success("Excluído com sucesso!");
                setListaLogsFeedback((prev: any[]) => prev.filter(item => item.id !== logId));
            } else {
                toast.error("Erro ao excluir do banco de dados.");
            }
        } catch (error) {
            toast.error("Erro de conexão.");
        }
    };


    const handleSalvarGeral = async () => {
        const res = await salvarAlteracoesGeral(
            cliente.id,
            {
                analistaResponsavel: analistaResponsavel,
                dataContratacao: dataContratacao,
                status: status,
                nps: nps,
                feedbackGoogle: feedbackSim,
                nomeGoogle: nomeFeedback,
                dataExito: dataExitoManual,
                cnpj: cnpj,
                razaoSocial: razaoSocial,
                nomeFantasia: nomeFantasia,
                dataConstituicao: dataConstituicao,
                regimeTributario: regimeTributario,
                uf: uf,
                servicos: servicosSelecionados,
                embasamento: embasamentoDesbloqueado ? embasamento || null : null,
                origemLead: origemLead || null,
            }
        );

        if (res.success) {
            toast.success("DADOS ATUALIZADOS COM SUCESSO");
            setEditandoDados(false);
            if (aoSalvar) await aoSalvar();
            onClose();
        }
    };

    const handleOcultarCliente = async (id: number) => {
        if (!confirm("Deseja ocultar este cliente?")) return;

        try {
            const res = await atualizarStatusCliente(id, "Arquivado");

            if (res.success) {
                toast.success("Cliente arquivado!");

                onClose(false);

                router.refresh();

            }
        } catch (error) {
            toast.error("Erro ao ocultar");
        }
    };




    if (!isOpen || !cliente) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto">
            <div className="bg-[#0b1220] border border-white/10 w-full max-w-6xl rounded-[2.5rem] shadow-2xl relative custom-scrollbar max-h-[95vh] overflow-y-auto">

                {/* HEADER */}
                <div className="sticky top-0 bg-[#0b1220]/95 backdrop-blur-md p-8 border-b border-white/5 flex justify-between items-center z-20 rounded-t-[2.5rem]">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                            DADOS DO <span className="text-indigo-500">CLIENTE</span>
                        </h2>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Gestão de Operação e CS</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowConfirmarOcultar(true)}
                                className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border bg-slate-800 text-slate-400 border-white/5 hover:bg-rose-500/20 hover:text-rose-500 hover:border-rose-500/50"
                            >
                                <Trash2 size={12} /> Excluir
                            </button>

                            <button
                                onClick={() => setEditandoDados(!editandoDados)}
                                className={`cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border ${editandoDados
                                    ? "bg-amber-500/20 text-amber-500 border-amber-500/50"
                                    : "bg-slate-800 text-slate-400 border-white/5 hover:bg-slate-700"
                                    }`}
                            >
                                {editandoDados ? <><LockOpen size={12} /> Edição Liberada</> : <><Edit3 size={12} /> Editar Dados</>}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-10">

                    {/* SEÇÃO 1: IGUAL AO CADASTRO */}
                    <section className={`grid grid-cols-1 md:grid-cols-12 gap-5 transition-all duration-500 ${editandoDados ? "opacity-100" : "opacity-70"}`}>
                        <div className="md:col-span-4 space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-500 ml-1 tracking-widest">CNPJ</label>
                            <input
                                disabled={!editandoDados}
                                value={cnpj}
                                onChange={(e) => setCnpj(e.target.value)}
                                className={`w-full bg-slate-950/50 border rounded-xl py-3.5 px-4 text-sm transition-all outline-none ${editandoDados ? "border-alpha/30 text-white focus:border-alpha" : "border-white/5 text-slate-500 cursor-not-allowed"}`}
                            />
                        </div>

                        <div className="md:col-span-8 space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-500 ml-1 tracking-widest">Razão Social</label>
                            <input
                                disabled={!editandoDados}
                                value={razaoSocial}
                                onChange={(e) => setRazaoSocial(e.target.value)}
                                className={`w-full bg-slate-950/50 border rounded-xl py-3.5 px-4 text-sm transition-all outline-none ${editandoDados ? "border-alpha/30 text-white focus:border-alpha" : "border-white/5 text-slate-500 cursor-not-allowed"}`}
                            />
                        </div>

                        <div className="md:col-span-6 space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-500 ml-1 tracking-widest">Nome Fantasia</label>
                            <input
                                disabled={!editandoDados}
                                value={nomeFantasia}
                                onChange={(e) => setNomeFantasia(e.target.value)}
                                className={

                                    `w-full bg-slate-950/50 border rounded-xl py-3.5 px-4 text-sm transition-all outline-none ${editandoDados ? "border-alpha/30 text-white focus:border-alpha" : "border-white/5 text-slate-500 cursor-not-allowed"}`}
                            />
                        </div>

                        <div className="md:col-span-3 space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-500 ml-1 tracking-widest">Data Constituição</label>
                            <input
                                disabled={!editandoDados}
                                value={dataConstituicao}
                                onChange={(e) => setDataConstituicao(e.target.value)}
                                className={`w-full bg-slate-950/50 border rounded-xl py-3.5 px-4 text-sm transition-all outline-none ${editandoDados ? "border-alpha/30 text-white focus:border-alpha" : "border-white/5 text-slate-500 cursor-not-allowed"}`}
                            />
                        </div>

                        <div className="md:col-span-3 space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-500 ml-1 tracking-widest">Regime</label>
                            <input
                                disabled={!editandoDados}
                                value={regimeTributario}
                                onChange={(e) => setRegimeTributario(e.target.value)}
                                className={`w-full bg-slate-950/50 border rounded-xl py-3.5 px-4 text-sm transition-all outline-none ${editandoDados ? "border-alpha/30 text-white focus:border-alpha" : "border-white/5 text-slate-500 cursor-not-allowed"}`}
                            />
                        </div>

                        <div className="md:col-span-3 space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-500 ml-1 tracking-widest">UF</label>
                            <input
                                disabled={!editandoDados}
                                value={uf}
                                onChange={(e) => setUf(e.target.value)}
                                className={`w-full bg-slate-950/50 border rounded-xl py-3.5 px-4 text-sm transition-all outline-none ${editandoDados ? "border-alpha/30 text-white focus:border-alpha" : "border-white/5 text-slate-500 cursor-not-allowed"}`}
                            />
                        </div>

                        <div className="md:col-span-9 space-y-1 relative">
                            <label className="text-[9px] font-black uppercase text-slate-500 ml-1 tracking-widest">
                                Serviço Contratado
                            </label>

                            {editandoDados ? (
                                <button
                                    type="button"
                                    onClick={() => setShowServicos(!showServicos)}
                                    className="w-full bg-slate-950/50 border border-alpha/30 rounded-xl py-3.5 px-4 text-sm font-black text-white hover:border-alpha transition-all text-left flex justify-between items-center italic uppercase group"
                                >
                                    {servicosSelecionados.length > 0 ? servicosSelecionados.join(" + ") : "SELECIONAR SERVIÇO"}
                                    <Plus size={14} className="text-alpha group-hover:scale-125 transition-transform" />
                                </button>
                            ) : (
                                <div className={`w-full bg-slate-950/30 border border-white/5 rounded-xl py-3.5 px-4 text-sm font-black ${servicosSelecionados.length > 0 ? style.text : "text-slate-600"} italic uppercase`}>
                                    {servicosSelecionados.length > 0 ? servicosSelecionados.join(" + ") : "NENHUM SERVIÇO DEFINIDO"}
                                </div>
                            )}



                            {showServicos && editandoDados && (
                                <div className="absolute top-full mt-2 w-full bg-slate-900 border border-white/10 rounded-2xl p-4 z-50 shadow-2xl animate-in zoom-in-95 duration-200">
                                    <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                                        {listaServicos.map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => {
                                                    setServicosSelecionados([s]);
                                                    setShowServicos(false);
                                                }}
                                                className="w-full text-left p-3 rounded-xl text-xs font-bold text-slate-400 hover:bg-white/5 hover:text-alpha transition-all"
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>



                    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 pt-6 border-t border-white/5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-indigo-400 ml-1 tracking-widest">Status Atual</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="cursor-pointer w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white focus:border-indigo-500 outline-none transition-all hover:bg-black"
                            >
                                <option value="Em Andamento">Em Andamento</option>
                                <option value="Deferido">Deferido</option>
                                <option value="Stand By">Stand By</option>
                                <option value="Cancelado - Indeferimento">Cancelado - Indeferimento</option>
                                <option value="Cancelado - Troca de Empresa">Cancelado - Troca de Empresa</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Data Contratação</label>
                            {editandoDados ? (
                                <input
                                    type="date"
                                    value={dataContratacao ? new Date(dataContratacao).toISOString().split('T')[0] : ""}
                                    onChange={(e) => setDataContratacao(e.target.value)}
                                    className="w-full bg-indigo-500/5 border border-indigo-500/20 p-2.5 rounded-xl text-sm font-bold text-indigo-400 outline-none cursor-pointer appearance-none"
                                    style={{ colorScheme: 'dark' }}
                                />
                            ) : (
                                <div className="bg-slate-900/30 border border-slate-800/50 p-3 rounded-xl text-sm text-slate-400 font-mono">
                                    {cliente.dataContratacao ? new Date(cliente.dataContratacao).toLocaleDateString('pt-BR') : "---"}
                                </div>
                            )}
                        </div>

                        {/* DATA ÊXITO */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Data de Êxito</label>
                            {status === "Deferido" ? (
                                <input
                                    type="date"
                                    value={dataExitoManual ? new Date(dataExitoManual).toISOString().split('T')[0] : ""}
                                    onChange={(e) => setDataExitoManual(e.target.value)}
                                    className="w-full bg-emerald-500/5 border border-emerald-500/20 p-2.5 rounded-xl text-sm font-bold text-emerald-400 outline-none cursor-pointer"
                                    style={{ colorScheme: 'dark' }}
                                />
                            ) : (
                                <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-slate-700 font-bold uppercase italic tracking-tighter">
                                    Aguardando Deferimento
                                </div>
                            )}
                        </div>

                        {/* ANALISTA RESPONSÁVEL*/}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Analista Responsável</label>
                            {editandoDados ? (
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setShowAnalistas((v) => !v)}
                                        className="w-full bg-indigo-500/5 border border-indigo-500/20 p-3 rounded-xl text-sm font-bold text-indigo-400 outline-none transition-all focus:border-indigo-500 flex items-center justify-between hover:border-indigo-500/50"
                                    >
                                        <span className={analistaResponsavel ? "uppercase italic" : "text-indigo-900/40"}>
                                            {analistaResponsavel || "SELECIONAR ANALISTA"}
                                        </span>
                                        <User size={14} className="text-indigo-500 shrink-0" />
                                    </button>
                                    {showAnalistas && (
                                        <div className="absolute top-full mt-1 left-0 right-0 bg-slate-900 border border-white/10 rounded-2xl p-3 z-30 shadow-2xl">
                                            <div className="space-y-0.5 max-h-48 overflow-y-auto custom-scrollbar">
                                                {listaAnalistas.map((a) => (
                                                    <button
                                                        key={a}
                                                        type="button"
                                                        onClick={() => { setAnalistaResponsavel(a); setShowAnalistas(false); }}
                                                        className={`w-full text-left p-3 rounded-xl text-xs font-bold transition-all ${
                                                            analistaResponsavel === a
                                                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20"
                                                                : "hover:bg-white/5 text-slate-400"
                                                        }`}
                                                    >
                                                        {a}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-slate-900/30 border border-slate-800/50 p-3 rounded-xl text-sm text-indigo-400/70 font-black uppercase tracking-tighter truncate italic">
                                    {cliente.analistaResponsavel || "Não Atribuído"}
                                </div>
                            )}
                        </div>

                        {/* EMBASAMENTO */}
                        <div className="space-y-2">
                            <label className={`text-[10px] font-black uppercase ml-1 tracking-widest flex items-center gap-1 ${embasamentoDesbloqueado ? "text-indigo-400" : "text-slate-600"}`}>
                                Embasamento
                                {!embasamentoDesbloqueado && <span className="text-[7px] bg-slate-800 px-1.5 py-0.5 rounded-full text-slate-600">150K/Ilimitado</span>}
                            </label>
                            <select
                                disabled={!editandoDados || !embasamentoDesbloqueado}
                                value={embasamento}
                                onChange={(e) => setEmbasamento(e.target.value)}
                                className={`w-full border rounded-xl p-3 text-sm outline-none transition-all appearance-none ${editandoDados && embasamentoDesbloqueado ? "bg-indigo-500/5 border-indigo-500/20 text-indigo-400 focus:border-indigo-500 cursor-pointer" : "bg-slate-900/20 border-slate-800/30 text-slate-600 cursor-not-allowed"}`}
                            >
                                <option value="">Não definido</option>
                                {listaEmbasamentos.map(e => <option key={e} value={e} className="bg-slate-900">{e}</option>)}
                                {embasamento && !listaEmbasamentos.includes(embasamento) && (
                                    <option value={embasamento} className="bg-slate-900">{embasamento}</option>
                                )}
                            </select>
                        </div>

                        {/* ORIGEM DO LEAD */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-indigo-400 ml-1 tracking-widest">Origem do Lead</label>
                            <select
                                disabled={!editandoDados}
                                value={origemLead}
                                onChange={(e) => setOrigemLead(e.target.value)}
                                className={`w-full border rounded-xl p-3 text-sm outline-none transition-all appearance-none ${editandoDados ? "bg-indigo-500/5 border-indigo-500/20 text-indigo-400 focus:border-indigo-500 cursor-pointer" : "bg-slate-900/30 border-slate-800/50 text-indigo-400/70"}`}
                            >
                                <option value="">Não definido</option>
                                {listaOrigensLead.map(o => <option key={o} value={o} className="bg-slate-900">{o}</option>)}
                                {origemLead && !listaOrigensLead.includes(origemLead) && (
                                    <option value={origemLead} className="bg-slate-900">{origemLead}</option>
                                )}
                            </select>
                        </div>

                    </section>



                    {/* SEÇÃO 3: SÓCIOS */}
                    <section className="space-y-4 pt-6 border-t border-white/5">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-1 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                                <h3 className="text-xs font-black uppercase text-slate-500 tracking-[0.2em]">
                                    Quadro de Sócios / Responsáveis
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowNovoSocio(!showNovoSocio)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
                            >
                                {showNovoSocio ? "Cancelar" : <><Plus size={14} /> Novo Sócio</>}
                            </button>
                        </div>

                        {/* FORMULÁRIO PARA ADICIONAR SÓCIO - RENDERIZA NA HORA */}
                        {showNovoSocio && (
                            <div className="p-6 bg-slate-900/50 border border-indigo-500/20 rounded-[2rem] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in zoom-in duration-300 mb-6 shadow-2xl">
                                <input
                                    placeholder="NOME DO SÓCIO"
                                    value={novoSocio.nome}
                                    onChange={e => setNovoSocio({ ...novoSocio, nome: e.target.value.toUpperCase() })}
                                    className="bg-black border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-all uppercase"
                                />
                                <input
                                    placeholder="TELEFONE (WHATSAPP)"
                                    value={novoSocio.telefone}
                                    onChange={e => setNovoSocio({ ...novoSocio, telefone: e.target.value })}
                                    className="bg-black border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-all"
                                />
                                <input
                                    placeholder="DATA DE NASCIMENTO (DD/MM/AAAA)"
                                    value={novoSocio.dataNascimento}
                                    onChange={e => setNovoSocio({ ...novoSocio, dataNascimento: e.target.value })}
                                    className="bg-black border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-all"
                                />

                                {/* SELECT DE VÍNCULO ESTILIZADO */}
                                <select
                                    value={novoSocio.vinculo}
                                    onChange={e => setNovoSocio({ ...novoSocio, vinculo: e.target.value })}
                                    className="bg-black border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-all cursor-pointer appearance-none"
                                >
                                    <option value="" className="text-slate-500">SELECIONE O VÍNCULO...</option>
                                    <option value="Sócio Proprietário">Sócio Proprietário</option>
                                    <option value="Sócio Oculto">Sócio Oculto</option>
                                    <option value="Funcionário/Colaborador">Funcionário/Colaborador</option>
                                    <option value="Contador Interno">Contador Interno</option>
                                    <option value="Contador Externo">Contador Externo</option>
                                    <option value="Despachante Aduaneiro">Despachante Aduaneiro</option>
                                    <option value="Outro">Outro</option>
                                </select>

                                <div className="flex gap-2 lg:col-span-2">
                                    <input
                                        placeholder="OBSERVAÇÃO"
                                        value={novoSocio.obs}
                                        onChange={e => setNovoSocio({ ...novoSocio, obs: e.target.value })}
                                        className="flex-1 bg-black border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-all"
                                    />
                                    <button
                                        onClick={handleAdicionarSocio}
                                        className="px-6 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white transition-all active:scale-95 flex items-center justify-center shadow-lg shadow-emerald-900/20"
                                    >
                                        <Check size={18} strokeWidth={3} />
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="bg-slate-950/50 border border-white/5 rounded-[2rem] overflow-hidden shadow-inner">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/5 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                        <th className="px-6 py-4 border-b border-white/5">Nome do Socio</th>
                                        <th className="px-6 py-4 border-b border-white/5">Telefone</th>
                                        <th className="px-6 py-4 border-b border-white/5 text-center">Nascimento</th>
                                        <th className="px-6 py-4 border-b border-white/5">Vinculo</th>
                                        <th className="px-6 py-4 border-b border-white/5">Observações</th>
                                        <th className="px-6 py-4 border-b border-white/5 text-center">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {listaSocios.length > 0 ? (
                                        listaSocios.map((s: any, i: number) => (
                                            editandoSocioId === s.id ? (
                                                <tr key={s.id || i} className="bg-indigo-500/5 border-l-2 border-indigo-500">
                                                    <td className="px-3 py-3">
                                                        <input
                                                            value={socioEditForm.nome}
                                                            onChange={e => setSocioEditForm({ ...socioEditForm, nome: e.target.value.toUpperCase() })}
                                                            className="w-full bg-black border border-indigo-500/30 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500 uppercase"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <input
                                                            value={socioEditForm.telefone}
                                                            onChange={e => setSocioEditForm({ ...socioEditForm, telefone: e.target.value })}
                                                            className="w-full bg-black border border-indigo-500/30 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500"
                                                            placeholder="Telefone"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <input
                                                            value={socioEditForm.dataNascimento}
                                                            onChange={e => setSocioEditForm({ ...socioEditForm, dataNascimento: e.target.value })}
                                                            className="w-full bg-black border border-indigo-500/30 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500"
                                                            placeholder="DD/MM/AAAA"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <select
                                                            value={socioEditForm.vinculo}
                                                            onChange={e => setSocioEditForm({ ...socioEditForm, vinculo: e.target.value })}
                                                            className="w-full bg-black border border-indigo-500/30 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500 cursor-pointer appearance-none"
                                                        >
                                                            <option value="">SELECIONE...</option>
                                                            <option value="Sócio Proprietário">Sócio Proprietário</option>
                                                            <option value="Sócio Oculto">Sócio Oculto</option>
                                                            <option value="Funcionário/Colaborador">Funcionário/Colaborador</option>
                                                            <option value="Contador Interno">Contador Interno</option>
                                                            <option value="Contador Externo">Contador Externo</option>
                                                            <option value="Despachante Aduaneiro">Despachante Aduaneiro</option>
                                                            <option value="Outro">Outro</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <input
                                                            value={socioEditForm.obs}
                                                            onChange={e => setSocioEditForm({ ...socioEditForm, obs: e.target.value })}
                                                            className="w-full bg-black border border-indigo-500/30 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500"
                                                            placeholder="Observação"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => handleSalvarEdicaoSocio(s.id)}
                                                                disabled={salvandoSocio}
                                                                className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all active:scale-90 disabled:opacity-50"
                                                                title="Salvar"
                                                            >
                                                                <Check size={14} strokeWidth={3} />
                                                            </button>
                                                            <button
                                                                onClick={() => setEditandoSocioId(null)}
                                                                className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-400 rounded-lg transition-all active:scale-90"
                                                                title="Cancelar"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                <tr key={s.id || i} className="hover:bg-white/[0.02] transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm font-bold text-white uppercase tracking-tight group-hover:text-indigo-400 transition-colors">
                                                            {s.nome}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {s.telefone ? (
                                                            <a
                                                                href={`https://wa.me/${s.telefone.replace(/\D/g, '')}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-[11px] font-mono text-indigo-400 hover:text-green-400 transition-all flex items-center gap-2"
                                                            >
                                                                <span className="opacity-50">WA:</span> {s.telefone}
                                                            </a>
                                                        ) : (
                                                            <span className="text-xs font-mono text-slate-700">---</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-xs font-bold text-slate-400">
                                                            {s.dataNascimento || "---"}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-[10px] font-black text-indigo-500/70 uppercase tracking-tighter bg-indigo-500/5 px-2 py-1 rounded-md border border-indigo-500/10">
                                                            {s.vinculo || "NÃO INFORMADO"}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-[11px] text-slate-500 italic leading-relaxed block max-w-xs truncate" title={s.obs}>
                                                            {s.obs || "---"}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <button
                                                            onClick={() => handleIniciarEdicaoSocio(s)}
                                                            className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all duration-200 active:scale-90"
                                                            title="Editar Sócio"
                                                        >
                                                            <Edit3 size={15} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-16 text-center text-slate-800 text-[10px] font-black uppercase tracking-[0.3em] italic opacity-40">
                                                Nenhum sócio vinculado a este CNPJ
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>


                    {/* SEÇÃO CUSTOMER SUCCESS */}
                    <section className="space-y-6 pt-6 border-t border-white/5">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2">
                                <MessageSquare size={16} className="text-emerald-500" /> Customer Success (CS)
                            </h3>
                            <button
                                onClick={() => setShowNovoCS(true)}
                                className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
                            >
                                <Plus size={14} /> Novo CS
                            </button>
                        </div>

                        <div className="bg-slate-950/50 border border-white/5 rounded-2xl overflow-hidden shadow-inner">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white/5 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">Data</th>
                                        <th className="px-6 py-4">Colaborador</th>
                                        <th className="px-6 py-4 text-center">Sentimento</th>
                                        <th className="px-6 py-4">Observação</th>
                                        <th className='px-6 py-4 text-center'>Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {listaLogsCS && listaLogsCS.length > 0 ? (
                                        listaLogsCS.map((log: any, index: number) => (
                                            <tr
                                                key={`${cliente?.id}-${log.id || index}`}
                                                className="hover:bg-white/[0.02] transition-colors group"
                                            >
                                                <td className="px-6 py-4 text-[11px] font-black text-blue-300 tracking-tighter">
                                                    {(() => {
                                                        const dataRaw = log.data_registro || log.dataRegistro || log.createdAt;
                                                        if (!dataRaw) return "---";

                                                        const d = new Date(dataRaw);
                                                        if (isNaN(d.getTime())) {
                                                            return dataRaw.split('T')[0].split('-').reverse().join('/');
                                                        }

                                                        return d.toLocaleDateString('pt-BR');
                                                    })()}
                                                </td>

                                                <td className="px-6 py-4 text-xs font-bold text-white uppercase tracking-tighter">
                                                    {log.colaborador || "---"}
                                                </td>

                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex justify-center scale-110">
                                                        {log.sentimento === "pos" && <ThumbsUp size={14} className="text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.3)]" />}
                                                        {log.sentimento === "neg" && <ThumbsDown size={14} className="text-rose-500 drop-shadow-[0_0_5px_rgba(244,63,94,0.3)]" />}
                                                        {log.sentimento === "na" && <Minus size={14} className="text-slate-500" />}
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4">
                                                    <p className="text-[11px] text-slate-400 italic max-w-xs truncate hover:text-white transition-colors cursor-help" title={log.observacao}>
                                                        {log.observacao || "---"}
                                                    </p>
                                                </td>

                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleAbrirEditCS(log); }}
                                                            className="cursor-pointer p-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all duration-200 active:scale-90"
                                                            title="Editar Registro"
                                                        >
                                                            <Edit3 size={15} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleExcluirCS(log.id || log.ID);
                                                            }}
                                                            className="cursor-pointer p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all duration-200 active:scale-90"
                                                            title="Excluir Registro"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center text-[10px] uppercase font-black tracking-[0.4em] opacity-20 italic">
                                                Nenhum histórico de CS detectado
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/*  NPS  */}
                        <div className={`grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-gradient-to-br from-slate-900/40 to-black p-6 rounded-[2.5rem] border transition-all duration-500 relative overflow-hidden group ${status === "Deferido" ? "border-white/5 opacity-100" : "border-white/0 opacity-30 grayscale pointer-events-none"
                            }`}>
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Star size={80} />
                            </div>

                            {/* Ícone e Títulos */}
                            <div className="md:col-span-4 flex items-center gap-4">
                                <div className={`p-3 rounded-2xl border transition-all duration-500 ${status === "Deferido" && nps !== null && nps >= 9 ? "bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]" :
                                    status === "Deferido" && nps !== null && nps >= 7 ? "bg-amber-500/10 border-amber-500/20" :
                                        status === "Deferido" && nps !== null && nps > 0 ? "bg-rose-500/10 border-rose-500/20" : "bg-slate-800/50 border-white/5"
                                    }`}>
                                    <Star className={`${status === "Deferido" && nps !== null && nps >= 9 ? "text-emerald-500" :
                                        status === "Deferido" && nps !== null && nps >= 7 ? "text-amber-500" :
                                            status === "Deferido" && nps !== null && nps > 0 ? "text-rose-500" : "text-slate-600"
                                        } w-5 h-5 transition-colors`} />
                                </div>
                                <div>
                                    <h3 className="text-[11px] font-black uppercase text-slate-200 tracking-[0.15em]">Métrica NPS</h3>
                                    <p className="text-[9px] text-slate-500 uppercase font-bold italic mt-0.5 tracking-tighter">
                                        {status === "Deferido" ? "Percepção de Valor e Fidelidade" : "Disponível após Deferimento"}
                                    </p>
                                </div>
                            </div>

                            {/* Select de Nota */}
                            <div className="md:col-span-3">
                                <select
                                    disabled={status !== "Deferido"}
                                    value={nps ?? ""}
                                    onChange={(e) => setNps(e.target.value === "" ? null : Number(e.target.value))}
                                    className="w-full bg-black/60 border border-white/10 rounded-2xl py-4 px-5 text-sm text-amber-500 font-black outline-none focus:border-amber-500/50 transition-all hover:bg-black cursor-pointer shadow-inner appearance-none disabled:cursor-not-allowed"
                                >
                                    <option value="" className="text-slate-700">NOTAS BLOQUEADAS</option>
                                    {[...Array(11)].map((_, i) => (
                                        <option key={i} value={i} className="bg-slate-900 text-amber-500 font-bold">
                                            {i} - {i >= 9 ? 'Promotor' : i >= 7 ? 'Neutro' : 'Detrator'}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Réguas de Cores */}
                            <div className="md:col-span-5 flex flex-col justify-center space-y-3">
                                <div className="flex justify-between text-[8px] font-black uppercase tracking-widest px-1">
                                    <span className={status === "Deferido" && nps !== null && nps > 0 && nps <= 6 ? "text-rose-500" : "text-slate-600"}>Detrator</span>
                                    <span className={status === "Deferido" && nps !== null && nps >= 7 && nps <= 8 ? "text-amber-500" : "text-slate-600"}>Neutro</span>
                                    <span className={status === "Deferido" && nps !== null && nps >= 9 ? "text-emerald-500" : "text-slate-600"}>Promotor</span>
                                </div>

                                <div className="h-2 w-full bg-slate-800/50 rounded-full overflow-hidden flex p-0.5 border border-white/5 shadow-inner">
                                    <div className={`h-full rounded-l-full transition-all duration-700 ${status === "Deferido" && nps !== null && nps > 0 && nps <= 6 ? "w-[63%] bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]" : "w-[63%] bg-rose-500/10"}`} />
                                    <div className={`h-full transition-all duration-700 ${status === "Deferido" && nps !== null && nps >= 7 && nps <= 8 ? "w-[18%] bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]" : "w-[18%] bg-amber-500/10"}`} />
                                    <div className={`h-full rounded-r-full transition-all duration-700 ${status === "Deferido" && nps !== null && nps >= 9 ? "w-[19%] bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" : "w-[19%] bg-emerald-500/10"}`} />
                                </div>
                            </div>
                        </div>

                    </section>



                    {/* SEÇÃO 6: FEEDBACK GOOGLE */}
                    <section className="space-y-6 pt-8 border-t border-white/5">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 rounded-lg"><Search className="text-blue-500 w-5 h-5" /></div>
                                <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Feedback Google</h3>
                            </div>
                            <button
                                onClick={() => setShowNovoFeedback(true)}
                                className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                                <Plus size={14} />FeedBack
                            </button>
                        </div>

                        <div className="flex flex-col md:flex-row items-center gap-8 bg-slate-950/30 p-6 rounded-2xl border border-white/5">
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-black uppercase text-slate-500">Fez Feedback?</span>
                                <button
                                    onClick={() => {
                                        setFeedbackSim(!feedbackSim);
                                        if (feedbackSim) setNomeFeedback("");
                                    }}
                                    className={`relative w-12 h-6 rounded-full transition-colors ${feedbackSim ? 'bg-emerald-500' : 'bg-red-500'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${feedbackSim ? 'left-7' : 'left-1'}`} />
                                </button>
                                <span className={`text-[10px] font-black uppercase ${feedbackSim ? 'text-emerald-500' : 'text-slate-600'}`}>
                                    {feedbackSim ? 'Sim' : 'Não'}
                                </span>
                            </div>

                            <div className="flex-1 w-full space-y-1">
                                <label className={`text-[9px] font-black uppercase ml-1 transition-colors ${feedbackSim ? 'text-slate-500' : 'text-slate-800'}`}>Nome de quem comentou</label>
                                <input
                                    type="text"
                                    disabled={!feedbackSim}
                                    value={nomeFeedback}
                                    onChange={(e) => setNomeFeedback(e.target.value)}
                                    placeholder={feedbackSim ? "Digite o nome..." : "Bloqueado - Marque 'Sim' primeiro"}
                                    className={`w-full bg-slate-950 border rounded-xl py-3 px-4 text-sm transition-all outline-none ${feedbackSim ? 'border-slate-800 text-white focus:border-blue-500' : 'border-transparent text-slate-800 cursor-not-allowed'}`}
                                />
                            </div>
                        </div>

                        {/* TABELA DE PEDIDOS DE FEEDBACK */}
                        <div className="bg-slate-950/50 border border-white/5 rounded-2xl overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white/5 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">Data</th>
                                        <th className="px-6 py-4">Colaborador</th>
                                        <th className="px-6 py-4 text-center">Sentimento</th>
                                        <th className="px-6 py-4">Observação</th>
                                        <th className="px-6 py-4 text-center">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {listaLogsFeedback && listaLogsFeedback.length > 0 ? (
                                        listaLogsFeedback.map((log: any, index: number) => (
                                            <tr key={log.id || index} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="px-6 py-4 text-[11px] font-black text-blue-300">
                                                    {new Date(log.data_registro || log.dataRegistro).toLocaleDateString('pt-BR')}
                                                </td>
                                                <td className="px-6 py-4 text-xs font-bold text-white uppercase">
                                                    {log.colaborador}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex justify-center">
                                                        {log.sentimento === "pos" && <ThumbsUp size={14} className="text-blue-500" />}
                                                        {log.sentimento === "neg" && <ThumbsDown size={14} className="text-rose-500" />}
                                                        {log.sentimento === "na" && <Minus size={14} className="text-slate-500" />}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-[11px] text-slate-400 italic truncate max-w-xs" title={log.observacao}>
                                                        {log.observacao}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center">
                                                        <button
                                                            onClick={() => handleExcluirFeedback(log.id)}
                                                            className="cursor-pointer p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all active:scale-90"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center text-[10px] uppercase font-black opacity-20 italic tracking-[0.4em]">
                                                Nenhum pedido de feedback detectado
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                {/* BOTÃO SALVAR e cancelar GERAL */}
                <div className="p-8 border-t border-white/5 flex justify-end gap-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="cursor-pointer flex items-center gap-2 px-10 py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                        <X size={18} /> Cancelar
                    </button>

                    <button
                        type="button"
                        onClick={handleSalvarGeral}
                        className="cursor-pointer flex items-center gap-2 px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                        <Save size={18} /> Salvar Alterações
                    </button>
                </div>

                {showNovoCS && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
                        <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-[2rem] p-8 shadow-3xl animate-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="text-lg font-black text-white uppercase">Novo <span className="text-emerald-500">CS</span></h4>
                                <button onClick={() => setShowNovoCS(false)}><X size={20} className="cursor-pointer text-slate-500" /></button>
                            </div>

                            <div className="space-y-6">

                                <div className="space-y-3">
                                    <div className="flex justify-between items-end px-1">
                                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                                            <MessageSquare size={12} className="text-emerald-500" /> Relato do Atendimento
                                        </label>
                                        <span className={

                                            `text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${obsCS.length >= 10 && obsCS.length <= 140 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                            {obsCS.length}/140
                                        </span>
                                    </div>

                                    <div className="relative group">
                                        <textarea
                                            value={obsCS}
                                            onChange={(e) => setObsCS(e.target.value)}
                                            className={`w-full bg-slate-950/80 border-2 rounded-2xl p-4 text-sm text-white min-h-[130px] outline-none transition-all duration-300 resize-none shadow-inner
                                            ${obsCS.length > 0 && (obsCS.length < 10 || obsCS.length > 140)
                                                    ? 'border-rose-500/30 focus:border-rose-500 focus:shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                                                    : 'border-slate-800 focus:border-emerald-500 focus:shadow-[0_0_15px_rgba(16,185,129,0.1)]'}`}
                                            placeholder="O que o cliente relatou neste contato?..."
                                        />
                                        <div className={`absolute bottom-3 right-3 transition-opacity ${obsCS.length >= 10 && obsCS.length <= 140 ? 'opacity-100' : 'opacity-0'}`}>
                                            <CheckCircle2 size={16} className="text-emerald-500" />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase text-slate-500 block text-center">Resultado do Feedback</label>
                                    <div className="flex justify-between items-center gap-4">
                                        {/* POSITIVO */}
                                        <button
                                            onClick={() => setFeedbackCS("pos")}
                                            className={`cursor-pointer flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${feedbackCS === "pos" ? "bg-emerald-500/20 border-emerald-500 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]" : "bg-slate-950 border-white/5 text-slate-600 hover:text-white"}`}
                                        >
                                            <ThumbsUp size={24} /> <span className="text-[9px] font-black uppercase">Positivo</span>
                                        </button>

                                        {/* NEGATIVO */}
                                        <button
                                            onClick={() => setFeedbackCS("neg")}
                                            className={`cursor-pointer flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${feedbackCS === "neg" ? "bg-rose-500/20 border-rose-500 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.2)]" : "bg-slate-950 border-white/5 text-slate-600 hover:text-white"}`}
                                        >
                                            <ThumbsDown size={24} /> <span className="text-[9px] font-black uppercase">Negativo</span>
                                        </button>

                                        {/* N/A - SEM RESPOSTA */}
                                        <button
                                            onClick={() => setFeedbackCS("na")}
                                            className={`cursor-pointer flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${feedbackCS === "na" ? "bg-slate-700 border-white/30 text-white" : "bg-slate-950 border-white/5 text-slate-600 hover:text-white"}`}
                                        >
                                            <Minus size={24} /> <span className="text-[9px] font-black uppercase">N/A (Sem Resposta)</span>
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2 px-1">
                                            <Calendar size={12} className="text-emerald-500" /> Data do Atendimento
                                        </label>
                                        <input
                                            type="date"
                                            value={dataCS}
                                            onChange={(e) => setDataCS(e.target.value)}
                                            className="w-full bg-slate-950/80 border-2 border-slate-800 rounded-2xl p-4 text-sm text-white outline-none transition-all duration-300 focus:border-emerald-500 [color-scheme:dark]"
                                        />
                                    </div>

                                </div>

                                <div className="flex gap-3 pt-4">
                                    {/* BOTÃO CANCELAR */}
                                    <button
                                        onClick={() => {
                                            setShowNovoCS(false);
                                            setObsCS("");
                                            setFeedbackCS(

                                                null);
                                        }}
                                        className="cursor-pointer flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                    >
                                        Cancelar
                                    </button>

                                    {/* BOTÃO SALVAR CS */}
                                    <button

                                        onClick={handleSalvarCS}
                                        disabled={!isTextoValido(obsCS) || !feedbackCS}
                                        className="cursor-pointer flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {enviandoCS ? "Salvando..." : "Salvar CS"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>


            {/* MODAL PEQUENO: NOVO PEDIDO DE FEEDBACK */}
            {showNovoFeedback && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <div className="bg-[#0f172a] border border-blue-500/20 w-full max-w-md rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/20 rounded-xl"><TrendingUp className="text-blue-400 w-5 h-5" /></div>
                                <h4 className="text-xl font-black text-white uppercase italic tracking-tighter">Solicitar <span className="text-blue-500">Google</span></h4>
                            </div>

                            <button onClick={() => { setShowNovoFeedback(false); setObsFeedback(""); setSentimentoFeedback(null); }} className="cursor-pointer text-slate-500 hover:text-white"><X size={24} /></button>
                        </div>

                        <div className="space-y-8">
                            {/* BOTÕES DE SENTIMENTO */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-slate-500 block text-center tracking-widest">Sentimento do Cliente</label>
                                <div className="flex justify-between gap-3">
                                    {[
                                        { id: 'pos', icon: ThumbsUp, label: 'Positivo', color: 'blue' },
                                        { id: 'neg', icon: ThumbsDown, label: 'Negativo', color: 'rose' },
                                        { id: 'na', icon: Minus, label: 'N/A', color: 'slate' }
                                    ].map((btn) => (
                                        <button
                                            key={btn.id}
                                            onClick={() => setSentimentoFeedback(btn.id as any)}
                                            className={`cursor-pointer flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-300 
                                                ${sentimentoFeedback === btn.id
                                                    ? `bg-${btn.color}-500/10 border-${btn.color}-500 text-${btn.color}-400 shadow-lg`
                                                    : 'bg-slate-950 border-white/5 text-slate-600 hover:border-white/10'}`}
                                        >
                                            <btn.icon size={20} />
                                            <span className="text-[9px] font-black uppercase">{btn.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* INPUT DE TEXTO */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Observação</label>
                                    <span className={`text-[10px] font-mono font-bold ${obsFeedback.length >= 10 && obsFeedback.length <= 140 ? 'text-blue-400' : 'text-rose-500'}`}>
                                        {obsFeedback.length}/140
                                    </span>
                                </div>
                                <textarea
                                    value={obsFeedback}
                                    onChange={(e) => setObsFeedback(e.target.value)}
                                    className={`w-full bg-slate-950 border-2 rounded-2xl p-4 text-sm text-white min-h-[100px] outline-none transition-all
                                    ${obsFeedback.length > 0 && !isTextoValido(obsFeedback) ? 'border-rose-500/30' : 'border-slate-800 focus:border-blue-500'}`}
                                    placeholder="Por que está solicitando este feedback?..."
                                />
                            </div>

                            <div className="relative group">
                                <input
                                    type="date"
                                    value={dataFeedback}
                                    onChange={(e) => setDataFeedback(e.target.value)}
                                    className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 text-sm text-white outline-none transition-all duration-300 focus:border-blue-500 focus:shadow-[0_0_15px_rgba(59,130,246,0.1)] [color-scheme:dark] cursor-pointer font-bold"
                                />
                            </div>

                            <div className="flex gap-4">
                                <button onClick={() => setShowNovoFeedback(false)} className="cursor-pointer flex-1 py-4 bg-slate-900 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors">Cancelar</button>
                                <button
                                    onClick={handleSalvarFeedback}
                                    disabled={!isTextoValido(obsFeedback) || !sentimentoFeedback}
                                    className="cursor-pointer flex-1 py-4 bg-blue-600 disabled:bg-slate-800/50 disabled:text-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-all"
                                >
                                    Confirmar Pedido
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showEditCS && csEditando && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
                    <div className="bg-slate-900 border border-white/10 w-full max-w-md rounded-[2rem] p-8 shadow-3xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="text-lg font-black text-white uppercase">Editar <span className="text-emerald-500">CS</span></h4>
                            <button onClick={() => { setShowEditCS(false); setCsEditando(null); }}><X size={20} className="cursor-pointer text-slate-500" /></button>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-3">
                                <div className="flex justify-between items-end px-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                                        <MessageSquare size={12} className="text-emerald-500" /> Relato do Atendimento
                                    </label>
                                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${csEditObs.length >= 10 && csEditObs.length <= 140 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                        {csEditObs.length}/140
                                    </span>
                                </div>
                                <textarea
                                    value={csEditObs}
                                    onChange={(e) => setCsEditObs(e.target.value)}
                                    className={`w-full bg-slate-950/80 border-2 rounded-2xl p-4 text-sm text-white min-h-[120px] outline-none transition-all resize-none shadow-inner
                                    ${csEditObs.length > 0 && (csEditObs.length < 10 || csEditObs.length > 140)
                                            ? 'border-rose-500/30 focus:border-rose-500'
                                            : 'border-slate-800 focus:border-emerald-500'}`}
                                    placeholder="O que o cliente relatou neste contato?..."
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-slate-500 block text-center">Resultado do Feedback</label>
                                <div className="flex justify-between items-center gap-4">
                                    <button
                                        onClick={() => setCsEditSentimento("pos")}
                                        className={`cursor-pointer flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${csEditSentimento === "pos" ? "bg-emerald-500/20 border-emerald-500 text-emerald-500" : "bg-slate-950 border-white/5 text-slate-600 hover:text-white"}`}
                                    >
                                        <ThumbsUp size={22} /> <span className="text-[9px] font-black uppercase">Positivo</span>
                                    </button>
                                    <button
                                        onClick={() => setCsEditSentimento("neg")}
                                        className={`cursor-pointer flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${csEditSentimento === "neg" ? "bg-rose-500/20 border-rose-500 text-rose-500" : "bg-slate-950 border-white/5 text-slate-600 hover:text-white"}`}
                                    >
                                        <ThumbsDown size={22} /> <span className="text-[9px] font-black uppercase">Negativo</span>
                                    </button>
                                    <button
                                        onClick={() => setCsEditSentimento("na")}
                                        className={`cursor-pointer flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${csEditSentimento === "na" ? "bg-slate-700 border-white/30 text-white" : "bg-slate-950 border-white/5 text-slate-600 hover:text-white"}`}
                                    >
                                        <Minus size={22} /> <span className="text-[9px] font-black uppercase">N/A</span>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2 px-1">
                                    <Calendar size={12} className="text-emerald-500" /> Data do Atendimento
                                </label>
                                <input
                                    type="date"
                                    value={csEditData}
                                    onChange={(e) => setCsEditData(e.target.value)}
                                    className="w-full bg-slate-950/80 border-2 border-slate-800 rounded-2xl p-4 text-sm text-white outline-none transition-all focus:border-emerald-500 [color-scheme:dark]"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => { setShowEditCS(false); setCsEditando(null); }}
                                    className="cursor-pointer flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSalvarEditCS}
                                    disabled={!isTextoValido(csEditObs) || !csEditSentimento || salvandoCS}
                                    className="cursor-pointer flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {salvandoCS ? "Salvando..." : "Salvar Edição"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showConfirmarOcultar && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-rose-500/30 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl shadow-rose-900/20 text-center">
                        <div className="flex justify-center mb-6">
                            <div className="p-4 bg-rose-500/10 rounded-full animate-pulse">
                                <AlertTriangle size={40} className="text-rose-500" />
                            </div>
                        </div>

                        <h3 className="text-xl font-black text-white uppercase mb-2 tracking-tighter">Atenção Total</h3>
                        <p className="text-sm text-slate-400 mb-8 px-4">
                            Você está prestes a <span className="text-rose-500 font-bold">Excluir</span> este cliente da listagem principal.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => handleOcultarCliente(cliente.id)}
                                className="cursor-pointer w-full py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-lg shadow-rose-900/40"
                            >
                                Sim, Excluir Agora
                            </button>
                            <button
                                onClick={() => setShowConfirmarOcultar(false)}
                                className="cursor-pointer w-full py-4 bg-slate-800 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-700 transition-all"
                            >
                                Cancelar e Voltar
                            </button>
                        </div>
                    </div>
                </div>
            )}


        </div>
    );
}
