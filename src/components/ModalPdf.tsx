"use client";

import { pdf } from "@react-pdf/renderer";
import { FichaAlphaPDF, type FichaAlphaDados } from "./GerarFicha";
import { useRef, useState, type FormEvent } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { fichaViabilidadeExtrasSchema, type FichaViabilidadeExtras } from "@/lib/bpm/ficha-viabilidade-documento";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DetalhesEmpresaFicha } from "@/components/DetalhesEmpresaFicha";
import { upsertConsulta } from "@/actions/PreAnalise";
import { X, FileText, Loader2 } from "lucide-react";

interface Props {
    dados: unknown;
    radarDados: unknown;
    user: string;
    isOpen: boolean;
    onClose: () => void;
    modo?: "gerar" | "complementar";
    dadosManuaisIniciais?: NonNullable<FichaAlphaDados["extra"]>;
    onSalvar?: (extras: NonNullable<FichaAlphaDados["extra"]>) => Promise<void>;
}

const objeto = (valor: unknown): Record<string, unknown> =>
    typeof valor === "object" && valor !== null && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
const texto = (valor: unknown): string | undefined => typeof valor === "string" ? valor : undefined;
const valorMonetario = (valor: unknown): string | number | undefined =>
    typeof valor === "string" || typeof valor === "number" ? valor : undefined;

function normalizarFichaDados(entrada: unknown): FichaAlphaDados {
    const raiz = objeto(entrada);
    const rfb = objeto(raiz.rfb);
    const origemRfb = objeto(rfb.dados ?? raiz.rfb);
    const empresaqui = objeto(raiz.empresaqui);
    const origemEmpresaqui = objeto(empresaqui.dados ?? raiz.empresaqui);
    const radar = objeto(raiz.radar);
    const origemRadar = objeto(radar.dados ?? raiz.radar);
    return {
        rfb: { dados: {
            razaoSocial: texto(origemRfb.razaoSocial), nomeFantasia: texto(origemRfb.nomeFantasia),
            cnpj: texto(origemRfb.cnpj), uf: texto(origemRfb.uf),
            dataConstituicao: texto(origemRfb.dataConstituicao),
            capitalSocial: valorMonetario(origemRfb.capitalSocial),
            capital_social: valorMonetario(origemRfb.capital_social),
            natureza_juridica: texto(origemRfb.natureza_juridica),
        } },
        empresaqui: { dados: { regimeEA: texto(origemEmpresaqui.regimeEA) } },
        radar: { situacao: texto(origemRadar.situacao), submodalidade: texto(origemRadar.submodalidade) },
    };
}

export const ModalPDF = (props: Props) => props.isOpen ? <ModalPDFConteudo {...props} /> : null;

function ModalPDFConteudo({ dados: dadosEntrada, radarDados: radarEntrada, user, isOpen, onClose, modo = "gerar", dadosManuaisIniciais, onSalvar }: Props) {
    const dados = normalizarFichaDados(dadosEntrada);
    const radarObjeto = objeto(radarEntrada);
    const radarDados = objeto(radarObjeto.dados ?? radarEntrada);
    const { register, control, setValue, handleSubmit, formState: { errors } } = useForm<FichaViabilidadeExtras>({
        resolver: zodResolver(fichaViabilidadeExtrasSchema),
        defaultValues: { dataSituacao: "", horaSituacao: "", mesProtocolo: "", telefone: "", email: "", nomeResponsavel: "", observacoes: "", origemLead: "", origemLeadDetalhe: "", ...dadosManuaisIniciais },
    });
    const dadosManuais = useWatch({ control });
    const operacaoRef = useRef(false);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);
    const complementar = modo === "complementar";

    const ORIGENS = [
        { value: "instagram", label: "Instagram", detalhe: false },
        { value: "google", label: "Google", detalhe: false },
        { value: "callix", label: "Callix", detalhe: false },
        { value: "parceiro", label: "Parceiro", detalhe: true, placeholder: "Nome do parceiro" },
        { value: "indicacao", label: "Indicação", detalhe: true, placeholder: "Nome de quem indicou" },
        { value: "outros", label: "Outros", detalhe: true, placeholder: "Especificar origem" },
    ];

    const chaveOrigem = (valor: string | undefined) => (valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const origemSelecionada = ORIGENS.find(o => o.value === chaveOrigem(dadosManuais.origemLead));
    const origemAdicional = Boolean(dadosManuais.origemLead && !origemSelecionada);

    async function executar(event: FormEvent<HTMLFormElement>) {
      await handleSubmit(async (extras) => {
        if (operacaoRef.current) return;
        operacaoRef.current = true;
        setSalvando(true);
        setErro(null);
        try {
            if (complementar) {
                if (!onSalvar) throw new Error("Não foi possível salvar esta ficha.");
                await onSalvar(extras);
                onClose();
            } else {
                const payload = { ...objeto(dadosEntrada), radar: radarDados, extra: extras };
                await upsertConsulta(payload);
                const doc = <FichaAlphaPDF dados={{ ...normalizarFichaDados(payload), extra: extras }} userLogado={user} finalidade="pre-analise" />;
                const blob = await pdf(doc).toBlob();
                window.open(URL.createObjectURL(blob), "_blank");
            }
        } catch (error) {
            setErro(error instanceof Error ? error.message : "Não foi possível salvar a ficha. Tente novamente.");
        } finally {
            operacaoRef.current = false;
            setSalvando(false);
        }
      })(event);
    }

    const campoClass = "w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:border-white/20 focus:outline-none transition-all placeholder:text-slate-700";
    const labelClass = "block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5";

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !operacaoRef.current) onClose(); }}>
            <DialogContent showCloseButton={false} onEscapeKeyDown={(event) => { if (operacaoRef.current) event.preventDefault(); }} onPointerDownOutside={(event) => event.preventDefault()} className="crm-scope border-white/10 rounded-[2.5rem] sm:max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden p-0 gap-0 bg-[var(--crm-painel-card,var(--color-slate-950))]">
            <form onSubmit={executar} className="flex min-h-0 flex-col" aria-busy={salvando}>

                {/* HEADER */}
                <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <DialogTitle className="text-xl font-black italic uppercase tracking-tighter text-white">
                            {complementar ? "Complementar" : "Gerar"} <span className="text-orange-500">Ficha</span>
                        </DialogTitle>
                        <DialogDescription className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                            Campos opcionais — preencha se necessário
                        </DialogDescription>
                    </div>
                    <button type="button" aria-label="Fechar ficha" disabled={salvando} onClick={onClose} className="cursor-pointer p-2.5 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-all">
                        <X size={22} />
                    </button>
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-6">

                    {/* DADOS MANUAIS */}
                    <fieldset disabled={salvando} className="space-y-5 p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                        <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Preenchimento Manual</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Nome do Responsável</label>
                                <input
                                    type="text"
                                    placeholder="Nome completo"
                                    {...register("nomeResponsavel")}
                                    aria-label="Nome do Responsável"
                                    className={campoClass}
                                />
                            </div>

                            <div>
                                <label className={labelClass}>Telefone</label>
                                <input
                                    type="text"
                                    placeholder="(00) 00000-0000"
                                    {...register("telefone")}
                                    aria-label="Telefone"
                                    className={campoClass}
                                />
                            </div>

                            <div>
                                <label className={labelClass}>E-mail</label>
                                <input
                                    type="email"
                                    placeholder="nome@gmail.com"
                                    {...register("email")}
                                    aria-label="E-mail"
                                    className={campoClass}
                                />
                            </div>

                            <div>
                                <label className={labelClass}>Data da Reunião</label>
                                <input
                                    type="text"
                                    placeholder="DD/MM/AAAA"
                                    {...register("dataSituacao")}
                                    aria-label="Data da Reunião"
                                    className={campoClass}
                                />
                            </div>

                            <div>
                                <label className={labelClass}>Hora da Reunião</label>
                                <input
                                    type="text"
                                    placeholder="HH:MM"
                                    {...register("horaSituacao")}
                                    aria-label="Hora da Reunião"
                                    className={campoClass}
                                />
                            </div>

                            <div className="sm:col-span-2">
                                <label className={labelClass}>Mês de Protocolo</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Maio"
                                    {...register("mesProtocolo")}
                                    aria-label="Mês de Protocolo"
                                    className={campoClass}
                                />
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>Observações</label>
                            <textarea
                                rows={3}
                                placeholder="Detalhes relevantes sobre a situação da empresa..."
                                    {...register("observacoes")}
                                    aria-label="Observações"
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
                                        aria-pressed={chaveOrigem(dadosManuais.origemLead) === origem.value}
                                        onClick={() => { setValue("origemLead", chaveOrigem(dadosManuais.origemLead) === origem.value ? "" : origem.value, { shouldDirty: true }); setValue("origemLeadDetalhe", "", { shouldDirty: true }); }}
                                        className={`cursor-pointer px-3 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all ${
                                            chaveOrigem(dadosManuais.origemLead) === origem.value
                                                ? "bg-orange-500/20 border-orange-500/40 text-orange-300"
                                                : "bg-white/[0.03] border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300"
                                        }`}
                                    >
                                        {origem.label}
                                    </button>
                                ))}
                                {origemAdicional && <button type="button" aria-pressed="true" className="rounded-xl border border-orange-500/40 bg-orange-500/20 px-3 py-2.5 text-xs text-orange-300">{dadosManuais.origemLead}</button>}
                            </div>

                            {(origemSelecionada?.detalhe || origemAdicional) && (
                                <input
                                    type="text"
                                    placeholder={origemSelecionada?.placeholder ?? "Complemento da origem"}
                                    {...register("origemLeadDetalhe")}
                                    aria-label="Complemento da origem"
                                    className={`${campoClass} mt-3`}
                                    autoFocus
                                />
                            )}
                        </div>
                    </fieldset>

                    <DetalhesEmpresaFicha dados={dados} radarDados={radarDados} user={user} />
                </div>

                {(erro || Object.keys(errors).length > 0) && <p role="alert" className="px-8 py-3 text-sm text-rose-300">{erro ?? Object.values(errors).find((error) => error?.message)?.message}</p>}
                {/* FOOTER */}
                <div className="px-8 py-6 border-t border-white/5 flex flex-col sm:flex-row gap-3 justify-end">
                    <button
                        type="button" disabled={salvando} onClick={onClose}
                        className="cursor-pointer px-6 py-3 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-white hover:bg-white/5 rounded-xl transition-all"
                    >
                        {complementar ? "Fechar" : "Cancelar"}
                    </button>
                    <button
                        type="submit" disabled={salvando}
                        className="cursor-pointer flex items-center justify-center gap-2 px-8 py-3 bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-orange-400 shadow-lg transition-all active:scale-95"
                    >
                        {salvando ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                        {salvando ? "Salvando…" : complementar ? "Salvar" : "Gerar Documento PDF"}
                    </button>
                </div>
            </form>
            </DialogContent>
        </Dialog>
    );
}

export default ModalPDF;
