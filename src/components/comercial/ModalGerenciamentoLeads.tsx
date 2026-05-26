"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fmtDate } from "@/lib/format-date";
import { motion, AnimatePresence } from "framer-motion";
import {
    X, ChevronLeft, ChevronRight, Plus, Search, Loader2,
    Eye, Check, BarChart3, Users, FileText, Minus, Trash2, Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
    criarContrato,
    getContratos,
    getColaboradoresComerciais,
    getServicosComerciais,
    criarServicoComercial,
    excluirContrato,
    atualizarContratoUrl,
} from "@/actions/ContratoComercial";
import QuadroSocios, { type Socio } from "./QuadroSocios";
import ModalConfirmacaoFechamento from "./ModalConfirmacaoFechamento";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface UsuarioSimples {
    id: number;
    nome: string;
    imagemUrl: string | null;
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
    closerNome: string;
    status: string;
    pagamentoConfirmado: boolean;
    pagamentoConfirmadoEm: Date | null;
    contratoAssinado: boolean;
    contratoUrl: string | null;
    mes: number;
    ano: number;
    usuarioId: number;
    usuario: { id: number; nome: string; imagemUrl: string | null };
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
    "Tráfego Pago (Meta - Instagram)", "Tráfego Pago (Google)",
    "Indicação Parceiro", "Indicação Cliente", "WhatsApp", "Instagram",
    "Orgânico", "Evento", "Outro",
];

const SERVICOS_PADRAO = [
    "Habilitação RADAR - 50K",
    "Revisão RADAR - 150K",
    "Revisão RADAR - ILIMITADO",
    "TTD 409",
    "Recuperação AFRMM",
    "Outras Recuperações Tributárias",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isAdminOrCeo(role: string) {
    return role === "Admin" || role === "CEO" || role === "Lider Comercial";
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
    nomeUsuario?: string;
    onServicoNovo: (nome: string) => Promise<void>;
    onSalvo: () => void;
    onCancelar: () => void;
}

function FormNovoContrato({
    mes, ano,
    colaboradores, servicos, nomeUsuario, onServicoNovo, onSalvo, onCancelar,
}: FormNovoContratoProps) {
    const [cnpj, setCnpj] = useState("");
    const [consultando, setConsultando] = useState(false);
    const [dadosEmpresa, setDadosEmpresa] = useState({ razaoSocial: "", nomeFantasia: "" });
    const [consultado, setConsultado] = useState(false);

    const [valorContrato, setValorContrato] = useState(0);
    const [formaPagamento, setFormaPagamento] = useState<string>("");
    const [formaPagamentoCustom, setFormaPagamentoCustom] = useState("");
    const [mostraFormaPagCustom, setMostraFormaPagCustom] = useState(false);
    const [servico, setServico] = useState("");
    const [novoServico, setNovoServico] = useState("");
    const [mostraNovo, setMostraNovo] = useState(false);
    const [showServicos, setShowServicos] = useState(false);
    const [showPagamento, setShowPagamento] = useState(false);
    const [showCloser, setShowCloser] = useState(false);
    const [canalAquisicao, setCanalAquisicao] = useState("");
    const [closerNome, setCloserNome] = useState(nomeUsuario ?? "");
    const [closerCustom, setCloserCustom] = useState("");
    const [mostraCloserCustom, setMostraCloserCustom] = useState(false);
    const [socios, setSocios] = useState<Socio[]>([]);
    const [salvando, setSalvando] = useState(false);

    const consultarCNPJ = async () => {
        const cnpjLimpo = cnpj.replace(/\D/g, "");
        if (cnpjLimpo.length !== 14) {
            toast.error("CNPJ inválido");
            return;
        }
        setConsultando(true);
        try {
            const res = await fetch(`/api/ReceitaFederal?cnpj=${cnpjLimpo}`);
            const data = await res.json() as { razaoSocial?: string; nomeFantasia?: string; error?: string };
            if (data.error) {
                toast.error(data.error);
                return;
            }
            setDadosEmpresa({
                razaoSocial: data.razaoSocial ?? "",
                nomeFantasia: data.nomeFantasia ?? "",
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
    const formaPagamentoFinal = mostraFormaPagCustom ? "OUTRO" : formaPagamento;

    const handleSalvar = async () => {
        if (!consultado) { toast.error("Consulte o CNPJ primeiro"); return; }
        if (!valorContrato) { toast.error("Informe o valor do contrato"); return; }
        if (!formaPagamentoFinal) { toast.error("Selecione a forma de pagamento"); return; }
        if (mostraFormaPagCustom && !formaPagamentoCustom.trim()) { toast.error("Informe a forma de pagamento"); return; }
        if (!servico) { toast.error("Selecione o serviço"); return; }
        if (!canalAquisicao) { toast.error("Selecione o canal de aquisição"); return; }
        if (!closerFinal) { toast.error("Informe o closer"); return; }

        const sociosComVinculo = socios.filter((s) => s.nome.trim());
        const semVinculo = sociosComVinculo.some((s) => !s.vinculo);
        if (semVinculo) { toast.error("Selecione o vínculo de todos os sócios"); return; }

        setSalvando(true);
        try {
            const res = await criarContrato({
                cnpj: cnpj.replace(/\D/g, ""),
                razaoSocial: dadosEmpresa.razaoSocial,
                nomeFantasia: dadosEmpresa.nomeFantasia || undefined,
                valorContrato,
                formaPagamento: formaPagamentoFinal as "ENTRADA_EXITO" | "PARCELADO_CC" | "INTEGRAL_PIX" | "OUTRO",
                servico,
                canalAquisicao,
                closerNome: closerFinal,
                mes,
                ano,
                socios: sociosComVinculo,
            });

            if (!res.success) { toast.error(res.error); return; }
            toast.success("Contrato enviado!");
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
                    Novo Contrato — {MESES[mes - 1]} {ano}
                </h4>

                {/* Bloco 1 — CNPJ */}
                <div className={sectionCls}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">
                        1 · Empresa
                    </p>
                    <div>
                        <label className={labelCls}>CNPJ *</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="00.000.000/0000-00"
                                value={cnpj}
                                onChange={(e) => { setCnpj(e.target.value); setConsultado(false); }}
                                className={`${inputCls} flex-1`}
                            />
                            <button
                                type="button"
                                onClick={consultarCNPJ}
                                disabled={consultando}
                                className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50 transition-colors whitespace-nowrap"
                            >
                                {consultando ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                                Consultar
                            </button>
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
                            onChange={(e) => setCanalAquisicao(e.target.value)}
                            className={inputCls}
                        >
                            <option value="">Selecione...</option>
                            {CANAIS_AQUISICAO.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>
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
                        ) : (
                            <><FileText size={13} /> Contrato Enviado</>
                        )}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

// ─── Tabela de Contratos Enviados ─────────────────────────────────────────────

function TabelaEnviados({
    contratos,
    showCloser,
    canDelete,
    onConfirmar,
    onExcluir,
}: {
    contratos: Contrato[];
    showCloser: boolean;
    canDelete: boolean;
    onConfirmar: (c: Contrato) => void;
    onExcluir: (c: Contrato) => void;
}) {
    const agora = new Date();
    const thCls = "px-3 py-3 text-[8px] font-black uppercase tracking-widest text-slate-600 whitespace-nowrap";
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
                            <th className={thCls}>Data Enviado</th>
                            {showCloser && <th className={thCls}>Closer</th>}
                            <th className={thCls}>CNPJ</th>
                            <th className={thCls}>Razão Social</th>
                            <th className={thCls}>Nome Fantasia</th>
                            <th className={thCls}>Valor</th>
                            <th className={thCls}>Serviço</th>
                            <th className={`${thCls} text-right`}>Ação</th>
                            {canDelete && <th className={`${thCls} text-right`} />}
                        </tr>
                    </thead>
                    <tbody>
                        {contratos.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={(showCloser ? 1 : 0) + (canDelete ? 1 : 0) + 7}
                                    className="px-4 py-8 text-center text-[9px] font-black uppercase tracking-widest text-slate-700"
                                >
                                    Nenhum contrato enviado
                                </td>
                            </tr>
                        ) : (
                            contratos.map((c) => {
                                const atrasado = agora.getTime() - new Date(c.createdAt).getTime() > 24 * 60 * 60 * 1000;
                                return (
                                    <tr
                                        key={c.id}
                                        className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                                    >
                                        <td className="px-3 py-3 text-[10px] text-slate-500 whitespace-nowrap">
                                            {fmtDate(c.createdAt)}
                                        </td>
                                        {showCloser && (
                                            <td className="px-3 py-3 text-[10px] font-bold text-slate-300 whitespace-nowrap">
                                                {c.closerNome}
                                            </td>
                                        )}
                                        <td className="px-3 py-3 text-[10px] font-mono text-slate-400 whitespace-nowrap">
                                            {formatCNPJ(c.cnpj)}
                                        </td>
                                        <td className={`px-3 py-3 text-[11px] font-black max-w-[200px] truncate ${atrasado ? "text-red-500 animate-pulse" : "text-white"}`}>
                                            {c.razaoSocial}
                                        </td>
                                        <td className="px-3 py-3 text-[10px] text-slate-500 max-w-[160px] truncate">
                                            {c.nomeFantasia || <span className="text-slate-700">—</span>}
                                        </td>
                                        <td className="px-3 py-3 text-[11px] font-black text-emerald-400 whitespace-nowrap">
                                            {formatBRL(c.valorContrato)}
                                        </td>
                                        <td className="px-3 py-3 text-[10px] text-slate-500 max-w-[150px] truncate">
                                            {c.servico}
                                        </td>
                                        <td className="px-3 py-3 text-right">
                                            <button
                                                onClick={() => onConfirmar(c)}
                                                className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-colors animate-pulse hover:animate-none flex items-center gap-1.5 ml-auto whitespace-nowrap"
                                            >
                                                <Check size={11} /> Confirmar Fechamento
                                            </button>
                                        </td>
                                        {canDelete && (
                                            <td className="px-3 py-3 text-right">
                                                <button
                                                    onClick={() => onExcluir(c)}
                                                    className="p-1.5 rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                    title="Excluir contrato"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
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
}: {
    contratos: Contrato[];
    showCloser: boolean;
    canDelete: boolean;
    onExcluir: (c: Contrato) => void;
    onRecarregar: () => void;
}) {
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
                            {showCloser && <th className="px-3 py-3 text-[8px] font-black uppercase tracking-widest text-slate-600 whitespace-nowrap">Closer</th>}
                            <th className="px-3 py-3 text-[8px] font-black uppercase tracking-widest text-slate-600 whitespace-nowrap">Data</th>
                            <th className="px-3 py-3 text-[8px] font-black uppercase tracking-widest text-slate-600 whitespace-nowrap">CNPJ</th>
                            <th className="px-3 py-3 text-[8px] font-black uppercase tracking-widest text-slate-600 whitespace-nowrap">Razão Social</th>
                            <th className="px-3 py-3 text-[8px] font-black uppercase tracking-widest text-slate-600 whitespace-nowrap">Nome Fantasia</th>
                            <th className="px-3 py-3 text-[8px] font-black uppercase tracking-widest text-slate-600 whitespace-nowrap">Valor</th>
                            <th className="px-3 py-3 text-[8px] font-black uppercase tracking-widest text-slate-600 whitespace-nowrap">Serviço</th>
                            <th className="px-3 py-3 text-[8px] font-black uppercase tracking-widest text-slate-600 text-right whitespace-nowrap">Contrato</th>
                            {canDelete && <th className="px-3 py-3 text-[8px] font-black uppercase tracking-widest text-slate-600" />}
                        </tr>
                    </thead>
                    <tbody>
                        {contratos.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={(showCloser ? 1 : 0) + (canDelete ? 1 : 0) + 7}
                                    className="px-4 py-8 text-center text-[9px] font-black uppercase tracking-widest text-slate-700"
                                >
                                    Nenhum contrato fechado
                                </td>
                            </tr>
                        ) : (
                            contratos.map((c) => (
                                <tr
                                    key={c.id}
                                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                                >
                                    {showCloser && (
                                        <td className="px-3 py-3 text-[10px] font-bold text-slate-300 whitespace-nowrap">
                                            {c.closerNome}
                                        </td>
                                    )}
                                    <td className="px-3 py-3 text-[10px] text-slate-500 whitespace-nowrap">
                                        {c.pagamentoConfirmadoEm
                                            ? fmtDate(c.pagamentoConfirmadoEm)
                                            : "—"}
                                    </td>
                                    <td className="px-3 py-3 text-[10px] font-mono text-slate-400 whitespace-nowrap">
                                        {formatCNPJ(c.cnpj)}
                                    </td>
                                    <td className="px-3 py-3 text-[11px] font-black text-white max-w-[200px] truncate">
                                        {c.razaoSocial}
                                    </td>
                                    <td className="px-3 py-3 text-[10px] text-slate-500 max-w-[160px] truncate">
                                        {c.nomeFantasia || <span className="text-slate-700">—</span>}
                                    </td>
                                    <td className="px-3 py-3 text-[11px] font-black text-emerald-400 whitespace-nowrap">
                                        {formatBRL(c.valorContrato)}
                                    </td>
                                    <td className="px-3 py-3 text-[10px] text-slate-500 max-w-[150px] truncate">
                                        {c.servico}
                                    </td>
                                    <td className="px-3 py-3 text-right">
                                        {c.contratoUrl ? (
                                            <a
                                                href={c.contratoUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 p-2 rounded-xl hover:bg-white/5 text-slate-500 hover:text-blue-400 transition-colors"
                                            >
                                                <Eye size={14} />
                                            </a>
                                        ) : (
                                            <UploadContratoBtn contratoId={c.id} onRecarregar={onRecarregar} />
                                        )}
                                    </td>
                                    {canDelete && (
                                        <td className="px-3 py-3 text-right">
                                            <button
                                                onClick={() => onExcluir(c)}
                                                className="p-1.5 rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                title="Excluir contrato"
                                            >
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

// ─── Modal Principal ──────────────────────────────────────────────────────────

export default function ModalGerenciamentoLeads({ role, nomeUsuario, onFechar, onDadosAlterados, onVendaFechada }: Props) {
    const agora = new Date();
    const [mes, setMes] = useState(agora.getMonth() + 1);
    const [ano, setAno] = useState(agora.getFullYear());
    const [mostraForm, setMostraForm] = useState(false);
    const [painelGlobal, setPainelGlobal] = useState(false);
    const [filtroColaboradorId, setFiltroColaboradorId] = useState<number | undefined>(undefined);

    const [contratos, setContratos] = useState<Contrato[]>([]);
    const [carregando, setCarregando] = useState(true);
    const [colaboradores, setColaboradores] = useState<UsuarioSimples[]>([]);
    const [servicos, setServicos] = useState<string[]>([]);
    const [contratoParaFechar, setContratoParaFechar] = useState<Contrato | null>(null);
    const [contratoParaExcluir, setContratoParaExcluir] = useState<Contrato | null>(null);
    const [excluindo, setExcluindo] = useState(false);

    const isAdmin = isAdminOrCeo(role);

    const carregarContratos = useCallback(async () => {
        setCarregando(true);
        try {
            const res = await getContratos({
                mes,
                ano,
                adminView: isAdmin && painelGlobal,
                filtroUsuarioId: filtroColaboradorId,
            });
            if (res.success) {
                setContratos(res.contratos as unknown as Contrato[]);
            }
        } finally {
            setCarregando(false);
        }
    }, [mes, ano, isAdmin, painelGlobal, filtroColaboradorId]);

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
            const merged = [...new Set([...SERVICOS_PADRAO, ...fromDb])];
            setServicos(merged);
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
    };

    const enviados = contratos.filter((c) => c.status === "ENVIADO");
    const fechados = contratos.filter((c) => c.status === "FECHADO");

    const totalFechado = fechados.reduce((acc, c) => acc + c.valorContrato, 0);

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
                        className="relative z-10 w-full max-w-6xl max-h-[92vh] bg-[#060d1c] border border-white/10 rounded-3xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden"
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
                                    {/* Painel Global — só admin/ceo */}
                                    {isAdmin && (
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
                                    {isAdmin && painelGlobal && (
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
                                        onClick={() => setMostraForm((v) => !v)}
                                        className="flex items-center gap-2 h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black uppercase tracking-widest transition-colors"
                                    >
                                        {mostraForm ? <Minus size={13} /> : <Plus size={13} />}
                                        <span className="hidden sm:block">Novo Cliente</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ── Body ── */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {/* Formulário */}
                            <AnimatePresence>
                                {mostraForm && (
                                    <FormNovoContrato
                                        mes={mes}
                                        ano={ano}
                                        colaboradores={colaboradores}
                                        servicos={servicos}
                                        nomeUsuario={nomeUsuario}
                                        onServicoNovo={handleServicoNovo}
                                        onSalvo={() => {
                                            setMostraForm(false);
                                            void carregarContratos();
                                            onDadosAlterados?.();
                                        }}
                                        onCancelar={() => setMostraForm(false)}
                                    />
                                )}
                            </AnimatePresence>

                            {/* Tabelas */}
                            <div className="p-6 space-y-8">
                                {carregando ? (
                                    <div className="flex items-center justify-center py-16 gap-3 text-slate-600">
                                        <Loader2 size={20} className="animate-spin" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">
                                            Carregando contratos...
                                        </span>
                                    </div>
                                ) : (
                                    <>
                                        <TabelaEnviados
                                            contratos={enviados}
                                            showCloser={isAdmin && painelGlobal}
                                            canDelete={isAdmin}
                                            onConfirmar={setContratoParaFechar}
                                            onExcluir={setContratoParaExcluir}
                                        />
                                        <TabelaFechados
                                            contratos={fechados}
                                            showCloser={isAdmin && painelGlobal}
                                            canDelete={isAdmin}
                                            onExcluir={setContratoParaExcluir}
                                            onRecarregar={carregarContratos}
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
