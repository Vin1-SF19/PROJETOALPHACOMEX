"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
    Settings, Trophy, Target, ArrowLeft,
    X, Check, RefreshCw, Users, Loader2, Crown, TrendingUp, Briefcase,
    Eye, EyeOff, Tv, FileText,
} from "lucide-react";
import ModalGerenciamentoLeads from "@/components/comercial/ModalGerenciamentoLeads";
import { ModalJustificativaMeta } from "@/components/Metas/ModalJustificativaMeta";
import { pusherClient } from "@/lib/pusher";
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

function tocarSomMeta(tipo: "individual" | "equipe" | "super") {
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

                if (tipo === "super") {
                    [1046.5, 1318.5, 1568, 2093].forEach((freq, index) => {
                        nota(freq, 1.05 + index * 0.12, 1.8, 0.78 - index * 0.1, index % 2 ? "sine" : "sawtooth");
                    });
                    boom(1.05, 1.2);
                    boom(1.55, 0.9);
                    noise(1.05, 0.35, 0.65);
                }
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
        // Som de comemoração só para venda fechada (pagamento + contrato)
        if (tipo === "VENDA") {
            try {
                const audio = new Audio("/sounds/efeitoVendaUnica.mp3");
                audio.volume = 0.85;
                void audio.play().catch(() => {});
            } catch {}
        }
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
    const bateuSuperMeta = colab.superMeta > 0 && colab.vendas >= colab.superMeta;
    const faltam = colab.meta > colab.vendas ? colab.meta - colab.vendas : 0;
    const quaseNaMeta = faltam > 0 && faltam <= 2;
    const alvoProgresso = colab.superMeta > 0 ? colab.superMeta : colab.meta;
    const progresso = alvoProgresso > 0 ? Math.min((colab.vendas / alvoProgresso) * 100, 100) : 0;
    const accentRgb = tema.accent;

    // Linha tem altura FIXA (rowHeight) — a pill nunca ultrapassa esse valor,
    // senão a lista cresce além da tela e volta o scroll. Um teto (160px) evita
    // que, com poucos colaboradores, as pills fiquem gigantes e grudadas.
    const gap = Math.min(28, Math.max(8, Math.round(rowHeight * 0.16)));
    const barHeight = Math.max(38, Math.min(128, rowHeight - gap));
    const avatarDiam = Math.min(barHeight + 10, rowHeight - 4);
    const avatarRad = avatarDiam / 2;

    const fontVendas = Math.max(17, Math.round(barHeight * 0.38));
    const fontNome   = Math.max(12, Math.round(barHeight * 0.20));
    const fontStatus = Math.max(8,  Math.round(barHeight * 0.095));
    const fontRank   = Math.max(13, Math.round(barHeight * 0.28));

    return (
        <div
            className="flex items-center px-3 sm:px-6 lg:px-10 shrink-0"
            style={{ height: `${rowHeight}px`, paddingTop: `${gap / 2}px`, paddingBottom: `${gap / 2}px` }}
        >

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
                        nome={colab.usuario}
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
                            {bateuSuperMeta ? "SUPER META BATIDA" : "META BATIDA"}
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
                            {colab.usuario}
                        </h3>
                        <p className={`font-black uppercase tracking-[0.15em] mt-0.5
                            ${bateuMeta ? "text-amber-500/80" : quaseNaMeta ? "text-white/50" : "text-slate-700"}`}
                            style={{ fontSize: `${fontStatus}px` }}
                        >
                            {bateuSuperMeta ? "● SUPER META BATIDA"
                                : bateuMeta ? "● META BATIDA"
                                : quaseNaMeta ? `⚡ FALTA ${faltam}!`
                                : colab.meta > 0 ? "EM PROGRESSO" : "SEM META"}
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

                    {/* Meta normal ao lado de vendas totais / super meta */}
                    <div className="shrink-0 flex items-center gap-2 sm:gap-3 ml-auto">
                        <span
                            title={`Meta normal: ${colab.meta || "não definida"}`}
                            aria-label={`Meta normal ${colab.meta || "não definida"}`}
                            className={`font-black tabular-nums leading-none ${bateuMeta ? "text-red-400" : "text-slate-400"}`}
                            style={{ fontSize: `${Math.round(fontVendas * 0.72)}px` }}
                        >
                            {colab.meta || "—"}
                        </span>
                        <span className="h-5 w-px bg-white/10" aria-hidden="true" />
                        <div className="flex items-baseline gap-1">
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
                            {colab.superMeta || "—"}
                        </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Termômetro lateral da meta coletiva ────────────────────────────────────
// Principal: só closers (meta + super meta). Ramal lateral: total geral,
// incluindo líderes comerciais, medido contra a Meta Alpha (sem ela, usa o alvo das closers).

function TermometroMetaEquipe({ totalVendas, totalGeral, meta, superMeta, metaAlpha }: {
    totalVendas: number;
    totalGeral: number;
    meta: number;
    superMeta: number;
    metaAlpha: number;
}) {
    const bateuMeta = meta > 0 && totalVendas >= meta;
    const bateuSuperMeta = superMeta > 0 && totalVendas >= superMeta;
    const faltam = meta > totalVendas ? meta - totalVendas : 0;
    const alvo = superMeta > 0 ? superMeta : meta;
    const progresso = alvo > 0 ? Math.min((totalVendas / alvo) * 100, 100) : 0;
    const posicaoMeta = alvo > 0 && meta > 0 ? Math.min((meta / alvo) * 100, 100) : 0;

    const alvoGeral = metaAlpha > 0 ? metaAlpha : alvo;
    const progressoGeral = alvoGeral > 0 ? Math.min((totalGeral / alvoGeral) * 100, 100) : 0;
    const geralBateuAlvo = alvoGeral > 0 && totalGeral >= alvoGeral;

    return (
        <aside
            data-team-goal-thermometer
            aria-label={alvo > 0
                ? `Closers com ${totalVendas} vendas; meta ${meta || "não definida"}; super meta ${superMeta || "não definida"}; total geral ${totalGeral}${metaAlpha > 0 ? ` de meta Alpha ${metaAlpha}` : ""}`
                : `Meta da equipe: ${totalVendas} vendas de closers e ${totalGeral} no total, sem meta definida`}
            className={`relative z-10 w-[136px] sm:w-[168px] lg:w-[196px] shrink-0 border-r bg-slate-950/35 px-2 sm:px-3 py-4 sm:py-5 flex flex-col items-center overflow-hidden ${bateuMeta ? "border-red-600/40" : "border-white/[0.06]"}`}
        >
            <p className={`text-[8px] sm:text-[9px] font-black uppercase tracking-[0.16em] sm:tracking-[0.22em] text-center ${bateuSuperMeta ? "text-amber-300" : bateuMeta ? "text-red-400" : "text-blue-300"}`}>
                Meta Equipe
            </p>

            <div className="relative flex-1 w-full min-h-0 mt-3 flex items-end">
                {/* Termômetro principal — closers */}
                <div className={`relative flex-1 min-w-0 h-full flex flex-col items-center justify-end ${bateuMeta ? "animate-pulse" : ""}`}>
                    {bateuMeta && (
                        <div className={`absolute top-0 z-30 h-8 w-8 sm:h-9 sm:w-9 rounded-full border-2 border-[#020617] flex items-center justify-center ${bateuSuperMeta ? "bg-amber-300 shadow-[0_0_32px_rgba(251,191,36,0.85)]" : "bg-red-600 shadow-[0_0_30px_rgba(220,38,38,0.8)]"}`}>
                            <Trophy size={14} className="text-slate-950" />
                        </div>
                    )}

                    <div
                        role={alvo > 0 ? "progressbar" : undefined}
                        aria-valuemin={alvo > 0 ? 0 : undefined}
                        aria-valuemax={alvo > 0 ? alvo : undefined}
                        aria-valuenow={alvo > 0 ? Math.min(totalVendas, alvo) : undefined}
                        aria-valuetext={alvo > 0 ? `${totalVendas} vendas de closers de ${alvo}` : "Metas não definidas"}
                        className={`relative flex-1 min-h-[92px] w-8 sm:w-10 rounded-t-full rounded-b-md border ${bateuSuperMeta ? "border-amber-300/80" : bateuMeta ? "border-red-500/80 shadow-[0_0_30px_rgba(185,28,28,0.55)]" : "border-blue-400/30"} bg-slate-950/90 shadow-inner`}
                    >
                        <div className="absolute inset-0 overflow-hidden rounded-t-full rounded-b-md">
                            <div className="absolute inset-x-0 top-3 bottom-3 flex flex-col justify-between pointer-events-none z-10">
                            {[100, 75, 50, 25].map((marca) => (
                                <span key={marca} className="block h-px w-full bg-white/10" />
                            ))}
                            </div>
                            <div
                                data-team-goal-fill
                                className={`absolute inset-x-0 bottom-0 transition-[height] duration-1000 ease-out motion-reduce:transition-none ${bateuMeta ? "bg-gradient-to-t from-red-950 via-red-700 to-red-500" : "bg-gradient-to-t from-blue-700 via-blue-500 to-cyan-300"}`}
                                style={{ height: `${progresso}%` }}
                            />
                            <div className={`absolute inset-x-0 bottom-0 h-1/3 blur-lg pointer-events-none ${bateuMeta ? "bg-red-600/45" : "bg-blue-400/25"}`} />
                        </div>

                        {meta > 0 && (
                            <div
                                data-team-goal-normal-marker
                                className="absolute inset-x-0 z-20 flex flex-col items-center"
                                style={{ bottom: `calc(${Math.min(posicaoMeta, 75)}% - 1px)` }}
                            >
                                <span className="mb-0.5 rounded bg-slate-950/85 px-1 py-px text-[7px] sm:text-[8px] font-black uppercase leading-none tabular-nums text-red-200 whitespace-nowrap">Meta {meta}</span>
                                <span className="h-0.5 w-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.9)]" />
                            </div>
                        )}
                        {/* Número da super meta fica logo abaixo da barra limitadora, fora do recorte do tubo */}
                        {superMeta > 0 && (
                            <div data-team-goal-super-marker className="absolute inset-x-0 top-2 z-20 flex flex-col items-center">
                                <span className="h-0.5 w-full bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)]" />
                                <span className="mt-0.5 rounded bg-slate-950/85 px-1 py-px text-[7px] sm:text-[8px] font-black uppercase leading-none tabular-nums text-amber-200 whitespace-nowrap">Super Meta {superMeta}</span>
                            </div>
                        )}
                    </div>

                    <div
                        data-team-goal-reading
                        className={`relative z-20 -mt-2 h-[62px] w-[62px] sm:h-[76px] sm:w-[76px] rounded-full border-[3px] flex flex-col items-center justify-center text-center ${bateuSuperMeta ? "bg-gradient-to-br from-red-600 to-amber-400 border-amber-200 text-white shadow-[0_0_38px_rgba(251,191,36,0.7)]" : bateuMeta ? "bg-gradient-to-br from-red-700 to-red-950 border-red-400 text-white shadow-[0_0_34px_rgba(220,38,38,0.7)]" : "bg-gradient-to-br from-blue-600 to-indigo-800 border-blue-300/70 text-white shadow-[0_0_24px_rgba(59,130,246,0.38)]"}`}
                        style={{
                            textShadow: "0 0 14px rgba(255,255,255,0.28)",
                        }}
                    >
                        <span className="text-xl sm:text-2xl font-black tabular-nums tracking-tighter leading-none whitespace-nowrap">
                            {totalVendas}
                        </span>
                        <span className="mt-1 text-[6px] sm:text-[7px] font-black uppercase tracking-[0.12em] text-white/80">
                            {bateuSuperMeta ? "Super meta!" : bateuMeta ? "Meta batida" : meta > 0 ? `Faltam ${faltam}` : "Sem meta"}
                        </span>
                    </div>
                </div>

                {/* Ramal lateral — total geral (closers + líderes comerciais) */}
                <div data-team-goal-total-branch className="relative h-full flex items-end shrink-0">
                    <span
                        aria-hidden
                        className={`-ml-1.5 mb-[74px] sm:mb-[88px] h-2 w-3 sm:w-4 border-y ${geralBateuAlvo ? "border-amber-300/70 bg-amber-400/40" : "border-violet-400/40 bg-violet-500/25"}`}
                    />
                    <div className="flex h-[62%] min-h-[150px] flex-col items-center">
                        <p className="mb-1.5 text-[7px] sm:text-[8px] font-black uppercase tracking-[0.14em] text-violet-200 text-center leading-tight">
                            Meta<br />Alpha
                        </p>
                        <div
                            role={alvoGeral > 0 ? "progressbar" : undefined}
                            aria-valuemin={alvoGeral > 0 ? 0 : undefined}
                            aria-valuemax={alvoGeral > 0 ? alvoGeral : undefined}
                            aria-valuenow={alvoGeral > 0 ? Math.min(totalGeral, alvoGeral) : undefined}
                            aria-valuetext={alvoGeral > 0 ? `${totalGeral} vendas no total de ${alvoGeral}` : `${totalGeral} vendas no total`}
                            className={`relative flex-1 min-h-[60px] w-5 sm:w-6 overflow-hidden rounded-t-full rounded-b-md border ${geralBateuAlvo ? "border-amber-300/80 shadow-[0_0_20px_rgba(251,191,36,0.5)]" : "border-violet-400/40"} bg-slate-950/90 shadow-inner`}
                        >
                            <div
                                data-team-goal-total-fill
                                className={`absolute inset-x-0 bottom-0 transition-[height] duration-1000 ease-out motion-reduce:transition-none ${geralBateuAlvo ? "bg-gradient-to-t from-red-700 via-amber-500 to-amber-300" : "bg-gradient-to-t from-violet-800 via-violet-500 to-fuchsia-300"}`}
                                style={{ height: `${progressoGeral}%` }}
                            />
                            {alvoGeral > 0 && (
                                <span className="absolute inset-x-0 top-2 z-10 h-0.5 bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.9)]" />
                            )}
                        </div>
                        <div className="h-[62px] sm:h-[76px] flex items-center">
                            <span
                                data-team-goal-total-reading
                                className={`rounded-lg border px-1.5 py-1 text-[11px] sm:text-sm font-black tabular-nums leading-none whitespace-nowrap ${geralBateuAlvo ? "border-amber-300/70 bg-amber-400/15 text-amber-200" : "border-violet-400/40 bg-violet-500/10 text-violet-100"}`}
                            >
                                {totalGeral}{alvoGeral > 0 && <span className="text-white/50">/{alvoGeral}</span>}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
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
                                {colab.usuario.substring(0, 2).toUpperCase()}
                            </span>
                        </div>
                        {colab.imagemUrl && (
                            <Image src={colab.imagemUrl} alt={colab.usuario} fill unoptimized className="object-cover relative z-10" />
                        )}
                    </div>
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 h-10 w-10 rounded-full bg-amber-400 border-4 border-[#040d1a] flex items-center justify-center shadow-xl">
                        <Crown size={18} className="text-slate-900" />
                    </div>
                </div>

                <div className="space-y-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.6em] text-red-500">Parabéns</p>
                    <h2 className="text-6xl font-black uppercase italic text-white tracking-tighter leading-none">
                        {colab.usuario}
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

function TelaCelebracaoEquipe({ colaboradores, totalVendas, meta, superMeta = 0, superMetaAtingida = false, onFechar }: {
    colaboradores: ColaboradorMeta[];
    totalVendas: number;
    meta: number;
    superMeta?: number;
    superMetaAtingida?: boolean;
    onFechar: () => void;
}) {
    useEffect(() => {
        tocarSomMeta(superMetaAtingida ? "super" : "equipe");
        const t = setTimeout(onFechar, superMetaAtingida ? 22_000 : 18_000);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div
            className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none overflow-hidden ${superMetaAtingida ? "bg-[#160308]" : "bg-[#040d1a]"}`}
        >
            {/* Red accent frame */}
            <div className="absolute inset-0 pointer-events-none">
                <div className={`absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent ${superMetaAtingida ? "via-amber-300" : "via-red-600"} to-transparent`} />
                <div className={`absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent ${superMetaAtingida ? "via-amber-300" : "via-red-600"} to-transparent`} />
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
                {superMetaAtingida && (
                    <>
                        <div className="absolute inset-[-20%] bg-[radial-gradient(circle_at_center,rgba(251,191,36,0.18),transparent_55%)] animate-pulse" />
                        {Array.from({ length: 24 }).map((_, index) => (
                            <span
                                key={index}
                                className="absolute h-2 w-2 rotate-45 bg-amber-300 animate-pulse shadow-[0_0_16px_rgba(252,211,77,0.9)]"
                                style={{ left: `${4 + ((index * 37) % 92)}%`, top: `${5 + ((index * 53) % 88)}%`, animationDelay: `${(index % 7) * 120}ms` }}
                            />
                        ))}
                    </>
                )}
            </div>

            <div className="absolute top-8 left-10 text-[9px] font-black text-red-900 uppercase tracking-[0.4em]">
                {superMetaAtingida ? "ALPHA::EQUIPE::SUPER::META" : "ALPHA::EQUIPE::META::REACHED"}
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
                                            {c.usuario.substring(0, 2).toUpperCase()}
                                        </span>
                                    </div>
                                    {c.imagemUrl && (
                                        <Image src={c.imagemUrl} alt={c.usuario} fill unoptimized className="object-cover relative z-10" />
                                    )}
                                </div>
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-wide max-w-[64px] truncate">
                                    {c.usuario}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Text */}
                <div className="space-y-3">
                    <p className={`text-[11px] font-black uppercase tracking-[0.6em] ${superMetaAtingida ? "text-amber-300" : "text-red-500"}`}>
                        {superMetaAtingida ? "Conquista Extraordinária" : "Parabéns — Equipe Comercial"}
                    </p>
                    <h2 className={`text-5xl lg:text-7xl font-black uppercase italic tracking-tighter leading-none ${superMetaAtingida ? "text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-amber-200 to-red-400 drop-shadow-[0_0_30px_rgba(251,191,36,0.5)]" : "text-white"}`}>
                        {superMetaAtingida ? "Super Meta Batida!" : "Meta Batida!"}
                    </h2>
                    <div className="flex items-center justify-center gap-3 mt-3">
                        <Trophy size={24} className="text-amber-400" />
                        <p className="text-xl text-slate-200 font-black">
                            <span className="text-red-400">{totalVendas}</span>
                            <span className="text-slate-500"> / {superMetaAtingida ? superMeta : meta} vendas</span>
                        </p>
                        <Trophy size={24} className="text-amber-400" />
                    </div>
                </div>

            </div>
        </div>
    );
}

// ─── Modal de configuração (admin) ───────────────────────────────────────────

type ColabConfig = { id: number; colaboradoraId: string; usuario: string; meta: number; superMeta: number; visivelNoPainel: boolean };

function ModalConfigurar({ mes, ano, onFechar }: { mes: number; ano: number; onFechar: () => void }) {
    const [colabs, setColabs] = useState<ColabConfig[]>([]);
    const [metaEquipe, setMetaEquipe] = useState(0);
    const [superMetaEquipe, setSuperMetaEquipe] = useState(0);
    const [metaAlphaEquipe, setMetaAlphaEquipe] = useState(0);
    const [metaEquipeEditada, setMetaEquipeEditada] = useState(false);
    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [togglingId, setTogglingId] = useState<number | null>(null);

    useEffect(() => {
        getColaboradoresParaConfigurar().then((res) => {
            if (res.success) {
                const colaboradores = res.colaboradores as ColabConfig[];
                const somaMetas = colaboradores.reduce((total, colaborador) => total + colaborador.meta, 0);
                setColabs(colaboradores);
                setMetaEquipe(res.metaEquipe || somaMetas);
                setSuperMetaEquipe(res.superMetaEquipe);
                setMetaAlphaEquipe(res.metaAlphaEquipe);
                setMetaEquipeEditada(res.metaEquipe > 0 && res.metaEquipe !== somaMetas);
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
        const superMetaInvalida = colabs.some((c) => c.superMeta > 0 && c.superMeta < c.meta);
        if (superMetaInvalida || (superMetaEquipe > 0 && superMetaEquipe < metaEquipe)) {
            toast.error("A super meta deve ser igual ou maior que a meta normal");
            return;
        }
        setSalvando(true);
        try {
            const resultados = await Promise.all([
                upsertMetaEquipe(metaEquipe, superMetaEquipe, metaAlphaEquipe, mes, ano),
                ...colabs.map((c) => upsertMetaUsuario(c.colaboradoraId, c.meta, c.superMeta, mes, ano)),
            ]);
            if (resultados.some((resultado) => !resultado.success)) {
                throw new Error("Falha ao persistir uma ou mais metas");
            }
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
                                {MESES[mes - 1]} {ano} · equipe comercial
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
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <label className="text-[10px] font-black uppercase text-blue-400 tracking-widest flex items-center gap-2">
                                        <Users size={12} /> Metas Gerais da Equipe
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMetaEquipe(colabs.reduce((total, colaborador) => total + colaborador.meta, 0));
                                            setMetaEquipeEditada(false);
                                        }}
                                        className="text-[8px] font-black uppercase tracking-wider text-blue-300/70 hover:text-blue-200"
                                    >
                                        Usar soma
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    <label className="space-y-1.5 text-[8px] font-black uppercase tracking-widest text-slate-500">
                                        Meta normal
                                        <input
                                            type="number"
                                            value={metaEquipe}
                                            onChange={(e) => {
                                                setMetaEquipe(Number(e.target.value));
                                                setMetaEquipeEditada(true);
                                            }}
                                            min={0}
                                            className="w-full h-12 bg-black/60 border border-blue-500/20 rounded-xl px-4 text-white font-black text-xl focus:border-blue-500/50 outline-none"
                                            placeholder="0"
                                        />
                                    </label>
                                    <label className="space-y-1.5 text-[8px] font-black uppercase tracking-widest text-amber-400/80">
                                        Super meta
                                        <input
                                            type="number"
                                            value={superMetaEquipe}
                                            onChange={(e) => setSuperMetaEquipe(Number(e.target.value))}
                                            min={0}
                                            className="w-full h-12 bg-black/60 border border-amber-500/25 rounded-xl px-4 text-amber-200 font-black text-xl focus:border-amber-400/60 outline-none"
                                            placeholder="0"
                                        />
                                    </label>
                                    <label className="space-y-1.5 text-[8px] font-black uppercase tracking-widest text-violet-300/80">
                                        Meta Alpha · closers + líderes
                                        <input
                                            type="number"
                                            value={metaAlphaEquipe}
                                            onChange={(e) => setMetaAlphaEquipe(Number(e.target.value))}
                                            min={0}
                                            className="w-full h-12 bg-black/60 border border-violet-500/25 rounded-xl px-4 text-violet-200 font-black text-xl focus:border-violet-400/60 outline-none"
                                            placeholder="0"
                                        />
                                    </label>
                                </div>
                                <p className="mt-2 text-[8px] font-bold text-slate-600">
                                    {metaEquipeEditada ? "Valor geral personalizado" : "Meta geral sincronizada com a soma individual"}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1 flex items-center gap-2">
                                    <Target size={11} /> Metas Individuais · Equipe Comercial
                                </p>
                                {colabs.length === 0 && (
                                    <p className="text-xs text-slate-600 text-center py-6">
                                        Nenhum integrante comercial encontrado.
                                    </p>
                                )}
                                {colabs.map((c, i) => (
                                    <div key={c.colaboradoraId} className={`flex items-center gap-3 p-4 rounded-2xl border transition-all ${c.visivelNoPainel ? "bg-slate-900/50 border-white/5" : "bg-slate-950/50 border-white/[0.03] opacity-60"}`}>
                                        <span className={`flex-1 text-[11px] font-black uppercase truncate ${c.visivelNoPainel ? "text-white" : "text-slate-500 line-through"}`}>{c.usuario}</span>
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
                                        <label className="w-20 sm:w-24 shrink-0 text-center text-[7px] font-black uppercase tracking-widest text-slate-600">
                                            Meta
                                            <input
                                                type="number"
                                                value={c.meta}
                                                onChange={(e) => {
                                                    const novo = [...colabs];
                                                    novo[i] = { ...novo[i], meta: Number(e.target.value) };
                                                    setColabs(novo);
                                                    if (!metaEquipeEditada) {
                                                        setMetaEquipe(novo.reduce((total, colaborador) => total + colaborador.meta, 0));
                                                    }
                                                }}
                                                min={0}
                                                aria-label={`Meta normal de ${c.usuario}`}
                                                className="mt-1 w-full h-10 bg-black/60 border border-white/10 rounded-xl px-2 text-white font-black text-sm focus:border-blue-500/50 outline-none text-center"
                                                placeholder="0"
                                            />
                                        </label>
                                        <label className="w-20 sm:w-24 shrink-0 text-center text-[7px] font-black uppercase tracking-widest text-amber-500/60">
                                            Super meta
                                            <input
                                                type="number"
                                                value={c.superMeta}
                                                onChange={(e) => {
                                                    const novo = [...colabs];
                                                    novo[i] = { ...novo[i], superMeta: Number(e.target.value) };
                                                    setColabs(novo);
                                                }}
                                                min={0}
                                                aria-label={`Super meta de ${c.usuario}`}
                                                className="mt-1 w-full h-10 bg-black/60 border border-amber-500/20 rounded-xl px-2 text-amber-200 font-black text-sm focus:border-amber-400/60 outline-none text-center"
                                                placeholder="0"
                                            />
                                        </label>
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
    const [superMetaEquipe, setSuperMetaEquipe] = useState(dadosIniciais.success ? dadosIniciais.superMetaEquipe : 0);
    const [metaAlphaEquipe, setMetaAlphaEquipe] = useState(dadosIniciais.success ? dadosIniciais.metaAlphaEquipe : 0);
    const [totalVendas, setTotalVendas] = useState(dadosIniciais.success ? dadosIniciais.totalVendas : 0);
    const [totalVendasGeral, setTotalVendasGeral] = useState(dadosIniciais.success ? dadosIniciais.totalVendasGeral : 0);
    const [atualizando, setAtualizando] = useState(false);
    const [modalAberto, setModalAberto] = useState(false);
    const [modoTV, setModoTV] = useState(false);
    const [modalGerenciamentoAberto, setModalGerenciamentoAberto] = useState(false);
    const [modalJustificativaAberto, setModalJustificativaAberto] = useState(false);
    const [rowHeight, setRowHeight] = useState(120);
    const scoreboardRef = useRef<HTMLDivElement>(null);

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
    const [celebrandoSuperMetaEquipe, setCelebrandoSuperMetaEquipe] = useState(false);
    const equipeJaCelebradaRef = useRef(false);
    const superMetaEquipeJaCelebradaRef = useRef(false);

    const processarCelebracoes = useCallback((colabs: ColaboradorMeta[], total: number, meta: number, superMeta: number) => {
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

        let atrasoEquipe = novosIndividuais.length * 10_500;
        if (meta > 0 && total >= meta && !equipeJaCelebradaRef.current) {
            equipeJaCelebradaRef.current = true;
            try { sessionStorage.setItem(`metas-eq-${mesAtual}-${anoAtual}`, "true"); } catch {}
            setTimeout(() => setCelebrandoEquipe(true), atrasoEquipe);
            atrasoEquipe += 18_500;
        }

        if (superMeta > 0 && total >= superMeta && !superMetaEquipeJaCelebradaRef.current) {
            superMetaEquipeJaCelebradaRef.current = true;
            try { sessionStorage.setItem(`metas-eq-super-${mesAtual}-${anoAtual}`, "true"); } catch {}
            setTimeout(() => setCelebrandoSuperMetaEquipe(true), atrasoEquipe);
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
            superMetaEquipeJaCelebradaRef.current =
                sessionStorage.getItem(`metas-eq-super-${mesAtual}-${anoAtual}`) === "true";
        } catch {}

        if (dadosIniciais.success) {
            processarCelebracoes(
                dadosIniciais.colaboradores,
                dadosIniciais.totalVendas,
                dadosIniciais.metaEquipe,
                dadosIniciais.superMetaEquipe,
            );
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
                setSuperMetaEquipe(res.superMetaEquipe);
                setMetaAlphaEquipe(res.metaAlphaEquipe);
                setTotalVendas(res.totalVendas);
                setTotalVendasGeral(res.totalVendasGeral);
                processarCelebracoes(res.colaboradores, res.totalVendas, res.metaEquipe, res.superMetaEquipe);
            }
        } finally {
            setAtualizando(false);
        }
    }, [processarCelebracoes]);

    // Real-time: atualiza sozinho quando um closer confirma uma venda (venda-confirmada
    // disparado por confirmarFechamento em ContratoComercial.ts), sem depender de refresh manual.
    useEffect(() => {
        const client = pusherClient;
        if (!client) return;
        const channel = client.subscribe("private-metas-alpha");
        channel.bind("venda-confirmada", () => {
            void atualizar();
        });
        return () => {
            try {
                channel.unbind("venda-confirmada");
                client.unsubscribe("private-metas-alpha");
            } catch {
                // ignore cleanup errors on closed connection
            }
        };
    }, [atualizar]);

    const isTV = role === 'TV' || modoTV;

    const toggleModoTV = () => {
        const next = !modoTV;
        setModoTV(next);
        window.parent.postMessage({ type: 'ALPHA_TV_MODE', active: next }, '*');
    };
    const HEADER_HEIGHT = 72;
    useEffect(() => {
        const el = scoreboardRef.current;
        if (!el) return;
        const calc = () => {
            // Mede a altura REAL do container (não window.innerHeight — dentro de iframe
            // o tamanho da janela pode não bater com a área que o iframe realmente ocupa).
            // O termômetro ocupa apenas o eixo horizontal. A altura é distribuída
            // exclusivamente entre as linhas individuais (ou o estado vazio).
            const alturaDisponivel = el.clientHeight;
            if (alturaDisponivel <= 0) return;
            const totalLinhas = Math.max(colaboradores.length, 1);
            setRowHeight(Math.floor(alturaDisponivel / totalLinhas));
        };
        calc();
        const observer = new ResizeObserver(calc);
        observer.observe(el);
        return () => observer.disconnect();
    }, [colaboradores.length, isTV]);

    return (
        <main className="h-screen bg-[#020617] text-slate-200 font-sans overflow-hidden flex flex-col">
            {/* Background */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-blue-700/5 blur-[200px] rounded-full" />
                <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-indigo-800/5 blur-[180px] rounded-full" />
            </div>

            {/* Saída do modo TV manual; a meta coletiva agora vive somente no placar. */}
            {isTV && modoTV && (
                <button
                    onClick={toggleModoTV}
                    title="Sair do Modo TV"
                    className="fixed right-4 top-4 z-20 h-11 w-11 rounded-xl bg-slate-950/80 border border-white/10 text-slate-500 hover:text-white hover:bg-white/10 transition-all backdrop-blur-xl flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                    <Tv size={13} />
                </button>
            )}

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

                    <button
                        onClick={() => setModalGerenciamentoAberto(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-600/20 transition-all text-emerald-400"
                    >
                        <Briefcase size={15} />
                        <span className="text-[9px] font-black uppercase tracking-widest hidden sm:block">Gerenciamento de Leads</span>
                    </button>

                    <button
                        onClick={() => setModalJustificativaAberto(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-600/10 border border-amber-500/20 hover:bg-amber-600/20 transition-all text-amber-400"
                    >
                        <FileText size={15} />
                        <span className="text-[9px] font-black uppercase tracking-widest hidden sm:block">Justificativa de Meta</span>
                    </button>

                    {(isAdmin || role === 'CEO' || role === 'Lider Comercial') && (
                        <button
                            onClick={() => setModalAberto(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-blue-600/10 border border-blue-500/20 hover:bg-blue-600/20 transition-all text-blue-400"
                        >
                            <Settings size={15} />
                            <span className="text-[9px] font-black uppercase tracking-widest hidden sm:block">Metas</span>
                        </button>
                    )}

                    <button
                        onClick={toggleModoTV}
                        title="Modo TV — oculta sidebar e abas"
                        className={`p-2.5 rounded-xl border transition-all ${
                            modoTV
                                ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                                : "bg-white/5 border-white/5 text-slate-500 hover:text-white hover:border-white/10"
                        }`}
                    >
                        <Tv size={14} />
                    </button>
                </div>
            </header>}

            {/* ── Scoreboard — termômetro coletivo lateral + linhas individuais ── */}
            <div ref={scoreboardRef} className="relative z-10 flex-1 flex overflow-hidden">
                <TermometroMetaEquipe totalVendas={totalVendas} totalGeral={totalVendasGeral} meta={metaEquipe} superMeta={superMetaEquipe} metaAlpha={metaAlphaEquipe} />

                <div className="min-w-0 flex-1 flex flex-col overflow-hidden">
                    {colaboradores.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-5 opacity-30 px-4">
                            <TrendingUp size={72} className="text-slate-700" strokeWidth={1} />
                            <div className="text-center">
                                <p className="text-sm font-black uppercase tracking-widest text-slate-500">
                                    Nenhum integrante comercial visível
                                </p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 mt-1">
                                    Ajuste a visibilidade de closers e líderes em Configurar Metas
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
                    superMeta={superMetaEquipe}
                    onFechar={() => setCelebrandoEquipe(false)}
                />
            )}

            {/* Celebração exuberante da super meta da equipe */}
            {celebrandoSuperMetaEquipe && !celebrandoAtual && !celebrandoEquipe && (
                <TelaCelebracaoEquipe
                    colaboradores={colaboradores}
                    totalVendas={totalVendas}
                    meta={metaEquipe}
                    superMeta={superMetaEquipe}
                    superMetaAtingida
                    onFechar={() => setCelebrandoSuperMetaEquipe(false)}
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

            {/* Modal justificativa de meta */}
            <ModalJustificativaMeta
                open={modalJustificativaAberto}
                onOpenChange={setModalJustificativaAberto}
                podeGerenciar={isAdmin || role === 'CEO' || role === 'Lider Comercial'}
                mesAtual={mesAtual}
                anoAtual={anoAtual}
            />

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
