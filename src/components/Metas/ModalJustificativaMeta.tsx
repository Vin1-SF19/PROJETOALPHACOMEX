"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PreviewJustificativa } from "@/components/Metas/PreviewJustificativa";
import { ListaHistoricoJustificativas } from "@/components/Metas/ListaHistoricoJustificativas";
import { MESES } from "@/components/Metas/SeletorPeriodoJustificativa";
import { VisualizacaoSimplesJustificativa } from "@/components/Metas/VisualizacaoSimplesJustificativa";
import { AbaVigenteJustificativa } from "@/components/Metas/AbaVigenteJustificativa";
import { ConfirmacoesJustificativaMeta } from "@/components/Metas/ConfirmacoesJustificativaMeta";
import {
    BuscarJustificativaVigente,
    ExcluirJustificativaMeta,
    ListarHistoricoJustificativas,
    RegistrarJustificativaMeta,
    type JustificativaMetaItem,
} from "@/actions/JustificativaMeta";

interface ModalJustificativaMetaProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    podeGerenciar: boolean;
    mesAtual: number;
    anoAtual: number;
}

interface UploadResponse {
    success: boolean;
    url?: string;
    size?: number;
    error?: string;
}

export function ModalJustificativaMeta({
    open,
    onOpenChange,
    podeGerenciar,
    mesAtual,
    anoAtual,
}: ModalJustificativaMetaProps) {
    const anos = [anoAtual - 2, anoAtual - 1, anoAtual, anoAtual + 1];

    const [mes, setMes] = useState(mesAtual);
    const [ano, setAno] = useState(anoAtual);
    const [vigente, setVigente] = useState<JustificativaMetaItem | null>(null);
    const [carregandoVigente, setCarregandoVigente] = useState(false);

    const [historico, setHistorico] = useState<JustificativaMetaItem[] | null>(null);
    const [carregandoHistorico, setCarregandoHistorico] = useState(false);
    const [itemHistoricoSelecionado, setItemHistoricoSelecionado] = useState<JustificativaMetaItem | null>(null);

    const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
    const [enviando, setEnviando] = useState(false);
    const [confirmarSobrescritaAberto, setConfirmarSobrescritaAberto] = useState(false);
    const [confirmarExclusaoAberto, setConfirmarExclusaoAberto] = useState(false);
    const [excluindo, setExcluindo] = useState(false);

    useEffect(() => {
        if (!open) return;
        setCarregandoVigente(true);
        setItemHistoricoSelecionado(null);
        void (async () => {
            const resultado = await BuscarJustificativaVigente(mes, ano);
            setVigente(resultado.success ? resultado.data : null);
            setCarregandoVigente(false);
        })();
        // eslint-disable-next-line react-hooks/set-state-in-effect
    }, [open, mes, ano]);

    useEffect(() => {
        if (!open || !podeGerenciar) return;
        setCarregandoHistorico(true);
        void (async () => {
            const resultado = await ListarHistoricoJustificativas();
            setHistorico(resultado.success ? resultado.data : []);
            setCarregandoHistorico(false);
        })();
        // eslint-disable-next-line react-hooks/set-state-in-effect
    }, [open, podeGerenciar]);

    function recarregarVigente() {
        void (async () => {
            const resultado = await BuscarJustificativaVigente(mes, ano);
            setVigente(resultado.success ? resultado.data : null);
        })();
    }

    function recarregarHistorico() {
        void (async () => {
            const resultado = await ListarHistoricoJustificativas();
            if (resultado.success) setHistorico(resultado.data);
        })();
    }

    function selecionarArquivo(file: File | null) {
        if (!file) {
            setArquivoSelecionado(null);
            return;
        }
        const ehPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        if (!ehPdf) {
            toast.error("Apenas arquivos PDF são aceitos. Se o arquivo é um Word (.docx), converta para PDF antes de enviar.");
            setArquivoSelecionado(null);
            return;
        }
        setArquivoSelecionado(file);
    }

    function iniciarEnvio() {
        if (!arquivoSelecionado) return;
        if (vigente) {
            setConfirmarSobrescritaAberto(true);
            return;
        }
        void enviarArquivo();
    }

    async function enviarArquivo() {
        if (!arquivoSelecionado) return;
        setEnviando(true);
        try {
            const params = new URLSearchParams({
                filename: arquivoSelecionado.name,
                mes: String(mes),
                ano: String(ano),
            });
            const uploadResp = await fetch(`/api/metas/justificativas/upload?${params.toString()}`, {
                method: "POST",
                body: arquivoSelecionado,
            });

            let uploadData: UploadResponse;
            try {
                uploadData = await uploadResp.json();
            } catch {
                toast.error("Erro ao processar resposta do servidor.");
                return;
            }

            if (!uploadResp.ok || !uploadData.success || !uploadData.url || uploadData.size === undefined) {
                toast.error(uploadData.error ?? "Erro ao enviar arquivo");
                return;
            }

            const resultado = await RegistrarJustificativaMeta({
                mes,
                ano,
                url: uploadData.url,
                nomeArquivo: arquivoSelecionado.name,
                tamanhoBytes: uploadData.size,
            });
            if (!resultado.success) {
                toast.error(resultado.error);
                return;
            }

            toast.success(`Justificativa de ${MESES[mes - 1]}/${ano} enviada.`);
            setArquivoSelecionado(null);
            recarregarVigente();
            recarregarHistorico();
        } finally {
            setEnviando(false);
        }
    }

    async function excluirVigente() {
        if (!vigente) return;
        setExcluindo(true);
        try {
            const resultado = await ExcluirJustificativaMeta(vigente.id);
            if (!resultado.success) {
                toast.error(resultado.error);
                return;
            }
            toast.success("Justificativa excluída permanentemente.");
            recarregarVigente();
            recarregarHistorico();
        } finally {
            setExcluindo(false);
        }
    }

    const itemExibido = itemHistoricoSelecionado ?? vigente;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto border-white/10 bg-slate-950 sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-slate-200">
                        <FileText size={18} className="text-amber-400" />
                        Justificativa de Meta
                    </DialogTitle>
                </DialogHeader>

                {!podeGerenciar ? (
                    <VisualizacaoSimplesJustificativa
                        carregando={carregandoVigente}
                        vigente={vigente}
                        mesLabel={MESES[mesAtual - 1]}
                        ano={anoAtual}
                    />
                ) : (
                    <Tabs defaultValue="vigente" onValueChange={() => setItemHistoricoSelecionado(null)}>
                        <TabsList className="flex w-full justify-start">
                            <TabsTrigger value="vigente">Vigente</TabsTrigger>
                            <TabsTrigger value="historico">Histórico</TabsTrigger>
                        </TabsList>

                        <TabsContent value="vigente">
                            <AbaVigenteJustificativa
                                mes={mes}
                                ano={ano}
                                anos={anos}
                                onMesChange={setMes}
                                onAnoChange={setAno}
                                arquivoSelecionado={arquivoSelecionado}
                                enviando={enviando}
                                onSelecionarArquivo={selecionarArquivo}
                                onEnviar={iniciarEnvio}
                                carregandoVigente={carregandoVigente}
                                itemExibido={itemExibido}
                                vigente={vigente}
                                mesLabel={MESES[mes - 1]}
                                onSolicitarExclusao={() => setConfirmarExclusaoAberto(true)}
                            />
                        </TabsContent>

                        <TabsContent value="historico" className="space-y-2">
                            {carregandoHistorico ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="size-5 animate-spin text-slate-500" aria-hidden="true" />
                                </div>
                            ) : !historico?.length ? (
                                <p className="py-8 text-center text-sm text-slate-500">Nenhuma justificativa enviada ainda.</p>
                            ) : (
                                <ListaHistoricoJustificativas
                                    historico={historico}
                                    onSelecionar={setItemHistoricoSelecionado}
                                />
                            )}

                            {itemHistoricoSelecionado && (
                                <div className="pt-2">
                                    <PreviewJustificativa
                                        item={itemHistoricoSelecionado}
                                        altura="h-[45vh]"
                                        tituloIframe="Justificativa de Meta — histórico"
                                        ocultarBarraSuperior
                                    />
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                )}
            </DialogContent>

            <ConfirmacoesJustificativaMeta
                confirmarSobrescritaAberto={confirmarSobrescritaAberto}
                onConfirmarSobrescritaChange={setConfirmarSobrescritaAberto}
                onSubstituir={() => {
                    setConfirmarSobrescritaAberto(false);
                    void enviarArquivo();
                }}
                mesLabel={MESES[mes - 1]}
                ano={ano}
                confirmarExclusaoAberto={confirmarExclusaoAberto}
                onConfirmarExclusaoChange={setConfirmarExclusaoAberto}
                onExcluir={() => {
                    setConfirmarExclusaoAberto(false);
                    void excluirVigente();
                }}
                excluindo={excluindo}
            />
        </Dialog>
    );
}
