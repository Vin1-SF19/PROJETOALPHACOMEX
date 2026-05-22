"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
    Settings, Trophy, Target, ArrowLeft,
    X, Check, RefreshCw, Users, Loader2, Crown, TrendingUp, Briefcase,
    Eye, EyeOff,
} from "lucide-react";
import ModalGerenciamentoLeads from "@/components/comercial/ModalGerenciamentoLeads";
import { getTema } from "@/lib/temas";
import { toast } from "sonner";
import {
    upsertMetaUsuario,
    upsertMetaEquipe,
    toggleMetaVisibilidade,
    getColaboradoresParaConfigurar,
    getDadosMetas,
    type ColaboradorMeta,
    type DadosMetasResult,
    type DadosMetasError,
} from "@/actions/Metas";

const MESES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface Props {
    dadosIniciais: DadosMetasResult | DadosMetasError;
    isAdmin: boolean;
    mesAtual: number;
    anoAtual: number;
    role: string;
    nomeUsuario: string;
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

function Avatar({ imagemUrl, nome, tema, className = "" }: {
    imagemUrl: string | null;
    nome: string;
    tema: string;
    className?: string;
}) {
    const style = getTema(tema);
    return (
        <div className={`relative rounded-full overflow-hidden shrink-0 shadow-xl ${className}`}>
            <div className={`absolute inset-0 ${style.bg} flex items-center justify-center`}>
                <span className="text-white font-black text-lg select-none">
                    {nome.substring(0, 2).toUpperCase()}
                </span>
            </div>
            {imagemUrl && (
                <Image
                    src={imagemUrl}
                    alt={nome}
                    fill
                    unoptimized
                    className="object-cover relative z-10"
                />
            )}
        </div>
    );
}

// ─── Efeitos sonoros ─────────────────────────────────────────────────────────

let _audioCtx: AudioContext | null = null;

function unlockAudio() {
    if (typeof window === "undefined") return;
    try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!_audioCtx) _audioCtx = new AC();
        if (_audioCtx.state === "suspended") void _audioCtx.resume();
    } catch {}
}

function tocarSomMeta(tipo: "individual" | "equipe") {
    if (typeof window === "undefined") return;
    try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!_audioCtx) _audioCtx = new AC();
        const ctx = _audioCtx;

        const play = () => {
            const comp = ctx.createDynamicsCompressor();
            comp.threshold.value = -3;
            comp.knee.value = 6;
            comp.ratio.value = 6;
            comp.attack.value = 0.001;
            comp.release.value = 0.15;
            comp.connect(ctx.destination);

            const nota = (freq: number, inicio: number, dur: number, vol: number, forma: OscillatorType = "sine") => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(comp);
                osc.type = forma;
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0, ctx.currentTime + inicio);
                gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + inicio + 0.015);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + inicio + dur);
                osc.start(ctx.currentTime + inicio);
                osc.stop(ctx.currentTime + inicio + dur + 0.05);
            };

            const boom = (inicio: number, vol: number) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(comp);
                osc.type = "sine";
                osc.frequency.setValueAtTime(180, ctx.currentTime + inicio);
                osc.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + inicio + 0.28);
                gain.gain.setValueAtTime(vol, ctx.currentTime + inicio);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + inicio + 0.35);
                osc.start(ctx.currentTime + inicio);
                osc.stop(ctx.currentTime + inicio + 0.40);
            };

            const noise = (inicio: number, dur: number, vol: number) => {
                const size = Math.floor(ctx.sampleRate * dur);
                const buf = ctx.createBuffer(1, size, ctx.sampleRate);
                const data = buf.getChannelData(0);
                for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
                const src = ctx.createBufferSource();
                src.buffer = buf;
                const gain = ctx.createGain();
                src.connect(gain);
                gain.connect(comp);
                gain.gain.setValueAtTime(vol, ctx.currentTime + inicio);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + inicio + dur);
                src.start(ctx.currentTime + inicio);
            };

            if (tipo === "individual") {
                boom(0, 1.3);
                noise(0, 0.15, 0.85);

                nota(523.25, 0.05, 0.35, 0.95, "sawtooth"); // C5
                nota(523.25, 0.05, 0.35, 0.55, "sine");
                nota(659.25, 0.18, 0.35, 0.95, "sawtooth"); // E5
                nota(659.25, 0.18, 0.35, 0.55, "sine");
                nota(783.99, 0.31, 0.35, 0.95, "sawtooth"); // G5
                nota(783.99, 0.31, 0.35, 0.55, "sine");

                nota(1046.5, 0.45, 1.3, 1.0,  "sawtooth"); // C6
                nota(1046.5, 0.45, 1.3, 0.65, "sine");
                nota(659.25, 0.45, 1.3, 0.55, "sine");
                nota(783.99, 0.45, 1.3, 0.55, "sine");
                nota(523.25, 0.45, 1.3, 0.45, "sine");
                nota(2093.0, 0.55, 1.1, 0.28, "sine"); // C7 shimmer
                boom(0.55, 0.75);
                noise(0.55, 0.12, 0.5);

            } else {
                boom(0, 1.4);
                boom(0.07, 1.1);
                noise(0, 0.22, 1.0);

                nota(65.41,  0,    1.4, 1.0, "triangle"); // C2
                nota(130.81, 0,    1.4, 0.95, "sawtooth"); // C3

                nota(261.63, 0.0,  0.55, 0.95, "sawtooth"); // C4
                nota(329.63, 0.10, 0.55, 0.95, "sawtooth"); // E4
                nota(392.00, 0.20, 0.55, 0.95, "sawtooth"); // G4
                nota(523.25, 0.30, 0.65, 1.0,  "sawtooth"); // C5
                nota(659.25, 0.40, 0.65, 1.0,  "sawtooth"); // E5
                nota(783.99, 0.50, 0.65, 1.0,  "sawtooth"); // G5
                nota(1046.5, 0.60, 1.5,  1.0,  "sawtooth"); // C6

                nota(523.25, 0.60, 1.5, 0.60, "sine");
                nota(659.25, 0.60, 1.5, 0.55, "sine");
                nota(783.99, 0.60, 1.5, 0.55, "sine");
                nota(1046.5, 0.60, 1.5, 0.70, "sine");

                nota(2093.0, 0.72, 1.4, 0.30, "sine"); // C7
                nota(4186.0, 0.85, 1.1, 0.15, "sine"); // C8 air
                boom(0.72, 0.80);
                boom(1.25, 0.50);
                noise(0.72, 0.20, 0.50);
            }
        };

        if (ctx.state === "suspended") {
            void ctx.resume().then(play);
        } else {
            play();
        }
    } catch {
        // Audio não suportado — falha silenciosa
    }
}

// ─── Alerta de Venda / Pagamento ─────────────────────────────────────────────

function AlertaVenda({ tipo, closerNome, razaoSocial, onFechar }: {
    tipo: "VENDA" | "PAGAMENTO";
    closerNome: string;
    razaoSocial: string;
    onFechar: () => void;
}) {
    useEffect(() => {
        const t = setTimeout(onFechar, 7_000);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const isVenda = tipo === "VENDA";
    const accentColor = isVenda ? "rgba(16,185,129,1)" : "rgba(59,130,246,1)";
    const glowBg = isVenda ? "bg-emerald-950/30" : "bg-blue-950/30";
    const glowAccent = isVenda ? "bg-emerald-700/15" : "bg-blue-700/15";
    const labelCls = isVenda ? "text-emerald-500" : "text-blue-500";
    const avatarBg = isVenda ? "bg-emerald-600" : "bg-blue-600";
    const avatarShadow = isVenda ? "rgba(16,185,129,0.5)" : "rgba(59,130,246,0.5)";
    const pulseBg = isVenda ? "bg-emerald-600/15" : "bg-blue-600/15";
    const borderColor = isVenda ? "rgba(16,185,129,0.6)" : "rgba(59,130,246,0.6)";

    return (
        <div
            className="fixed inset-0 z-[9998] bg-[#040d1a]/95 flex flex-col items-center justify-center select-none cursor-pointer"
            onClick={onFechar}
        >
            {/* accent frame */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />
                <div className="absolute bottom-0 left-0 right-0 h-1.5" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)` }} />
                <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: `linear-gradient(180deg, transparent, ${accentColor}, transparent)` }} />
                <div className="absolute right-0 top-0 bottom-0 w-1.5" style={{ background: `linear-gradient(180deg, transparent, ${accentColor}, transparent)` }} />
                {[["top-0 left-0", "border-t-2 border-l-2"], ["top-0 right-0", "border-t-2 border-r-2"], ["bottom-0 left-0", "border-b-2 border-l-2"], ["bottom-0 right-0", "border-b-2 border-r-2"]].map(([pos, border], i) => (
                    <div key={i} className={`absolute ${pos} h-16 w-16 ${border}`} style={{ borderColor }} />
                ))}
            </div>

            {/* glows */}
            <div className="absolute inset-0 pointer-events-none">
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] ${glowBg} blur-[180px] rounded-full`} />
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] ${glowAccent} blur-[120px] rounded-full`} />
            </div>

            <div className="absolute top-8 left-10 text-[9px] font-black uppercase tracking-[0.4em]" style={{ color: isVenda ? "rgba(16,185,129,0.4)" : "rgba(59,130,246,0.4)" }}>
                {isVenda ? "ALPHA::VENDA::REALIZADA" : "ALPHA::PAGAMENTO::CONFIRMADO"}
            </div>

            <button
                onClick={(e) => { e.stopPropagation(); onFechar(); }}
                className="absolute top-6 right-6 p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-white transition-colors z-10"
            >
                <X size={18} />
            </button>

            <div className="relative z-10 flex flex-col items-center gap-8 text-center px-8 max-w-lg">
                {/* Initials */}
                <div className="relative">
                    <div className={`absolute -inset-4 rounded-full blur-xl animate-pulse ${pulseBg}`} />
                    <div
                        className={`relative h-36 w-36 rounded-full ${avatarBg} flex items-center justify-center border-4`}
                        style={{ borderColor, boxShadow: `0 0 80px ${avatarShadow}` }}
                    >
                        <span className="text-white font-black text-5xl">
                            {closerNome.substring(0, 2).toUpperCase()}
                        </span>
                    </div>
                </div>

                <div className="space-y-3">
                    <p className={`text-[11px] font-black uppercase tracking-[0.6em] ${labelCls}`}>
                        {isVenda ? "Venda Realizada!" : "Pagamento Confirmado!"}
                    </p>
                    <h2 className="text-5xl font-black uppercase italic text-white tracking-tighter leading-none">
                        {closerNome}
                    </h2>
                    <p className="text-xl font-black text-slate-300 uppercase italic mt-2">
                        {razaoSocial}
                    </p>
                </div>
            </div>
        </div>
    );
}

// ─── Linha de colaborador (pill com avatar sobreposição) ────────────────────

function LinhaColaborador({ colab, rank, rowHeight }: {
    colab: ColaboradorMeta;
    rank: number;
    rowHeight: number;
}) {
    const tema = getTema(colab.tema);
    const bateuMeta = colab.meta > 0 && colab.vendas >= colab.meta;
    const faltam = colab.meta > colab.vendas ? colab.meta - colab.vendas : 0;
    const quaseNaMeta = faltam > 0 && faltam <= 2;
    const progresso = colab.meta > 0 ? Math.min((colab.vendas / colab.meta) * 100, 100) : 0;
    const accentRgb = tema.accent;

    const barHeight = Math.max(72, Math.min(160, rowHeight - 28));
    const avatarDiam = barHeight + 36;
    const avatarRad = avatarDiam / 2;

    const fontVendas = Math.max(26, Math.round(barHeight * 0.52));
    const fontNome   = Math.max(14, Math.round(barHeight * 0.26));
    const fontStatus = Math.max(9,  Math.round(barHeight * 0.115));
    const fontRank   = Math.max(18, Math.round(barHeight * 0.38));

    return (
        <div className="flex items-center px-6 lg:px-10 py-2.5">

            {/* ── Avatar — fica na frente e "morde" a pill ── */}
            <div
                className="relative shrink-0 z-10"
                style={{
                    width: `${avatarDiam}px`,
                    height: `${avatarDiam}px`,
                    marginRight: `-${avatarRad}px`,
                }}
            >
                <div
                    className="w-full h-full rounded-full p-[3px]"
                    style={{
                        background: bateuMeta
                            ? "linear-gradient(135deg, rgba(245,158,11,0.95), rgba(245,158,11,0.35))"
                            : quaseNaMeta
                            ? `linear-gradient(135deg, rgba(${accentRgb},1), rgba(${accentRgb},0.3))`
                            : `linear-gradient(135deg, rgba(${accentRgb},0.75), rgba(${accentRgb},0.15))`,
                        boxShadow: quaseNaMeta
                            ? `0 0 22px 7px rgba(${accentRgb},0.45), 0 6px 24px rgba(0,0,0,0.5)`
                            : bateuMeta
                            ? `0 0 22px 7px rgba(245,158,11,0.35), 0 6px 24px rgba(0,0,0,0.5)`
                            : `0 0 14px 3px rgba(${accentRgb},0.2), 0 6px 24px rgba(0,0,0,0.5)`,
                    }}
                >
                    <Avatar
                        imagemUrl={colab.imagemUrl}
                        nome={colab.nome}
                        tema={colab.tema}
                        className="w-full h-full"
                    />
                </div>
                {bateuMeta && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 h-6 w-6 rounded-full bg-amber-400 border-2 border-[#020617] flex items-center justify-center shadow-xl z-20">
                        <Crown size={10} className="text-slate-900" />
                    </div>
                )}
            </div>

            {/* ── Pill bar (rounded-full) ── */}
            <div
                className="relative flex-1 overflow-hidden rounded-full border border-white/[0.06]"
                style={{
                    height: `${barHeight}px`,
                    background: "rgba(5,10,28,0.75)",
                }}
            >
                {/* Sombra do tema na borda esquerda */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: `radial-gradient(ellipse 35% 100% at 0% 50%, rgba(${accentRgb},0.12) 0%, transparent 55%)`,
                    }}
                />

                {/* Fill de progresso */}
                <div
                    className="absolute top-0 left-0 bottom-0 transition-all duration-1000 ease-out"
                    style={{
                        width: `${progresso}%`,
                        background: bateuMeta
                            ? `linear-gradient(90deg, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0.36) 100%)`
                            : quaseNaMeta
                            ? `linear-gradient(90deg, rgba(${accentRgb},0.12) 0%, rgba(${accentRgb},0.32) 100%)`
                            : `linear-gradient(90deg, rgba(${accentRgb},0.07) 0%, rgba(${accentRgb},0.18) 100%)`,
                        borderRight: `2px solid ${
                            bateuMeta ? "rgba(245,158,11,0.8)"
                            : quaseNaMeta ? `rgba(${accentRgb},1)`
                            : `rgba(${accentRgb},0.5)`
                        }`,
                        boxShadow: bateuMeta
                            ? `6px 0 30px rgba(245,158,11,0.3)`
                            : quaseNaMeta
                            ? `6px 0 40px rgba(${accentRgb},0.5)`
                            : `4px 0 16px rgba(${accentRgb},0.15)`,
                    }}
                />

                {/* Highlight topo */}
                <div
                    className="absolute top-0 left-0 right-0 h-px pointer-events-none"
                    style={{ background: `linear-gradient(90deg, rgba(${accentRgb},0.25) 0%, transparent 40%)` }}
                />

                {/* Efeito pulsante quando faltam ≤ 2 */}
                {quaseNaMeta && (
                    <>
                        <div
                            className="absolute top-0 bottom-0 w-0.5 animate-pulse pointer-events-none"
                            style={{
                                left: `calc(${progresso}% - 1px)`,
                                background: `rgba(${accentRgb}, 1)`,
                                boxShadow: `0 0 14px 5px rgba(${accentRgb},0.65)`,
                            }}
                        />
                        <div
                            className="absolute top-0 bottom-0 animate-pulse pointer-events-none"
                            style={{
                                left: `calc(${progresso}% - 28px)`,
                                width: "28px",
                                background: `linear-gradient(90deg, transparent, rgba(${accentRgb},0.3))`,
                            }}
                        />
                    </>
                )}

                {/* Overlay META BATIDA */}
                {bateuMeta && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span
                            className="font-black uppercase italic tracking-tighter select-none whitespace-nowrap"
                            style={{
                                fontSize: `${Math.max(18, barHeight * 0.44)}px`,
                                color: "rgba(245, 158, 11, 0.65)",
                                textShadow: "0 0 28px rgba(245,158,11,0.55), 0 0 60px rgba(245,158,11,0.22)",
                            }}
                        >
                            META BATIDA
                        </span>
                    </div>
                )}

                {/* ── Conteúdo da linha ── */}
                <div
                    className="absolute inset-0 flex items-center gap-3"
                    style={{ paddingLeft: `${avatarRad + 14}px`, paddingRight: "20px" }}
                >
                    {/* Rank */}
                    <div className="shrink-0" style={{ width: `${Math.round(fontRank * 1.6)}px` }}>
                        {rank <= 3 ? (
                            <span className="leading-none" style={{ fontSize: `${fontRank}px` }}>
                                {rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}
                            </span>
                        ) : (
                            <span className="font-black tabular-nums text-slate-700 uppercase tracking-widest" style={{ fontSize: `${fontStatus}px` }}>
                                #{rank}
                            </span>
                        )}
                    </div>

                    {/* Nome + status */}
                    <div className="flex-1 min-w-0">
                        <h3
                            className={`font-black uppercase italic tracking-tight truncate leading-tight
                                ${bateuMeta ? "text-amber-300" : quaseNaMeta ? "text-white" : "text-slate-200"}`}
                            style={{
                                fontSize: `${fontNome}px`,
                                ...(quaseNaMeta && !bateuMeta ? { textShadow: `0 0 20px rgba(${accentRgb},0.5)` } : {}),
                            }}
                        >
                            {colab.nome}
                        </h3>
                        <p className={`font-black uppercase tracking-[0.15em] mt-0.5
                            ${bateuMeta ? "text-amber-500/80" : quaseNaMeta ? "text-white/50" : "text-slate-700"}`}
                            style={{ fontSize: `${fontStatus}px` }}
                        >
                            {bateuMeta ? "● META BATIDA"
                                : quaseNaMeta ? `⚡ FALTA ${faltam}!`
                                : colab.meta > 0 ? `Meta: ${colab.meta}` : "Sem meta"}
                        </p>
                    </div>

                    {/* Badge pulsante */}
                    {quaseNaMeta && (
                        <div
                            className="shrink-0 animate-pulse hidden sm:block"
                            style={{
                                padding: "2px 10px",
                                borderRadius: "999px",
                                background: `rgba(${accentRgb},0.15)`,
                                border: `1px solid rgba(${accentRgb},0.5)`,
                                boxShadow: `0 0 10px rgba(${accentRgb},0.3)`,
                            }}
                        >
                            <span
                                className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap"
                                style={{ color: `rgb(${accentRgb})` }}
                            >
                                ⚡ {faltam} vnd
                            </span>
                        </div>
                    )}

                    {/* Vendas totais / Meta */}
                    <div className="shrink-0 flex items-baseline gap-1 ml-auto">
                        <span
                            className={`font-black tabular-nums leading-none
                                ${bateuMeta ? "text-amber-400" : quaseNaMeta ? "text-white" : tema.text}`}
                            style={{
                                fontSize: `${fontVendas}px`,
                                ...(quaseNaMeta && !bateuMeta
                                    ? { textShadow: `0 0 24px rgba(${accentRgb},0.7)` }
                                    : bateuMeta
                                    ? { textShadow: "0 0 24px rgba(245,158,11,0.4)" }
                                    : {}),
                            }}
                        >
                            {colab.vendas}
                        </span>
                        <span className="font-black text-slate-700" style={{ fontSize: `${Math.round(fontVendas * 0.7)}px` }}>/</span>
                        <span className="font-black tabular-nums text-slate-500" style={{ fontSize: `${Math.round(fontVendas * 0.7)}px` }}>
                            {colab.meta || "—"}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Tela de celebração individual ──────────────────────────────────────────

function TelaCelebracaoIndividual({ colab, onFechar }: {
    colab: ColaboradorMeta;
    onFechar: () => void;
}) {
    const tema = getTema(colab.tema);

    useEffect(() => {
        tocarSomMeta("individual");
        const t = setTimeout(onFechar, 10_000);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div
            className="fixed inset-0 z-[9999] bg-[#040d1a] flex flex-col items-center justify-center select-none"
        >
            {/* Red accent frame */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-red-600 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-red-600 to-transparent" />
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-transparent via-red-600 to-transparent" />
                <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-transparent via-red-600 to-transparent" />
                {[["top-0 left-0", "border-t-2 border-l-2"],
                ["top-0 right-0", "border-t-2 border-r-2"],
                ["bottom-0 left-0", "border-b-2 border-l-2"],
                ["bottom-0 right-0", "border-b-2 border-r-2"]].map(([pos, border], i) => (
                    <div key={i} className={`absolute ${pos} h-16 w-16 border-red-700/60 ${border}`} />
                ))}
            </div>

            {/* Glows */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-red-950/30 blur-[180px] rounded-full" />
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] ${tema.glow} blur-[120px] rounded-full opacity-30`} />
            </div>

            <div className="absolute top-8 left-10 text-[9px] font-black text-red-900 uppercase tracking-[0.4em]">
                ALPHA::META::REACHED
            </div>

            <button onClick={onFechar} className="absolute top-6 right-6 p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-white transition-colors z-10">
                <X size={18} />
            </button>

            <div className="relative z-10 flex flex-col items-center gap-8 text-center px-8 max-w-lg">
                {/* Avatar */}
                <div className="relative">
                    <div className="absolute -inset-4 rounded-full bg-red-600/15 blur-xl animate-pulse" />
                    <div className="relative h-44 w-44 rounded-full overflow-hidden border-4 border-red-600/60 shadow-[0_0_80px_rgba(220,38,38,0.5)]">
                        <div className={`absolute inset-0 ${tema.bg} flex items-center justify-center`}>
                            <span className="text-white font-black text-5xl">
                                {colab.nome.substring(0, 2).toUpperCase()}
                            </span>
                        </div>
                        {colab.imagemUrl && (
                            <Image src={colab.imagemUrl} alt={colab.nome} fill unoptimized className="object-cover relative z-10" />
                        )}
                    </div>
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 h-10 w-10 rounded-full bg-amber-400 border-4 border-[#040d1a] flex items-center justify-center shadow-xl">
                        <Crown size={18} className="text-slate-900" />
                    </div>
                </div>

                <div className="space-y-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.6em] text-red-500">Parabéns</p>
                    <h2 className="text-6xl font-black uppercase italic text-white tracking-tighter leading-none">
                        {colab.nome}
                    </h2>
                    <p className="text-2xl font-black text-slate-200 uppercase italic mt-2">Meta Batida!</p>
                    <p className="text-sm text-slate-500 font-bold mt-1">
                        <span className="text-red-400 font-black">{colab.vendas}</span> vendas · Meta:{" "}
                        <span className="text-white font-black">{colab.meta}</span>
                    </p>
                </div>

            </div>
        </div>
    );
}

// ─── Tela de celebração da EQUIPE ────────────────────────────────────────────

function TelaCelebracaoEquipe({ colaboradores, totalVendas, meta, onFechar }: {
    colaboradores: ColaboradorMeta[];
    totalVendas: number;
    meta: number;
    onFechar: () => void;
}) {
    useEffect(() => {
        tocarSomMeta("equipe");
        const t = setTimeout(onFechar, 18_000);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div
            className="fixed inset-0 z-[9999] bg-[#040d1a] flex flex-col items-center justify-center select-none overflow-hidden"
        >
            {/* Red accent frame */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-red-600 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-red-600 to-transparent" />
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-transparent via-red-600 to-transparent" />
                <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-transparent via-red-600 to-transparent" />
                {[["top-0 left-0", "border-t-2 border-l-2"],
                ["top-0 right-0", "border-t-2 border-r-2"],
                ["bottom-0 left-0", "border-b-2 border-l-2"],
                ["bottom-0 right-0", "border-b-2 border-r-2"]].map(([pos, border], i) => (
                    <div key={i} className={`absolute ${pos} h-20 w-20 border-red-700/60 ${border}`} />
                ))}
            </div>

            {/* Glow */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-red-950/25 blur-[200px] rounded-full" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-950/20 blur-[150px] rounded-full" />
            </div>

            <div className="absolute top-8 left-10 text-[9px] font-black text-red-900 uppercase tracking-[0.4em]">
                ALPHA::EQUIPE::META::REACHED
            </div>

            <button onClick={onFechar} className="absolute top-6 right-6 p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-500 hover:text-white transition-colors z-10">
                <X size={18} />
            </button>

            <div className="relative z-10 flex flex-col items-center gap-8 text-center px-8 max-w-4xl w-full">
                {/* Fotos da equipe */}
                <div className="flex flex-wrap justify-center gap-3 max-w-2xl">
                    {colaboradores.map((c) => {
                        const tema = getTema(c.tema);
                        return (
                            <div key={c.colaboradoraId} className="flex flex-col items-center gap-1.5">
                                <div className="relative h-16 w-16 rounded-full overflow-hidden border-2 border-red-600/50 shadow-[0_0_20px_rgba(220,38,38,0.3)]">
                                    <div className={`absolute inset-0 ${tema.bg} flex items-center justify-center`}>
                                        <span className="text-white font-black text-sm">
                                            {c.nome.substring(0, 2).toUpperCase()}
                                        </span>
                                    </div>
                                    {c.imagemUrl && (
                                        <Image src={c.imagemUrl} alt={c.nome} fill unoptimized className="object-cover relative z-10" />
                                    )}
                                </div>
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-wide max-w-[64px] truncate">
                                    {c.nome.split(" ")[0]}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Text */}
                <div className="space-y-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.6em] text-red-500">
                        Parabéns — Equipe Comercial
                    </p>
                    <h2 className="text-5xl lg:text-7xl font-black uppercase italic text-white tracking-tighter leading-none">
                        Meta Batida!
                    </h2>
                    <div className="flex items-center justify-center gap-3 mt-3">
                        <Trophy size={24} className="text-amber-400" />
                        <p className="text-xl text-slate-200 font-black">
                            <span className="text-red-400">{totalVendas}</span>
                            <span className="text-slate-500"> / {meta} vendas</span>
                        </p>
                        <Trophy size={24} className="text-amber-400" />
                    </div>
                </div>

            </div>
        </div>
    );
}

// ─── Modal de configuração (admin) ───────────────────────────────────────────

type ColabConfig = { id: number; colaboradoraId: string; meta: number; visivelNoPainel: boolean };

function ModalConfigurar({ mes, ano, onFechar }: { mes: number; ano: number; onFechar: () => void }) {
    const [colabs, setColabs] = useState<ColabConfig[]>([]);
    const [metaEquipe, setMetaEquipe] = useState(0);
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [togglingId, setTogglingId] = useState<number | null>(null);

    useEffect(() => {
        getColaboradoresParaConfigurar().then((res) => {
            if (res.success) {
                setColabs(res.colaboradores as ColabConfig[]);
                setMetaEquipe(res.metaEquipe);
            }
            setCarregando(false);
        });
    }, []);

    const toggleVisivel = async (colab: ColabConfig) => {
        setTogglingId(colab.id);
        const novoVisivel = !colab.visivelNoPainel;
        const res = await toggleMetaVisibilidade(colab.id, novoVisivel);
        if (res.success) {
            setColabs((prev) =>
                prev.map((c) => c.id === colab.id ? { ...c, visivelNoPainel: novoVisivel } : c)
            );
        } else {
            toast.error("Erro ao alterar visibilidade");
        }
        setTogglingId(null);
    };

    const salvar = async () => {
        setSalvando(true);
        try {
            await upsertMetaEquipe(metaEquipe, mes, ano);
            await Promise.all(colabs.map((c) => upsertMetaUsuario(c.colaboradoraId, c.meta, mes, ano)));
            toast.success("Metas atualizadas!");
            onFechar();
        } catch {
            toast.error("Erro ao salvar metas");
        } finally {
            setSalvando(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-[#080f1e] border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-600/10 rounded-xl border border-blue-500/20">
                            <Settings size={20} className="text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-black text-white uppercase italic tracking-tight">Configurar Metas</h3>
                            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mt-0.5">
                                {MESES[mes - 1]} {ano} · role COMERCIAL
                            </p>
                        </div>
                    </div>
                    <button onClick={onFechar} className="p-2 rounded-xl bg-white/5 border border-white/5 text-slate-400 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {carregando ? (
                        <div className="flex items-center justify-center py-12 gap-3 text-slate-600">
                            <Loader2 size={20} className="animate-spin" />
                            <span className="text-xs font-black uppercase tracking-widest">Carregando...</span>
                        </div>
                    ) : (
                        <>
                            <div className="p-5 rounded-2xl bg-blue-600/5 border border-blue-500/20">
                                <label className="text-[10px] font-black uppercase text-blue-400 tracking-widest block mb-3 flex items-center gap-2">
                                    <Users size={12} /> Meta Geral da Equipe
                                </label>
                                <input
                                    type="number"
                                    value={metaEquipe}
                                    onChange={(e) => setMetaEquipe(Number(e.target.value))}
                                    min={0}
                                    className="w-full h-12 bg-black/60 border border-blue-500/20 rounded-xl px-4 text-white font-black text-xl focus:border-blue-500/50 outline-none"
                                    placeholder="0"
                                />
                            </div>

                            <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1 flex items-center gap-2">
                                    <Target size={11} /> Metas Individuais (COMERCIAL)
                                </p>
                                {colabs.length === 0 && (
                                    <p className="text-xs text-slate-600 text-center py-6">
                                        Nenhum usuário com role COMERCIAL encontrado.
                                    </p>
                                )}
                                {colabs.map((c, i) => (
                                    <div key={c.colaboradoraId} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${c.visivelNoPainel ? "bg-slate-900/50 border-white/5" : "bg-slate-950/50 border-white/[0.03] opacity-60"}`}>
                                        <span className={`flex-1 text-[11px] font-black uppercase truncate ${c.visivelNoPainel ? "text-white" : "text-slate-500 line-through"}`}>{c.colaboradoraId}</span>
                                        <button
                                            onClick={() => toggleVisivel(c)}
                                            disabled={togglingId === c.id}
                                            title={c.visivelNoPainel ? "Ocultar do painel TV" : "Exibir no painel TV"}
                                            className={`shrink-0 p-2 rounded-xl border transition-all ${c.visivelNoPainel ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20" : "bg-slate-800/50 border-white/5 text-slate-600 hover:bg-slate-700/50 hover:text-slate-400"}`}
                                        >
                                            {togglingId === c.id
                                                ? <Loader2 size={13} className="animate-spin" />
                                                : c.visivelNoPainel ? <Eye size={13} /> : <EyeOff size={13} />
                                            }
                                        </button>
                                        <input
                                            type="number"
                                            value={c.meta}
                                            onChange={(e) => {
                                                const novo = [...colabs];
                                                novo[i] = { ...novo[i], meta: Number(e.target.value) };
                                                setColabs(novo);
                                            }}
                                            min={0}
                                            className="w-24 h-10 bg-black/60 border border-white/10 rounded-xl px-3 text-white font-black text-sm focus:border-blue-500/50 outline-none text-center"
                                            placeholder="0"
                                        />
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div className="p-6 border-t border-white/5 flex gap-3">
                    <button onClick={onFechar} className="flex-1 h-12 rounded-2xl bg-white/5 border border-white/5 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-colors">
                        Cancelar
                    </button>
                    <button
                        onClick={salvar}
                        disabled={salvando || carregando}
                        className="flex-1 h-12 rounded-2xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {salvando ? <Loader2 size={14} className="animate-spin" /> : <><Check size={14} /> Salvar</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MetasClient({ dadosIniciais, isAdmin, mesAtual, anoAtual, role, nomeUsuario }: Props) {
    const router = useRouter();
    const [colaboradores, setColaboradores] = useState<ColaboradorMeta[]>(
        dadosIniciais.success ? dadosIniciais.colaboradores : []
    );
    const [metaEquipe, setMetaEquipe] = useState(dadosIniciais.success ? dadosIniciais.metaEquipe : 0);
    const [totalVendas, setTotalVendas] = useState(dadosIniciais.success ? dadosIniciais.totalVendas : 0);
    const [atualizando, setAtualizando] = useState(false);
    const [modalAberto, setModalAberto] = useState(false);
    const [modalGerenciamentoAberto, setModalGerenciamentoAberto] = useState(false);
    const [rowHeight, setRowHeight] = useState(120);

    // Alerta de venda / pagamento
    const [alertaVenda, setAlertaVenda] = useState<{
        tipo: "VENDA" | "PAGAMENTO";
        closerNome: string;
        razaoSocial: string;
    } | null>(null);

    // Celebrações individuais
    const [celebracaoQueue, setCelebracaoQueue] = useState<ColaboradorMeta[]>([]);
    const [celebrandoAtual, setCelebrandoAtual] = useState<ColaboradorMeta | null>(null);
    const celebradosRef = useRef(new Set<string>());

    // Celebração da equipe
    const [celebrandoEquipe, setCelebrandoEquipe] = useState(false);
    const equipeJaCelebradaRef = useRef(false);

    const processarCelebracoes = useCallback((colabs: ColaboradorMeta[], total: number, meta: number) => {
        const novosIndividuais = colabs.filter(
            (c) => c.meta > 0 && c.vendas >= c.meta && !celebradosRef.current.has(c.colaboradoraId)
        );
        novosIndividuais.forEach((c) => celebradosRef.current.add(c.colaboradoraId));
        if (novosIndividuais.length > 0) {
            try {
                sessionStorage.setItem(
                    `metas-ind-${mesAtual}-${anoAtual}`,
                    JSON.stringify([...celebradosRef.current])
                );
            } catch {}
            setCelebracaoQueue((prev) => [...prev, ...novosIndividuais]);
        }

        if (meta > 0 && total >= meta && !equipeJaCelebradaRef.current) {
            equipeJaCelebradaRef.current = true;
            try { sessionStorage.setItem(`metas-eq-${mesAtual}-${anoAtual}`, "true"); } catch {}
            setTimeout(() => setCelebrandoEquipe(true), novosIndividuais.length * 10_500);
        }
    }, [mesAtual, anoAtual]);

    // Processar fila individual
    useEffect(() => {
        if (!celebrandoAtual && celebracaoQueue.length > 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setCelebrandoAtual(celebracaoQueue[0]);
            setCelebracaoQueue((prev) => prev.slice(1));
        }
    }, [celebracaoQueue, celebrandoAtual]);

    useEffect(() => {
        // Desbloqueia AudioContext na primeira interação do usuário
        window.addEventListener("click", unlockAudio, { once: true });
        window.addEventListener("keydown", unlockAudio, { once: true });

        // Restaura celebrações já exibidas nesta sessão
        try {
            const savedInd = sessionStorage.getItem(`metas-ind-${mesAtual}-${anoAtual}`);
            if (savedInd) {
                (JSON.parse(savedInd) as string[]).forEach((id) => celebradosRef.current.add(id));
            }
            equipeJaCelebradaRef.current =
                sessionStorage.getItem(`metas-eq-${mesAtual}-${anoAtual}`) === "true";
        } catch {}

        if (dadosIniciais.success) {
            processarCelebracoes(dadosIniciais.colaboradores, dadosIniciais.totalVendas, dadosIniciais.metaEquipe);
        }

        return () => {
            window.removeEventListener("click", unlockAudio);
            window.removeEventListener("keydown", unlockAudio);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const atualizar = useCallback(async () => {
        setAtualizando(true);
        try {
            const res = await getDadosMetas();
            if (res.success) {
                setColaboradores(res.colaboradores);
                setMetaEquipe(res.metaEquipe);
                setTotalVendas(res.totalVendas);
                processarCelebracoes(res.colaboradores, res.totalVendas, res.metaEquipe);
            }
        } finally {
            setAtualizando(false);
        }
    }, [processarCelebracoes]);

    // Sem polling: atualizar é chamado via callback onDadosAlterados do modal

    const isTV = role === 'TV';
    const HEADER_HEIGHT = isTV ? 0 : 72;
    const MIN_ROW = isTV ? 130 : 100;
    const MAX_ROW = isTV ? 260 : 190;

    useEffect(() => {
        const calc = () => {
            if (colaboradores.length === 0) { setRowHeight(isTV ? 160 : 120); return; }
            setRowHeight(Math.max(MIN_ROW, Math.min(MAX_ROW, Math.floor((window.innerHeight - HEADER_HEIGHT) / colaboradores.length))));
        };
        calc();
        window.addEventListener("resize", calc);
        return () => window.removeEventListener("resize", calc);
    }, [colaboradores.length]);

    const metaEquipePct = metaEquipe > 0 ? Math.min((totalVendas / metaEquipe) * 100, 100) : 0;
    const equipeBateuMeta = metaEquipe > 0 && totalVendas >= metaEquipe;

    return (
        <main className="h-screen bg-[#020617] text-slate-200 font-sans overflow-hidden flex flex-col">
            {/* Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-blue-700/5 blur-[200px] rounded-full" />
                <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-indigo-800/5 blur-[180px] rounded-full" />
            </div>

            {/* ── Header (oculto no modo TV) ── */}
            {!isTV && <header
                className="relative z-10 flex items-center justify-between gap-4 px-6 lg:px-8 border-b border-white/5 bg-slate-950/60 backdrop-blur-2xl shrink-0"
                style={{ height: `${HEADER_HEIGHT}px` }}
            >
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2.5 rounded-2xl bg-white/5 border border-white/5 hover:border-blue-500/30 transition-all group"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-blue-600/10 border border-blue-500/20">
                            <Image src="/revenue.png" alt="Metas" width={22} height={22} className="object-contain" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black uppercase italic tracking-tighter text-white leading-none">
                                Alpha <span className="text-blue-500">Metas</span>
                            </h1>
                            <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                                {MESES[mesAtual - 1]} {anoAtual}
                                {" · "}
                                <span className="text-slate-500">{colaboradores.length} comerciais</span>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={atualizar}
                        disabled={atualizando}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-slate-500 hover:text-white hover:border-white/10 transition-all disabled:opacity-30"
                    >
                        <RefreshCw size={14} className={atualizando ? "animate-spin" : ""} />
                    </button>

                    {/* Widget meta equipe */}
                    <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all
                        ${equipeBateuMeta
                            ? "bg-amber-500/10 border-amber-500/30 shadow-[0_0_25px_-5px_rgba(245,158,11,0.3)]"
                            : "bg-slate-900/60 border-white/5"}`}>
                        <Target size={14} className={equipeBateuMeta ? "text-amber-400" : "text-slate-500"} />
                        <div>
                            <p className={`text-[8px] font-black uppercase tracking-widest ${equipeBateuMeta ? "text-amber-400" : "text-slate-500"}`}>
                                Meta Equipe
                            </p>
                            <p className="text-sm font-black leading-none">
                                <span className={equipeBateuMeta ? "text-amber-400" : "text-white"}>{totalVendas}</span>
                                <span className="text-slate-600 font-black"> / {metaEquipe || "—"}</span>
                            </p>
                        </div>
                        {metaEquipe > 0 && (
                            <div className="h-8 w-1.5 rounded-full bg-slate-800 overflow-hidden relative">
                                <div
                                    className={`absolute bottom-0 left-0 right-0 rounded-full transition-all duration-700 ${equipeBateuMeta ? "bg-amber-400" : "bg-blue-500"}`}
                                    style={{ height: `${metaEquipePct}%` }}
                                />
                            </div>
                        )}
                        {equipeBateuMeta && <Trophy size={14} className="text-amber-400" />}
                    </div>

                    <button
                        onClick={() => setModalGerenciamentoAberto(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-600/20 transition-all text-emerald-400"
                    >
                        <Briefcase size={15} />
                        <span className="text-[9px] font-black uppercase tracking-widest hidden sm:block">Gerenciamento de Leads</span>
                    </button>

                    {isAdmin && (
                        <button
                            onClick={() => setModalAberto(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-blue-600/10 border border-blue-500/20 hover:bg-blue-600/20 transition-all text-blue-400"
                        >
                            <Settings size={15} />
                            <span className="text-[9px] font-black uppercase tracking-widest hidden sm:block">Metas</span>
                        </button>
                    )}
                </div>
            </header>}

            {/* ── Scoreboard ── */}
            <div className="relative z-10 flex-1 flex flex-col overflow-y-auto py-3">
                {colaboradores.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-5 opacity-30">
                        <TrendingUp size={72} className="text-slate-700" strokeWidth={1} />
                        <div className="text-center">
                            <p className="text-sm font-black uppercase tracking-widest text-slate-500">
                                Nenhum usuário com role COMERCIAL
                            </p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 mt-1">
                                Cadastre usuários com role COMERCIAL para aparecerem aqui
                            </p>
                        </div>
                    </div>
                ) : (
                    colaboradores.map((colab, i) => (
                        <LinhaColaborador
                            key={colab.colaboradoraId}
                            colab={colab}
                            rank={i + 1}
                            rowHeight={rowHeight}
                        />
                    ))
                )}
            </div>

            {/* Celebrações individuais */}
            {celebrandoAtual && (
                <TelaCelebracaoIndividual
                    colab={celebrandoAtual}
                    onFechar={() => setCelebrandoAtual(null)}
                />
            )}

            {/* Celebração da equipe */}
            {celebrandoEquipe && !celebrandoAtual && (
                <TelaCelebracaoEquipe
                    colaboradores={colaboradores}
                    totalVendas={totalVendas}
                    meta={metaEquipe}
                    onFechar={() => setCelebrandoEquipe(false)}
                />
            )}

            {/* Modal admin metas */}
            {modalAberto && (
                <ModalConfigurar
                    mes={mesAtual}
                    ano={anoAtual}
                    onFechar={() => {
                        setModalAberto(false);
                        atualizar();
                    }}
                />
            )}

            {/* Modal gerenciamento de leads */}
            {modalGerenciamentoAberto && (
                <ModalGerenciamentoLeads
                    role={role}
                    nomeUsuario={nomeUsuario}
                    onFechar={() => setModalGerenciamentoAberto(false)}
                    onDadosAlterados={() => { void atualizar(); }}
                    onVendaFechada={(data) => {
                        setAlertaVenda({
                            tipo: data.pagamentoConfirmado && data.contratoAssinado ? "VENDA" : "PAGAMENTO",
                            closerNome: data.closerNome,
                            razaoSocial: data.razaoSocial,
                        });
                    }}
                />
            )}

            {/* Alerta de venda / pagamento */}
            {alertaVenda && (
                <AlertaVenda
                    tipo={alertaVenda.tipo}
                    closerNome={alertaVenda.closerNome}
                    razaoSocial={alertaVenda.razaoSocial}
                    onFechar={() => setAlertaVenda(null)}
                />
            )}
        </main>
    );
}
