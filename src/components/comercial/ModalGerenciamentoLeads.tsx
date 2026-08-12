"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fmtDate } from "@/lib/format-date";
import { motion, AnimatePresence } from "framer-motion";
import {
    X, ChevronLeft, ChevronRight, Plus, Search, Loader2,
    Eye, Check, BarChart3, Users, FileText, Minus, Trash2, Upload, Pencil,
    MessageSquare, Archive, ArchiveRestore, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
    criarContrato,
    atualizarContrato,
    getContratos,
    getColaboradoresComerciais,
    getServicosComerciais,
    getProspeccoesAtivas,
    criarServicoComercial,
    excluirContrato,
    atualizarContratoUrl,
    arquivarContrato,
    restaurarContrato,
    criarObservacaoContrato,
} from "@/actions/ContratoComercial";
import { listarParceirosSimples, buscarParceiroDetalheSimples } from "@/actions/parceiros";
import { SERVICOS_COMERCIAIS_PADRAO } from "@/lib/comercial/servicos";
import QuadroSocios, { type Socio } from "./QuadroSocios";
import ModalConfirmacaoFechamento from "./ModalConfirmacaoFechamento";
import { CampoProspeccaoAtiva } from "./CampoProspeccaoAtiva";
import { SeletorParceiroPesquisavel, type ParceiroOpcao } from "./SeletorParceiroPesquisavel";
import { isAdminRole } from "@/lib/roles";
import {
    CANAL_INDICACAO_CLIENTE,
    CANAL_INDICACAO_PARCEIRO,
    LABEL_INDICACAO_CLIENTE,
    LABEL_INDICACAO_PARCEIRO,
    parseParceiroNaoCadastrado,
} from "@/lib/comercial/parceiro-nao-cadastrado";
import {
    CANAL_PROSPECCAO_ATIVA,
    normalizarCatalogoProspeccoes,
} from "@/lib/comercial/prospeccao-ativa";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface UsuarioSimples {
    id: number;
    nome: string;
    imagemUrl: string | null;
}

interface ParceiroDetalheSimples {
    id: number;
    tipo: string;
    documento: string;
    nome: string;
    nomeFantasia: string | null;
    email: string;
    telefone: string | null;
    telefone2: string | null;
    nivel: string;
    endereco: { cep: string; logradouro: string; numero: string | null; complemento: string | null; bairro: string; cidade: string; uf: string } | null;
    representantes: { nome: string; documento: string; cargo: string | null; email: string | null; telefone: string | null }[];
}

interface ObservacaoContrato {
    id: string;
    contratoId: string;
    texto: string;
    tipo: "POSITIVO" | "NEGATIVO" | "NA";
    criadoEm: Date | string;
}

interface Contrato {
    id: string;
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string | null;
    valorContrato: number;
    formaPagamento: string;
    servico: string;
    canalAquisicao: string;
    canalOutro?: string | null;
    indicadoPorParceiroId?: number | null;
    closerNome: string;
    status: string;
    pagamentoConfirmado: boolean;
    pagamentoConfirmadoEm: Date | null;
    contratoAssinado: boolean;
    contratoUrl: string | null;
    arquivado: boolean;
    arquivadoEm: Date | null;
    mes: number;
    ano: number;
    usuarioId: number;
    usuario: { id: number; nome: string; imagemUrl: string | null };
    socios?: unknown;
    observacoes?: ObservacaoContrato[];
    createdAt: Date | string;
}

interface Props {
    role: string;
    nomeUsuario?: string;
    onFechar: () => void;
    onDadosAlterados?: () => void;
    onVendaFechada?: (data: { closerNome: string; razaoSocial: string; pagamentoConfirmado: boolean; contratoAssinado: boolean }) => void;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MESES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const FORMAS_PAGAMENTO = ["ENTRADA_EXITO", "PARCELADO_CC", "INTEGRAL_PIX"] as const;
const FORMAS_LABEL: Record<string, string> = {
    ENTRADA_EXITO: "50% Entrada / 50% Êxito (Pix)",
    PARCELADO_CC: "Parcelamento Cartão de Crédito - até 12x com juros",
    INTEGRAL_PIX: "Integral na contratação - 10% OFF (Pix)",
    OUTRO: "Outra forma",
};

const CANAIS_AQUISICAO = [
    { value: "Tráfego Pago (Meta - Instagram)", label: "Tráfego Pago (Meta - Instagram)" },
    { value: "Tráfego Pago (Google)", label: "Tráfego Pago (Google)" },
    { value: CANAL_INDICACAO_PARCEIRO, label: LABEL_INDICACAO_PARCEIRO },
    { value: CANAL_INDICACAO_CLIENTE, label: LABEL_INDICACAO_CLIENTE },
    { value: "WhatsApp", label: "WhatsApp" },
    { value: "Instagram", label: "Instagram" },
    { value: "Orgânico", label: "Orgânico" },
    { value: "Evento", label: "Evento" },
    { value: CANAL_PROSPECCAO_ATIVA, label: CANAL_PROSPECCAO_ATIVA },
    { value: "Outro", label: "Outro" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isAdminOrCeo(role: string) {
    return isAdminRole(role) || role === "Lider Comercial";
}

function podeVerGlobal(role: string) {
    return isAdminRole(role) || role === "Lider Comercial" || role === "FINANCEIRO";
}

function formatBRL(v: number) {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCNPJ(cnpj: string) {
    const d = cnpj.replace(/\D/g, "");
    if (d.length !== 14) return cnpj;
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

// ─── Input de valor monetário ─────────────────────────────────────────────────

function InputMonetario({
    value, onChange, disabled,
}: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
    const [display, setDisplay] = useState(
        value > 0 ? value.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "",
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/[^\d]/g, "");
        const num = parseInt(raw || "0", 10) / 100;
        setDisplay(num.toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
        onChange(num);
    };

    return (
        <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 font-black">
                R$
            </span>
            <input
                type="text"
                inputMode="numeric"
                value={display}
                onChange={handleChange}
                disabled={disabled}
                placeholder="0,00"
                className="w-full h-10 bg-slate-950/80 border border-white/10 rounded-xl pl-9 pr-3 text-sm text-white placeholder-slate-600 focus:border-blue-500/50 focus:outline-none transition-colors disabled:opacity-50"
            />
        </div>
    );
}

// ─── Formulário Novo Cliente ─────────────────────────────────────────────────

interface FormNovoContratoProps {
    mes: number;
    ano: number;
    colaboradores: UsuarioSimples[];
    servicos: string[];
    prospeccoesAtivas: string[];
    nomeUsuario?: string;
    initialData?: Contrato;
    editandoId?: string;
    onServicoNovo: (nome: string) => Promise<void>;
    onProspeccaoSalva: (nome: string) => void;
    onSalvo: () => void;
    onCancelar: () => void;
}

function FormNovoContrato({
    mes, ano,
    colaboradores, servicos, prospeccoesAtivas, nomeUsuario, initialData, editandoId,
    onServicoNovo, onProspeccaoSalva, onSalvo, onCancelar,
}: FormNovoContratoProps) {
    const isEdicao = !!editandoId;
    const cnpjInicial = initialData?.cnpj ? formatCNPJ(initialData.cnpj) : "";
    const eConstituicaoInicial = initialData?.cnpj === "00000000000000";
    const parceiroPendenteInicial = parseParceiroNaoCadastrado(initialData?.canalOutro);

    const [cnpj, setCnpj] = useState(cnpjInicial);
    const [consultando, setConsultando] = useState(false);
    const [dadosEmpresa, setDadosEmpresa] = useState({
        razaoSocial: initialData?.razaoSocial ?? "",
        nomeFantasia: initialData?.nomeFantasia ?? "",
        dataConstituicao: (initialData as { dataConstituicao?: string | null } | undefined)?.dataConstituicao ?? "",
        regimeTributario: (initialData as { regimeTributario?: string | null } | undefined)?.regimeTributario ?? "",
        uf: (initialData as { uf?: string | null } | undefined)?.uf ?? "",
    });
    const [consultado, setConsultado] = useState(isEdicao);
    const [empresaEmConstituicao, setEmpresaEmConstituicao] = useState(eConstituicaoInicial);

    const padraoFormaPag = (v: string) => (["ENTRADA_EXITO","PARCELADO_CC","INTEGRAL_PIX"].includes(v) ? v : v === "OUTRO" ? "" : "");
    const isCustomPag = initialData ? !["ENTRADA_EXITO","PARCELADO_CC","INTEGRAL_PIX"].includes(initialData.formaPagamento) : false;

    const [valorContrato, setValorContrato] = useState(initialData?.valorContrato ?? 0);
    const [formaPagamento, setFormaPagamento] = useState<string>(initialData ? padraoFormaPag(initialData.formaPagamento) : "");
    const [formaPagamentoCustom, setFormaPagamentoCustom] = useState(isCustomPag ? (initialData?.formaPagamento ?? "") : "");
    const [mostraFormaPagCustom, setMostraFormaPagCustom] = useState(isCustomPag);
    const [servico, setServico] = useState(initialData?.servico ?? "");
    const [novoServico, setNovoServico] = useState("");
    const [mostraNovo, setMostraNovo] = useState(false);
    const [showServicos, setShowServicos] = useState(false);
    const [showPagamento, setShowPagamento] = useState(false);
    const [showCloser, setShowCloser] = useState(false);
    const [canalAquisicao, setCanalAquisicao] = useState(initialData?.canalAquisicao ?? "");
    const [canalOutro, setCanalOutro] = useState(
        initialData?.canalAquisicao === "Outro" || initialData?.canalAquisicao === CANAL_PROSPECCAO_ATIVA
            ? (initialData.canalOutro ?? "")
            : "",
    );
    const [indicadoPorParceiroId, setIndicadoPorParceiroId] = useState<number | null>(initialData?.indicadoPorParceiroId ?? null);
    const [parceiroNaoCadastrado, setParceiroNaoCadastrado] = useState(Boolean(parceiroPendenteInicial));
    const [parceiroPendenteNome, setParceiroPendenteNome] = useState(parceiroPendenteInicial?.nome ?? "");
    const [parceiroPendenteEmpresa, setParceiroPendenteEmpresa] = useState(parceiroPendenteInicial?.empresa ?? "");
    const [parceiroPendenteTelefone, setParceiroPendenteTelefone] = useState(parceiroPendenteInicial?.telefone ?? "");
    const [parceirosLista, setParceirosLista] = useState<ParceiroOpcao[]>([]);
    const [parceirosCarregados, setParceirosCarregados] = useState(false);
    const carregandoParceirosLista = canalAquisicao === CANAL_INDICACAO_PARCEIRO && !parceirosCarregados;
    const [parceiroDetalhe, setParceiroDetalhe] = useState<ParceiroDetalheSimples | null>(null);
    const [carregandoParceiroDetalhe, setCarregandoParceiroDetalhe] = useState(false);
    const [parceiroDetalheAberto, setParceiroDetalheAberto] = useState(false);

    const alternarParceiroNaoCadastrado = () => {
        if (parceiroNaoCadastrado) {
            setParceiroNaoCadastrado(false);
            setParceiroPendenteNome("");
            setParceiroPendenteEmpresa("");
            setParceiroPendenteTelefone("");
            return;
        }

        setParceiroNaoCadastrado(true);
        setIndicadoPorParceiroId(null);
        setParceiroDetalhe(null);
        setParceiroDetalheAberto(false);
    };
    const [closerNome, setCloserNome] = useState(initialData?.closerNome ?? nomeUsuario ?? "");
    const [closerCustom, setCloserCustom] = useState("");
    const [mostraCloserCustom, setMostraCloserCustom] = useState(false);
    const [socios, setSocios] = useState<Socio[]>((initialData?.socios as Socio[]) ?? []);
    const [salvando, setSalvando] = useState(false);

    // Carrega parceiros quando o canal é indicação de parceiro.
    useEffect(() => {
        if (canalAquisicao === CANAL_INDICACAO_PARCEIRO && !parceirosCarregados) {
            let ativo = true;
            listarParceirosSimples()
                .then((ps) => {
                    if (!ativo) return;
                    setParceirosLista(ps.map(p => ({
                        id: p.id,
                        nome: p.nome,
                        nomeFantasia: p.nomeFantasia,
                        nivel: p.nivel,
                        representantes: p.representantes.map(r => r.nome),
                    })));
                })
                .catch(() => {
                    if (ativo) toast.error("Não foi possível carregar os parceiros");
                })
                .finally(() => {
                    if (!ativo) return;
                    setParceirosCarregados(true);
                });

            return () => {
                ativo = false;
            };
        }
    }, [canalAquisicao, parceirosCarregados]);

    // Carrega os dados completos do parceiro selecionado (confirmação visual, só leitura)
    // — abre a gaveta automaticamente assim que os dados chegam.
    useEffect(() => {
        setParceiroDetalhe(null); // eslint-disable-line react-hooks/set-state-in-effect -- reseta ao trocar de parceiro
        setParceiroDetalheAberto(false);
        if (!indicadoPorParceiroId) return;
        setCarregandoParceiroDetalhe(true);
        buscarParceiroDetalheSimples(indicadoPorParceiroId)
            .then(p => {
                setParceiroDetalhe(p);
                if (p) setParceiroDetalheAberto(true);
            })
            .catch(() => {})
            .finally(() => setCarregandoParceiroDetalhe(false));
    }, [indicadoPorParceiroId]);

    const ativarConstituicao = (ativo: boolean) => {
        setEmpresaEmConstituicao(ativo);
        if (ativo) {
            setCnpj("00.000.000/0000-00");
            setDadosEmpresa({ razaoSocial: "Em constituição", nomeFantasia: "", dataConstituicao: "", regimeTributario: "", uf: "" });
            setConsultado(true);
        } else {
            setCnpj("");
            setDadosEmpresa({ razaoSocial: "", nomeFantasia: "", dataConstituicao: "", regimeTributario: "", uf: "" });
            setConsultado(false);
        }
    };

    const consultarCNPJ = async () => {
        const cnpjLimpo = cnpj.replace(/\D/g, "");
        if (cnpjLimpo.length !== 14) {
            toast.error("CNPJ inválido");
            return;
        }
        setConsultando(true);
        try {
            const res = await fetch(`/api/ReceitaFederal?cnpj=${cnpjLimpo}`);
            const data = await res.json() as { razaoSocial?: string; nomeFantasia?: string; dataConstituicao?: string; regimeTributario?: string; uf?: string; error?: string };
            if (data.error) {
                toast.error(data.error);
                return;
            }
            setDadosEmpresa({
                razaoSocial: data.razaoSocial ?? "",
                nomeFantasia: data.nomeFantasia ?? "",
                dataConstituicao: data.dataConstituicao ?? "",
                regimeTributario: data.regimeTributario ?? "",
                uf: data.uf ?? "",
            });
            setConsultado(true);
            toast.success("Dados importados!");
        } catch {
            toast.error("Erro ao consultar CNPJ");
        } finally {
            setConsultando(false);
        }
    };

    const handleAdicionarServico = async () => {
        if (!novoServico.trim()) return;
        await onServicoNovo(novoServico.trim());
        setServico(novoServico.trim());
        setNovoServico("");
        setMostraNovo(false);
    };

    const closerFinal = mostraCloserCustom ? closerCustom : closerNome;
    const formaPagamentoFinal = mostraFormaPagCustom ? formaPagamentoCustom.trim() : formaPagamento;

    const handleSalvar = async () => {
        if (!consultado) { toast.error("Consulte o CNPJ primeiro"); return; }
        if (!valorContrato) { toast.error("Informe o valor do contrato"); return; }
        if (!formaPagamentoFinal) { toast.error("Selecione a forma de pagamento"); return; }
        if (mostraFormaPagCustom && !formaPagamentoCustom.trim()) { toast.error("Informe a forma de pagamento"); return; }
        if (!servico) { toast.error("Selecione o serviço"); return; }
        if (!canalAquisicao) { toast.error("Selecione o canal de aquisição"); return; }
        if (canalAquisicao === "Outro" && !canalOutro.trim()) { toast.error("Descreva o canal (Outro)"); return; }
        if (canalAquisicao === CANAL_PROSPECCAO_ATIVA && !canalOutro.trim()) {
            toast.error("Descreva a prospecção ativa"); return;
        }
        if (canalAquisicao === CANAL_INDICACAO_PARCEIRO && parceiroNaoCadastrado && !parceiroPendenteNome.trim()) {
            toast.error("Informe o nome do parceiro"); return;
        }
        if (canalAquisicao === CANAL_INDICACAO_PARCEIRO && !parceiroNaoCadastrado && !indicadoPorParceiroId) {
            toast.error("Selecione o parceiro que indicou"); return;
        }
        if (!closerFinal) { toast.error("Informe o closer"); return; }

        const sociosComVinculo = socios.filter((s) => s.nome.trim());
        const semVinculo = sociosComVinculo.some((s) => !s.vinculo);
        if (semVinculo) { toast.error("Selecione o vínculo de todos os sócios"); return; }

        setSalvando(true);
        try {
            const payload = {
                cnpj: cnpj.replace(/\D/g, ""),
                razaoSocial: dadosEmpresa.razaoSocial,
                nomeFantasia: dadosEmpresa.nomeFantasia || undefined,
                dataConstituicao: dadosEmpresa.dataConstituicao || undefined,
                regimeTributario: dadosEmpresa.regimeTributario || undefined,
                uf: dadosEmpresa.uf || undefined,
                valorContrato,
                formaPagamento: formaPagamentoFinal,
                servico,
                canalAquisicao,
                canalOutro: canalAquisicao === "Outro" || canalAquisicao === CANAL_PROSPECCAO_ATIVA
                    ? (canalOutro.trim() || undefined)
                    : undefined,
                indicadoPorParceiroId: canalAquisicao === CANAL_INDICACAO_PARCEIRO && !parceiroNaoCadastrado
                    ? (indicadoPorParceiroId ?? undefined)
                    : undefined,
                parceiroNaoCadastrado: canalAquisicao === CANAL_INDICACAO_PARCEIRO && parceiroNaoCadastrado
                    ? {
                        nome: parceiroPendenteNome.trim(),
                        empresa: parceiroPendenteEmpresa.trim() || undefined,
                        telefone: parceiroPendenteTelefone.trim() || undefined,
                    }
                    : undefined,
                closerNome: closerFinal,
                socios: sociosComVinculo,
            };

            const res = isEdicao
                ? await atualizarContrato({ ...payload, id: editandoId })
                : await criarContrato({ ...payload, mes, ano });

            if (!res.success) { toast.error(res.error); return; }
            if (canalAquisicao === CANAL_PROSPECCAO_ATIVA) {
                onProspeccaoSalva(canalOutro.trim());
            }
            toast.success(isEdicao ? "Lead atualizado!" : "Contrato enviado!");
            onSalvo();
        } catch {
            toast.error("Erro ao salvar");
        } finally {
            setSalvando(false);
        }
    };

    const inputCls =
        "w-full h-10 bg-slate-950/80 border border-white/10 rounded-xl px-3 text-sm text-white placeholder-slate-600 focus:border-blue-500/50 focus:outline-none transition-colors disabled:opacity-50";
    const labelCls = "text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1.5";
    const sectionCls = "p-4 rounded-2xl bg-slate-900/40 border border-white/5 space-y-4";

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
        >
            <div className="border-t border-white/5 p-6 space-y-5">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {isEdicao ? "Editar Lead" : `Novo Contrato — ${MESES[mes - 1]} ${ano}`}
                </h4>

                {/* Bloco 1 — CNPJ */}
                <div className={sectionCls}>
                    <div className="flex items-center justify-between">
                        <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">
                            1 · Empresa
                        </p>
                        <button
                            type="button"
                            onClick={() => ativarConstituicao(!empresaEmConstituicao)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest transition-colors ${
                                empresaEmConstituicao
                                    ? "bg-amber-500/20 border border-amber-500/40 text-amber-400"
                                    : "bg-white/5 border border-white/5 text-slate-500 hover:text-white"
                            }`}
                        >
                            {empresaEmConstituicao ? <Check size={10} /> : <Plus size={10} />}
                            Empresa em Constituição
                        </button>
                    </div>
                    <div>
                        <label className={labelCls}>CNPJ *</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="00.000.000/0000-00"
                                value={cnpj}
                                disabled={empresaEmConstituicao}
                                onChange={(e) => { setCnpj(e.target.value); setConsultado(false); }}
                                className={`${inputCls} flex-1`}
                            />
                            {!empresaEmConstituicao && (
                                <button
                                    type="button"
                                    onClick={consultarCNPJ}
                                    disabled={consultando}
                                    className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50 transition-colors whitespace-nowrap"
                                >
                                    {consultando ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                                    Consultar
                                </button>
                            )}
                        </div>
                    </div>

                    {consultado && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}>Razão Social</label>
                                <input readOnly value={dadosEmpresa.razaoSocial} className={`${inputCls} cursor-not-allowed`} />
                            </div>
                            <div>
                                <label className={labelCls}>Nome Fantasia</label>
                                <input readOnly value={dadosEmpresa.nomeFantasia} className={`${inputCls} cursor-not-allowed`} />
                            </div>
                        </div>
                    )}
                </div>

                {/* Bloco 2 — Contrato */}
                <div className={sectionCls}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">
                        2 · Contrato
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Valor do Contrato *</label>
                            <InputMonetario value={valorContrato} onChange={setValorContrato} />
                        </div>
                        <div>
                            <label className={labelCls}>Forma de Pagamento *</label>
                            {!mostraFormaPagCustom ? (
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setShowPagamento((v) => !v)}
                                        className="w-full h-10 bg-slate-950/80 border border-white/10 rounded-xl px-3 text-sm font-black text-left flex items-center justify-between transition-colors hover:border-blue-500/40 focus:outline-none"
                                    >
                                        <span className={formaPagamento ? "text-white italic uppercase" : "text-slate-600"}>
                                            {formaPagamento ? FORMAS_LABEL[formaPagamento] : "SELECIONAR"}
                                        </span>
                                        <Plus size={13} className="text-blue-400 shrink-0" />
                                    </button>
                                    {showPagamento && (
                                        <div className="absolute top-full mt-1 left-0 right-0 bg-slate-900 border border-white/10 rounded-2xl p-3 z-50 shadow-2xl">
                                            <div className="space-y-0.5">
                                                {FORMAS_PAGAMENTO.map((f) => (
                                                    <button
                                                        key={f}
                                                        type="button"
                                                        onClick={() => { setFormaPagamento(f); setShowPagamento(false); }}
                                                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                                            formaPagamento === f
                                                                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                                                                : "text-slate-400 hover:bg-white/5 hover:text-white"
                                                        }`}
                                                    >
                                                        {FORMAS_LABEL[f]}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <input
                                    type="text"
                                    placeholder="Ex: Débito, Parcelado, etc."
                                    value={formaPagamentoCustom}
                                    onChange={(e) => setFormaPagamentoCustom(e.target.value)}
                                    className={inputCls}
                                />
                            )}
                            <button
                                type="button"
                                onClick={() => { setMostraFormaPagCustom((v) => !v); setFormaPagamento(""); setFormaPagamentoCustom(""); setShowPagamento(false); }}
                                className="mt-2 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                <Plus size={11} />
                                {mostraFormaPagCustom ? "Usar formas padrão" : "Outra Forma"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bloco 3 — Serviços */}
                <div className={sectionCls}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">
                        3 · Serviço
                    </p>
                    <div className="relative">
                        <label className={labelCls}>Serviço *</label>
                        <button
                            type="button"
                            onClick={() => setShowServicos((v) => !v)}
                            className="w-full h-10 bg-slate-950/80 border border-white/10 rounded-xl px-3 text-sm font-black text-left flex items-center justify-between transition-colors hover:border-blue-500/40 focus:outline-none focus:border-blue-500/50"
                        >
                            <span className={servico ? "text-white italic uppercase" : "text-slate-600"}>
                                {servico || "SELECIONAR SERVIÇO"}
                            </span>
                            <Plus size={13} className="text-blue-400 shrink-0" />
                        </button>

                        {showServicos && (
                            <div className="absolute top-full mt-1 left-0 right-0 bg-slate-900 border border-white/10 rounded-2xl p-3 z-50 shadow-2xl">
                                <div className="space-y-0.5 max-h-52 overflow-y-auto custom-scrollbar">
                                    {servicos.map((s) => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => { setServico(s); setShowServicos(false); }}
                                            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                                servico === s
                                                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                                                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                                            }`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    {mostraNovo ? (
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Nome do novo serviço"
                                value={novoServico}
                                onChange={(e) => setNovoServico(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleAdicionarServico()}
                                className={`${inputCls} flex-1`}
                            />
                            <button
                                type="button"
                                onClick={handleAdicionarServico}
                                className="h-10 px-3 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 transition-colors"
                            >
                                <Check size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={() => { setMostraNovo(false); setNovoServico(""); }}
                                className="h-10 px-3 rounded-xl bg-white/5 border border-white/5 text-slate-500 hover:text-white transition-colors"
                            >
                                <Minus size={14} />
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setMostraNovo(true)}
                            className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            <Plus size={11} /> Novo Serviço
                        </button>
                    )}
                </div>

                {/* Bloco 4 — Closer */}
                <div className={sectionCls}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">
                        4 · Closer
                    </p>
                    {!mostraCloserCustom ? (
                        <div className="relative">
                            <label className={labelCls}>Closer *</label>
                            <button
                                type="button"
                                onClick={() => setShowCloser((v) => !v)}
                                className="w-full h-10 bg-slate-950/80 border border-white/10 rounded-xl px-3 text-sm font-black text-left flex items-center justify-between transition-colors hover:border-blue-500/40 focus:outline-none"
                            >
                                <span className={closerNome ? "text-white italic uppercase" : "text-slate-600"}>
                                    {closerNome || "SELECIONAR CLOSER"}
                                </span>
                                <Plus size={13} className="text-blue-400 shrink-0" />
                            </button>
                            {showCloser && (
                                <div className="absolute top-full mt-1 left-0 right-0 bg-slate-900 border border-white/10 rounded-2xl p-3 z-50 shadow-2xl">
                                    <div className="space-y-0.5 max-h-48 overflow-y-auto custom-scrollbar">
                                        {colaboradores.map((c) => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => { setCloserNome(c.nome); setShowCloser(false); }}
                                                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                                    closerNome === c.nome
                                                        ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                                                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                                                }`}
                                            >
                                                {c.nome}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div>
                            <label className={labelCls}>Closer Customizado *</label>
                            <input
                                type="text"
                                placeholder="Nome do closer"
                                value={closerCustom}
                                onChange={(e) => setCloserCustom(e.target.value)}
                                className={inputCls}
                            />
                        </div>
                    )}
                    <button
                        type="button"
                        onClick={() => { setMostraCloserCustom((v) => !v); setCloserNome(""); setCloserCustom(""); setShowCloser(false); }}
                        className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        <Plus size={11} />
                        {mostraCloserCustom ? "Usar lista de colaboradores" : "Novo Closer"}
                    </button>
                </div>

                {/* Bloco 5 — Sócios */}
                <div className={sectionCls}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">
                        5 · Sócios
                    </p>
                    <QuadroSocios socios={socios} onChange={setSocios} />
                </div>

                {/* Bloco 6 — Canal de Aquisição */}
                <div className={sectionCls}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">
                        6 · Canal de Aquisição
                    </p>
                    <div>
                        <label className={labelCls}>Canal *</label>
                        <select
                            value={canalAquisicao}
                            onChange={(e) => {
                                if (e.target.value !== canalAquisicao) setCanalOutro("");
                                setCanalAquisicao(e.target.value);
                            }}
                            className={inputCls}
                        >
                            <option value="">Selecione...</option>
                            {CANAIS_AQUISICAO.map((canal) => (
                                <option key={canal.value} value={canal.value}>{canal.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Outro → input livre */}
                    {canalAquisicao === "Outro" && (
                        <div className="mt-2">
                            <label className={labelCls}>Qual canal?</label>
                            <input
                                value={canalOutro}
                                onChange={(e) => setCanalOutro(e.target.value)}
                                placeholder="Descreva o canal de aquisição"
                                className={inputCls}
                            />
                        </div>
                    )}

                    {canalAquisicao === CANAL_PROSPECCAO_ATIVA && (
                        <CampoProspeccaoAtiva
                            valor={canalOutro}
                            opcoes={prospeccoesAtivas}
                            onChange={setCanalOutro}
                            inputClassName={inputCls}
                            labelClassName={labelCls}
                        />
                    )}

                    {/* Indicação de parceiros → parceiro cadastrado ou pendente */}
                    {canalAquisicao === CANAL_INDICACAO_PARCEIRO && (
                        <div className="mt-2 space-y-3">
                            <label className={labelCls}>Parceiro que indicou</label>
                            <SeletorParceiroPesquisavel
                                parceiros={parceirosLista}
                                value={indicadoPorParceiroId}
                                onChange={(parceiroId) => {
                                    setIndicadoPorParceiroId(parceiroId);
                                    if (parceiroId) setParceiroNaoCadastrado(false);
                                }}
                                disabled={parceiroNaoCadastrado}
                                carregando={carregandoParceirosLista}
                            />

                            <button
                                type="button"
                                aria-pressed={parceiroNaoCadastrado}
                                aria-label={parceiroNaoCadastrado
                                    ? "Cancelar parceiro não cadastrado e voltar para a lista de parceiros"
                                    : "Informar um parceiro ainda não cadastrado"}
                                onClick={alternarParceiroNaoCadastrado}
                                className={`w-full min-h-12 px-3 py-2.5 rounded-xl border text-left transition-all flex items-center gap-3 ${
                                    parceiroNaoCadastrado
                                        ? "border-amber-400/70 bg-amber-500/20 text-amber-100 shadow-[0_0_24px_rgba(245,158,11,0.16)]"
                                        : "border-amber-500/35 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15 hover:border-amber-400/60"
                                }`}
                            >
                                <AlertTriangle size={17} className="shrink-0" />
                                <span className="flex-1">
                                    <span className="block text-[11px] font-black uppercase tracking-wider">Outro parceiro / Não cadastrado</span>
                                    <span className="block text-[9px] mt-0.5 opacity-80">
                                        {parceiroNaoCadastrado
                                            ? "Selecionado · clique novamente para cancelar"
                                            : "Gera uma pendência destacada no módulo de Parceiros"}
                                    </span>
                                </span>
                                {parceiroNaoCadastrado && (
                                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-300 text-amber-950">
                                        <X size={15} strokeWidth={2.5} />
                                    </span>
                                )}
                            </button>

                            {parceiroNaoCadastrado && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/20">
                                    <div
                                        role="status"
                                        className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-amber-300/45 bg-amber-400/15 px-3 py-3 shadow-[0_8px_24px_rgba(245,158,11,0.12)]"
                                    >
                                        <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-300" />
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-wider text-amber-100">
                                                Parceiro não cadastrado ativo
                                            </p>
                                            <p className="mt-1 text-[10px] font-semibold leading-relaxed text-amber-100/75">
                                                Para cancelar e voltar à lista de parceiros cadastrados, clique novamente em
                                                <span className="font-black text-amber-100"> Outro parceiro / Não cadastrado</span> acima.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className={labelCls}>Nome do parceiro *</label>
                                        <input
                                            value={parceiroPendenteNome}
                                            onChange={(e) => setParceiroPendenteNome(e.target.value)}
                                            maxLength={120}
                                            placeholder="Nome da pessoa que indicou"
                                            className={inputCls}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Empresa</label>
                                        <input
                                            value={parceiroPendenteEmpresa}
                                            onChange={(e) => setParceiroPendenteEmpresa(e.target.value)}
                                            maxLength={160}
                                            placeholder="Empresa (opcional)"
                                            className={inputCls}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Telefone</label>
                                        <input
                                            value={parceiroPendenteTelefone}
                                            onChange={(e) => setParceiroPendenteTelefone(e.target.value)}
                                            maxLength={40}
                                            inputMode="tel"
                                            placeholder="(00) 00000-0000"
                                            className={inputCls}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Confirmação visual dos dados do parceiro selecionado — gaveta, só leitura */}
                            {!parceiroNaoCadastrado && indicadoPorParceiroId && (
                                <div className="mt-2 rounded-xl overflow-hidden" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
                                    <button
                                        type="button"
                                        onClick={() => setParceiroDetalheAberto(v => !v)}
                                        disabled={!parceiroDetalhe}
                                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left disabled:opacity-60"
                                    >
                                        {carregandoParceiroDetalhe ? (
                                            <Loader2 size={14} className="animate-spin text-slate-400 shrink-0" />
                                        ) : (
                                            <Users size={14} className="text-slate-400 shrink-0" />
                                        )}
                                        <span className="flex-1 min-w-0 text-[11px] font-bold text-slate-300 truncate">
                                            {carregandoParceiroDetalhe ? "Carregando dados do parceiro..." : (parceiroDetalhe?.nome ?? "Parceiro")}
                                        </span>
                                        {parceiroDetalhe && (
                                            <ChevronDown size={14} className={`shrink-0 text-slate-500 transition-transform ${parceiroDetalheAberto ? "rotate-180" : ""}`} />
                                        )}
                                    </button>

                                    {parceiroDetalheAberto && parceiroDetalhe && (
                                        <div className="px-3 pb-3 pt-2 border-t grid grid-cols-2 gap-x-4 gap-y-2.5 text-[11px]" style={{ borderColor: "rgba(99,102,241,0.15)" }}>
                                            <div>
                                                <p className="text-[8.5px] text-slate-600 uppercase tracking-widest font-bold">{parceiroDetalhe.tipo === "PJ" ? "CNPJ" : "CPF"}</p>
                                                <p className="font-mono font-bold text-slate-200">{parceiroDetalhe.documento}</p>
                                            </div>
                                            <div>
                                                <p className="text-[8.5px] text-slate-600 uppercase tracking-widest font-bold">Nível</p>
                                                <p className="font-bold text-slate-200">{parceiroDetalhe.nivel}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-[8.5px] text-slate-600 uppercase tracking-widest font-bold">E-mail</p>
                                                <p className="font-bold text-slate-200">{parceiroDetalhe.email}</p>
                                            </div>
                                            {(parceiroDetalhe.telefone || parceiroDetalhe.telefone2) && (
                                                <div className="col-span-2">
                                                    <p className="text-[8.5px] text-slate-600 uppercase tracking-widest font-bold">Telefone</p>
                                                    <p className="font-bold text-slate-200">{[parceiroDetalhe.telefone, parceiroDetalhe.telefone2].filter(Boolean).join(" · ")}</p>
                                                </div>
                                            )}
                                            {parceiroDetalhe.endereco && (
                                                <div className="col-span-2">
                                                    <p className="text-[8.5px] text-slate-600 uppercase tracking-widest font-bold">Endereço</p>
                                                    <p className="font-bold text-slate-200">
                                                        {parceiroDetalhe.endereco.logradouro}{parceiroDetalhe.endereco.numero ? `, ${parceiroDetalhe.endereco.numero}` : ""} — {parceiroDetalhe.endereco.bairro}, {parceiroDetalhe.endereco.cidade}/{parceiroDetalhe.endereco.uf}
                                                    </p>
                                                </div>
                                            )}
                                            {parceiroDetalhe.representantes.length > 0 && (
                                                <div className="col-span-2">
                                                    <p className="text-[8.5px] text-slate-600 uppercase tracking-widest font-bold mb-1">
                                                        Representantes ({parceiroDetalhe.representantes.length})
                                                    </p>
                                                    <div className="space-y-1.5">
                                                        {parceiroDetalhe.representantes.map((r, i) => (
                                                            <div key={i} className="rounded-lg px-2.5 py-1.5" style={{ background: "rgba(99,102,241,0.06)" }}>
                                                                <p className="font-bold text-slate-200">{r.nome}{r.cargo ? ` · ${r.cargo}` : ""}</p>
                                                                <p className="text-slate-500 font-mono">{r.documento}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Botões */}
                <div className="flex gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onCancelar}
                        className="flex-1 h-12 rounded-2xl bg-white/5 border border-white/5 text-slate-400 font-black text-[9px] uppercase tracking-widest hover:bg-white/10 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleSalvar}
                        disabled={salvando}
                        className="flex-1 h-12 rounded-2xl bg-blue-600 text-white font-black text-[9px] uppercase tracking-widest hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {salvando ? (
                            <Loader2 size={13} className="animate-spin" />
                        ) : isEdicao ? (
                            <><Check size={13} /> Salvar Alterações</>
                        ) : (
                            <><FileText size={13} /> Contrato Enviado</>
                        )}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

// ─── Modal de Observação ─────────────────────────────────────────────────────

const TIPO_CONFIG = {
    POSITIVO: { icon: ThumbsUp,   label: "Positivo", cls: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20" },
    NEGATIVO: { icon: ThumbsDown, label: "Negativo", cls: "text-red-400    border-red-500/30    bg-red-500/10    hover:bg-red-500/20"    },
    NA:       { icon: FileText,   label: "N/A",      cls: "text-slate-400  border-white/10      bg-white/5       hover:bg-white/10"      },
} as const;

function ModalObservacao({
    contrato,
    onFechar,
    onSalvo,
}: {
    contrato: Contrato;
    onFechar: () => void;
    onSalvo: (novaObs: ObservacaoContrato) => void;
}) {
    const [tipo, setTipo] = useState<"POSITIVO" | "NEGATIVO" | "NA">("NA");
    const [texto, setTexto] = useState("");
    const [salvando, setSalvando] = useState(false);
    const [mostraForm, setMostraForm] = useState(!(contrato.observacoes?.length));

    const obs = contrato.observacoes ?? [];

    const handleSalvar = async () => {
        if (!texto.trim()) { toast.error("Escreva a observação"); return; }
        setSalvando(true);
        try {
            const res = await criarObservacaoContrato(contrato.id, texto, tipo);
            if (!res.success) { toast.error(res.error); return; }
            toast.success("Observação salva!");
            onSalvo(res.obs as ObservacaoContrato);
            setTexto("");
            setTipo("NA");
            setMostraForm(false);
        } finally {
            setSalvando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onFechar} />
            <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                className="relative z-10 w-full max-w-md bg-[#070e1c] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                    <div>
                        <h3 className="font-black text-white uppercase italic text-sm leading-none">Observações</h3>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5 truncate max-w-[260px]">
                            {contrato.razaoSocial}
                        </p>
                    </div>
                    <button onClick={onFechar} className="p-1.5 rounded-xl hover:bg-white/5 text-slate-500 hover:text-white transition-colors">
                        <X size={15} />
                    </button>
                </div>

                <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Obs existentes */}
                    {obs.length > 0 && (
                        <div className="space-y-2">
                            {obs.map((o) => {
                                const cfg = TIPO_CONFIG[o.tipo as keyof typeof TIPO_CONFIG] ?? TIPO_CONFIG.NA;
                                const Icon = cfg.icon;
                                return (
                                    <div key={o.id} className="p-3 rounded-2xl bg-white/[0.03] border border-white/5">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase ${cfg.cls}`}>
                                                <Icon size={10} /> {cfg.label}
                                            </span>
                                            <span className="text-[9px] text-slate-600 ml-auto">
                                                {new Date(o.criadoEm).toLocaleDateString("pt-BR")}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-300 leading-relaxed">{o.texto}</p>
                                    </div>
                                );
                            })}

                            {!mostraForm && (
                                <button
                                    onClick={() => setMostraForm(true)}
                                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl border border-dashed border-white/10 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white hover:border-white/20 transition-colors"
                                >
                                    <Plus size={11} /> Adicionar outra observação
                                </button>
                            )}
                        </div>
                    )}

                    {/* Formulário de nova obs */}
                    <AnimatePresence>
                        {mostraForm && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-3 overflow-hidden"
                            >
                                {/* Tipo */}
                                <div className="flex gap-2">
                                    {(Object.entries(TIPO_CONFIG) as [keyof typeof TIPO_CONFIG, typeof TIPO_CONFIG[keyof typeof TIPO_CONFIG]][]).map(([key, cfg]) => {
                                        const Icon = cfg.icon;
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => setTipo(key)}
                                                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                                                    tipo === key
                                                        ? cfg.cls + " ring-1 ring-inset ring-current"
                                                        : "border-white/5 bg-white/[0.02] text-slate-600 hover:text-slate-400"
                                                }`}
                                            >
                                                <Icon size={12} /> {cfg.label}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Texto */}
                                <textarea
                                    rows={4}
                                    value={texto}
                                    onChange={(e) => setTexto(e.target.value)}
                                    placeholder="Descreva a observação..."
                                    className="w-full bg-slate-950/80 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-700 focus:border-blue-500/50 focus:outline-none transition-colors resize-none"
                                />

                                <div className="flex gap-2">
                                    {obs.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => { setMostraForm(false); setTexto(""); }}
                                            className="flex-1 h-10 rounded-xl bg-white/5 border border-white/5 text-slate-400 font-black text-[9px] uppercase tracking-widest hover:bg-white/10 transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleSalvar}
                                        disabled={salvando || !texto.trim()}
                                        className="flex-1 h-10 rounded-xl bg-blue-600 text-white font-black text-[9px] uppercase tracking-widest hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
                                    >
                                        {salvando ? <Loader2 size={13} className="animate-spin" /> : <><Check size={12} /> Salvar</>}
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}

// ─── Tabela de Contratos Enviados ─────────────────────────────────────────────

function TabelaEnviados({
    contratos,
    showCloser,
    canDelete,
    onConfirmar,
    onExcluir,
    onEditar,
    onObsAtualizada,
    onRecarregar,
}: {
    contratos: Contrato[];
    showCloser: boolean;
    canDelete: boolean;
    onConfirmar: (c: Contrato) => void;
    onExcluir: (c: Contrato) => void;
    onEditar: (c: Contrato) => void;
    onObsAtualizada: (contratoId: string, obs: ObservacaoContrato) => void;
    onRecarregar: () => void;
}) {
    const agora = new Date();
    const thCls = "px-3 py-3 text-[8px] font-black uppercase tracking-widest text-slate-600 whitespace-nowrap";
    const [obsAberto, setObsAberto] = useState<string | null>(null);
    const [expandido, setExpandido] = useState<string | null>(null);
    const [arquivando, setArquivando] = useState<string | null>(null);

    const handleArquivar = async (c: Contrato) => {
        setArquivando(c.id);
        try {
            const res = await arquivarContrato(c.id);
            if (res.success) { toast.success("Arquivado!"); onRecarregar(); }
            else toast.error(res.error);
        } finally {
            setArquivando(null);
        }
    };

    const contratoObsAberto = obsAberto ? contratos.find((c) => c.id === obsAberto) : null;

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Contratos Enviados
                    <span className="ml-2 text-blue-400">({contratos.length})</span>
                </h4>
            </div>

            <div className="rounded-2xl border border-white/5 overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-900/60 border-b border-white/5">
                            <th className="px-2 py-3 w-6" />
                            <th className={thCls}>Data Enviado</th>
                            {showCloser && <th className={thCls}>Closer</th>}
                            <th className={thCls}>CNPJ</th>
                            <th className={thCls}>Razão Social</th>
                            <th className={thCls}>Nome Fantasia</th>
                            <th className={thCls}>Valor</th>
                            <th className={thCls}>Serviço</th>
                            <th className={`${thCls} text-right`}>Fechar</th>
                            <th className={`${thCls} text-right`}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {contratos.length === 0 ? (
                            <tr>
                                <td colSpan={(showCloser ? 1 : 0) + 9} className="px-4 py-8 text-center text-[9px] font-black uppercase tracking-widest text-slate-700">
                                    Nenhum contrato enviado
                                </td>
                            </tr>
                        ) : (
                            contratos.map((c) => {
                                const atrasado = agora.getTime() - new Date(c.createdAt).getTime() > 24 * 60 * 60 * 1000;
                                const obsCount = c.observacoes?.length ?? 0;
                                const isExpanded = expandido === c.id;
                                return (
                                    <>
                                        <tr key={c.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                            {/* Seta de expansão */}
                                            <td className="px-2 py-3">
                                                {obsCount > 0 && (
                                                    <button onClick={() => setExpandido(isExpanded ? null : c.id)} className="p-1 rounded-lg text-slate-600 hover:text-slate-300 transition-colors">
                                                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-3 py-3 text-[10px] text-slate-500 whitespace-nowrap">
                                                {fmtDate(c.createdAt)}
                                            </td>
                                            {showCloser && (
                                                <td className="px-3 py-3 text-[10px] font-bold text-slate-300 whitespace-nowrap">{c.closerNome}</td>
                                            )}
                                            <td className="px-3 py-3 text-[10px] font-mono text-slate-400 whitespace-nowrap">
                                                {formatCNPJ(c.cnpj)}
                                            </td>
                                            <td className="px-3 py-3 max-w-[200px]">
                                                <button type="button" onClick={() => onEditar(c)} title="Editar lead"
                                                    className={`flex items-center gap-1.5 text-[11px] font-black truncate hover:underline group ${atrasado ? "text-red-500" : "text-white"}`}
                                                >
                                                    {c.razaoSocial}
                                                    <Pencil size={10} className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
                                                </button>
                                            </td>
                                            <td className="px-3 py-3 text-[10px] text-slate-500 max-w-[160px] truncate">
                                                {c.nomeFantasia || <span className="text-slate-700">—</span>}
                                            </td>
                                            <td className="px-3 py-3 text-[11px] font-black text-emerald-400 whitespace-nowrap">
                                                {formatBRL(c.valorContrato)}
                                            </td>
                                            <td className="px-3 py-3 text-[10px] text-slate-500 max-w-[150px] truncate">{c.servico}</td>
                                            <td className="px-3 py-3 text-right">
                                                <button
                                                    onClick={() => onConfirmar(c)}
                                                    className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-colors animate-pulse hover:animate-none flex items-center gap-1.5 ml-auto whitespace-nowrap"
                                                >
                                                    <Check size={11} /> Confirmar Fechamento
                                                </button>
                                            </td>
                                            {/* Ações: obs + arquivar + excluir */}
                                            <td className="px-3 py-3 text-right">
                                                <div className="flex items-center gap-1 justify-end">
                                                    <button
                                                        onClick={() => setObsAberto(c.id)}
                                                        title="Observações"
                                                        className="relative p-1.5 rounded-lg text-slate-600 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                                                    >
                                                        <MessageSquare size={13} />
                                                        {obsCount > 0 && (
                                                            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-blue-500 text-[8px] font-black flex items-center justify-center text-white">
                                                                {obsCount}
                                                            </span>
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => handleArquivar(c)}
                                                        disabled={arquivando === c.id}
                                                        title="Arquivar"
                                                        className="p-1.5 rounded-lg text-slate-600 hover:text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-40"
                                                    >
                                                        {arquivando === c.id ? <Loader2 size={13} className="animate-spin" /> : <Archive size={13} />}
                                                    </button>
                                                    {canDelete && (
                                                        <button onClick={() => onExcluir(c)} className="p-1.5 rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Excluir">
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {/* Linha expandida com observações */}
                                        {isExpanded && obsCount > 0 && (
                                            <tr key={`${c.id}-obs`} className="bg-white/[0.01]">
                                                <td colSpan={(showCloser ? 1 : 0) + 9 + 1} className="px-6 py-3">
                                                    <div className="space-y-2">
                                                        {c.observacoes?.map((o) => {
                                                            const cfg = TIPO_CONFIG[o.tipo as keyof typeof TIPO_CONFIG] ?? TIPO_CONFIG.NA;
                                                            const Icon = cfg.icon;
                                                            return (
                                                                <div key={o.id} className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                                                                    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[8px] font-black uppercase mt-0.5 ${cfg.cls}`}>
                                                                        <Icon size={9} />
                                                                    </span>
                                                                    <p className="text-[11px] text-slate-300 flex-1">{o.texto}</p>
                                                                    <span className="text-[9px] text-slate-600 shrink-0">{new Date(o.criadoEm).toLocaleDateString("pt-BR")}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal de observação */}
            <AnimatePresence>
                {contratoObsAberto && (
                    <ModalObservacao
                        contrato={contratoObsAberto}
                        onFechar={() => setObsAberto(null)}
                        onSalvo={(novaObs) => {
                            onObsAtualizada(contratoObsAberto.id, novaObs);
                            setObsAberto(null);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── Upload Contrato Button ────────────────────────────────────────────────────

function UploadContratoBtn({ contratoId, onRecarregar }: { contratoId: string; onRecarregar: () => void }) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const handleUpload = async (file: File) => {
        if (file.type !== "application/pdf") { toast.error("Apenas PDF"); return; }
        if (file.size > 10 * 1024 * 1024) { toast.error("Arquivo excede 10MB"); return; }
        setUploading(true);
        try {
            const res = await fetch(`/api/contratos/upload?filename=${encodeURIComponent(file.name)}`, {
                method: "POST", body: file, headers: { "content-length": String(file.size) },
            });
            const data = await res.json() as { url?: string; error?: string };
            if (!res.ok || !data.url) { toast.error(data.error ?? "Erro ao fazer upload"); return; }
            const saveRes = await atualizarContratoUrl(contratoId, data.url);
            if (saveRes.success) { toast.success("Contrato enviado!"); onRecarregar(); }
            else toast.error(saveRes.error ?? "Erro ao salvar");
        } catch { toast.error("Erro ao enviar"); }
        finally { setUploading(false); }
    };

    return (
        <>
            <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) void handleUpload(f); e.target.value = ""; }} />
            <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                title="Enviar contrato assinado (PDF)"
                className="relative inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/15 border border-red-500/40 text-red-400 text-[8px] font-black uppercase tracking-wider hover:bg-red-500/25 transition-colors disabled:opacity-50"
            >
                {uploading ? (
                    <Loader2 size={10} className="animate-spin" />
                ) : (
                    <>
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500" />
                        <Upload size={10} />
                        Doc
                    </>
                )}
            </button>
        </>
    );
}

// ─── Tabela de Contratos Fechados ─────────────────────────────────────────────

function TabelaFechados({
    contratos,
    showCloser,
    canDelete,
    onExcluir,
    onRecarregar,
    onEditar,
}: {
    contratos: Contrato[];
    showCloser: boolean;
    canDelete: boolean;
    onExcluir: (c: Contrato) => void;
    onRecarregar: () => void;
    onEditar: (c: Contrato) => void;
}) {
    const thCls = "px-3 py-3 text-[8px] font-black uppercase tracking-widest text-slate-600 whitespace-nowrap";
    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Contratos Fechados
                    <span className="ml-2 text-emerald-400">({contratos.length})</span>
                </h4>
            </div>

            <div className="rounded-2xl border border-white/5 overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-900/60 border-b border-white/5">
                            {showCloser && <th className={thCls}>Closer</th>}
                            <th className={thCls}>Data</th>
                            <th className={thCls}>CNPJ</th>
                            <th className={thCls}>Razão Social</th>
                            <th className={thCls}>Nome Fantasia</th>
                            <th className={thCls}>Valor</th>
                            <th className={thCls}>Serviço</th>
                            <th className={`${thCls} text-right`}>Contrato</th>
                            {canDelete && <th className={thCls} />}
                        </tr>
                    </thead>
                    <tbody>
                        {contratos.length === 0 ? (
                            <tr>
                                <td colSpan={(showCloser ? 1 : 0) + (canDelete ? 1 : 0) + 7} className="px-4 py-8 text-center text-[9px] font-black uppercase tracking-widest text-slate-700">
                                    Nenhum contrato fechado
                                </td>
                            </tr>
                        ) : (
                            contratos.map((c) => (
                                <tr key={c.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                    {showCloser && <td className="px-3 py-3 text-[10px] font-bold text-slate-300 whitespace-nowrap">{c.closerNome}</td>}
                                    <td className="px-3 py-3 text-[10px] text-slate-500 whitespace-nowrap">
                                        {c.pagamentoConfirmadoEm ? fmtDate(c.pagamentoConfirmadoEm) : "—"}
                                    </td>
                                    <td className="px-3 py-3 text-[10px] font-mono text-slate-400 whitespace-nowrap">{formatCNPJ(c.cnpj)}</td>
                                    <td className="px-3 py-3 max-w-[200px]">
                                        <button type="button" onClick={() => onEditar(c)} className="flex items-center gap-1.5 text-[11px] font-black text-white truncate hover:underline group">
                                            {c.razaoSocial}
                                            <Pencil size={10} className="shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
                                        </button>
                                    </td>
                                    <td className="px-3 py-3 text-[10px] text-slate-500 max-w-[160px] truncate">
                                        {c.nomeFantasia || <span className="text-slate-700">—</span>}
                                    </td>
                                    <td className="px-3 py-3 text-[11px] font-black text-emerald-400 whitespace-nowrap">{formatBRL(c.valorContrato)}</td>
                                    <td className="px-3 py-3 text-[10px] text-slate-500 max-w-[150px] truncate">{c.servico}</td>
                                    <td className="px-3 py-3 text-right">
                                        {c.contratoUrl ? (
                                            <a href={c.contratoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 p-2 rounded-xl hover:bg-white/5 text-slate-500 hover:text-blue-400 transition-colors">
                                                <Eye size={14} />
                                            </a>
                                        ) : (
                                            <UploadContratoBtn contratoId={c.id} onRecarregar={onRecarregar} />
                                        )}
                                    </td>
                                    {canDelete && (
                                        <td className="px-3 py-3 text-right">
                                            <button onClick={() => onExcluir(c)} className="p-1.5 rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Excluir">
                                                <Trash2 size={13} />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Tabela de Contratos Arquivados ───────────────────────────────────────────

function TabelaArquivados({
    contratos,
    showCloser,
    onRecarregar,
}: {
    contratos: Contrato[];
    showCloser: boolean;
    onRecarregar: () => void;
}) {
    const [restaurando, setRestaurando] = useState<string | null>(null);

    const handleRestaurar = async (id: string) => {
        setRestaurando(id);
        try {
            const res = await restaurarContrato(id);
            if (res.success) { toast.success("Restaurado!"); onRecarregar(); }
            else toast.error(res.error);
        } finally {
            setRestaurando(null);
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-500/60" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    Contratos Arquivados
                    <span className="ml-2 text-amber-500/70">({contratos.length})</span>
                </h4>
            </div>

            {contratos.length === 0 ? (
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-700 py-4 text-center">
                    Nenhum contrato arquivado
                </p>
            ) : (
                <div className="rounded-2xl border border-white/5 overflow-x-auto opacity-80">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-900/60 border-b border-white/5">
                                {showCloser && <th className="px-3 py-3 text-[8px] font-black uppercase tracking-widest text-slate-600">Closer</th>}
                                <th className="px-3 py-3 text-[8px] font-black uppercase tracking-widest text-slate-600">Data</th>
                                <th className="px-3 py-3 text-[8px] font-black uppercase tracking-widest text-slate-600">Razão Social</th>
                                <th className="px-3 py-3 text-[8px] font-black uppercase tracking-widest text-slate-600">Valor</th>
                                <th className="px-3 py-3 text-[8px] font-black uppercase tracking-widest text-slate-600 text-right">Restaurar</th>
                            </tr>
                        </thead>
                        <tbody>
                            {contratos.map((c) => (
                                <tr key={c.id} className="border-b border-white/[0.03]">
                                    {showCloser && <td className="px-3 py-3 text-[10px] text-slate-500">{c.closerNome}</td>}
                                    <td className="px-3 py-3 text-[10px] text-slate-600 whitespace-nowrap">
                                        {c.pagamentoConfirmadoEm ? fmtDate(c.pagamentoConfirmadoEm) : "—"}
                                    </td>
                                    <td className="px-3 py-3 text-[10px] text-slate-500 max-w-[220px] truncate">{c.razaoSocial}</td>
                                    <td className="px-3 py-3 text-[10px] text-slate-500 whitespace-nowrap">{formatBRL(c.valorContrato)}</td>
                                    <td className="px-3 py-3 text-right">
                                        <button
                                            onClick={() => handleRestaurar(c.id)}
                                            disabled={restaurando === c.id}
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-black uppercase tracking-widest hover:bg-amber-500/20 transition-colors disabled:opacity-40"
                                        >
                                            {restaurando === c.id ? <Loader2 size={10} className="animate-spin" /> : <ArchiveRestore size={10} />}
                                            Restaurar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ─── Modal Principal ──────────────────────────────────────────────────────────

export default function ModalGerenciamentoLeads({ role, nomeUsuario, onFechar, onDadosAlterados, onVendaFechada }: Props) {
    const agora = new Date();
    const [mes, setMes] = useState(agora.getMonth() + 1);
    const [ano, setAno] = useState(agora.getFullYear());
    const [mostraForm, setMostraForm] = useState(false);
    const [painelGlobal, setPainelGlobal] = useState(false);
    const [abaEnviados, setAbaEnviados] = useState<"enviados" | "arquivados">("enviados");
    const [filtroColaboradorId, setFiltroColaboradorId] = useState<number | undefined>(undefined);

    const [enviados, setEnviados] = useState<Contrato[]>([]);
    const [fechados, setFechados] = useState<Contrato[]>([]);
    const [arquivados, setArquivados] = useState<Contrato[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [colaboradores, setColaboradores] = useState<UsuarioSimples[]>([]);
    const [servicos, setServicos] = useState<string[]>([]);
    const [prospeccoesAtivas, setProspeccoesAtivas] = useState<string[]>([]);
    const [contratoParaFechar, setContratoParaFechar] = useState<Contrato | null>(null);
    const [contratoParaExcluir, setContratoParaExcluir] = useState<Contrato | null>(null);
    const [modoEdicao, setModoEdicao] = useState<Contrato | null>(null);
    const [excluindo, setExcluindo] = useState(false);

    const isAdmin = isAdminOrCeo(role);
    const podeGlobal = podeVerGlobal(role);

    const carregarContratos = useCallback(async () => {
        setCarregando(true);
        try {
            const res = await getContratos({
                mes,
                ano,
                adminView: podeGlobal && painelGlobal,
                filtroUsuarioId: filtroColaboradorId,
            });
            if (res.success) {
                setEnviados(res.enviados as unknown as Contrato[]);
                setFechados(res.fechados as unknown as Contrato[]);
                setArquivados((res.arquivados ?? []) as unknown as Contrato[]);
            }
        } finally {
            setCarregando(false);
        }
    }, [mes, ano, podeGlobal, painelGlobal, filtroColaboradorId]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void carregarContratos();
    }, [carregarContratos]);

    useEffect(() => {
        getColaboradoresComerciais().then((res) => {
            if (res.success) setColaboradores(res.usuarios as unknown as UsuarioSimples[]);
        });
        getServicosComerciais().then((res) => {
            const fromDb = res.success ? res.servicos.map((s) => s.nome) : [];
            const merged = [...new Set([...SERVICOS_COMERCIAIS_PADRAO, ...fromDb])];
            setServicos(merged);
        });
        getProspeccoesAtivas().then((res) => {
            if (res.success) setProspeccoesAtivas(res.prospeccoes);
        });
    }, []);

    const handleServicoNovo = async (nome: string) => {
        const res = await criarServicoComercial(nome);
        if (res.success) {
            setServicos((prev) => [...prev, nome].sort());
            toast.success("Serviço adicionado!");
        } else {
            toast.error(res.error);
        }
    };

    const handleProspeccaoSalva = (nome: string) => {
        setProspeccoesAtivas((atuais) => normalizarCatalogoProspeccoes([...atuais, nome]));
    };

    const handleExcluirConfirmado = async () => {
        if (!contratoParaExcluir) return;
        setExcluindo(true);
        try {
            const res = await excluirContrato(contratoParaExcluir.id);
            if (!res.success) { toast.error(res.error); return; }
            toast.success("Contrato excluído");
            setContratoParaExcluir(null);
            void carregarContratos();
            onDadosAlterados?.();
        } catch {
            toast.error("Erro ao excluir");
        } finally {
            setExcluindo(false);
        }
    };

    const navegarMes = (delta: number) => {
        let novoMes = mes + delta;
        let novoAno = ano;
        if (novoMes > 12) { novoMes = 1; novoAno++; }
        if (novoMes < 1) { novoMes = 12; novoAno--; }
        setMes(novoMes);
        setAno(novoAno);
        setMostraForm(false);
        setModoEdicao(null);
    };

    const totalFechado = fechados.reduce((acc, c) => acc + c.valorContrato, 0);

    const handleObsAtualizada = (contratoId: string, novaObs: ObservacaoContrato) => {
        setEnviados((prev) =>
            prev.map((c) =>
                c.id === contratoId
                    ? { ...c, observacoes: [novaObs, ...(c.observacoes ?? [])] }
                    : c
            )
        );
    };

    return (
        <>
            <AnimatePresence>
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/85 backdrop-blur-md"
                        onClick={onFechar}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.97, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: 12 }}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        className="relative z-10 w-full max-w-[96vw] max-h-[92vh] bg-[#060d1c] border border-white/10 rounded-3xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden"
                    >
                        {/* ── Header ── */}
                        <div className="shrink-0 border-b border-white/5 bg-[#060d1c]/95 backdrop-blur-xl">
                            {/* Top bar */}
                            <div className="flex items-center justify-between gap-4 px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-blue-600/10 border border-blue-500/20">
                                        <BarChart3 size={18} className="text-blue-400" />
                                    </div>
                                    <div>
                                        <h2 className="font-black uppercase italic tracking-tight text-white text-lg leading-none">
                                            Gestão Comercial
                                        </h2>
                                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-0.5">
                                            Contratos · {MESES[mes - 1]} {ano}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Painel Global — admin/ceo/financeiro */}
                                    {podeGlobal && (
                                        <button
                                            onClick={() => { setPainelGlobal((v) => !v); setFiltroColaboradorId(undefined); }}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors ${
                                                painelGlobal
                                                    ? "bg-violet-600/20 border border-violet-500/30 text-violet-400"
                                                    : "bg-white/5 border border-white/5 text-slate-500 hover:text-white"
                                            }`}
                                        >
                                            <Users size={13} />
                                            <span className="hidden sm:block">
                                                {painelGlobal ? "Global" : "Painel Global"}
                                            </span>
                                        </button>
                                    )}
                                    <button
                                        onClick={onFechar}
                                        className="p-2 rounded-xl bg-white/5 border border-white/5 text-slate-500 hover:text-white transition-colors"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Sub-header: Navegação de mês + botão Novo Cliente */}
                            <div className="flex items-center justify-between gap-4 px-6 pb-4">
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => navegarMes(-1)}
                                        className="p-2 rounded-xl hover:bg-white/5 text-slate-500 hover:text-white transition-colors"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="text-sm font-black text-white uppercase tracking-tight px-2 min-w-[130px] text-center">
                                        {MESES[mes - 1]} {ano}
                                    </span>
                                    <button
                                        onClick={() => navegarMes(1)}
                                        className="p-2 rounded-xl hover:bg-white/5 text-slate-500 hover:text-white transition-colors"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>

                                <div className="flex items-center gap-3">
                                    {/* Filtro por colaborador — admin/global */}
                                    {podeGlobal && painelGlobal && (
                                        <select
                                            value={filtroColaboradorId ?? ""}
                                            onChange={(e) =>
                                                setFiltroColaboradorId(e.target.value ? Number(e.target.value) : undefined)
                                            }
                                            className="h-9 bg-slate-900/60 border border-white/10 rounded-xl px-3 text-[10px] text-slate-300 font-black focus:outline-none focus:border-blue-500/50 transition-colors"
                                        >
                                            <option value="">Todos os colaboradores</option>
                                            {colaboradores.map((c) => (
                                                <option key={c.id} value={c.id}>{c.nome}</option>
                                            ))}
                                        </select>
                                    )}

                                    {/* Métricas rápidas */}
                                    {fechados.length > 0 && (
                                        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                            <span className="text-[9px] font-black uppercase text-emerald-400">
                                                {formatBRL(totalFechado)} fechado
                                            </span>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => { setMostraForm((v) => !v); setModoEdicao(null); }}
                                        className="flex items-center gap-2 h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black uppercase tracking-widest transition-colors"
                                    >
                                        {(mostraForm && !modoEdicao) ? <Minus size={13} /> : <Plus size={13} />}
                                        <span className="hidden sm:block">Novo Cliente</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ── Body ── */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {/* Formulário */}
                            <AnimatePresence>
                                {(mostraForm || modoEdicao) && (
                                    <FormNovoContrato
                                        mes={mes}
                                        ano={ano}
                                        colaboradores={colaboradores}
                                        servicos={servicos}
                                        prospeccoesAtivas={prospeccoesAtivas}
                                        nomeUsuario={nomeUsuario}
                                        initialData={modoEdicao ?? undefined}
                                        editandoId={modoEdicao?.id}
                                        onServicoNovo={handleServicoNovo}
                                        onProspeccaoSalva={handleProspeccaoSalva}
                                        onSalvo={() => {
                                            setMostraForm(false);
                                            setModoEdicao(null);
                                            void carregarContratos();
                                            onDadosAlterados?.();
                                        }}
                                        onCancelar={() => { setMostraForm(false); setModoEdicao(null); }}
                                    />
                                )}
                            </AnimatePresence>

                            {/* Tabelas */}
                            <div className="p-6 space-y-6">
                                {carregando ? (
                                    <div className="flex items-center justify-center py-16 gap-3 text-slate-600">
                                        <Loader2 size={20} className="animate-spin" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Carregando contratos...</span>
                                    </div>
                                ) : (
                                    <>
                                        {/* Tabs Enviados / Arquivados */}
                                        <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/[0.03] border border-white/5 w-fit">
                                            <button
                                                onClick={() => setAbaEnviados("enviados")}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                                                    abaEnviados === "enviados"
                                                        ? "bg-blue-600/20 border border-blue-500/30 text-blue-400"
                                                        : "text-slate-500 hover:text-slate-300"
                                                }`}
                                            >
                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                                Enviados
                                                <span className="ml-0.5 opacity-70">({enviados.length})</span>
                                            </button>
                                            <button
                                                onClick={() => setAbaEnviados("arquivados")}
                                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                                                    abaEnviados === "arquivados"
                                                        ? "bg-amber-500/20 border border-amber-500/30 text-amber-400"
                                                        : "text-slate-500 hover:text-slate-300"
                                                }`}
                                            >
                                                <Archive size={11} />
                                                Arquivados
                                                <span className="ml-0.5 opacity-70">({arquivados.length})</span>
                                            </button>
                                        </div>

                                        {abaEnviados === "enviados" ? (
                                            <TabelaEnviados
                                                contratos={enviados}
                                                showCloser={podeGlobal && painelGlobal}
                                                canDelete={isAdmin}
                                                onConfirmar={setContratoParaFechar}
                                                onExcluir={setContratoParaExcluir}
                                                onEditar={(c) => { setModoEdicao(c); setMostraForm(false); }}
                                                onObsAtualizada={handleObsAtualizada}
                                                onRecarregar={carregarContratos}
                                            />
                                        ) : (
                                            <TabelaArquivados
                                                contratos={arquivados}
                                                showCloser={podeGlobal && painelGlobal}
                                                onRecarregar={() => { void carregarContratos(); setAbaEnviados("enviados"); }}
                                            />
                                        )}

                                        <TabelaFechados
                                            contratos={fechados}
                                            showCloser={podeGlobal && painelGlobal}
                                            canDelete={isAdmin}
                                            onExcluir={setContratoParaExcluir}
                                            onRecarregar={carregarContratos}
                                            onEditar={(c) => { setModoEdicao(c); setMostraForm(false); }}
                                        />
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Glow de fundo */}
                        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
                            <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-blue-700/4 blur-[120px] rounded-full" />
                            <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-indigo-800/4 blur-[100px] rounded-full" />
                        </div>
                    </motion.div>
                </div>
            </AnimatePresence>

            {/* Modal de confirmação */}
            {contratoParaFechar && (
                <ModalConfirmacaoFechamento
                    contrato={contratoParaFechar}
                    onFechar={() => setContratoParaFechar(null)}
                    onConfirmado={(confirmData) => {
                        const contrato = contratoParaFechar;
                        setContratoParaFechar(null);
                        void carregarContratos();
                        onDadosAlterados?.();
                        if (contrato) {
                            onVendaFechada?.({
                                closerNome: contrato.closerNome,
                                razaoSocial: contrato.razaoSocial,
                                pagamentoConfirmado: confirmData.pagamentoConfirmado,
                                contratoAssinado: confirmData.contratoAssinado,
                            });
                        }
                    }}
                />
            )}

            {/* Modal confirmar exclusão */}
            {contratoParaExcluir && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        onClick={() => !excluindo && setContratoParaExcluir(null)}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="relative z-10 w-full max-w-sm bg-[#080f1e] border border-white/10 rounded-3xl shadow-2xl p-6 space-y-5"
                    >
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 shrink-0">
                                <Trash2 size={18} className="text-red-400" />
                            </div>
                            <div>
                                <h3 className="font-black uppercase italic tracking-tight text-white text-base leading-none">
                                    Excluir Contrato
                                </h3>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1.5">
                                    {contratoParaExcluir.razaoSocial}
                                </p>
                                <p className="text-[9px] text-slate-600 mt-1">
                                    Esta ação remove o contrato do Metas. O cliente no painel CS/NPS permanece.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setContratoParaExcluir(null)}
                                disabled={excluindo}
                                className="flex-1 h-11 rounded-2xl bg-white/5 border border-white/5 text-slate-400 font-black text-[9px] uppercase tracking-widest hover:bg-white/10 transition-colors disabled:opacity-40"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleExcluirConfirmado}
                                disabled={excluindo}
                                className="flex-1 h-11 rounded-2xl bg-red-600 text-white font-black text-[9px] uppercase tracking-widest hover:bg-red-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
                            >
                                {excluindo ? <Loader2 size={13} className="animate-spin" /> : <><Trash2 size={13} /> Excluir</>}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </>
    );
}
