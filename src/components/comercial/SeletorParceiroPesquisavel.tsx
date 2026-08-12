"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Search, Users, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface ParceiroOpcao {
    id: number;
    nome: string;
    nomeFantasia: string | null;
    nivel: string;
    representantes: string[];
}

interface SeletorParceiroPesquisavelProps {
    parceiros: ParceiroOpcao[];
    value: number | null;
    onChange: (parceiroId: number | null) => void;
    disabled?: boolean;
    carregando?: boolean;
}

export function normalizarBuscaParceiro(valor: string) {
    return valor
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR")
        .trim();
}

export function filtrarParceiros(parceiros: ParceiroOpcao[], busca: string) {
    const termos = normalizarBuscaParceiro(busca).split(/\s+/).filter(Boolean);
    if (termos.length === 0) return parceiros;

    return parceiros.filter((parceiro) => {
        const textoPesquisavel = normalizarBuscaParceiro([
            parceiro.nome,
            parceiro.nomeFantasia,
            ...parceiro.representantes,
        ].filter(Boolean).join(" "));

        return termos.every((termo) => textoPesquisavel.includes(termo));
    });
}

export function SeletorParceiroPesquisavel({
    parceiros,
    value,
    onChange,
    disabled = false,
    carregando = false,
}: SeletorParceiroPesquisavelProps) {
    const [aberto, setAberto] = useState(false);
    const [busca, setBusca] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const listboxId = useId();
    const parceiroSelecionado = parceiros.find((parceiro) => parceiro.id === value);
    const parceirosFiltrados = useMemo(
        () => filtrarParceiros(parceiros, busca),
        [busca, parceiros],
    );

    const selecionar = (parceiroId: number | null) => {
        onChange(parceiroId);
        setBusca("");
        setAberto(false);
    };

    return (
        <Popover
            open={aberto}
            onOpenChange={(novoEstado) => {
                setAberto(novoEstado);
                if (!novoEstado) setBusca("");
            }}
        >
            <PopoverTrigger asChild>
                <button
                    type="button"
                    role="combobox"
                    aria-expanded={aberto}
                    aria-controls={listboxId}
                    aria-label="Selecionar parceiro que indicou"
                    disabled={disabled}
                    className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-white/10 bg-slate-950/80 px-3 text-left text-sm text-white transition-all hover:border-blue-400/30 hover:bg-slate-950 focus:border-blue-400/60 focus:outline-none focus:ring-2 focus:ring-blue-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-blue-400/15 bg-blue-500/10 text-blue-300">
                        {carregando ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className={`block truncate font-semibold ${parceiroSelecionado ? "text-slate-100" : "text-slate-500"}`}>
                            {parceiroSelecionado?.nome ?? (carregando ? "Carregando parceiros..." : "Selecione o parceiro...")}
                        </span>
                        {parceiroSelecionado?.nomeFantasia && (
                            <span className="block truncate text-[10px] text-slate-500">
                                {parceiroSelecionado.nomeFantasia}
                            </span>
                        )}
                    </span>
                    <ChevronDown
                        size={16}
                        className={`shrink-0 text-slate-500 transition-transform ${aberto ? "rotate-180 text-blue-300" : ""}`}
                    />
                </button>
            </PopoverTrigger>

            <PopoverContent
                align="start"
                sideOffset={6}
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    inputRef.current?.focus();
                }}
                className="w-[var(--radix-popover-trigger-width)] min-w-[280px] overflow-hidden rounded-xl border-blue-400/20 bg-[#07111f]/[0.98] shadow-[0_24px_70px_rgba(2,6,23,0.7),0_0_32px_rgba(59,130,246,0.08)]"
            >
                <div className="border-b border-white/10 bg-white/[0.025] p-2.5">
                    <div className="flex h-10 items-center gap-2.5 rounded-lg border border-white/10 bg-slate-950/80 px-3 transition-colors focus-within:border-blue-400/50 focus-within:ring-2 focus-within:ring-blue-500/10">
                        <Search size={15} className="shrink-0 text-blue-300" />
                        <input
                            ref={inputRef}
                            value={busca}
                            onChange={(event) => setBusca(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" && parceirosFiltrados.length === 1) {
                                    event.preventDefault();
                                    selecionar(parceirosFiltrados[0].id);
                                }
                            }}
                            placeholder="Pesquisar parceiro..."
                            aria-label="Pesquisar parceiro por nome"
                            className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600"
                        />
                        {busca && (
                            <button
                                type="button"
                                onClick={() => {
                                    setBusca("");
                                    inputRef.current?.focus();
                                }}
                                aria-label="Limpar pesquisa"
                                className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>
                    <p className="mt-2 px-1 text-[9px] font-bold uppercase tracking-widest text-slate-600">
                        {carregando
                            ? "Buscando parceiros"
                            : `${parceirosFiltrados.length} ${parceirosFiltrados.length === 1 ? "parceiro encontrado" : "parceiros encontrados"}`}
                    </p>
                </div>

                <div id={listboxId} role="listbox" aria-label="Parceiros cadastrados" className="max-h-64 overflow-y-auto p-1.5">
                    {carregando ? (
                        <div role="status" className="flex items-center justify-center gap-2 px-3 py-8 text-xs font-semibold text-slate-500">
                            <Loader2 size={15} className="animate-spin text-blue-300" />
                            Carregando parceiros...
                        </div>
                    ) : parceirosFiltrados.length > 0 ? (
                        parceirosFiltrados.map((parceiro) => {
                            const selecionado = parceiro.id === value;
                            const detalhes = [
                                parceiro.nomeFantasia,
                                parceiro.representantes.length > 0
                                    ? parceiro.representantes.join(" / ")
                                    : null,
                            ].filter(Boolean).join(" · ");

                            return (
                                <button
                                    key={parceiro.id}
                                    type="button"
                                    role="option"
                                    aria-selected={selecionado}
                                    onClick={() => selecionar(parceiro.id)}
                                    className={`group flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors ${
                                        selecionado
                                            ? "bg-blue-500/15 text-blue-100"
                                            : "text-slate-300 hover:bg-white/[0.055] hover:text-white"
                                    }`}
                                >
                                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-[10px] font-black uppercase ${
                                        selecionado
                                            ? "border-blue-400/30 bg-blue-500/15 text-blue-200"
                                            : "border-white/10 bg-white/[0.035] text-slate-500 group-hover:text-blue-300"
                                    }`}>
                                        {parceiro.nome.slice(0, 2)}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-xs font-bold">{parceiro.nome}</span>
                                        {detalhes && (
                                            <span className="mt-0.5 block truncate text-[10px] text-slate-500">
                                                {detalhes}
                                            </span>
                                        )}
                                    </span>
                                    <span className="shrink-0 rounded-md border border-white/10 bg-white/[0.035] px-1.5 py-1 text-[8px] font-black uppercase tracking-wider text-slate-500">
                                        {parceiro.nivel}
                                    </span>
                                    {selecionado && <Check size={15} className="shrink-0 text-blue-300" />}
                                </button>
                            );
                        })
                    ) : (
                        <div role="status" className="px-4 py-8 text-center">
                            <span className="mx-auto grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.025] text-slate-600">
                                <Search size={16} />
                            </span>
                            <p className="mt-2 text-xs font-bold text-slate-400">Nenhum parceiro encontrado</p>
                            <p className="mt-1 text-[10px] text-slate-600">Tente pesquisar por outro nome.</p>
                        </div>
                    )}
                </div>

                {value !== null && !carregando && (
                    <div className="border-t border-white/10 p-1.5">
                        <button
                            type="button"
                            onClick={() => selecionar(null)}
                            className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold text-slate-500 transition-colors hover:bg-white/[0.04] hover:text-slate-300"
                        >
                            <X size={12} />
                            Limpar seleção
                        </button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    );
}
