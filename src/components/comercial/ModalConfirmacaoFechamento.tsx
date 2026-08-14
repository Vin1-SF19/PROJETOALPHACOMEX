"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X, CheckCircle2, FileCheck2, Upload, Loader2, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { confirmarFechamento } from "@/actions/ContratoComercial";

interface Contrato {
    id: string;
    cnpj: string | null;
    razaoSocial: string;
    nomeFantasia: string | null;
    valorContrato: number;
    servico: string;
}

interface Props {
    contrato: Contrato;
    onFechar: () => void;
    onConfirmado: (data: { pagamentoConfirmado: boolean; contratoAssinado: boolean }) => void;
}

export default function ModalConfirmacaoFechamento({ contrato, onFechar, onConfirmado }: Props) {
    const [pagamentoConfirmado, setPagamentoConfirmado] = useState(false);
    const [dataPagamento, setDataPagamento] = useState(
        new Date().toISOString().split("T")[0],
    );
    const [contratoAssinado, setContratoAssinado] = useState(false);
    const [contratoUrl, setContratoUrl] = useState("");
    const [uploadando, setUploadando] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const podeConfirmar = pagamentoConfirmado && (!contratoAssinado || contratoUrl !== "");

    const handleUpload = async (file: File) => {
        if (!file) return;
        if (file.type !== "application/pdf") {
            toast.error("Apenas arquivos PDF são aceitos");
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast.error("Arquivo excede 10MB");
            return;
        }

        setUploadando(true);
        try {
            const res = await fetch(`/api/contratos/upload?filename=${encodeURIComponent(file.name)}`, {
                method: "POST",
                body: file,
                headers: { "content-length": String(file.size) },
            });
            const data = await res.json() as { url?: string; error?: string };
            if (!res.ok || !data.url) {
                toast.error(data.error ?? "Erro ao fazer upload");
                return;
            }
            setContratoUrl(data.url);
            toast.success("Contrato enviado!");
        } catch {
            toast.error("Erro ao fazer upload");
        } finally {
            setUploadando(false);
        }
    };

    const handleConfirmar = async () => {
        if (!podeConfirmar) return;
        setSalvando(true);
        try {
            const res = await confirmarFechamento({
                id: contrato.id,
                pagamentoConfirmado,
                pagamentoConfirmadoEm: dataPagamento,
                contratoAssinado,
                contratoUrl,
            });
            if (!res.success) {
                toast.error(res.error);
                return;
            }
            toast.success("Contrato fechado!");
            onConfirmado({ pagamentoConfirmado, contratoAssinado });
        } catch {
            toast.error("Erro ao confirmar");
        } finally {
            setSalvando(false);
        }
    };

    const formatBRL = (v: number) =>
        v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    const switchCls = (active: boolean) =>
        `relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
            active ? "bg-emerald-500" : "bg-slate-700"
        }`;

    const thumbCls = (active: boolean) =>
        `absolute h-4 w-4 rounded-full bg-white shadow transition-transform ${
            active ? "translate-x-6" : "translate-x-1"
        }`;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    onClick={onFechar}
                />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 8 }}
                    transition={{ duration: 0.2 }}
                    className="relative z-10 w-full max-w-md bg-[#080f1e] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-white/5 flex items-start justify-between gap-4">
                        <div>
                            <h3 className="font-black uppercase italic tracking-tight text-white text-lg leading-none">
                                Confirmar Fechamento
                            </h3>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1.5">
                                {contrato.razaoSocial}
                            </p>
                            <p className="text-[11px] font-black text-blue-400 mt-0.5">
                                {formatBRL(contrato.valorContrato)} · {contrato.servico}
                            </p>
                        </div>
                        <button
                            onClick={onFechar}
                            className="shrink-0 p-2 rounded-xl bg-white/5 border border-white/5 text-slate-500 hover:text-white transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 space-y-5">
                        {/* Switch Pagamento */}
                        <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-widest text-white">
                                        Pagamento Confirmado
                                    </p>
                                    <p className="text-[9px] text-slate-600 font-bold mt-0.5">
                                        Obrigatório para fechar
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setPagamentoConfirmado((v) => !v)}
                                    className={switchCls(pagamentoConfirmado)}
                                    role="switch"
                                    aria-checked={pagamentoConfirmado}
                                >
                                    <span className={thumbCls(pagamentoConfirmado)} />
                                </button>
                            </div>

                            {/* Data do pagamento — só aparece quando confirmado */}
                            <AnimatePresence>
                                {pagamentoConfirmado && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1.5">
                                            Data do Pagamento
                                        </label>
                                        <input
                                            type="date"
                                            value={dataPagamento}
                                            onChange={(e) => setDataPagamento(e.target.value)}
                                            className="w-full h-10 bg-slate-950/80 border border-emerald-500/30 rounded-xl px-3 text-sm text-white focus:border-emerald-500/60 focus:outline-none transition-colors"
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Switch Contrato Assinado */}
                        <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-[11px] font-black uppercase tracking-widest text-white">
                                        Contrato Assinado
                                    </p>
                                    <p className="text-[9px] text-slate-600 font-bold mt-0.5">
                                        Opcional — upload obrigatório se marcado
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setContratoAssinado((v) => !v);
                                        if (contratoAssinado) setContratoUrl("");
                                    }}
                                    className={switchCls(contratoAssinado)}
                                    role="switch"
                                    aria-checked={contratoAssinado}
                                >
                                    <span className={thumbCls(contratoAssinado)} />
                                </button>
                            </div>

                            {/* Upload — só aparece quando assinado marcado */}
                            <AnimatePresence>
                                {contratoAssinado && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        {contratoUrl ? (
                                            <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                                <FileCheck2 size={16} className="text-emerald-400 shrink-0" />
                                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider truncate flex-1">
                                                    Contrato enviado
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setContratoUrl("");
                                                        if (fileRef.current) fileRef.current.value = "";
                                                    }}
                                                    className="shrink-0 text-slate-500 hover:text-red-400 transition-colors"
                                                >
                                                    <X size={13} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => fileRef.current?.click()}
                                                disabled={uploadando}
                                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-blue-500/30 text-[10px] font-black uppercase tracking-widest text-blue-400 hover:bg-blue-600/10 transition-colors disabled:opacity-50"
                                            >
                                                {uploadando ? (
                                                    <><Loader2 size={13} className="animate-spin" /> Enviando...</>
                                                ) : (
                                                    <><Upload size={13} /> Upload Contrato (PDF)</>
                                                )}
                                            </button>
                                        )}
                                        <input
                                            ref={fileRef}
                                            type="file"
                                            accept=".pdf,application/pdf"
                                            className="hidden"
                                            onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                if (f) void handleUpload(f);
                                            }}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Aviso quando não pode confirmar */}
                        {!podeConfirmar && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                <AlertCircle size={13} className="text-amber-400 shrink-0" />
                                <p className="text-[9px] font-black uppercase tracking-wider text-amber-400">
                                    {!pagamentoConfirmado
                                        ? "Confirme o pagamento para prosseguir"
                                        : "Envie o contrato PDF para prosseguir"}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-white/5 flex gap-3">
                        <button
                            onClick={onFechar}
                            className="flex-1 h-12 rounded-2xl bg-white/5 border border-white/5 text-slate-400 font-black text-[9px] uppercase tracking-widest hover:bg-white/10 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleConfirmar}
                            disabled={!podeConfirmar || salvando}
                            className="flex-1 h-12 rounded-2xl bg-emerald-600 text-white font-black text-[9px] uppercase tracking-widest hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {salvando ? (
                                <Loader2 size={14} className="animate-spin" />
                            ) : (
                                <><CheckCircle2 size={14} /> Confirmar Fechamento</>
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
