"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { FichaAlphaDados } from "@/components/GerarFicha";

export function DetalhesEmpresaFicha({ dados, radarDados, user }: { dados: FichaAlphaDados; radarDados: Record<string, unknown>; user: string }) {
    const [showDetails, setShowDetails] = useState(false);
    const texto = (valor: unknown) => typeof valor === "string" ? valor : undefined;
    const abertura = dados.rfb?.dados?.dataConstituicao ?? "";
    const [dia, mes, ano] = abertura.split("/").map(Number);
    const data = new Date(ano, mes - 1, dia);
    const hoje = new Date();
    const aniversario = new Date(hoje.getFullYear(), mes - 1, dia);
    const maisDe5Anos = Number.isFinite(data.getTime()) && hoje.getFullYear() - ano - (hoje < aniversario ? 1 : 0) >= 5;
    return (
                    <div className="rounded-2xl border border-white/10 overflow-hidden">
                        <button type="button"
                            onClick={() => setShowDetails(v => !v)}
                            className="cursor-pointer w-full flex items-center justify-between px-6 py-4 bg-white/[0.03] hover:bg-white/[0.06] transition-all"
                        >
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">
                                Detalhes da Empresa
                            </span>
                            {showDetails
                                ? <ChevronUp size={18} className="text-slate-400" />
                                : <ChevronDown size={18} className="text-slate-400" />
                            }
                        </button>

                        {showDetails && (
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/[0.01]">
                                <DetalheCard
                                    tag="Receita Federal"
                                    tagColor="text-blue-400"
                                    title={dados?.rfb?.dados?.razaoSocial || "Empresa não identificada"}
                                    lines={[
                                        `Fantasia: ${dados?.rfb?.dados?.nomeFantasia || "---"}`,
                                        `CNPJ: ${dados?.rfb?.dados?.cnpj || "---"}`,
                                        `UF: ${dados?.rfb?.dados?.uf || "---"}`,
                                    ]}
                                />

                                <DetalheCard
                                    tag="Tempo de Constituição"
                                    tagColor="text-slate-400"
                                    title={maisDe5Anos ? "Mais de 5 Anos" : "Menos de 5 Anos"}
                                    lines={[`Abertura: ${dados?.rfb?.dados?.dataConstituicao || "---"}`]}
                                    highlight={maisDe5Anos ? "emerald" : "blue"}
                                />

                                <DetalheCard
                                    tag="Capital Social"
                                    tagColor="text-emerald-400"
                                    title={dados?.rfb?.dados?.capitalSocial
                                        ? Number(dados.rfb.dados.capitalSocial).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                                        : "Não informado"}
                                    lines={["Valor declarado na Receita Federal"]}
                                />

                                <DetalheCard
                                    tag="Consulta Siscomex"
                                    tagColor="text-orange-400"
                                    title={texto(radarDados.submodalidade) || "Não Identificado"}
                                    lines={[
                                        `Situação: ${texto(radarDados.situacao) || "---"}`,
                                        `Data: ${texto(radarDados.dataSituacao) || "---"}`,
                                    ]}
                                />

                                <DetalheCard
                                    tag="Empresa Aqui"
                                    tagColor="text-purple-400"
                                    title={dados?.empresaqui?.dados?.regimeEA || "Regime não informado"}
                                    lines={[`Natureza: ${dados?.rfb?.dados?.natureza_juridica || "---"}`]}
                                />

                                <DetalheCard
                                    tag="Emitido por"
                                    tagColor="text-slate-400"
                                    title={user}
                                    lines={[`Data de Emissão: ${new Date().toLocaleDateString("pt-BR")}`]}
                                />
                            </div>
                        )}
                    </div>

    );
}

function DetalheCard({ tag, tagColor, title, lines, highlight }: {
    tag: string;
    tagColor: string;
    title: string;
    lines: string[];
    highlight?: string;
}) {
    const borderClass = highlight === "emerald" ? "border-emerald-500/20" : "border-white/5";
    return (
        <div className={`p-4 rounded-xl border ${borderClass} bg-white/[0.03]`}>
            <span className={`text-[10px] font-black uppercase tracking-widest ${tagColor}`}>{tag}</span>
            <h3 className="font-black text-white mt-1.5 text-sm uppercase italic leading-tight truncate">{title}</h3>
            {lines.map((line, i) => (
                <p key={i} className="text-[10px] text-slate-500 mt-1 font-bold">{line}</p>
            ))}
        </div>
    );
}

