"use client";

import React, { useEffect, useState } from 'react';
import { X, Search, Laptop, UserCheck, Calendar as CalendarIcon, Plus, Trash2, CheckCircle2, AlertTriangle, Wallet, CreditCard } from "lucide-react";
import { toast } from 'sonner';
import { CadastrarCliente, verificarCNPJDuplicado, buscarUsuariosPorRole } from "@/actions/Clientes";
import { FORMAS_PAGAMENTO, FORMAS_LABEL } from "./formas-pagamento";
import { ModalSelecionarUsuario } from "./ModalSelecionarUsuario";
import { CsNpsModal3DShell } from "../CsNpsMotion";

export default function ModalCadastroCliente({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {

    const [dataContratacao, setDataContratacao] = useState(new Date().toISOString().split('T')[0]);
    const [showServicos, setShowServicos] = useState(false);
    const [showAnalistas, setShowAnalistas] = useState(false);
    const [servicosSelecionados, setServicosSelecionados] = useState<string[]>([]);
    const [analistaSelecionado, setAnalistaSelecionado] = useState("");
    const [isCriandoServico, setIsCriandoServico] = useState(false);
    const [novoServicoNome, setNovoServicoNome] = useState("");
    const [listaAnalistas, setListaAnalistas] = useState<string[]>([]);
    const [listaClosersUsuarios, setListaClosersUsuarios] = useState<string[]>([]);
    const [campoSelecionandoUsuario, setCampoSelecionandoUsuario] = useState<"analista" | "closer" | null>(null);
    const [embasamentoSelecionado, setEmbasamentoSelecionado] = useState("");
    const [showEmbasamento, setShowEmbasamento] = useState(false);
    const [isCriandoEmbasamento, setIsCriandoEmbasamento] = useState(false);
    const [novoEmbasamentoNome, setNovoEmbasamentoNome] = useState("");
    const [listaEmbasamentos, setListaEmbasamentos] = useState(["Disponibilidade Financeira", "Início ou Retomada", "Receita Bruta (DAS)", "Receita Bruta (CPRB)"]);
    const [origemLeadSelecionada, setOrigemLeadSelecionada] = useState("");
    const [showOrigemLead, setShowOrigemLead] = useState(false);
    const [isCriandoOrigemLead, setIsCriandoOrigemLead] = useState(false);
    const [novaOrigemLeadNome, setNovaOrigemLeadNome] = useState("");
    const [listaOrigensLead, setListaOrigensLead] = useState(["Tráfego Pago (Meta - Instagram)", "Tráfego Pago (Google)", "Indicação Parceiro", "Indicação Cliente", "Evento", "China"]);
    const [cnpj, setCnpj] = useState("");
    const [carregando, setCarregando] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [modalDuplicata, setModalDuplicata] = useState<{ aberto: boolean; razaoSocial: string }>({ aberto: false, razaoSocial: "" });
    const [dadosEmpresa, setDadosEmpresa] = useState({
        razaoSocial: "",
        nomeFantasia: "",
        dataConstituicao: "",
        uf: "",
        municipio: "",
        regimeTributario: ""
    });
    const [formaPagamentoSelecionada, setFormaPagamentoSelecionada] = useState("");
    const [showFormaPagamento, setShowFormaPagamento] = useState(false);
    const [formaPagamentoCustom, setFormaPagamentoCustom] = useState("");
    const [mostraFormaPagamentoCustom, setMostraFormaPagamentoCustom] = useState(false);
    const [valorContrato, setValorContrato] = useState("");
    const [closerSelecionado, setCloserSelecionado] = useState("");
    const [showCloser, setShowCloser] = useState(false);
    const [socios, setSocios] = useState([
        { nome: "", telefone: "", dataNascimento: "", vinculo: "", obs: "" },
        { nome: "", telefone: "", dataNascimento: "", vinculo: "", obs: "" },
        { nome: "", telefone: "", dataNascimento: "", vinculo: "", obs: "" }
    ]);

    const listaServicos = ["Habilitação RADAR - 50K", "Revisão RADAR - 150K", "Revisão RADAR - ILIMITADO", "TTD 409", "Recuperação AFRMM", "Outras Recuperaçoes Tributarias"];
    const SERVICOS_COM_EMBASAMENTO = ["Revisão RADAR - 150K", "Revisão RADAR - ILIMITADO"];
    const embasamentoDesbloqueado = SERVICOS_COM_EMBASAMENTO.some(s => servicosSelecionados.includes(s));

    useEffect(() => {
        buscarUsuariosPorRole(["OPERACIONAL"]).then((usuarios) => setListaAnalistas(usuarios.map((u) => u.nome)));
        buscarUsuariosPorRole(["COMERCIAL", "Lider Comercial"]).then((usuarios) => setListaClosersUsuarios(usuarios.map((u) => u.nome)));
    }, []);

    const updateSocio = (index: number, field: string, value: string) => {
        const novosSocios = [...socios];
        novosSocios[index] = { ...novosSocios[index], [field]: value };
        setSocios(novosSocios);
    };

    const executarConsultaCNPJ = async () => {
        const cnpjLimpo = cnpj.replace(/\D/g, "");
        setCarregando(true);
        try {
            const res = await fetch(`/api/ReceitaFederal?cnpj=${cnpjLimpo}`);
            const data = await res.json();
            if (data.error) {
                toast.error(data.error);
            } else {
                setDadosEmpresa({
                    razaoSocial: data.razaoSocial,
                    nomeFantasia: data.nomeFantasia,
                    dataConstituicao: data.dataConstituicao,
                    uf: data.uf,
                    municipio: data.municipio ?? "",
                    regimeTributario: data.regimeTributario
                });
                toast.success("Dados importados!");
            }
        } catch (error) {
            toast.error("Erro ao conectar com a API");
        } finally {
            setCarregando(false);
        }
    };

    const handleConsultarCNPJ = async () => {
        const cnpjLimpo = cnpj.replace(/\D/g, "");
        if (cnpjLimpo.length !== 14) return toast.error("CNPJ Inválido!");

        const { existe, razaoSocial } = await verificarCNPJDuplicado(cnpjLimpo);
        if (existe) {
            setModalDuplicata({ aberto: true, razaoSocial: razaoSocial || "" });
            return;
        }

        await executarConsultaCNPJ();
    };

    const handleFinalizar = async () => {
        if (!dadosEmpresa.razaoSocial || !analistaSelecionado) {
            return toast.error("Preencha o CNPJ e o Analista!");
        }

        const sociosParaEnviar = socios.filter(s => s.nome && s.nome.trim() !== "");

        const temSocioSemVinculo = sociosParaEnviar.some(s => !s.vinculo || s.vinculo.trim() === "");

        if (temSocioSemVinculo) {
            return toast.error("Selecione o Vínculo de todos os sócios preenchidos!");
        }

        setIsSaving(true);

        const formaPagamentoFinal = mostraFormaPagamentoCustom ? formaPagamentoCustom.trim() : formaPagamentoSelecionada;

        const payload = {
            cnpj,
            ...dadosEmpresa,
            servicos: servicosSelecionados,
            analistaResponsavel: analistaSelecionado,
            embasamento: embasamentoDesbloqueado ? embasamentoSelecionado || null : null,
            origemLead: origemLeadSelecionada || null,
            dataContratacao,
            formaPagamento: formaPagamentoFinal || null,
            valorContrato: valorContrato ? Number(valorContrato) : null,
            closerNome: closerSelecionado || null,
        };

        const res = await CadastrarCliente(payload, sociosParaEnviar);

        if (res.success) {
            toast.success("Cadastrado!");
            onClose();
            window.location.reload();
        } else {
            toast.error(res.error || "Erro ao salvar");
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const ModalDuplicata = () => (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <CsNpsModal3DShell className="relative bg-[#0b1220] border border-amber-500/30 rounded-[2rem] p-8 max-w-sm w-full mx-4 shadow-2xl shadow-amber-900/20">
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="p-4 bg-amber-500/10 rounded-full border border-amber-500/20">
                        <AlertTriangle size={36} className="text-amber-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black uppercase text-white tracking-tighter">CNPJ já possui cadastro</h3>
                        {modalDuplicata.razaoSocial && (
                            <p className="text-[11px] text-amber-400 font-bold mt-1 uppercase">{modalDuplicata.razaoSocial}</p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-3 font-bold">Este CNPJ já contratou outro serviço com a Alpha. Você pode continuar normalmente — o cadastro só é bloqueado se o MESMO serviço já estiver contratado para este CNPJ.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 w-full mt-2">
                        <button
                            onClick={() => setModalDuplicata({ aberto: false, razaoSocial: "" })}
                            className="py-3 bg-slate-900 hover:bg-slate-800 text-slate-400 text-[9px] font-black uppercase rounded-xl transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={async () => {
                                setModalDuplicata({ aberto: false, razaoSocial: "" });
                                await executarConsultaCNPJ();
                            }}
                            className="py-3 bg-amber-600 hover:bg-amber-500 text-white text-[9px] font-black uppercase rounded-xl transition-all"
                        >
                            Continuar consulta
                        </button>
                    </div>
                </div>
            </CsNpsModal3DShell>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            {modalDuplicata.aberto && <ModalDuplicata />}
            <CsNpsModal3DShell className="bg-[#0b1220] border border-white/10 w-full max-w-5xl max-h-[95vh] overflow-y-auto rounded-[2.5rem] shadow-2xl relative custom-scrollbar">

                {/* HEADER */}
                <div className="sticky top-0 bg-[#0b1220]/95 backdrop-blur-md p-8 border-b border-white/5 flex justify-between items-center z-20">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">CADASTRO DE <span className="text-indigo-500">CLIENTE</span></h2>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Integração via API Receita Federal</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white"><X size={24} /></button>
                </div>

                <div className="p-8 space-y-8">
                    {/* SEÇÃO 1: CNPJ E DADOS FISCAIS */}
                    <section className="grid grid-cols-1 md:grid-cols-12 gap-5">
                        <div className="md:col-span-4 space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">CNPJ</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="00.000.000/0000-00"
                                    value={cnpj}
                                    onChange={(e) => setCnpj(e.target.value)}
                                    className="w-full bg-slate-950 border border-indigo-500/30 rounded-xl py-3 px-4 text-sm text-white outline-none focus:border-indigo-500 transition-all"
                                />
                                <button
                                    onClick={handleConsultarCNPJ}
                                    disabled={carregando}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {carregando ? <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full" /> : <Search size={18} />}
                                </button>
                            </div>
                        </div>

                        <div className="md:col-span-8 space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Razão Social</label>
                            <input
                                disabled
                                value={dadosEmpresa.razaoSocial}
                                className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-3 px-4 text-sm text-slate-400 cursor-not-allowed"
                                placeholder="Consultar CNPJ..."
                            />
                        </div>

                        <div className="md:col-span-6 space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Nome Fantasia</label>
                            <input
                                disabled
                                value={dadosEmpresa.nomeFantasia}
                                className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-3 px-4 text-sm text-slate-400 cursor-not-allowed"
                            />
                        </div>

                        <div className="md:col-span-6 space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Data Constituição</label>
                            <input
                                disabled
                                value={dadosEmpresa.dataConstituicao}
                                className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-3 px-4 text-sm text-slate-400 cursor-not-allowed"
                            />
                        </div>

                        <div className="md:col-span-6 space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Regime Tributário</label>
                            <input
                                disabled
                                value={dadosEmpresa.regimeTributario}
                                className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-3 px-4 text-sm text-slate-400 cursor-not-allowed"
                            />
                        </div>

                        <div className="md:col-span-6 space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">UF</label>
                            <input
                                disabled
                                value={dadosEmpresa.uf}
                                className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-3 px-4 text-sm text-slate-400 cursor-not-allowed"
                            />
                        </div>

                        <div className="md:col-span-6 space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Cidade</label>
                            <input
                                disabled
                                value={dadosEmpresa.municipio}
                                className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-3 px-4 text-sm text-slate-400 cursor-not-allowed"
                            />
                        </div>
                    </section>


                    {/* SEÇÃO 2: OPERACIONAL (BOTÕES FUNCIONAIS) */}
                    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6 border-t border-white/5">
                        <div

                            className="space-y-2 relative">
                            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">
                                Serviços ({servicosSelecionados.length})
                            </label>
                            <button
                                onClick={() => setShowServicos(!showServicos)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-300 flex justify-between items-center hover:border-indigo-500/50 transition-all"
                            >
                                {servicosSelecionados.length > 0 ? servicosSelecionados.join(", ") : "Selecionar Serviço"}
                                <Laptop size={16} className="text-indigo-500 shrink-0 ml-2" />
                            </button>

                            {showServicos && (
                                <div className="absolute top-full mt-2 w-full bg-slate-900 border border-white/10 rounded-2xl p-4 z-30 shadow-2xl animate-in zoom-in-95 duration-200">
                                    <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                                        {listaServicos.map(s => (
                                            <button
                                                key={s}
                                                onClick={() => {
                                                    setServicosSelecionados([s]);
                                                    setShowServicos(false);
                                                }}
                                                className="w-full text-left p-3 rounded-xl text-xs font-bold text-slate-400 hover:bg-white/5 hover:text-indigo-400 transition-all"
                                            >
                                                {s}
                                            </button>
                                        ))}

                                        {!isCriandoServico ? (
                                            <button
                                                onClick={() => setIsCriandoServico(true)}
                                                className="w-full text-left p-3 rounded-xl text-xs font-black text-emerald-500 hover:bg-emerald-500/10 transition-all flex items-center gap-2 border-t border-white/5 mt-2"
                                            >
                                                <Plus size={14} /> NOVO SERVIÇO
                                            </button>
                                        ) : (
                                            <div className="mt-2 p-2 border-t border-white/5 space-y-2">
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    placeholder="Nome do serviço..."
                                                    value={novoServicoNome}
                                                    onChange={(e) => setNovoServicoNome(e.target.value)}
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none focus:border-emerald-500"
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            if (novoServicoNome) {
                                                                setServicosSelecionados([novoServicoNome]);
                                                                setShowServicos(false);
                                                                setIsCriandoServico(false);
                                                                setNovoServicoNome("");
                                                            }
                                                        }}
                                                        className="flex-1 bg-emerald-600 text-white text-[9px] font-black p-2 rounded-lg uppercase"
                                                    >
                                                        Confirmar
                                                    </button>
                                                    <button
                                                        onClick={() => setIsCriandoServico(false)}
                                                        className="bg-slate-800 text-slate-400 text-[9px] font-black p-2 rounded-lg uppercase"
                                                    >
                                                        X
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* EMBASAMENTO */}
                        <div className="space-y-2 relative">
                            <label className={`text-[10px] font-black uppercase ml-1 flex items-center gap-2 ${embasamentoDesbloqueado ? "text-indigo-400" : "text-slate-600"}`}>
                                Embasamento
                                {!embasamentoDesbloqueado && <span className="text-[8px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-500">Revisão 150K / Ilimitado</span>}
                            </label>
                            <button
                                disabled={!embasamentoDesbloqueado}
                                onClick={() => embasamentoDesbloqueado && setShowEmbasamento(!showEmbasamento)}
                                className={`w-full border rounded-xl py-3 px-4 text-sm flex justify-between items-center transition-all ${embasamentoDesbloqueado ? "bg-slate-950 border-slate-800 text-slate-300 hover:border-indigo-500/50 cursor-pointer" : "bg-slate-900/30 border-slate-800/30 text-slate-600 cursor-not-allowed"}`}
                            >
                                {embasamentoSelecionado || "Selecionar Embasamento"}
                                <Search size={16} className={embasamentoDesbloqueado ? "text-indigo-500" : "text-slate-700"} />
                            </button>
                            {showEmbasamento && embasamentoDesbloqueado && (
                                <div className="absolute top-full mt-2 w-full bg-slate-900 border border-white/10 rounded-2xl p-4 z-30 shadow-2xl animate-in zoom-in-95 duration-200">
                                    <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                                        {listaEmbasamentos.map(e => (
                                            <button key={e} onClick={() => { setEmbasamentoSelecionado(e); setShowEmbasamento(false); }} className={`w-full text-left p-3 rounded-xl text-xs font-bold transition-all ${embasamentoSelecionado === e ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-indigo-400"}`}>{e}</button>
                                        ))}
                                        {!isCriandoEmbasamento ? (
                                            <button onClick={() => setIsCriandoEmbasamento(true)} className="w-full text-left p-3 rounded-xl text-[10px] font-black text-emerald-500 hover:bg-emerald-500/10 transition-all flex items-center gap-2 border-t border-white/5 mt-2 pt-3">
                                                <Plus size={14} /> NOVO EMBASAMENTO
                                            </button>
                                        ) : (
                                            <div className="mt-2 p-2 border-t border-white/5 space-y-2 animate-in slide-in-from-top-2">
                                                <input autoFocus type="text" placeholder="Nome do embasamento..." value={novoEmbasamentoNome} onChange={(e) => setNovoEmbasamentoNome(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white outline-none focus:border-emerald-500" />
                                                <div className="flex gap-2">
                                                    <button onClick={() => { if (novoEmbasamentoNome) { setListaEmbasamentos(prev => [...prev, novoEmbasamentoNome]); setEmbasamentoSelecionado(novoEmbasamentoNome); setShowEmbasamento(false); setIsCriandoEmbasamento(false); setNovoEmbasamentoNome(""); } }} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black p-2 rounded-lg uppercase transition-colors">Confirmar</button>
                                                    <button onClick={() => setIsCriandoEmbasamento(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-400 text-[9px] font-black p-2 rounded-lg uppercase transition-colors">Sair</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2 relative">
                            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Analista Responsável</label>
                            <button
                                onClick={() => setShowAnalistas(!showAnalistas)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-300 flex justify-between items-center hover:border-indigo-500/50 transition-all"
                            >
                                {analistaSelecionado || "Escolher Analista"} <UserCheck size={16} className="text-indigo-500" />
                            </button>

                            {/* SUB-MODAL ANALISTAS */}
                            {showAnalistas && (
                                <div className="absolute top-full mt-2 w-full bg-slate-900 border border-white/10 rounded-2xl p-4 z-30 shadow-2xl animate-in zoom-in-95 duration-200">
                                    <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                                        {listaAnalistas.map(a => (
                                            <button
                                                key={a}
                                                onClick={() => { setAnalistaSelecionado(a); setShowAnalistas(false); }}
                                                className={`w-full text-left p-3 rounded-xl text-xs font-bold transition-all ${analistaSelecionado === a ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-white/5 text-slate-400'}`}
                                            >
                                                {a}
                                            </button>
                                        ))}

                                        <button
                                            onClick={() => { setCampoSelecionandoUsuario("analista"); setShowAnalistas(false); }}
                                            className="w-full text-left p-3 rounded-xl text-[10px] font-black text-emerald-500 hover:bg-emerald-500/10 transition-all flex items-center gap-2 border-t border-white/5 mt-2 pt-3"
                                        >
                                            <Plus size={14} /> OUTRO ANALISTA
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>


                        

                        {/* ORIGEM DO LEAD */}
                        <div className="space-y-2 relative">
                            <label className="text-[10px] font-black uppercase text-indigo-400 ml-1">Origem do Lead</label>
                            <button onClick={() => setShowOrigemLead(!showOrigemLead)} className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-300 flex justify-between items-center hover:border-indigo-500/50 transition-all">
                                {origemLeadSelecionada || "Canal de Aquisição"}
                                <UserCheck size={16} className="text-indigo-500" />
                            </button>
                            {showOrigemLead && (
                                <div className="absolute top-full mt-2 w-full bg-slate-900 border border-white/10 rounded-2xl p-4 z-30 shadow-2xl animate-in zoom-in-95 duration-200">
                                    <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                                        {listaOrigensLead.map(o => (
                                            <button key={o} onClick={() => { setOrigemLeadSelecionada(o); setShowOrigemLead(false); }} className={`w-full text-left p-3 rounded-xl text-xs font-bold transition-all ${origemLeadSelecionada === o ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-indigo-400"}`}>{o}</button>
                                        ))}
                                        {!isCriandoOrigemLead ? (
                                            <button onClick={() => setIsCriandoOrigemLead(true)} className="w-full text-left p-3 rounded-xl text-[10px] font-black text-emerald-500 hover:bg-emerald-500/10 transition-all flex items-center gap-2 border-t border-white/5 mt-2 pt-3">
                                                <Plus size={14} /> NOVA ORIGEM
                                            </button>
                                        ) : (
                                            <div className="mt-2 p-2 border-t border-white/5 space-y-2 animate-in slide-in-from-top-2">
                                                <input autoFocus type="text" placeholder="Nome da origem..." value={novaOrigemLeadNome} onChange={(e) => setNovaOrigemLeadNome(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white outline-none focus:border-emerald-500" />
                                                <div className="flex gap-2">
                                                    <button onClick={() => { if (novaOrigemLeadNome) { setListaOrigensLead(prev => [...prev, novaOrigemLeadNome]); setOrigemLeadSelecionada(novaOrigemLeadNome); setShowOrigemLead(false); setIsCriandoOrigemLead(false); setNovaOrigemLeadNome(""); } }} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black p-2 rounded-lg uppercase transition-colors">Confirmar</button>
                                                    <button onClick={() => setIsCriandoOrigemLead(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-400 text-[9px] font-black p-2 rounded-lg uppercase transition-colors">Sair</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Data de Contratação</label>
                            <input type="date" value={dataContratacao} onChange={(e) => setDataContratacao(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white outline-none focus:border-indigo-500 transition-all [color-scheme:dark]" />
                        </div>

                        {/* FORMA DE PAGAMENTO */}
                        <div className="space-y-2 relative">
                            <label className="text-[10px] font-black uppercase text-slate-500 ml-1 flex items-center gap-1"><CreditCard size={12} className="text-indigo-500" /> Forma de Pagamento</label>
                            <button
                                onClick={() => setShowFormaPagamento(!showFormaPagamento)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-300 flex justify-between items-center hover:border-indigo-500/50 transition-all text-left"
                            >
                                <span className="truncate">
                                    {mostraFormaPagamentoCustom
                                        ? (formaPagamentoCustom || "Descrever forma de pagamento...")
                                        : (formaPagamentoSelecionada ? FORMAS_LABEL[formaPagamentoSelecionada] : "Selecionar Forma de Pagamento")}
                                </span>
                                <Search size={16} className="text-indigo-500 shrink-0 ml-2" />
                            </button>
                            {showFormaPagamento && (
                                <div className="absolute top-full mt-2 w-full bg-slate-900 border border-white/10 rounded-2xl p-4 z-30 shadow-2xl animate-in zoom-in-95 duration-200">
                                    <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                                        {FORMAS_PAGAMENTO.map((f) => (
                                            <button
                                                key={f}
                                                onClick={() => {
                                                    setFormaPagamentoSelecionada((atual) => (atual === f && !mostraFormaPagamentoCustom ? "" : f));
                                                    setMostraFormaPagamentoCustom(false);
                                                    setShowFormaPagamento(false);
                                                }}
                                                className={`w-full text-left p-3 rounded-xl text-xs font-bold transition-all ${formaPagamentoSelecionada === f && !mostraFormaPagamentoCustom ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-indigo-400"}`}
                                            >
                                                {FORMAS_LABEL[f]}
                                            </button>
                                        ))}
                                        {!mostraFormaPagamentoCustom ? (
                                            <button
                                                onClick={() => { setMostraFormaPagamentoCustom(true); setFormaPagamentoSelecionada(""); setShowFormaPagamento(false); }}
                                                className="w-full text-left p-3 rounded-xl text-[10px] font-black text-emerald-500 hover:bg-emerald-500/10 transition-all flex items-center gap-2 border-t border-white/5 mt-2 pt-3"
                                            >
                                                <Plus size={14} /> OUTRA FORMA
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            )}
                            {mostraFormaPagamentoCustom && (
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Descrever forma de pagamento..."
                                    value={formaPagamentoCustom}
                                    onChange={(e) => setFormaPagamentoCustom(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-emerald-500 mt-2"
                                />
                            )}
                        </div>

                        {/* VALOR DO CONTRATO */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-500 ml-1 flex items-center gap-1"><Wallet size={12} className="text-indigo-500" /> Valor do Contrato</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0,00"
                                value={valorContrato}
                                onChange={(e) => setValorContrato(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-sm text-white outline-none focus:border-indigo-500 transition-all"
                            />
                        </div>

                        {/* CLOSER */}
                        <div className="space-y-2 relative">
                            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Closer (Vendedor)</label>
                            <button
                                onClick={() => setShowCloser(!showCloser)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-sm text-slate-300 flex justify-between items-center hover:border-indigo-500/50 transition-all"
                            >
                                {closerSelecionado || "Selecionar Closer"} <UserCheck size={16} className="text-indigo-500" />
                            </button>
                            {showCloser && (
                                <div className="absolute top-full mt-2 w-full bg-slate-900 border border-white/10 rounded-2xl p-4 z-30 shadow-2xl animate-in zoom-in-95 duration-200">
                                    <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                                        {listaClosersUsuarios.map((c) => (
                                            <button
                                                key={c}
                                                onClick={() => { setCloserSelecionado(c); setShowCloser(false); }}
                                                className={`w-full text-left p-3 rounded-xl text-xs font-bold transition-all ${closerSelecionado === c ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-white/5 hover:text-indigo-400"}`}
                                            >
                                                {c}
                                            </button>
                                        ))}
                                        <button
                                            onClick={() => { setCampoSelecionandoUsuario("closer"); setShowCloser(false); }}
                                            className="w-full text-left p-3 rounded-xl text-[10px] font-black text-emerald-500 hover:bg-emerald-500/10 transition-all flex items-center gap-2 border-t border-white/5 mt-2 pt-3"
                                        >
                                            <Plus size={14} /> OUTRO CLOSER
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* SEÇÃO 3: TABELA SÓCIOS */}
                    <section className="space-y-4 pt-6 border-t border-white/5">
                        <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                            SÓCIOS / RESPONSÁVEIS
                            <Plus
                                size={12}
                                className="text-indigo-500 cursor-pointer hover:scale-125 transition-transform"
                            />
                        </h3>
                        <div className="bg-slate-950/50 border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white/5 text-[9px] font-black uppercase text-slate-500">
                                    <tr>
                                        <th className="px-6 py-4">Nome do Responsável</th>
                                        <th className="px-6 py-4">Telefone / WhatsApp</th>
                                        <th className="px-6 py-4 text-center">Data de Nascimento</th>
                                        <th className="px-6 py-4">Vínculo</th>
                                        <th className="px-6 py-4">Observações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {socios.map((socio, i) => (
                                        <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-4 py-2">
                                                <input
                                                    value={socio.nome || ""}
                                                    onChange={(e) => updateSocio(i, "nome", e.target.value)}
                                                    className="w-full bg-transparent border-none text-xs text-white p-2 outline-none placeholder:text-slate-700"
                                                    placeholder="Nome..."
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input
                                                    value={socio.telefone || ""}
                                                    onChange={(e) => updateSocio(i, "telefone", e.target.value)}
                                                    className="w-full bg-transparent border-none text-xs text-white p-2 outline-none placeholder:text-slate-700"
                                                    placeholder="(00) 00000-0000"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <input
                                                    value={socio.dataNascimento || ""}
                                                    onChange={(e) => updateSocio(i, "dataNascimento", e.target.value)}
                                                    className="w-full bg-transparent border-none text-xs text-center text-white p-2 outline-none placeholder:text-slate-700"
                                                    placeholder="DD/MM/AAAA"
                                                />
                                            </td>

                                            <td className="px-4 py-2">
                                                <select
                                                    required
                                                    value={socio.vinculo || ""}
                                                    onChange={(e) => updateSocio(i, "vinculo", e.target.value)}
                                                    className="w-full bg-transparent border-none text-xs text-white p-2 outline-none cursor-pointer appearance-none focus:ring-0"
                                                >
                                                    <option value="" className="bg-slate-900 text-slate-500">Selecione...</option>
                                                    <option value="Sócio Proprietário" className="bg-slate-900">Sócio Proprietário</option>
                                                    <option value="Sócio Oculto" className="bg-slate-900">Sócio Oculto</option>
                                                    <option value="Funcionário/Colaborador" className="bg-slate-900">Funcionário/Colaborador</option>
                                                    <option value="Contador Interno" className="bg-slate-900">Contador Interno</option>
                                                    <option value="Contador Externo" className="bg-slate-900">Contador Externo</option>
                                                    <option value="Despachante Aduaneiro" className="bg-slate-900">Despachante Aduaneiro</option>
                                                    <option value="Outro" className="bg-slate-900">Outro</option>
                                                </select>
                                            </td>

                                            <td className="px-4 py-2">
                                                <input
                                                    value={socio.obs || ""}
                                                    onChange={(e) => updateSocio(i, "obs", e.target.value)}
                                                    className="w-full bg-transparent border-none text-xs text-white p-2 outline-none placeholder:text-slate-700"
                                                    placeholder="Obs..."
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* RODAPÉ  */}
                    <div className="flex justify-end gap-4 pt-4">
                        <button onClick={onClose} className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">Cancelar</button>
                        <button
                            onClick={handleFinalizar}
                            disabled={isSaving}
                            className={`px-12 py-4 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-3
                                    ${isSaving
                                    ? 'bg-indigo-400 cursor-not-allowed opacity-80'
                                    : 'bg-indigo-600 hover:bg-indigo-500 active:scale-95'
                                }`}
                            >
                            {isSaving ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                "Salvar Cliente"
                            )}
                        </button></div>
                </div>
            </CsNpsModal3DShell>

            <ModalSelecionarUsuario
                open={campoSelecionandoUsuario !== null}
                onClose={() => setCampoSelecionandoUsuario(null)}
                titulo={campoSelecionandoUsuario === "analista" ? "Selecionar Analista" : "Selecionar Closer"}
                onSelecionar={(nome) => {
                    if (campoSelecionandoUsuario === "analista") setAnalistaSelecionado(nome);
                    else if (campoSelecionandoUsuario === "closer") setCloserSelecionado(nome);
                }}
            />
        </div>
    );
}
