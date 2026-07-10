"use client";

import { pdf } from "@react-pdf/renderer";
import { FichaAlphaPDF } from "./GerarFicha";
import { useEffect, useState } from "react";
import { upsertConsulta } from "@/actions/PreAnalise";
import { ChevronDown, ChevronUp, X, FileText } from "lucide-react";

interface Props {
    dados: any;
    radarDados: any;
    user: string;
    isOpen: boolean;
    onClose: () => void;
}

export const ModalPDF = ({ dados, radarDados, user, isOpen, onClose }: Props) => {
    const [dadosManuais, setDadosManuais] = useState({
        dataSituacao: "",
        horaSituacao: "",
        mesProtocolo: "",
        telefone: "",
        email: "",
        nomeResponsavel: "",
        observacoes: "",
        origemLead: "",
        origemLeadDetalhe: ""
    });
    const [showDetails, setShowDetails] = useState(false);

    const ORIGENS = [
        { value: "instagram", label: "Instagram", detalhe: false },
        { value: "google", label: "Google", detalhe: false },
        { value: "callix", label: "Callix", detalhe: false },
        { value: "parceiro", label: "Parceiro", detalhe: true, placeholder: "Nome do parceiro" },
        { value: "indicacao", label: "Indicação", detalhe: true, placeholder: "Nome de quem indicou" },
        { value: "outros", label: "Outros", detalhe: true, placeholder: "Especificar origem" },
    ];

    const origemSelecionada = ORIGENS.find(o => o.value === dadosManuais.origemLead);

    useEffect(() => {
        if (isOpen) document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = "unset"; };
    }, [isOpen]);

    if (!isOpen) return null;

    const gerarEVisualizar = async () => {
        const radarReal = radarDados?.dados || radarDados;
        const payload = {
            ...dados,
            radar: radarReal,
            extra: { ...dadosManuais }
        };
        await upsertConsulta(payload);
        const doc = <FichaAlphaPDF dados={payload} userLogado={user} />;
        const blob = await pdf(doc).toBlob();
        window.open(URL.createObjectURL(blob), "_blank");
    };

    const dataAbertura = dados?.rfb?.dados?.dataConstituicao || "";
    let maisDe5Anos = false;

    if (dataAbertura?.includes("/")) {
        const [dia, mes, ano] = dataAbertura.split("/").map(Number);
        const dataAberturaDoc = new Date(ano, mes - 1, dia);
        const agora = new Date();
        let idade = agora.getFullYear() - dataAberturaDoc.getFullYear();
        const m = agora.getMonth() - dataAberturaDoc.getMonth();
        if (m < 0 || (m === 0 && agora.getDate() < dataAberturaDoc.getDate())) idade--;
        maisDe5Anos = idade >= 5;
    }

    const campoClass = "w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:border-white/20 focus:outline-none transition-all placeholder:text-slate-700";
    const labelClass = "block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5";

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="bg-[#0A0A0A] border border-white/10 rounded-[2.5rem] max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* HEADER */}
                <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">
                            Gerar <span className="text-orange-500">Ficha</span>
                        </h2>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                            Campos opcionais — preencha se necessário
                        </p>
                    </div>
                    <button onClick={onClose} className="cursor-pointer p-2.5 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-all">
                        <X size={22} />
                    </button>
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">

                    {/* DADOS MANUAIS */}
                    <div className="space-y-5 p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                        <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Preenchimento Manual</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Nome do Responsável</label>
                                <input
                                    type="text"
                                    placeholder="Nome completo"
                                    value={dadosManuais.nomeResponsavel}
                                    onChange={(e) => setDadosManuais({ ...dadosManuais, nomeResponsavel: e.target.value })}
                                    className={campoClass}
                                />
                            </div>

                            <div>
                                <label className={labelClass}>Telefone</label>
                                <input
                                    type="text"
                                    placeholder="(00) 00000-0000"
                                    value={dadosManuais.telefone}
                                    onChange={(e) => setDadosManuais({ ...dadosManuais, telefone: e.target.value })}
                                    className={campoClass}
                                />
                            </div>

                            <div>
                                <label className={labelClass}>E-mail</label>
                                <input
                                    type="email"
                                    placeholder="nome@gmail.com"
                                    value={dadosManuais.email}
                                    onChange={(e) => setDadosManuais({ ...dadosManuais, email: e.target.value })}
                                    className={campoClass}
                                />
                            </div>

                            <div>
                                <label className={labelClass}>Data da Reunião</label>
                                <input
                                    type="text"
                                    placeholder="DD/MM/AAAA"
                                    value={dadosManuais.dataSituacao}
                                    onChange={(e) => setDadosManuais({ ...dadosManuais, dataSituacao: e.target.value })}
                                    className={campoClass}
                                />
                            </div>

                            <div>
                                <label className={labelClass}>Hora da Reunião</label>
                                <input
                                    type="text"
                                    placeholder="HH:MM"
                                    value={dadosManuais.horaSituacao}
                                    onChange={(e) => setDadosManuais({ ...dadosManuais, horaSituacao: e.target.value })}
                                    className={campoClass}
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className={labelClass}>Mês de Protocolo</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Maio"
                                    value={dadosManuais.mesProtocolo}
                                    onChange={(e) => setDadosManuais({ ...dadosManuais, mesProtocolo: e.target.value })}
                                    className={campoClass}
                                />
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>Observações</label>
                            <textarea
                                rows={3}
                                placeholder="Detalhes relevantes sobre a situação da empresa..."
                                value={dadosManuais.observacoes}
                                onChange={(e) => setDadosManuais({ ...dadosManuais, observacoes: e.target.value })}
                                className={`${campoClass} resize-none`}
                            />
                        </div>

                        {/* ORIGEM DO LEAD */}
                        <div>
                            <label className={labelClass}>Origem do Lead</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
                                {ORIGENS.map(origem => (
                                    <button
                                        key={origem.value}
                                        type="button"
                                        onClick={() => setDadosManuais({
                                            ...dadosManuais,
                                            origemLead: dadosManuais.origemLead === origem.value ? "" : origem.value,
                                            origemLeadDetalhe: ""
                                        })}
                                        className={`cursor-pointer px-3 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all ${
                                            dadosManuais.origemLead === origem.value
                                                ? "bg-orange-500/20 border-orange-500/40 text-orange-300"
                                                : "bg-white/[0.03] border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300"
                                        }`}
                                    >
                                        {origem.label}
                                    </button>
                                ))}
                            </div>

                            {origemSelecionada?.detalhe && (
                                <input
                                    type="text"
                                    placeholder={origemSelecionada.placeholder}
                                    value={dadosManuais.origemLeadDetalhe}
                                    onChange={(e) => setDadosManuais({ ...dadosManuais, origemLeadDetalhe: e.target.value })}
                                    className={`${campoClass} mt-3`}
                                    autoFocus
                                />
                            )}
                        </div>
                    </div>

                    {/* DETALHES DA EMPRESA — colapsável */}
                    <div className="rounded-2xl border border-white/10 overflow-hidden">
                        <button
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
                                    title={radarDados?.submodalidade || "Não Identificado"}
                                    lines={[
                                        `Situação: ${radarDados?.situacao || "---"}`,
                                        `Data: ${radarDados?.dataSituacao || "---"}`,
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
                </div>

                {/* FOOTER */}
                <div className="px-8 py-6 border-t border-white/5 flex flex-col sm:flex-row gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="cursor-pointer px-6 py-3 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-white hover:bg-white/5 rounded-xl transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={gerarEVisualizar}
                        className="cursor-pointer flex items-center justify-center gap-2 px-8 py-3 bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-orange-400 shadow-lg transition-all active:scale-95"
                    >
                        <FileText size={16} />
                        Gerar Documento PDF
                    </button>
                </div>
            </div>
        </div>
    );
};

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

export default ModalPDF;
