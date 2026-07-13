"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

interface DropdownSelecaoComCriacaoProps {
    label: string;
    valorAtual: string;
    opcoes: string[];
    onSelecionar: (valor: string) => void;
    disabled?: boolean;
    permiteCriarNovo?: boolean;
    placeholder?: string;
    labelDesbloqueio?: string;
    /**
     * Quando fornecida, substitui o comportamento de "criar novo" (texto
     * livre) por abrir um modal externo (ex: `ModalSelecionarUsuario`) — usado
     * por Analista/Closer, que passam a listar usuários reais e delegam a
     * seleção de "qualquer outro usuário" a um modal, em vez de texto livre.
     * `permiteCriarNovo` continua controlando SE o botão de escape hatch
     * aparece; esta prop só muda O QUE ele faz ao ser clicado.
     */
    onAbrirModalOutro?: () => void;
    textoBotaoOutro?: string;
}

/**
 * Dropdown de seleção única com opção de "criar novo item" inline — extraído
 * de `modalDados.tsx` (2026-07-13) para evitar triplicar ~50 linhas de JSX
 * por card ao migrar Analista/Embasamento/Origem do Lead para dentro de cada
 * serviço contratado (ver decisions.md, "cards de Serviços Contratados
 * absorvem o bloco de gestão"). Estilo indigo padrão do módulo CS&NPS.
 */
export function DropdownSelecaoComCriacao({
    label,
    valorAtual,
    opcoes,
    onSelecionar,
    disabled = false,
    permiteCriarNovo = false,
    placeholder = "SELECIONAR",
    labelDesbloqueio,
    onAbrirModalOutro,
    textoBotaoOutro,
}: DropdownSelecaoComCriacaoProps) {
    const [aberto, setAberto] = useState(false);
    const [criando, setCriando] = useState(false);
    const [novoValor, setNovoValor] = useState("");

    return (
        <div className="space-y-2">
            <label className={`text-[10px] font-black uppercase ml-1 tracking-widest flex items-center gap-1 ${disabled ? "text-slate-600" : "text-indigo-400"}`}>
                {label}
                {disabled && labelDesbloqueio && (
                    <span className="text-[7px] bg-slate-800 px-1.5 py-0.5 rounded-full text-slate-600">{labelDesbloqueio}</span>
                )}
            </label>

            <div className="relative">
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setAberto((v) => !v)}
                    className={`w-full border rounded-xl p-3 text-sm outline-none transition-all flex items-center justify-between ${disabled
                        ? "bg-slate-900/20 border-slate-800/30 text-slate-600 cursor-not-allowed"
                        : "bg-indigo-500/5 border-indigo-500/20 text-indigo-400 focus:border-indigo-500 hover:border-indigo-500/50 cursor-pointer"
                        }`}
                >
                    <span className={valorAtual ? "uppercase italic truncate" : "text-indigo-900/40"}>
                        {valorAtual || placeholder}
                    </span>
                </button>

                {aberto && !disabled && (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-slate-900 border border-white/10 rounded-2xl p-3 z-30 shadow-2xl">
                        <div className="space-y-0.5 max-h-48 overflow-y-auto custom-scrollbar">
                            {opcoes.map((o) => (
                                <button
                                    key={o}
                                    type="button"
                                    onClick={() => { onSelecionar(o); setAberto(false); setCriando(false); }}
                                    className={`w-full text-left p-3 rounded-xl text-xs font-bold transition-all ${valorAtual === o
                                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20"
                                        : "hover:bg-white/5 text-slate-400"
                                        }`}
                                >
                                    {o}
                                </button>
                            ))}

                            {valorAtual && !opcoes.includes(valorAtual) && (
                                <button
                                    type="button"
                                    onClick={() => setAberto(false)}
                                    className="w-full text-left p-3 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow-lg shadow-indigo-900/20"
                                >
                                    {valorAtual}
                                </button>
                            )}

                            {permiteCriarNovo && onAbrirModalOutro && (
                                <button
                                    type="button"
                                    onClick={() => { setAberto(false); onAbrirModalOutro(); }}
                                    className="w-full text-left p-3 rounded-xl text-[10px] font-black text-emerald-500 hover:bg-emerald-500/10 transition-all flex items-center gap-2 border-t border-white/5 mt-2 pt-3"
                                >
                                    <Plus size={14} /> {textoBotaoOutro || `OUTRO ${label.toUpperCase()}`}
                                </button>
                            )}

                            {permiteCriarNovo && !onAbrirModalOutro && (
                                !criando ? (
                                    <button
                                        type="button"
                                        onClick={() => setCriando(true)}
                                        className="w-full text-left p-3 rounded-xl text-[10px] font-black text-emerald-500 hover:bg-emerald-500/10 transition-all flex items-center gap-2 border-t border-white/5 mt-2 pt-3"
                                    >
                                        <Plus size={14} /> NOVO {label.toUpperCase()}
                                    </button>
                                ) : (
                                    <div className="mt-2 p-2 border-t border-white/5 space-y-2 animate-in slide-in-from-top-2">
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder={`Nome ${label.toLowerCase()}...`}
                                            value={novoValor}
                                            onChange={(e) => setNovoValor(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white outline-none focus:border-emerald-500"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (novoValor) {
                                                        onSelecionar(novoValor);
                                                        setAberto(false);
                                                        setCriando(false);
                                                        setNovoValor("");
                                                    }
                                                }}
                                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black p-2 rounded-lg uppercase transition-colors"
                                            >
                                                Confirmar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCriando(false)}
                                                className="bg-slate-800 hover:bg-slate-700 text-slate-400 text-[9px] font-black p-2 rounded-lg uppercase transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
