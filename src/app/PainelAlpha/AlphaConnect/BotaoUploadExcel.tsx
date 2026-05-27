"use client";

import { useState, useRef } from "react";
import { FileUp, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { protocolarNoRadarAction, verificarCnpjsNoRadarFiscal } from "@/actions/RadarFiscal";

const CHUNK_DB = 200;   // CNPJs por consulta de banco (seguro para SQLite)
const DELAY_API = 61000; // ms entre chamadas externas (rate limit Receita)

type Fase = "idle" | "verificando" | "processando" | "concluido";

interface Progresso {
    fase: Fase;
    dbAtual: number;
    dbTotal: number;
    apiAtual: number;
    apiTotal: number;
    pulados: number;
    segundosRestantes: number;
}

export function BotaoUploadExcel() {
    const [prog, setProg] = useState<Progresso>({
        fase: "idle",
        dbAtual: 0,
        dbTotal: 0,
        apiAtual: 0,
        apiTotal: 0,
        pulados: 0,
        segundosRestantes: 0,
    });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const abortRef = useRef(false);

    const resetar = () => {
        abortRef.current = false;
        setProg({ fase: "idle", dbAtual: 0, dbTotal: 0, apiAtual: 0, apiTotal: 0, pulados: 0, segundosRestantes: 0 });
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const aguardar = async (ms: number, totalSegundos: number) => {
        const intervalo = 1000;
        let restante = totalSegundos;
        while (restante > 0 && !abortRef.current) {
            setProg((p) => ({ ...p, segundosRestantes: restante }));
            await new Promise((r) => setTimeout(r, intervalo));
            restante--;
        }
        setProg((p) => ({ ...p, segundosRestantes: 0 }));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        abortRef.current = false;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = new Uint8Array(event.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: "array" });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const json: unknown[] = XLSX.utils.sheet_to_json(worksheet);

                const todosCnpjs = json
                    .map((row) => {
                        const r = row as Record<string, unknown>;
                        const key = Object.keys(r).find((k) => k.toLowerCase() === "cnpj");
                        return key ? String(r[key]).replace(/\D/g, "").padStart(14, "0").substring(0, 14) : null;
                    })
                    .filter((c): c is string => !!c && c.length === 14);

                if (todosCnpjs.length === 0) {
                    toast.error("NENHUM CNPJ VÁLIDO ENCONTRADO");
                    return;
                }

                // ── Fase 1: verificar banco em chunks ──────────────────
                setProg((p) => ({
                    ...p,
                    fase: "verificando",
                    dbTotal: todosCnpjs.length,
                    dbAtual: 0,
                }));

                const jaNoDb = new Set<string>();
                const chunks: string[][] = [];
                for (let i = 0; i < todosCnpjs.length; i += CHUNK_DB) {
                    chunks.push(todosCnpjs.slice(i, i + CHUNK_DB));
                }

                for (let ci = 0; ci < chunks.length; ci++) {
                    if (abortRef.current) break;
                    const chunk = chunks[ci];
                    const res = await verificarCnpjsNoRadarFiscal(chunk);
                    if (res.success) {
                        res.encontrados.forEach((cnpj) => jaNoDb.add(cnpj));
                    }
                    setProg((p) => ({ ...p, dbAtual: Math.min((ci + 1) * CHUNK_DB, todosCnpjs.length) }));
                }

                const paraConsultar = todosCnpjs.filter((c) => !jaNoDb.has(c));
                const pulados = jaNoDb.size;

                if (paraConsultar.length === 0) {
                    toast.success(`TODOS OS ${todosCnpjs.length} CNPJs JÁ ESTÃO NO BANCO`);
                    resetar();
                    return;
                }

                toast.info(
                    `${pulados} já no banco · ${paraConsultar.length} serão consultados na API`,
                );

                // ── Fase 2: consultar API só para os que faltam ────────
                setProg((p) => ({
                    ...p,
                    fase: "processando",
                    apiTotal: paraConsultar.length,
                    apiAtual: 0,
                    pulados,
                }));

                for (let i = 0; i < paraConsultar.length; i++) {
                    if (abortRef.current) break;
                    const cnpjAtual = paraConsultar[i];
                    setProg((p) => ({ ...p, apiAtual: i + 1 }));

                    try {
                        const response = await fetch(`/api/RadarFiscal?cnpj=${cnpjAtual}`);
                        if (!response.ok) {
                            if (response.status === 429) {
                                toast.error(`LIMITE DA RECEITA ATINGIDO — CNPJ ${cnpjAtual}`);
                            }
                        } else {
                            const dadosBrutos = await response.json();
                            if (dadosBrutos && !dadosBrutos.error) {
                                await protocolarNoRadarAction(dadosBrutos);
                            }
                        }
                    } catch (err) {
                        console.error(`CNPJ ${cnpjAtual}:`, err);
                    }

                    if (i < paraConsultar.length - 1 && !abortRef.current) {
                        await aguardar(DELAY_API, 61);
                    }
                }

                if (!abortRef.current) {
                    toast.success(`LOTE FINALIZADO — ${paraConsultar.length} consultados, ${pulados} pulados (já no banco)`);
                }
            } catch {
                toast.error("ERRO CRÍTICO AO LER PLANILHA");
            } finally {
                resetar();
            }
        };

        reader.readAsArrayBuffer(file);
    };

    const processando = prog.fase !== "idle";

    const labelBtn = () => {
        if (prog.fase === "verificando") {
            return `VERIFICANDO BANCO ${prog.dbAtual}/${prog.dbTotal}`;
        }
        if (prog.fase === "processando") {
            if (prog.segundosRestantes > 0) return `PRÓXIMO EM ${prog.segundosRestantes}S`;
            return `CONSULTANDO API ${prog.apiAtual}/${prog.apiTotal}`;
        }
        return null;
    };

    return (
        <>
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".xlsx, .xls"
                className="hidden"
            />
            <button
                onClick={() => {
                    if (processando) {
                        abortRef.current = true;
                        return;
                    }
                    fileInputRef.current?.click();
                }}
                disabled={false}
                title={processando ? "Clique para cancelar" : "Upload Excel"}
                className={`cursor-pointer h-14 px-6 rounded-2xl flex items-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                    processando
                        ? "bg-amber-600/10 border border-amber-600/20 text-amber-400 hover:bg-red-600/20 hover:text-red-400 hover:border-red-600/30"
                        : "bg-emerald-600/10 border border-emerald-600/20 text-emerald-500 hover:bg-emerald-600 hover:text-white"
                }`}
            >
                {processando ? (
                    <>
                        <Loader2 size={18} className="animate-spin shrink-0" />
                        <span className="truncate max-w-[220px]">{labelBtn()}</span>
                    </>
                ) : (
                    <>
                        <FileUp size={18} /> Upload Excel
                    </>
                )}
            </button>
        </>
    );
}
