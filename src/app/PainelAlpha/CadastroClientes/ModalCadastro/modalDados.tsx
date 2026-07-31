"use client";

import React, { useEffect, useState } from 'react';
import { createPortal } from "react-dom";
import { fmtDate, fmtDateTime } from "@/lib/format-date";
import { X, Plus, ThumbsUp, ThumbsDown, Minus, Calendar, MessageSquare, Save, Star, Search, CheckCircle2, TrendingUp, LockOpen, Edit3, Check, Trash2, AlertTriangle, Briefcase, Wallet, CreditCard, UserCircle2, Loader2 } from "lucide-react";
import { adicionarSocio, atualizarLogCS, atualizarLogFeedback, atualizarSocio, atualizarStatusCliente, excluirLogCS, excluirLogFeedback, salvarAlteracoesGeral, salvarLogCS, salvarLogFeedback, buscarServicoContratadoPorCliente, buscarUsuariosPorRole, type ClienteCS } from '@/actions/Clientes';
import { toast } from 'sonner';
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getTema } from '@/lib/temas';
import { DropdownSelecaoComCriacao } from './DropdownSelecaoComCriacao';
import { ModalSelecionarUsuario } from './ModalSelecionarUsuario';
import { FORMAS_PAGAMENTO, FORMAS_LABEL, formatarFormaPagamento } from './formas-pagamento';
import { ORIGENS_LEAD_PADRAO } from './origens-lead';
import { CsNpsModal3DShell } from "../CsNpsMotion";
import { SERVICOS_COMERCIAIS_PADRAO } from "@/lib/comercial/servicos";

/**
 * `dataContratacao` é salva como `.toISOString()` de uma data "só o dia" (sem
 * hora relevante, ex: vinda de `<input type="date">`) — representa meia-noite
 * UTC, que em fusos negativos (America/Sao_Paulo, UTC-3) "volta" 1 dia ao
 * formatar com `fmtDate` (que já usa timeZone correto, mas a data de entrada
 * já nasceu deslocada). Mesmo padrão de correção já usado em `page.tsx` para
 * "Data de Êxito" — compensa o offset antes de formatar.
 */
function fmtDataSemHora(value: string | Date | null | undefined): string {
    if (!value) return "---";
    const d = new Date(value);
    const dataCorrigida = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
    return fmtDate(dataCorrigida);
}


interface ModalDadosProps {
    editandoDados: boolean;
    cnpj: string;
    setCnpj: (val: string) => void;
    razaoSocial: string;
    setRazaoSocial: (val: string) => void;
    nomeFantasia: string;
    setNomeFantasia: (val: string) => void;
    dataConstituicao: string;
    setDataConstituicao: (val: string) => void;
    regimeTributario: string;
    setRegimeTributario: (val: string) => void;
    uf: string;
    setUf: (val: string) => void;
    servicosSelecionados: string[];
    analistaSelecionado: string;
    style: any;
}




interface ModalGestaoClienteProps {
    isOpen: boolean;
    onClose: (refresh?: boolean) => void;
    cliente: ClienteCS[] | ClienteCS | null;
    aoSalvar?: () => void | Promise<void>;
}

export default function ModalGestaoCliente({ isOpen, onClose, cliente: clienteGrupo, aoSalvar }: ModalGestaoClienteProps) {
    const { data: session } = useSession();
    const style = getTema((session?.user as any)?.tema_interface || "blue");

    /**
     * `clienteGrupo` é a lista de TODOS os registros do mesmo CNPJ (um por
     * serviço contratado, mais recente primeiro — ver page.tsx). `cliente`
     * segue representando o registro PRINCIPAL (mais recente), usado para
     * preencher todos os campos editáveis já existentes neste modal.
     * `outrosServicos` são os demais registros do mesmo CNPJ, exibidos na
     * seção "Serviços Contratados" mais abaixo.
     */
    const cliente = Array.isArray(clienteGrupo) ? clienteGrupo[0] : clienteGrupo;
    const outrosServicos: ClienteCS[] = Array.isArray(clienteGrupo) ? clienteGrupo.slice(1) : [];
    /** Normaliza `clienteGrupo` para array sempre — usado pela seção "Serviços Contratados", que deve
     * exibir mesmo quando há apenas 1 registro (todo cliente tem no mínimo 1 serviço). */
    const registrosDoServicosSecao: ClienteCS[] = cliente ? [cliente, ...outrosServicos] : [];

    /**
     * Estado de gestão POR CARD (Status Atual, Data Contratação, Data de Êxito,
     * Analista Responsável, Embasamento, Origem do Lead) — cada registro de
     * serviço tem seu próprio formulário independente, mas todos são salvos
     * juntos pelo único botão "Salvar Alterações" (`handleSalvarTudo`), não
     * mais individualmente. Visibilidade de edição continua controlada pelo
     * único `editandoDados` global (mesmo botão "Editar Dados" do topo libera
     * TODOS os cards ao mesmo tempo — decisão do usuário, ver decisions.md).
     */
    interface FormGestaoCard {
        status: string;
        dataContratacao: string;
        dataExitoManual: string;
        analistaResponsavel: string;
        embasamento: string;
        origemLead: string;
        formaPagamento: string;
        valorContrato: string;
        closerNome: string;
    }
    const [formPorCard, setFormPorCard] = useState<Record<number, FormGestaoCard>>({});
    const [salvandoTudo, setSalvandoTudo] = useState(false);

    function formInicialDoRegistro(registro: ClienteCS): FormGestaoCard {
        return {
            status: registro.status || "Em Andamento",
            dataContratacao: registro.dataContratacao || "",
            dataExitoManual: registro.dataExito
                ? new Date(registro.dataExito).toISOString().split("T")[0]
                : "",
            analistaResponsavel: registro.analistaResponsavel || "",
            embasamento: registro.embasamento || "",
            origemLead: registro.origemLead || "",
            formaPagamento: registro.formaPagamento || "",
            valorContrato: registro.valorContrato != null ? String(registro.valorContrato) : "",
            closerNome: registro.closerNome || "",
        };
    }

    function atualizarFormCard(registroId: number, patch: Partial<FormGestaoCard>) {
        setFormPorCard((prev) => ({
            ...prev,
            [registroId]: { ...prev[registroId], ...patch },
        }));
    }

    const [servicosSelecionados, setServicosSelecionados] = useState<string[]>([]);
    const [analistaSelecionado, setAnalistaSelecionado] = useState("");
    const [showConfirmarOcultar, setShowConfirmarOcultar] = useState(false);

    const router = useRouter();
    const portalTarget = typeof document === "undefined" ? null : document.body;
    const [showNovoCS, setShowNovoCS] = useState(false);
    const [status, setStatus] = useState(cliente?.status || "Em Andamento");
    const [feedbackCS, setFeedbackCS] = useState<"pos" | "neg" | "na" | null>(null);
    const [sentimentoFeedback, setSentimentoFeedback] = useState<"pos" | "neg" | "na" | null>(null);
    const [obsCS, setObsCS] = useState("");
    const [salvandoNovoCS, setSalvandoNovoCS] = useState(false);

    const [nps, setNps] = useState<number | null>(cliente?.nps ?? null);
    const [feedbackSim, setFeedbackSim] = useState(cliente?.feedbackGoogle ?? false);
    const [nomeFeedback, setNomeFeedback] = useState("");
    const [showNovoFeedback, setShowNovoFeedback] = useState(false);
    const [salvandoFeedback, setSalvandoFeedback] = useState(false);
    const [showEditFeedback, setShowEditFeedback] = useState(false);
    const [feedbackEditando, setFeedbackEditando] = useState<ClienteCS["logFeedback"][number] | null>(null);
    const [feedbackEditSentimento, setFeedbackEditSentimento] = useState<"pos" | "neg" | "na" | null>(null);
    const [feedbackEditObs, setFeedbackEditObs] = useState("");
    const [feedbackEditData, setFeedbackEditData] = useState("");
    const [salvandoEdicaoFeedback, setSalvandoEdicaoFeedback] = useState(false);

    const [listaLogsFeedback, setListaLogsFeedback] = useState<any[]>(cliente?.logFeedback ?? []);
    const [editandoDados, setEditandoDados] = useState(false);

    const [showServicos, setShowServicos] = useState(false);
    const [isCriandoServico, setIsCriandoServico] = useState(false);
    const [novoServicoNome, setNovoServicoNome] = useState("");

    const listaServicos: string[] = [...SERVICOS_COMERCIAIS_PADRAO];
    const SERVICOS_COM_EMBASAMENTO = ["Revisão RADAR - 150K", "Revisão RADAR - ILIMITADO"];

    const listaEmbasamentos = ["Disponibilidade Financeira", "Início ou Retomada", "Receita Bruta (DAS)", "Receita Bruta (CPRB)"];
    const listaOrigensLead = [...ORIGENS_LEAD_PADRAO];

    /**
     * Analista/Closer passam a listar usuários REAIS do banco (não mais lista
     * fixa) — busca uma vez ao montar o modal, reutilizada por TODOS os cards
     * de "Serviços Contratados" (mesma lista para todos, ver decisions.md
     * 2026-07-13). `campoModalUsuario` guarda qual card+campo está com o
     * `ModalSelecionarUsuario` aberto no momento (escape hatch para escolher
     * usuário de qualquer setor, fora do role padrão do campo).
     */
    const [listaAnalistas, setListaAnalistas] = useState<string[]>([]);
    const [listaClosersUsuarios, setListaClosersUsuarios] = useState<string[]>([]);
    const [campoModalUsuario, setCampoModalUsuario] = useState<{ registroId: number; campo: "analistaResponsavel" | "closerNome" } | null>(null);

    useEffect(() => {
        buscarUsuariosPorRole(["OPERACIONAL"]).then((usuarios) => setListaAnalistas(usuarios.map((u) => u.nome)));
        buscarUsuariosPorRole(["COMERCIAL", "Lider Comercial"]).then((usuarios) => setListaClosersUsuarios(usuarios.map((u) => u.nome)));
    }, []);

    const [dataCS, setDataCS] = useState(new Date().toISOString().split('T')[0]);
    const [dataFeedback, setDataFeedback] = useState(new Date().toISOString().split('T')[0]);


    const [obsFeedback, setObsFeedback] = useState("");


    const [cnpj, setCnpj] = useState(cliente?.cnpj || "");
    const [razaoSocial, setRazaoSocial] = useState(cliente?.razaoSocial || "");
    const [nomeFantasia, setNomeFantasia] = useState(cliente?.nomeFantasia || "");
    const [dataConstituicao, setDataConstituicao] = useState(cliente?.dataConstituicao || "");
    const [regimeTributario, setRegimeTributario] = useState(cliente?.regimeTributario || "");
    const [uf, setUf] = useState(cliente?.uf || "");
    const [municipio, setMunicipio] = useState(cliente?.municipio || "");


    const [listaLogsCS, setListaLogsCS] = useState<any[]>([]);

    const [listaSocios, setListaSocios] = useState<any[]>([]);
    const [showNovoSocio, setShowNovoSocio] = useState(false);
    const [novoSocio, setNovoSocio] = useState({ nome: "", telefone: "", dataNascimento: "", vinculo: "", obs: "" });

    // Edição inline de sócios
    const [editandoSocioId, setEditandoSocioId] = useState<number | null>(null);
    const [socioEditForm, setSocioEditForm] = useState({ nome: "", telefone: "", dataNascimento: "", vinculo: "", obs: "" });

    // Edição de log CS
    const [showEditCS, setShowEditCS] = useState(false);
    const [csEditando, setCsEditando] = useState<any>(null);
    const [csEditSentimento, setCsEditSentimento] = useState<"pos" | "neg" | "na" | null>(null);
    const [csEditObs, setCsEditObs] = useState("");
    const [csEditData, setCsEditData] = useState("");
    const [salvandoEdicaoCS, setSalvandoEdicaoCS] = useState(false);


    useEffect(() => {
        if (cliente) {
            setCnpj(cliente.cnpj || "");
            setRazaoSocial(cliente.razaoSocial || "");
            setServicosSelecionados(cliente.servicos?.split(",") || []);
            setAnalistaSelecionado(cliente.analistaResponsavel || "");
        }
    }, [cliente]);



    const isTextoValido = (texto: string) => texto.length >= 10 && texto.length <= 140;



    const handleSalvarCS = async () => {
        if (!feedbackCS || obsCS.length < 10) return toast.error("Dados inválidos");
        if (salvandoNovoCS) return;

        setSalvandoNovoCS(true);
        try {
            const dataSelecionada = new Date(`${dataCS}T12:00:00`).toISOString();
            const res = await salvarLogCS(cliente!.id, {
                sentimento: feedbackCS,
                observacao: obsCS,
                data_registro: dataSelecionada,
            });

            if (!res.success) {
                toast.error(res.error || "Não foi possível salvar o CS.");
                return;
            }

            setListaLogsCS((prev) => [res.data, ...prev]);
            setShowNovoCS(false);
            setObsCS("");
            setFeedbackCS(null);
            setDataCS(new Date().toISOString().split('T')[0]);
            toast.success("CS registrado!");
            try {
                if (aoSalvar) await aoSalvar();
            } catch {
                router.refresh();
            }
        } catch {
            toast.error("Falha na conexão ao salvar o CS.");
        } finally {
            setSalvandoNovoCS(false);
        }
    };

    const handleExcluirCS = async (logId: number) => {
        if (!confirm("Deseja realmente apagar este relato de CS?")) return;

        // Registro só existe no rascunho local (nunca foi salvo) — remove sem chamar o servidor.
        const aindaNaoSalvo = listaLogsCS.find((log) => log.id === logId)?._pendente === "criar";
        if (aindaNaoSalvo) {
            setListaLogsCS((prev: any[]) => prev.filter((log) => log.id !== logId));
            toast.success("Relato removido do rascunho!");
            return;
        }

        try {
            const res = await excluirLogCS(logId);

            if (res.success) {
                toast.success("Relato removido!");

                setListaLogsCS((prev: any[]) => prev.filter((log) => log.id !== logId));

                if (aoSalvar) aoSalvar();
            } else {
                toast.error("Erro ao excluir.");
            }
        } catch (error) {
            toast.error("Falha na conexão.");
        }
    };

    useEffect(() => {
        if (isOpen && cliente?.socios) {
            setListaSocios(cliente.socios);
        }
        return () => {
            setListaSocios([]);
            setShowNovoSocio(false);
        };
    }, [cliente?.id, isOpen]);

    /**
     * Sócios continuam como rascunho local até o botão geral do rodapé.
     * CS e feedback têm modais próprios e persistem imediatamente em seus
     * respectivos botões, evitando que o usuário precise salvar duas vezes.
     */
    const handleAdicionarSocio = () => {
        if (!novoSocio.nome) return toast.error("Nome é obrigatório");

        const socioRascunho = {
            id: -Date.now(),
            ...novoSocio,
            _pendente: "criar" as const,
        };

        setListaSocios(prev => [...prev, socioRascunho]);
        setNovoSocio({ nome: "", telefone: "", dataNascimento: "", vinculo: "", obs: "" });
        setShowNovoSocio(false);
        toast.info("Sócio adicionado ao rascunho — clique em Salvar Alterações para confirmar.");
    };


    const handleIniciarEdicaoSocio = (s: any) => {
        setEditandoSocioId(s.id);
        setSocioEditForm({ nome: s.nome || "", telefone: s.telefone || "", dataNascimento: s.dataNascimento || "", vinculo: s.vinculo || "", obs: s.obs || "" });
    };

    const handleSalvarEdicaoSocio = (socioId: number) => {
        if (!socioEditForm.nome) return toast.error("Nome é obrigatório");
        setListaSocios(prev => prev.map(s => s.id === socioId
            ? { ...s, ...socioEditForm, _pendente: s._pendente === "criar" ? "criar" as const : "editar" as const }
            : s));
        setEditandoSocioId(null);
        toast.info("Edição de sócio adicionada ao rascunho — clique em Salvar Alterações para confirmar.");
    };

    const handleAbrirEditCS = (log: any) => {
        setCsEditando(log);
        setCsEditSentimento(log.sentimento || null);
        setCsEditObs(log.observacao || "");
        const dataRaw = log.data_registro || log.dataRegistro || log.createdAt;
        if (dataRaw) {
            const d = new Date(dataRaw);
            setCsEditData(!isNaN(d.getTime()) ? d.toISOString().split('T')[0] : "");
        }
        setShowEditCS(true);
    };

    const handleSalvarEditCS = async () => {
        if (!csEditSentimento || csEditObs.length < 10) return toast.error("Dados inválidos");
        if (salvandoEdicaoCS) return;

        setSalvandoEdicaoCS(true);
        try {
            const res = await atualizarLogCS(csEditando.id, {
                sentimento: csEditSentimento,
                observacao: csEditObs,
                dataRegistro: csEditData,
            });

            if (!res.success) {
                toast.error(res.error || "Não foi possível atualizar o CS.");
                return;
            }

            setListaLogsCS(prev => prev.map(l => l.id === csEditando.id
                ? { ...l, ...res.data }
                : l));
            setShowEditCS(false);
            setCsEditando(null);
            toast.success("CS atualizado!");
            try {
                if (aoSalvar) await aoSalvar();
            } catch {
                router.refresh();
            }
        } catch {
            toast.error("Falha na conexão ao atualizar o CS.");
        } finally {
            setSalvandoEdicaoCS(false);
        }
    };

    // Inicializa o formulário de gestão de CADA card (registro) quando o modal abre/o grupo muda.
    useEffect(() => {
        if (isOpen && registrosDoServicosSecao.length > 0) {
            const inicial: Record<number, FormGestaoCard> = {};
            for (const registro of registrosDoServicosSecao) {
                inicial[registro.id] = formInicialDoRegistro(registro);
            }
            setFormPorCard(inicial);
        }
        return () => setFormPorCard({});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clienteGrupo, isOpen]);

    // Auto-preenche a Data de Êxito do CARD quando o Status daquele card vira "Deferido".
    function handleMudarStatusCard(registroId: number, novoStatus: string) {
        const form = formPorCard[registroId];
        atualizarFormCard(registroId, {
            status: novoStatus,
            dataExitoManual:
                novoStatus === "Deferido" && !form?.dataExitoManual
                    ? new Date().toISOString().split("T")[0]
                    : form?.dataExitoManual ?? "",
        });
    }

    useEffect(() => {
        if (cliente) {
            setCnpj(cliente.cnpj);
            setRazaoSocial(cliente.razaoSocial);
            setNomeFantasia(cliente.nomeFantasia || "");
            setDataConstituicao(cliente.dataConstituicao || "");
            setRegimeTributario(cliente.regimeTributario || "");
            setUf(cliente.uf || "");
            setMunicipio(cliente.municipio || "");
            setEditandoDados(false);
        }
    }, [cliente]);


    useEffect(() => {
        setFeedbackSim(cliente?.feedbackGoogle ?? false);
        setNomeFeedback(cliente?.nomeGoogle ?? "");
        setListaLogsFeedback(cliente?.logFeedback ?? []);
    }, [cliente]);

    useEffect(() => {
        if (isOpen && cliente?.id) {
            const logsDoCliente = [...(cliente.log_cs || [])].sort((a, b) => {
                const dataA = new Date(a.dataRegistro).getTime();
                const dataB = new Date(b.dataRegistro).getTime();
                return dataB - dataA;
            });
            setListaLogsCS(logsDoCliente);
        }
        return () => setListaLogsCS([]);
    }, [cliente?.id, isOpen]);


    useEffect(() => {
        if (cliente) {
            setStatus(cliente.status || "Em Andamento");
            setNps(cliente.nps || 0);
            setFeedbackSim(cliente.feedbackGoogle || false);
            setNomeFeedback(cliente.nomeGoogle || "");
        }
    }, [cliente, isOpen]);

    useEffect(() => {
        if (cliente && isOpen) {
            setCnpj(cliente.cnpj || "");
            setRazaoSocial(cliente.razaoSocial || "");
            setNomeFantasia(cliente.nomeFantasia || "");
            setDataConstituicao(cliente.dataConstituicao || "");
            setRegimeTributario(cliente.regimeTributario || "");
            setUf(cliente.uf || "");
            setMunicipio(cliente.municipio || "");
            setServicosSelecionados(cliente.servicos ? cliente.servicos.split(",").map((s: string) => s.trim()) : []);

            setEditandoDados(false);
        }
    }, [cliente, isOpen]);

    // Dados do Painel de Metas (Forma de Pagamento, Valor do Contrato, Closer) por serviço mesclado
    const [contratosPorRegistro, setContratosPorRegistro] = useState<Record<number, {
        servico: string;
        valorContrato: number;
        formaPagamento: string;
        closerNome: string;
        createdAt: Date;
    } | null>>({});
    const [carregandoContratos, setCarregandoContratos] = useState(false);

    useEffect(() => {
        if (!isOpen || !cliente) {
            setContratosPorRegistro({});
            return;
        }

        const registrosDoGrupo: ClienteCS[] = Array.isArray(clienteGrupo) ? clienteGrupo : (cliente ? [cliente] : []);
        let cancelado = false;

        (async () => {
            setCarregandoContratos(true);
            const entradas = await Promise.all(
                registrosDoGrupo.map(async (registro) => {
                    const contrato = await buscarServicoContratadoPorCliente(registro.cnpj, registro.servicos);
                    return [registro.id, contrato] as const;
                })
            );
            if (!cancelado) {
                setContratosPorRegistro(Object.fromEntries(entradas));
                setCarregandoContratos(false);
            }
        })();

        return () => { cancelado = true; };
    }, [clienteGrupo, cliente, isOpen]);





    const getStatusColor = (s: string) => {
        switch (s) {
            case "Deferido": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
            case "Em Andamento": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
            case "Stand By": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
            case "Cancelado": return "bg-rose-500/10 text-rose-500 border-rose-500/20";
            default: return "bg-slate-800 text-slate-400";
        }
    };

    const handleSalvarFeedback = async () => {
        if (!sentimentoFeedback || !isTextoValido(obsFeedback)) return;
        if (salvandoFeedback) return;

        setSalvandoFeedback(true);
        try {
            const dataSelecionada = new Date(`${dataFeedback}T12:00:00`).toISOString();
            const res = await salvarLogFeedback(cliente!.id, {
                sentimento: sentimentoFeedback,
                observacao: obsFeedback,
                data_registro: dataSelecionada,
            });

            if (!res.success) {
                toast.error(res.error || "Não foi possível salvar o feedback.");
                return;
            }

            setListaLogsFeedback((prev) => [res.data, ...prev]);
            setShowNovoFeedback(false);
            setObsFeedback("");
            setSentimentoFeedback(null);
            setDataFeedback(new Date().toISOString().split('T')[0]);
            toast.success("Pedido registrado!");
            try {
                if (aoSalvar) await aoSalvar();
            } catch {
                router.refresh();
            }
        } catch {
            toast.error("Falha na conexão ao salvar o feedback.");
        } finally {
            setSalvandoFeedback(false);
        }
    };

    const handleAbrirEditFeedback = (log: ClienteCS["logFeedback"][number]) => {
        setFeedbackEditando(log);
        setFeedbackEditSentimento(
            log.sentimento === "pos" || log.sentimento === "neg" || log.sentimento === "na"
                ? log.sentimento
                : null
        );
        setFeedbackEditObs(log.observacao || "");
        const dataRaw = log.dataRegistro;
        if (dataRaw) {
            const data = new Date(dataRaw);
            setFeedbackEditData(!Number.isNaN(data.getTime()) ? data.toISOString().split("T")[0] : "");
        } else {
            setFeedbackEditData("");
        }
        setShowEditFeedback(true);
    };

    const handleSalvarEditFeedback = async () => {
        if (!feedbackEditando || !feedbackEditSentimento || !isTextoValido(feedbackEditObs)) {
            return toast.error("Dados inválidos");
        }
        if (salvandoEdicaoFeedback) return;

        setSalvandoEdicaoFeedback(true);
        try {
            const res = await atualizarLogFeedback(feedbackEditando.id, {
                sentimento: feedbackEditSentimento,
                observacao: feedbackEditObs,
                dataRegistro: feedbackEditData,
            });

            if (!res.success) {
                toast.error(res.error || "Não foi possível atualizar o feedback.");
                return;
            }

            setListaLogsFeedback((prev) => prev.map((log) =>
                log.id === feedbackEditando.id ? { ...log, ...res.data } : log
            ));
            setShowEditFeedback(false);
            setFeedbackEditando(null);
            toast.success("Feedback atualizado!");
            try {
                if (aoSalvar) await aoSalvar();
            } catch {
                router.refresh();
            }
        } catch {
            toast.error("Falha na conexão ao atualizar o feedback.");
        } finally {
            setSalvandoEdicaoFeedback(false);
        }
    };

    const handleExcluirFeedback = async (logId: number) => {
        if (!logId) return toast.error("ID do log não encontrado");
        if (!confirm("Deseja realmente excluir este pedido de feedback?")) return;

        // Registro só existe no rascunho local (nunca foi salvo) — remove sem chamar o servidor.
        const aindaNaoSalvo = listaLogsFeedback.find((item) => item.id === logId)?._pendente === "criar";
        if (aindaNaoSalvo) {
            setListaLogsFeedback((prev: any[]) => prev.filter(item => item.id !== logId));
            toast.success("Pedido removido do rascunho!");
            return;
        }

        try {
            const res = await excluirLogFeedback(logId);

            if (res.success) {
                toast.success("Excluído com sucesso!");
                setListaLogsFeedback((prev: any[]) => prev.filter(item => item.id !== logId));
            } else {
                toast.error("Erro ao excluir do banco de dados.");
            }
        } catch (error) {
            toast.error("Erro de conexão.");
        }
    };


    /**
     * Salva TUDO que foi editado no modal de uma vez só — dados fiscais do
     * registro principal, o card de gestão de CADA serviço contratado, e as
     * pendências locais de sócios (`_pendente: "criar"|"editar"`).
     * Único botão de salvar do modal ("Salvar Alterações" no rodapé) — ver
     * `decisions.md` sobre a unificação. Antes, "Salvar Alterações" e "Salvar
     * Serviço" eram botões independentes que chamavam `salvarAlteracoesGeral`
     * para o MESMO registro (quando o serviço é o principal) cada um mandando
     * uma FOTO DESATUALIZADA dos campos que o outro botão gerenciava — quem
     * salvava por último apagava a mudança de quem salvou antes. Agora só há
     * uma chamada por registro, sempre com os valores AO VIVO de todos os
     * campos (nenhuma leitura de `cliente!.campo` desatualizado).
     *
     * Falha parcial: em vez de tudo ou nada, cada pendência é tentada e as que
     * falharem ficam registradas em `falhas` — as que deram certo têm o
     * `_pendente` limpo do estado local (senão um clique novo em "Salvar
     * Alterações" reenviaria sócio/CS/feedback já criados, duplicando). O
     * modal só fecha se NADA falhar.
     */
    const handleSalvarTudo = async () => {
        if (salvandoTudo) return;
        setSalvandoTudo(true);

        const falhas: string[] = [];

        // 1) Registro principal: dados fiscais + status/NPS/feedback do cliente + seu próprio card de serviço.
        const formPrincipal = formPorCard[cliente!.id];
        const desbloqueadoPrincipal = SERVICOS_COM_EMBASAMENTO.includes(cliente!.servicos || "");
        const resPrincipal = await salvarAlteracoesGeral(cliente!.id, {
            cnpj,
            razaoSocial,
            nomeFantasia,
            dataConstituicao,
            regimeTributario,
            uf,
            municipio,
            servicos: servicosSelecionados,
            nps,
            feedbackGoogle: feedbackSim,
            nomeGoogle: nomeFeedback,
            status: formPrincipal?.status ?? cliente!.status,
            dataContratacao: formPrincipal?.dataContratacao ?? cliente!.dataContratacao,
            dataExito: formPrincipal?.dataExitoManual ?? cliente!.dataExito,
            analistaResponsavel: formPrincipal?.analistaResponsavel ?? cliente!.analistaResponsavel,
            embasamento: formPrincipal
                ? (desbloqueadoPrincipal ? formPrincipal.embasamento || null : null)
                : (cliente!.embasamento ?? null),
            origemLead: formPrincipal?.origemLead ?? cliente!.origemLead ?? null,
            formaPagamento: formPrincipal?.formaPagamento || null,
            valorContrato: formPrincipal?.valorContrato ? Number(formPrincipal.valorContrato) : null,
            closerNome: formPrincipal?.closerNome || null,
        });
        if (!resPrincipal.success) falhas.push("dados do cliente");

        // 2) Demais serviços contratados do mesmo CNPJ — cada um com seu próprio card.
        for (const registro of outrosServicos) {
            const form = formPorCard[registro.id];
            if (!form) continue;
            const desbloqueado = SERVICOS_COM_EMBASAMENTO.includes(registro.servicos || "");
            const res = await salvarAlteracoesGeral(registro.id, {
                analistaResponsavel: form.analistaResponsavel,
                dataContratacao: form.dataContratacao,
                status: form.status,
                nps: registro.nps,
                feedbackGoogle: registro.feedbackGoogle,
                nomeGoogle: registro.nomeGoogle,
                dataExito: form.dataExitoManual,
                cnpj: registro.cnpj,
                razaoSocial: registro.razaoSocial,
                nomeFantasia: registro.nomeFantasia,
                dataConstituicao: registro.dataConstituicao,
                regimeTributario: registro.regimeTributario,
                uf: registro.uf,
                servicos: registro.servicos,
                embasamento: desbloqueado ? form.embasamento || null : null,
                origemLead: form.origemLead || null,
                formaPagamento: form.formaPagamento || null,
                valorContrato: form.valorContrato ? Number(form.valorContrato) : null,
                closerNome: form.closerNome || null,
            });
            if (!res.success) falhas.push(`serviço "${registro.servicos || registro.id}"`);
        }

        // 3) Sócios pendentes (criar/editar).
        for (const s of listaSocios) {
            if (s._pendente === "criar") {
                const res = await adicionarSocio(cliente!.id, {
                    nome: s.nome, telefone: s.telefone, dataNascimento: s.dataNascimento, vinculo: s.vinculo, obs: s.obs,
                });
                if (res.success && res.data) {
                    const novoId = res.data.id;
                    setListaSocios((prev) => prev.map((x) => x.id === s.id ? { ...x, id: novoId, _pendente: undefined } : x));
                } else {
                    falhas.push(`sócio "${s.nome}"`);
                }
            } else if (s._pendente === "editar") {
                const res = await atualizarSocio(s.id, {
                    nome: s.nome, telefone: s.telefone, dataNascimento: s.dataNascimento, vinculo: s.vinculo, obs: s.obs,
                });
                if (res.success) {
                    setListaSocios((prev) => prev.map((x) => x.id === s.id ? { ...x, _pendente: undefined } : x));
                } else {
                    falhas.push(`sócio "${s.nome}"`);
                }
            }
        }

        setSalvandoTudo(false);

        if (falhas.length === 0) {
            toast.success("Todas as alterações foram salvas!");
            setEditandoDados(false);
            if (aoSalvar) await aoSalvar();
            onClose();
        } else {
            toast.error(`Não foi possível salvar: ${falhas.join(", ")}. O restante foi salvo — corrija e clique em Salvar Alterações novamente.`);
        }
    };

    const handleOcultarCliente = async (id: number) => {
        if (!confirm("Deseja ocultar este cliente?")) return;

        try {
            const res = await atualizarStatusCliente(id, "Arquivado");

            if (res.success) {
                toast.success("Cliente arquivado!");

                onClose(false);

                router.refresh();

            }
        } catch (error) {
            toast.error("Erro ao ocultar");
        }
    };




    if (!isOpen || !cliente) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 overflow-y-auto">
            <CsNpsModal3DShell className="bg-[#0b1220] border border-white/10 w-full max-w-6xl rounded-[2.5rem] shadow-2xl relative custom-scrollbar max-h-[95vh] overflow-y-auto">

                {/* HEADER */}
                <div className="sticky top-0 bg-[#0b1220]/95 backdrop-blur-md p-8 border-b border-white/5 flex justify-between items-center z-20 rounded-t-[2.5rem]">
                    <div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                            DADOS DO <span className="text-indigo-500">CLIENTE</span>
                        </h2>
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-1">Gestão de Operação e CS</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowConfirmarOcultar(true)}
                                className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border bg-slate-800 text-slate-400 border-white/5 hover:bg-rose-500/20 hover:text-rose-500 hover:border-rose-500/50"
                            >
                                <Trash2 size={12} /> Excluir
                            </button>

                            <button
                                onClick={() => setEditandoDados(!editandoDados)}
                                className={`cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all border ${editandoDados
                                    ? "bg-amber-500/20 text-amber-500 border-amber-500/50"
                                    : "bg-slate-800 text-slate-400 border-white/5 hover:bg-slate-700"
                                    }`}
                            >
                                {editandoDados ? <><LockOpen size={12} /> Edição Liberada</> : <><Edit3 size={12} /> Editar Dados</>}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-10">

                    {/* SEÇÃO 1: IGUAL AO CADASTRO */}
                    <section className={`grid grid-cols-1 md:grid-cols-12 gap-5 transition-all duration-500 ${editandoDados ? "opacity-100" : "opacity-70"}`}>
                        <div className="md:col-span-4 space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-500 ml-1 tracking-widest">CNPJ</label>
                            <input
                                disabled={!editandoDados}
                                value={cnpj}
                                onChange={(e) => setCnpj(e.target.value)}
                                className={`w-full bg-slate-950/50 border rounded-xl py-3.5 px-4 text-sm transition-all outline-none ${editandoDados ? "border-alpha/30 text-white focus:border-alpha" : "border-white/5 text-slate-500 cursor-not-allowed"}`}
                            />
                        </div>

                        <div className="md:col-span-8 space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-500 ml-1 tracking-widest">Razão Social</label>
                            <input
                                disabled={!editandoDados}
                                value={razaoSocial}
                                onChange={(e) => setRazaoSocial(e.target.value)}
                                className={`w-full bg-slate-950/50 border rounded-xl py-3.5 px-4 text-sm transition-all outline-none ${editandoDados ? "border-alpha/30 text-white focus:border-alpha" : "border-white/5 text-slate-500 cursor-not-allowed"}`}
                            />
                        </div>

                        <div className="md:col-span-6 space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-500 ml-1 tracking-widest">Nome Fantasia</label>
                            <input
                                disabled={!editandoDados}
                                value={nomeFantasia}
                                onChange={(e) => setNomeFantasia(e.target.value)}
                                className={

                                    `w-full bg-slate-950/50 border rounded-xl py-3.5 px-4 text-sm transition-all outline-none ${editandoDados ? "border-alpha/30 text-white focus:border-alpha" : "border-white/5 text-slate-500 cursor-not-allowed"}`}
                            />
                        </div>

                        <div className="md:col-span-3 space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-500 ml-1 tracking-widest">Data Constituição</label>
                            <input
                                disabled={!editandoDados}
                                value={dataConstituicao}
                                onChange={(e) => setDataConstituicao(e.target.value)}
                                className={`w-full bg-slate-950/50 border rounded-xl py-3.5 px-4 text-sm transition-all outline-none ${editandoDados ? "border-alpha/30 text-white focus:border-alpha" : "border-white/5 text-slate-500 cursor-not-allowed"}`}
                            />
                        </div>

                        <div className="md:col-span-3 space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-500 ml-1 tracking-widest">Regime</label>
                            <input
                                disabled={!editandoDados}
                                value={regimeTributario}
                                onChange={(e) => setRegimeTributario(e.target.value)}
                                className={`w-full bg-slate-950/50 border rounded-xl py-3.5 px-4 text-sm transition-all outline-none ${editandoDados ? "border-alpha/30 text-white focus:border-alpha" : "border-white/5 text-slate-500 cursor-not-allowed"}`}
                            />
                        </div>

                        <div className="md:col-span-3 space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-500 ml-1 tracking-widest">UF</label>
                            <input
                                disabled={!editandoDados}
                                value={uf}
                                onChange={(e) => setUf(e.target.value)}
                                className={`w-full bg-slate-950/50 border rounded-xl py-3.5 px-4 text-sm transition-all outline-none ${editandoDados ? "border-alpha/30 text-white focus:border-alpha" : "border-white/5 text-slate-500 cursor-not-allowed"}`}
                            />
                        </div>

                        <div className="md:col-span-3 space-y-1">
                            <label className="text-[9px] font-black uppercase text-slate-500 ml-1 tracking-widest">Cidade</label>
                            <input
                                disabled={!editandoDados}
                                value={municipio}
                                onChange={(e) => setMunicipio(e.target.value)}
                                className={`w-full bg-slate-950/50 border rounded-xl py-3.5 px-4 text-sm transition-all outline-none ${editandoDados ? "border-alpha/30 text-white focus:border-alpha" : "border-white/5 text-slate-500 cursor-not-allowed"}`}
                            />
                        </div>

                    </section>



                    <section className="pt-6 border-t border-white/5">
                        <div className="space-y-1 relative max-w-md">
                            <label className="text-[10px] font-black uppercase text-indigo-400 ml-1 tracking-widest">
                                Serviço Contratado Recentemente
                            </label>

                            {editandoDados ? (
                                <button
                                    type="button"
                                    onClick={() => setShowServicos(!showServicos)}
                                    className="w-full bg-slate-950/50 border border-alpha/30 rounded-xl py-3 px-4 text-sm font-black text-white hover:border-alpha transition-all text-left flex justify-between items-center italic uppercase group"
                                >
                                    {servicosSelecionados.length > 0 ? servicosSelecionados.join(" + ") : "SELECIONAR SERVIÇO"}
                                    <Plus size={14} className="text-alpha group-hover:scale-125 transition-transform shrink-0 ml-2" />
                                </button>
                            ) : (
                                <div className={`w-full bg-slate-900/30 border border-slate-800/50 rounded-xl py-3 px-4 text-sm font-black ${servicosSelecionados.length > 0 ? style.text : "text-slate-600"} italic uppercase truncate`}>
                                    {servicosSelecionados.length > 0 ? servicosSelecionados.join(" + ") : "NENHUM SERVIÇO DEFINIDO"}
                                </div>
                            )}



                            {showServicos && editandoDados && (
                                <div className="absolute top-full mt-2 w-full bg-slate-900 border border-white/10 rounded-2xl p-4 z-50 shadow-2xl animate-in zoom-in-95 duration-200">
                                    <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar">
                                        {listaServicos.map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => {
                                                    setServicosSelecionados([s]);
                                                    setShowServicos(false);
                                                }}
                                                className="w-full text-left p-3 rounded-xl text-xs font-bold text-slate-400 hover:bg-white/5 hover:text-alpha transition-all"
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>



                    {/* SEÇÃO SERVIÇOS CONTRATADOS (mesclagem por CNPJ + dados do Painel de Metas) */}
                    {/*
                        Renderiza sempre que houver ao menos 1 registro — todo cliente tem
                        no mínimo 1 serviço contratado. Antes ficava condicionada a
                        `length > 1`, o que escondia os dados do Painel de Metas (Forma de
                        Pagamento/Valor/Closer) até para clientes com contrato real
                        correspondente, só porque tinham apenas 1 serviço (bug real
                        encontrado por Probe/usuário — ver known-errors.md).
                    */}
                    {cliente && (
                        <section className="space-y-4 pt-6 border-t border-white/5">
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-1 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                                <h3 className="text-xs font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2">
                                    <Briefcase size={14} className="text-indigo-400" /> Serviços Contratados ({registrosDoServicosSecao.length})
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                {registrosDoServicosSecao.map((registro: ClienteCS) => {
                                    const contrato = contratosPorRegistro[registro.id];
                                    const form = formPorCard[registro.id];
                                    const ehPrincipal = registro.id === cliente.id;
                                    const embasamentoDesbloqueadoCard = SERVICOS_COM_EMBASAMENTO.includes(registro.servicos || "");

                                    return (
                                        <div
                                            key={registro.id}
                                            className={`p-5 rounded-2xl border space-y-4 ${ehPrincipal ? "bg-indigo-500/5 border-indigo-500/20" : "bg-slate-950/50 border-white/5"}`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <span className="text-sm font-black text-white uppercase italic tracking-tight">
                                                    {registro.servicos || "Serviço não definido"}
                                                </span>
                                                <span className={`shrink-0 text-[9px] font-black uppercase px-2 py-1 rounded-full border ${getStatusColor(registro.status)}`}>
                                                    {registro.status || "Em Andamento"}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                                <Calendar size={12} className="text-indigo-400" />
                                                Contratado em {contrato?.createdAt ? fmtDate(contrato.createdAt) : fmtDataSemHora(registro.dataContratacao)}
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-white/5">
                                                {editandoDados && form ? (
                                                    <>
                                                        <DropdownSelecaoComCriacao
                                                            label="Forma Pagto."
                                                            valorAtual={formatarFormaPagamento(form.formaPagamento) === "---" ? "" : formatarFormaPagamento(form.formaPagamento)}
                                                            opcoes={FORMAS_PAGAMENTO.map((f) => FORMAS_LABEL[f])}
                                                            onSelecionar={(label) => {
                                                                const codigo = FORMAS_PAGAMENTO.find((f) => FORMAS_LABEL[f] === label) || label;
                                                                atualizarFormCard(registro.id, { formaPagamento: codigo === form.formaPagamento ? "" : codigo });
                                                            }}
                                                            disabled={!editandoDados}
                                                            placeholder="Não definido"
                                                        />
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black uppercase text-indigo-400 ml-1 tracking-widest">Valor Contrato</label>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={form.valorContrato}
                                                                onChange={(e) => atualizarFormCard(registro.id, { valorContrato: e.target.value })}
                                                                placeholder="0,00"
                                                                className="w-full bg-indigo-500/5 border border-indigo-500/20 rounded-xl py-3 px-4 text-sm text-white outline-none focus:border-indigo-500"
                                                            />
                                                        </div>
                                                        <DropdownSelecaoComCriacao
                                                            label="Closer"
                                                            valorAtual={form.closerNome}
                                                            opcoes={listaClosersUsuarios}
                                                            onSelecionar={(v) => atualizarFormCard(registro.id, { closerNome: v })}
                                                            disabled={!editandoDados}
                                                            permiteCriarNovo
                                                            placeholder="SELECIONAR CLOSER"
                                                            onAbrirModalOutro={() => setCampoModalUsuario({ registroId: registro.id, campo: "closerNome" })}
                                                            textoBotaoOutro="OUTRO CLOSER"
                                                        />
                                                    </>
                                                ) : carregandoContratos ? (
                                                    <div className="sm:col-span-3 text-[10px] text-slate-600 uppercase font-black tracking-widest italic animate-pulse">
                                                        Consultando Painel de Metas...
                                                    </div>
                                                ) : (form?.formaPagamento || form?.valorContrato || form?.closerNome) ? (
                                                    <>
                                                        <div className="space-y-1">
                                                            <span className="flex items-center gap-1 text-[9px] font-black uppercase text-slate-500 tracking-widest">
                                                                <CreditCard size={11} /> Forma Pagto.
                                                            </span>
                                                            <p className="text-xs font-bold text-slate-200">{formatarFormaPagamento(form?.formaPagamento)}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <span className="flex items-center gap-1 text-[9px] font-black uppercase text-slate-500 tracking-widest">
                                                                <Wallet size={11} /> Valor Contrato
                                                            </span>
                                                            <p className="text-xs font-bold text-emerald-400">
                                                                {form?.valorContrato ? Number(form.valorContrato).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "---"}
                                                            </p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <span className="flex items-center gap-1 text-[9px] font-black uppercase text-slate-500 tracking-widest">
                                                                <UserCircle2 size={11} /> Closer
                                                            </span>
                                                            <p className="text-xs font-bold text-slate-200">{form?.closerNome || "---"}</p>
                                                        </div>
                                                    </>
                                                ) : contrato ? (
                                                    <>
                                                        <div className="space-y-1">
                                                            <span className="flex items-center gap-1 text-[9px] font-black uppercase text-slate-500 tracking-widest">
                                                                <CreditCard size={11} /> Forma Pagto.
                                                            </span>
                                                            <p className="text-xs font-bold text-slate-200">{formatarFormaPagamento(contrato.formaPagamento)}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <span className="flex items-center gap-1 text-[9px] font-black uppercase text-slate-500 tracking-widest">
                                                                <Wallet size={11} /> Valor Contrato
                                                            </span>
                                                            <p className="text-xs font-bold text-emerald-400">
                                                                {contrato.valorContrato.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                                            </p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <span className="flex items-center gap-1 text-[9px] font-black uppercase text-slate-500 tracking-widest">
                                                                <UserCircle2 size={11} /> Closer
                                                            </span>
                                                            <p className="text-xs font-bold text-slate-200">{contrato.closerNome || "---"}</p>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="sm:col-span-3 text-[10px] text-slate-700 uppercase font-black tracking-widest italic">
                                                        Sem contrato vinculado no Painel de Metas
                                                    </div>
                                                )}
                                            </div>

                                            {form && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-white/5">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase text-indigo-400 ml-1 tracking-widest">Status Atual</label>
                                                        <select
                                                            disabled={!editandoDados}
                                                            value={form.status}
                                                            onChange={(e) => handleMudarStatusCard(registro.id, e.target.value)}
                                                            className={`w-full border rounded-xl py-3 px-4 text-sm outline-none transition-all ${editandoDados ? "cursor-pointer bg-slate-950 border-slate-800 text-white focus:border-indigo-500 hover:bg-black" : "bg-slate-900/20 border-slate-800/30 text-slate-500 cursor-not-allowed"}`}
                                                        >
                                                            <option value="Em Andamento">Em Andamento</option>
                                                            <option value="Deferido">Deferido</option>
                                                            <option value="Stand By">Stand By</option>
                                                            <option value="Cancelado - Indeferimento">Cancelado - Indeferimento</option>
                                                            <option value="Cancelado - Troca de Empresa">Cancelado - Troca de Empresa</option>
                                                        </select>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Data Contratação</label>
                                                        {editandoDados ? (
                                                            <input
                                                                type="date"
                                                                value={form.dataContratacao ? new Date(form.dataContratacao).toISOString().split('T')[0] : ""}
                                                                onChange={(e) => atualizarFormCard(registro.id, { dataContratacao: e.target.value })}
                                                                className="w-full bg-indigo-500/5 border border-indigo-500/20 p-2.5 rounded-xl text-sm font-bold text-indigo-400 outline-none cursor-pointer appearance-none"
                                                                style={{ colorScheme: 'dark' }}
                                                            />
                                                        ) : (
                                                            <div className="bg-slate-900/30 border border-slate-800/50 p-3 rounded-xl text-sm text-slate-400 font-mono">
                                                                {fmtDataSemHora(registro.dataContratacao)}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black uppercase text-slate-500 ml-1 tracking-widest">Data de Êxito</label>
                                                        {form.status === "Deferido" ? (
                                                            <input
                                                                type="date"
                                                                disabled={!editandoDados}
                                                                value={form.dataExitoManual ? new Date(form.dataExitoManual).toISOString().split('T')[0] : ""}
                                                                onChange={(e) => atualizarFormCard(registro.id, { dataExitoManual: e.target.value })}
                                                                className="w-full bg-emerald-500/5 border border-emerald-500/20 p-2.5 rounded-xl text-sm font-bold text-emerald-400 outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                                                                style={{ colorScheme: 'dark' }}
                                                            />
                                                        ) : (
                                                            <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs text-slate-700 font-bold uppercase italic tracking-tighter">
                                                                Aguardando Deferimento
                                                            </div>
                                                        )}
                                                    </div>

                                                    <DropdownSelecaoComCriacao
                                                        label="Analista Responsável"
                                                        valorAtual={form.analistaResponsavel}
                                                        opcoes={listaAnalistas}
                                                        onSelecionar={(v) => atualizarFormCard(registro.id, { analistaResponsavel: v })}
                                                        disabled={!editandoDados}
                                                        permiteCriarNovo
                                                        placeholder="SELECIONAR ANALISTA"
                                                        onAbrirModalOutro={() => setCampoModalUsuario({ registroId: registro.id, campo: "analistaResponsavel" })}
                                                        textoBotaoOutro="OUTRO ANALISTA"
                                                    />

                                                    <DropdownSelecaoComCriacao
                                                        label="Embasamento"
                                                        valorAtual={form.embasamento}
                                                        opcoes={listaEmbasamentos}
                                                        onSelecionar={(v) => atualizarFormCard(registro.id, { embasamento: v })}
                                                        disabled={!editandoDados || !embasamentoDesbloqueadoCard}
                                                        placeholder="Não definido"
                                                        labelDesbloqueio={!embasamentoDesbloqueadoCard ? "150K/Ilimitado" : undefined}
                                                    />

                                                    <div>
                                                        <DropdownSelecaoComCriacao
                                                            label="Origem do Lead"
                                                            valorAtual={form.origemLead}
                                                            opcoes={listaOrigensLead}
                                                            onSelecionar={(v) => atualizarFormCard(registro.id, { origemLead: v })}
                                                            disabled={!editandoDados}
                                                            placeholder="Não definido"
                                                        />

                                                        {/* Indicado por (parceiro) — só no card principal, é propriedade da empresa/CNPJ */}
                                                        {ehPrincipal && cliente?.indicacao?.parceiro && (
                                                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl mt-1" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)" }}>
                                                                <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300/70">Indicado por</span>
                                                                <span className="text-[12px] font-bold text-indigo-200">{cliente.indicacao.parceiro.nome}</span>
                                                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded" style={{ background: "rgba(99,102,241,0.2)", color: "#c7d2fe" }}>{cliente.indicacao.parceiro.nivel}</span>
                                                            </div>
                                                        )}
                                                    </div>

                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}



                    {/* SEÇÃO 3: SÓCIOS */}
                    <section className="space-y-4 pt-6 border-t border-white/5">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-1 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                                <h3 className="text-xs font-black uppercase text-slate-500 tracking-[0.2em]">
                                    Quadro de Sócios / Responsáveis
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowNovoSocio(!showNovoSocio)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
                            >
                                {showNovoSocio ? "Cancelar" : <><Plus size={14} /> Novo Sócio</>}
                            </button>
                        </div>

                        {/* FORMULÁRIO PARA ADICIONAR SÓCIO - RENDERIZA NA HORA */}
                        {showNovoSocio && (
                            <div className="p-6 bg-slate-900/50 border border-indigo-500/20 rounded-[2rem] grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in zoom-in duration-300 mb-6 shadow-2xl">
                                <input
                                    placeholder="NOME DO SÓCIO"
                                    value={novoSocio.nome}
                                    onChange={e => setNovoSocio({ ...novoSocio, nome: e.target.value.toUpperCase() })}
                                    className="bg-black border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-all uppercase"
                                />
                                <input
                                    placeholder="TELEFONE (WHATSAPP)"
                                    value={novoSocio.telefone}
                                    onChange={e => setNovoSocio({ ...novoSocio, telefone: e.target.value })}
                                    className="bg-black border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-all"
                                />
                                <input
                                    placeholder="DATA DE NASCIMENTO (DD/MM/AAAA)"
                                    value={novoSocio.dataNascimento}
                                    onChange={e => setNovoSocio({ ...novoSocio, dataNascimento: e.target.value })}
                                    className="bg-black border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-all"
                                />

                                {/* SELECT DE VÍNCULO ESTILIZADO */}
                                <select
                                    value={novoSocio.vinculo}
                                    onChange={e => setNovoSocio({ ...novoSocio, vinculo: e.target.value })}
                                    className="bg-black border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-all cursor-pointer appearance-none"
                                >
                                    <option value="" className="text-slate-500">SELECIONE O VÍNCULO...</option>
                                    <option value="Sócio Proprietário">Sócio Proprietário</option>
                                    <option value="Sócio Oculto">Sócio Oculto</option>
                                    <option value="Funcionário/Colaborador">Funcionário/Colaborador</option>
                                    <option value="Contador Interno">Contador Interno</option>
                                    <option value="Contador Externo">Contador Externo</option>
                                    <option value="Despachante Aduaneiro">Despachante Aduaneiro</option>
                                    <option value="Outro">Outro</option>
                                </select>

                                <div className="flex gap-2 lg:col-span-2">
                                    <input
                                        placeholder="OBSERVAÇÃO"
                                        value={novoSocio.obs}
                                        onChange={e => setNovoSocio({ ...novoSocio, obs: e.target.value })}
                                        className="flex-1 bg-black border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 transition-all"
                                    />
                                    <button
                                        onClick={handleAdicionarSocio}
                                        className="px-6 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white transition-all active:scale-95 flex items-center justify-center shadow-lg shadow-emerald-900/20"
                                    >
                                        <Check size={18} strokeWidth={3} />
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="bg-slate-950/50 border border-white/5 rounded-[2rem] overflow-hidden shadow-inner">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/5 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                        <th className="px-6 py-4 border-b border-white/5">Nome do Socio</th>
                                        <th className="px-6 py-4 border-b border-white/5">Telefone</th>
                                        <th className="px-6 py-4 border-b border-white/5 text-center">Nascimento</th>
                                        <th className="px-6 py-4 border-b border-white/5">Vinculo</th>
                                        <th className="px-6 py-4 border-b border-white/5">Observações</th>
                                        <th className="px-6 py-4 border-b border-white/5 text-center">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {listaSocios.length > 0 ? (
                                        listaSocios.map((s: any, i: number) => (
                                            editandoSocioId === s.id ? (
                                                <tr key={s.id || i} className="bg-indigo-500/5 border-l-2 border-indigo-500">
                                                    <td className="px-3 py-3">
                                                        <input
                                                            value={socioEditForm.nome}
                                                            onChange={e => setSocioEditForm({ ...socioEditForm, nome: e.target.value.toUpperCase() })}
                                                            className="w-full bg-black border border-indigo-500/30 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500 uppercase"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <input
                                                            value={socioEditForm.telefone}
                                                            onChange={e => setSocioEditForm({ ...socioEditForm, telefone: e.target.value })}
                                                            className="w-full bg-black border border-indigo-500/30 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500"
                                                            placeholder="Telefone"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <input
                                                            value={socioEditForm.dataNascimento}
                                                            onChange={e => setSocioEditForm({ ...socioEditForm, dataNascimento: e.target.value })}
                                                            className="w-full bg-black border border-indigo-500/30 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500"
                                                            placeholder="DD/MM/AAAA"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <select
                                                            value={socioEditForm.vinculo}
                                                            onChange={e => setSocioEditForm({ ...socioEditForm, vinculo: e.target.value })}
                                                            className="w-full bg-black border border-indigo-500/30 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500 cursor-pointer appearance-none"
                                                        >
                                                            <option value="">SELECIONE...</option>
                                                            <option value="Sócio Proprietário">Sócio Proprietário</option>
                                                            <option value="Sócio Oculto">Sócio Oculto</option>
                                                            <option value="Funcionário/Colaborador">Funcionário/Colaborador</option>
                                                            <option value="Contador Interno">Contador Interno</option>
                                                            <option value="Contador Externo">Contador Externo</option>
                                                            <option value="Despachante Aduaneiro">Despachante Aduaneiro</option>
                                                            <option value="Outro">Outro</option>
                                                        </select>
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <input
                                                            value={socioEditForm.obs}
                                                            onChange={e => setSocioEditForm({ ...socioEditForm, obs: e.target.value })}
                                                            className="w-full bg-black border border-indigo-500/30 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500"
                                                            placeholder="Observação"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-3">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => handleSalvarEdicaoSocio(s.id)}
                                                                className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-all active:scale-90 disabled:opacity-50"
                                                                title="Confirmar (salva junto com Salvar Alterações)"
                                                            >
                                                                <Check size={14} strokeWidth={3} />
                                                            </button>
                                                            <button
                                                                onClick={() => setEditandoSocioId(null)}
                                                                className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-400 rounded-lg transition-all active:scale-90"
                                                                title="Cancelar"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                <tr key={s.id || i} className="hover:bg-white/[0.02] transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <span className="text-sm font-bold text-white uppercase tracking-tight group-hover:text-indigo-400 transition-colors">
                                                            {s.nome}
                                                        </span>
                                                        {s._pendente && (
                                                            <span className="ml-2 text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 align-middle">
                                                                Não salvo
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {s.telefone ? (
                                                            <a
                                                                href={`https://wa.me/${s.telefone.replace(/\D/g, '')}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-[11px] font-mono text-indigo-400 hover:text-green-400 transition-all flex items-center gap-2"
                                                            >
                                                                <span className="opacity-50">WA:</span> {s.telefone}
                                                            </a>
                                                        ) : (
                                                            <span className="text-xs font-mono text-slate-700">---</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="text-xs font-bold text-slate-400">
                                                            {s.dataNascimento || "---"}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-[10px] font-black text-indigo-500/70 uppercase tracking-tighter bg-indigo-500/5 px-2 py-1 rounded-md border border-indigo-500/10">
                                                            {s.vinculo || "NÃO INFORMADO"}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-[11px] text-slate-500 italic leading-relaxed block max-w-xs truncate" title={s.obs}>
                                                            {s.obs || "---"}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <button
                                                            onClick={() => handleIniciarEdicaoSocio(s)}
                                                            className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all duration-200 active:scale-90"
                                                            title="Editar Sócio"
                                                        >
                                                            <Edit3 size={15} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-16 text-center text-slate-800 text-[10px] font-black uppercase tracking-[0.3em] italic opacity-40">
                                                Nenhum sócio vinculado a este CNPJ
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>


                    {/* SEÇÃO CUSTOMER SUCCESS */}
                    <section className="space-y-6 pt-6 border-t border-white/5">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2">
                                <MessageSquare size={16} className="text-emerald-500" /> Customer Success (CS)
                            </h3>
                            <button
                                onClick={() => setShowNovoCS(true)}
                                className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
                            >
                                <Plus size={14} /> Novo CS
                            </button>
                        </div>

                        <div className="bg-slate-950/50 border border-white/5 rounded-2xl overflow-hidden shadow-inner">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white/5 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">Data</th>
                                        <th className="px-6 py-4">Colaborador</th>
                                        <th className="px-6 py-4 text-center">Sentimento</th>
                                        <th className="px-6 py-4">Observação</th>
                                        <th className='px-6 py-4 text-center'>Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {listaLogsCS && listaLogsCS.length > 0 ? (
                                        listaLogsCS.map((log: any, index: number) => (
                                            <tr
                                                key={`${cliente?.id}-${log.id || index}`}
                                                className="hover:bg-white/[0.02] transition-colors group"
                                            >
                                                <td className="px-6 py-4 text-[11px] font-black text-blue-300 tracking-tighter">
                                                    {(() => {
                                                        const dataRaw = log.data_registro || log.dataRegistro || log.createdAt;
                                                        if (!dataRaw) return "---";

                                                        const d = new Date(dataRaw);
                                                        if (isNaN(d.getTime())) {
                                                            return dataRaw.split('T')[0].split('-').reverse().join('/');
                                                        }

                                                        return fmtDate(d);
                                                    })()}
                                                </td>

                                                <td className="px-6 py-4 text-xs font-bold text-white uppercase tracking-tighter">
                                                    {log.colaborador || "---"}
                                                    {log._pendente && (
                                                        <span className="ml-2 text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 align-middle">
                                                            Não salvo
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex justify-center scale-110">
                                                        {log.sentimento === "pos" && <ThumbsUp size={14} className="text-emerald-500 drop-shadow-[0_0_5px_rgba(16,185,129,0.3)]" />}
                                                        {log.sentimento === "neg" && <ThumbsDown size={14} className="text-rose-500 drop-shadow-[0_0_5px_rgba(244,63,94,0.3)]" />}
                                                        {log.sentimento === "na" && <Minus size={14} className="text-slate-500" />}
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4">
                                                    <p className="text-[11px] text-slate-400 italic max-w-xs truncate hover:text-white transition-colors cursor-help" title={log.observacao}>
                                                        {log.observacao || "---"}
                                                    </p>
                                                </td>

                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleAbrirEditCS(log); }}
                                                            className="cursor-pointer p-2 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all duration-200 active:scale-90"
                                                            title="Editar Registro"
                                                        >
                                                            <Edit3 size={15} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleExcluirCS(log.id || log.ID);
                                                            }}
                                                            className="cursor-pointer p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all duration-200 active:scale-90"
                                                            title="Excluir Registro"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center text-[10px] uppercase font-black tracking-[0.4em] opacity-20 italic">
                                                Nenhum histórico de CS detectado
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/*  NPS  */}
                        <div className={`grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-gradient-to-br from-slate-900/40 to-black p-6 rounded-[2.5rem] border transition-all duration-500 relative overflow-hidden group ${status === "Deferido" ? "border-white/5 opacity-100" : "border-white/0 opacity-30 grayscale pointer-events-none"
                            }`}>
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Star size={80} />
                            </div>

                            {/* Ícone e Títulos */}
                            <div className="md:col-span-4 flex items-center gap-4">
                                <div className={`p-3 rounded-2xl border transition-all duration-500 ${status === "Deferido" && nps !== null && nps >= 9 ? "bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]" :
                                    status === "Deferido" && nps !== null && nps >= 7 ? "bg-amber-500/10 border-amber-500/20" :
                                        status === "Deferido" && nps !== null && nps > 0 ? "bg-rose-500/10 border-rose-500/20" : "bg-slate-800/50 border-white/5"
                                    }`}>
                                    <Star className={`${status === "Deferido" && nps !== null && nps >= 9 ? "text-emerald-500" :
                                        status === "Deferido" && nps !== null && nps >= 7 ? "text-amber-500" :
                                            status === "Deferido" && nps !== null && nps > 0 ? "text-rose-500" : "text-slate-600"
                                        } w-5 h-5 transition-colors`} />
                                </div>
                                <div>
                                    <h3 className="text-[11px] font-black uppercase text-slate-200 tracking-[0.15em]">Métrica NPS</h3>
                                    <p className="text-[9px] text-slate-500 uppercase font-bold italic mt-0.5 tracking-tighter">
                                        {status === "Deferido" ? "Percepção de Valor e Fidelidade" : "Disponível após Deferimento"}
                                    </p>
                                </div>
                            </div>

                            {/* Select de Nota */}
                            <div className="md:col-span-3">
                                <select
                                    disabled={status !== "Deferido"}
                                    value={nps ?? ""}
                                    onChange={(e) => setNps(e.target.value === "" ? null : Number(e.target.value))}
                                    className="w-full bg-black/60 border border-white/10 rounded-2xl py-4 px-5 text-sm text-amber-500 font-black outline-none focus:border-amber-500/50 transition-all hover:bg-black cursor-pointer shadow-inner appearance-none disabled:cursor-not-allowed"
                                >
                                    <option value="" className="text-slate-700">NOTAS BLOQUEADAS</option>
                                    {[...Array(11)].map((_, i) => (
                                        <option key={i} value={i} className="bg-slate-900 text-amber-500 font-bold">
                                            {i} - {i >= 9 ? 'Promotor' : i >= 7 ? 'Neutro' : 'Detrator'}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Réguas de Cores */}
                            <div className="md:col-span-5 flex flex-col justify-center space-y-3">
                                <div className="flex justify-between text-[8px] font-black uppercase tracking-widest px-1">
                                    <span className={status === "Deferido" && nps !== null && nps > 0 && nps <= 6 ? "text-rose-500" : "text-slate-600"}>Detrator</span>
                                    <span className={status === "Deferido" && nps !== null && nps >= 7 && nps <= 8 ? "text-amber-500" : "text-slate-600"}>Neutro</span>
                                    <span className={status === "Deferido" && nps !== null && nps >= 9 ? "text-emerald-500" : "text-slate-600"}>Promotor</span>
                                </div>

                                <div className="h-2 w-full bg-slate-800/50 rounded-full overflow-hidden flex p-0.5 border border-white/5 shadow-inner">
                                    <div className={`h-full rounded-l-full transition-all duration-700 ${status === "Deferido" && nps !== null && nps > 0 && nps <= 6 ? "w-[63%] bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]" : "w-[63%] bg-rose-500/10"}`} />
                                    <div className={`h-full transition-all duration-700 ${status === "Deferido" && nps !== null && nps >= 7 && nps <= 8 ? "w-[18%] bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]" : "w-[18%] bg-amber-500/10"}`} />
                                    <div className={`h-full rounded-r-full transition-all duration-700 ${status === "Deferido" && nps !== null && nps >= 9 ? "w-[19%] bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" : "w-[19%] bg-emerald-500/10"}`} />
                                </div>
                            </div>
                        </div>

                    </section>



                    {/* SEÇÃO 6: FEEDBACK GOOGLE */}
                    <section className="space-y-6 pt-8 border-t border-white/5">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 rounded-lg"><Search className="text-blue-500 w-5 h-5" /></div>
                                <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Feedback Google</h3>
                            </div>
                            <button
                                onClick={() => setShowNovoFeedback(true)}
                                className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                                <Plus size={14} />FeedBack
                            </button>
                        </div>

                        <div className="flex flex-col md:flex-row items-center gap-8 bg-slate-950/30 p-6 rounded-2xl border border-white/5">
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] font-black uppercase text-slate-500">Fez Feedback?</span>
                                <button
                                    onClick={() => {
                                        setFeedbackSim(!feedbackSim);
                                        if (feedbackSim) setNomeFeedback("");
                                    }}
                                    className={`relative w-12 h-6 rounded-full transition-colors ${feedbackSim ? 'bg-emerald-500' : 'bg-red-500'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${feedbackSim ? 'left-7' : 'left-1'}`} />
                                </button>
                                <span className={`text-[10px] font-black uppercase ${feedbackSim ? 'text-emerald-500' : 'text-slate-600'}`}>
                                    {feedbackSim ? 'Sim' : 'Não'}
                                </span>
                            </div>

                            <div className="flex-1 w-full space-y-1">
                                <label className={`text-[9px] font-black uppercase ml-1 transition-colors ${feedbackSim ? 'text-slate-500' : 'text-slate-800'}`}>Nome de quem comentou</label>
                                <input
                                    type="text"
                                    disabled={!feedbackSim}
                                    value={nomeFeedback}
                                    onChange={(e) => setNomeFeedback(e.target.value)}
                                    placeholder={feedbackSim ? "Digite o nome..." : "Bloqueado - Marque 'Sim' primeiro"}
                                    className={`w-full bg-slate-950 border rounded-xl py-3 px-4 text-sm transition-all outline-none ${feedbackSim ? 'border-slate-800 text-white focus:border-blue-500' : 'border-transparent text-slate-800 cursor-not-allowed'}`}
                                />
                            </div>
                        </div>

                        {/* TABELA DE PEDIDOS DE FEEDBACK */}
                        <div className="bg-slate-950/50 border border-white/5 rounded-2xl overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-white/5 text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">Data</th>
                                        <th className="px-6 py-4">Colaborador</th>
                                        <th className="px-6 py-4 text-center">Sentimento</th>
                                        <th className="px-6 py-4">Observação</th>
                                        <th className="px-6 py-4 text-center">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {listaLogsFeedback && listaLogsFeedback.length > 0 ? (
                                        listaLogsFeedback.map((log: any, index: number) => (
                                            <tr key={log.id || index} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="px-6 py-4 text-[11px] font-black text-blue-300">
                                                    {fmtDate(log.data_registro || log.dataRegistro)}
                                                </td>
                                                <td className="px-6 py-4 text-xs font-bold text-white uppercase">
                                                    {log.colaborador}
                                                    {log._pendente && (
                                                        <span className="ml-2 text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 align-middle">
                                                            Não salvo
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex justify-center">
                                                        {log.sentimento === "pos" && <ThumbsUp size={14} className="text-blue-500" />}
                                                        {log.sentimento === "neg" && <ThumbsDown size={14} className="text-rose-500" />}
                                                        {log.sentimento === "na" && <Minus size={14} className="text-slate-500" />}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-[11px] text-slate-400 italic truncate max-w-xs" title={log.observacao}>
                                                        {log.observacao}
                                                    </p>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAbrirEditFeedback(log)}
                                                            className="cursor-pointer p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all active:scale-90"
                                                            title="Editar Feedback"
                                                        >
                                                            <Edit3 size={15} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleExcluirFeedback(log.id)}
                                                            className="cursor-pointer p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all active:scale-90"
                                                            title="Excluir Feedback"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="p-12 text-center text-[10px] uppercase font-black opacity-20 italic tracking-[0.4em]">
                                                Nenhum pedido de feedback detectado
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>

                {/* BOTÃO SALVAR e cancelar GERAL */}
                <div className="p-8 border-t border-white/5 flex justify-end gap-6">
                    <button
                        type="button"
                        onClick={() => onClose()}
                        className="cursor-pointer flex items-center gap-2 px-10 py-4 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all">
                        <X size={18} /> Cancelar
                    </button>

                    <button
                        type="button"
                        onClick={handleSalvarTudo}
                        disabled={salvandoTudo}
                        className="cursor-pointer flex items-center gap-2 px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                        <Save size={18} className={salvandoTudo ? "animate-spin" : ""} />
                        {salvandoTudo ? "Salvando..." : "Salvar Alterações"}
                    </button>
                </div>

                {showNovoCS && portalTarget && createPortal(
                    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
                        <CsNpsModal3DShell className="relative bg-slate-900 border border-white/10 w-full max-w-md rounded-[2rem] p-8 shadow-3xl">
                            <div className="flex justify-between items-center mb-6">
                                <h4 className="text-lg font-black text-white uppercase">Novo <span className="text-emerald-500">CS</span></h4>
                                <button type="button" onClick={() => setShowNovoCS(false)}><X size={20} className="cursor-pointer text-slate-500" /></button>
                            </div>

                            <form
                                className="space-y-6"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    void handleSalvarCS();
                                }}
                            >

                                <div className="space-y-3">
                                    <div className="flex justify-between items-end px-1">
                                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                                            <MessageSquare size={12} className="text-emerald-500" /> Relato do Atendimento
                                        </label>
                                        <span className={

                                            `text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${obsCS.length >= 10 && obsCS.length <= 140 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                            {obsCS.length}/140
                                        </span>
                                    </div>

                                    <div className="relative group">
                                        <textarea
                                            value={obsCS}
                                            onChange={(e) => setObsCS(e.target.value)}
                                            className={`w-full bg-slate-950/80 border-2 rounded-2xl p-4 text-sm text-white min-h-[130px] outline-none transition-all duration-300 resize-none shadow-inner
                                            ${obsCS.length > 0 && (obsCS.length < 10 || obsCS.length > 140)
                                                    ? 'border-rose-500/30 focus:border-rose-500 focus:shadow-[0_0_15px_rgba(244,63,94,0.1)]'
                                                    : 'border-slate-800 focus:border-emerald-500 focus:shadow-[0_0_15px_rgba(16,185,129,0.1)]'}`}
                                            placeholder="O que o cliente relatou neste contato?..."
                                        />
                                        <div className={`absolute bottom-3 right-3 transition-opacity ${obsCS.length >= 10 && obsCS.length <= 140 ? 'opacity-100' : 'opacity-0'}`}>
                                            <CheckCircle2 size={16} className="text-emerald-500" />
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase text-slate-500 block text-center">Resultado do Feedback</label>
                                    <div className="flex justify-between items-center gap-4">
                                        {/* POSITIVO */}
                                        <button
                                            type="button"
                                            onClick={() => setFeedbackCS("pos")}
                                            className={`cursor-pointer flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${feedbackCS === "pos" ? "bg-emerald-500/20 border-emerald-500 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]" : "bg-slate-950 border-white/5 text-slate-600 hover:text-white"}`}
                                        >
                                            <ThumbsUp size={24} /> <span className="text-[9px] font-black uppercase">Positivo</span>
                                        </button>

                                        {/* NEGATIVO */}
                                        <button
                                            type="button"
                                            onClick={() => setFeedbackCS("neg")}
                                            className={`cursor-pointer flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${feedbackCS === "neg" ? "bg-rose-500/20 border-rose-500 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.2)]" : "bg-slate-950 border-white/5 text-slate-600 hover:text-white"}`}
                                        >
                                            <ThumbsDown size={24} /> <span className="text-[9px] font-black uppercase">Negativo</span>
                                        </button>

                                        {/* N/A - SEM RESPOSTA */}
                                        <button
                                            type="button"
                                            onClick={() => setFeedbackCS("na")}
                                            className={`cursor-pointer flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${feedbackCS === "na" ? "bg-slate-700 border-white/30 text-white" : "bg-slate-950 border-white/5 text-slate-600 hover:text-white"}`}
                                        >
                                            <Minus size={24} /> <span className="text-[9px] font-black uppercase">N/A (Sem Resposta)</span>
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2 px-1">
                                            <Calendar size={12} className="text-emerald-500" /> Data do Atendimento
                                        </label>
                                        <input
                                            type="date"
                                            value={dataCS}
                                            onChange={(e) => setDataCS(e.target.value)}
                                            className="w-full bg-slate-950/80 border-2 border-slate-800 rounded-2xl p-4 text-sm text-white outline-none transition-all duration-300 focus:border-emerald-500 [color-scheme:dark]"
                                        />
                                    </div>

                                </div>

                                <div className="flex gap-3 pt-4">
                                    {/* BOTÃO CANCELAR */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowNovoCS(false);
                                            setObsCS("");
                                            setFeedbackCS(

                                                null);
                                        }}
                                        className="cursor-pointer flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                    >
                                        Cancelar
                                    </button>

                                    {/* BOTÃO SALVAR CS */}
                                    <button
                                        type="submit"
                                        disabled={!isTextoValido(obsCS) || !feedbackCS || salvandoNovoCS}
                                        className="cursor-pointer flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                                    >
                                        {salvandoNovoCS ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : "Salvar CS"}
                                    </button>
                                </div>
                            </form>
                        </CsNpsModal3DShell>
                    </div>,
                    portalTarget,
                )}
            </CsNpsModal3DShell>


            {/* MODAL PEQUENO: NOVO PEDIDO DE FEEDBACK */}
            {showNovoFeedback && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-300">
                    <CsNpsModal3DShell className="relative bg-[#0f172a] border border-blue-500/20 w-full max-w-md rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/20 rounded-xl"><TrendingUp className="text-blue-400 w-5 h-5" /></div>
                                <h4 className="text-xl font-black text-white uppercase italic tracking-tighter">Solicitar <span className="text-blue-500">Google</span></h4>
                            </div>

                            <button type="button" onClick={() => { setShowNovoFeedback(false); setObsFeedback(""); setSentimentoFeedback(null); }} className="cursor-pointer text-slate-500 hover:text-white"><X size={24} /></button>
                        </div>

                        <form
                            className="space-y-8"
                            onSubmit={(event) => {
                                event.preventDefault();
                                void handleSalvarFeedback();
                            }}
                        >
                            {/* BOTÕES DE SENTIMENTO */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-slate-500 block text-center tracking-widest">Sentimento do Cliente</label>
                                <div className="flex justify-between gap-3">
                                    {[
                                        { id: 'pos', icon: ThumbsUp, label: 'Positivo', color: 'blue' },
                                        { id: 'neg', icon: ThumbsDown, label: 'Negativo', color: 'rose' },
                                        { id: 'na', icon: Minus, label: 'N/A', color: 'slate' }
                                    ].map((btn) => (
                                        <button
                                            key={btn.id}
                                            type="button"
                                            onClick={() => setSentimentoFeedback(btn.id as any)}
                                            className={`cursor-pointer flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all duration-300 
                                                ${sentimentoFeedback === btn.id
                                                    ? `bg-${btn.color}-500/10 border-${btn.color}-500 text-${btn.color}-400 shadow-lg`
                                                    : 'bg-slate-950 border-white/5 text-slate-600 hover:border-white/10'}`}
                                        >
                                            <btn.icon size={20} />
                                            <span className="text-[9px] font-black uppercase">{btn.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* INPUT DE TEXTO */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Observação</label>
                                    <span className={`text-[10px] font-mono font-bold ${obsFeedback.length >= 10 && obsFeedback.length <= 140 ? 'text-blue-400' : 'text-rose-500'}`}>
                                        {obsFeedback.length}/140
                                    </span>
                                </div>
                                <textarea
                                    value={obsFeedback}
                                    onChange={(e) => setObsFeedback(e.target.value)}
                                    className={`w-full bg-slate-950 border-2 rounded-2xl p-4 text-sm text-white min-h-[100px] outline-none transition-all
                                    ${obsFeedback.length > 0 && !isTextoValido(obsFeedback) ? 'border-rose-500/30' : 'border-slate-800 focus:border-blue-500'}`}
                                    placeholder="Por que está solicitando este feedback?..."
                                />
                            </div>

                            <div className="relative group">
                                <input
                                    type="date"
                                    value={dataFeedback}
                                    onChange={(e) => setDataFeedback(e.target.value)}
                                    className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 text-sm text-white outline-none transition-all duration-300 focus:border-blue-500 focus:shadow-[0_0_15px_rgba(59,130,246,0.1)] [color-scheme:dark] cursor-pointer font-bold"
                                />
                            </div>

                            <div className="flex gap-4">
                                <button type="button" onClick={() => setShowNovoFeedback(false)} className="cursor-pointer flex-1 py-4 bg-slate-900 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors">Cancelar</button>
                                <button
                                    type="submit"
                                    disabled={!isTextoValido(obsFeedback) || !sentimentoFeedback || salvandoFeedback}
                                    className="cursor-pointer flex-1 py-4 bg-blue-600 disabled:bg-slate-800/50 disabled:text-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-all inline-flex items-center justify-center gap-2"
                                >
                                    {salvandoFeedback ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : "Confirmar Pedido"}
                                </button>
                            </div>
                        </form>
                    </CsNpsModal3DShell>
                </div>
            )}

            {showEditFeedback && feedbackEditando && portalTarget && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
                    <CsNpsModal3DShell className="relative bg-[#0f172a] border border-blue-500/20 w-full max-w-md rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                        <div className="flex justify-between items-center mb-8">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/20 rounded-xl">
                                    <Edit3 className="text-blue-400 w-5 h-5" />
                                </div>
                                <h4 className="text-xl font-black text-white uppercase italic tracking-tighter">
                                    Editar <span className="text-blue-500">Feedback</span>
                                </h4>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowEditFeedback(false);
                                    setFeedbackEditando(null);
                                }}
                                className="cursor-pointer text-slate-500 hover:text-white"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <form
                            className="space-y-8"
                            onSubmit={(event) => {
                                event.preventDefault();
                                void handleSalvarEditFeedback();
                            }}
                        >
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-slate-500 block text-center tracking-widest">
                                    Sentimento do Cliente
                                </label>
                                <div className="flex justify-between gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFeedbackEditSentimento("pos")}
                                        className={`cursor-pointer flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                                            feedbackEditSentimento === "pos"
                                                ? "bg-blue-500/10 border-blue-500 text-blue-400 shadow-lg"
                                                : "bg-slate-950 border-white/5 text-slate-600 hover:border-white/10"
                                        }`}
                                    >
                                        <ThumbsUp size={20} />
                                        <span className="text-[9px] font-black uppercase">Positivo</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFeedbackEditSentimento("neg")}
                                        className={`cursor-pointer flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                                            feedbackEditSentimento === "neg"
                                                ? "bg-rose-500/10 border-rose-500 text-rose-400 shadow-lg"
                                                : "bg-slate-950 border-white/5 text-slate-600 hover:border-white/10"
                                        }`}
                                    >
                                        <ThumbsDown size={20} />
                                        <span className="text-[9px] font-black uppercase">Negativo</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFeedbackEditSentimento("na")}
                                        className={`cursor-pointer flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                                            feedbackEditSentimento === "na"
                                                ? "bg-slate-700 border-white/30 text-white shadow-lg"
                                                : "bg-slate-950 border-white/5 text-slate-600 hover:border-white/10"
                                        }`}
                                    >
                                        <Minus size={20} />
                                        <span className="text-[9px] font-black uppercase">N/A</span>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                                        Observação
                                    </label>
                                    <span className={`text-[10px] font-mono font-bold ${
                                        isTextoValido(feedbackEditObs) ? "text-blue-400" : "text-rose-500"
                                    }`}>
                                        {feedbackEditObs.length}/140
                                    </span>
                                </div>
                                <textarea
                                    value={feedbackEditObs}
                                    onChange={(event) => setFeedbackEditObs(event.target.value)}
                                    className={`w-full bg-slate-950 border-2 rounded-2xl p-4 text-sm text-white min-h-[100px] outline-none transition-all resize-none ${
                                        feedbackEditObs.length > 0 && !isTextoValido(feedbackEditObs)
                                            ? "border-rose-500/30"
                                            : "border-slate-800 focus:border-blue-500"
                                    }`}
                                    placeholder="Atualize a observação do feedback..."
                                />
                            </div>

                            <input
                                type="date"
                                value={feedbackEditData}
                                onChange={(event) => setFeedbackEditData(event.target.value)}
                                className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 text-sm text-white outline-none transition-all focus:border-blue-500 [color-scheme:dark] cursor-pointer font-bold"
                            />

                            <div className="flex gap-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowEditFeedback(false);
                                        setFeedbackEditando(null);
                                    }}
                                    disabled={salvandoEdicaoFeedback}
                                    className="cursor-pointer flex-1 py-4 bg-slate-900 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!isTextoValido(feedbackEditObs) || !feedbackEditSentimento || salvandoEdicaoFeedback}
                                    className="cursor-pointer flex-1 py-4 bg-blue-600 disabled:bg-slate-800/50 disabled:text-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-all inline-flex items-center justify-center gap-2"
                                >
                                    {salvandoEdicaoFeedback
                                        ? <><Loader2 size={14} className="animate-spin" /> Salvando...</>
                                        : "Salvar Edição"}
                                </button>
                            </div>
                        </form>
                    </CsNpsModal3DShell>
                </div>,
                portalTarget,
            )}

            {showEditCS && csEditando && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
                    <CsNpsModal3DShell className="relative bg-slate-900 border border-white/10 w-full max-w-md rounded-[2rem] p-8 shadow-3xl">
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="text-lg font-black text-white uppercase">Editar <span className="text-emerald-500">CS</span></h4>
                            <button type="button" onClick={() => { setShowEditCS(false); setCsEditando(null); }}><X size={20} className="cursor-pointer text-slate-500" /></button>
                        </div>

                        <form
                            className="space-y-6"
                            onSubmit={(event) => {
                                event.preventDefault();
                                void handleSalvarEditCS();
                            }}
                        >
                            <div className="space-y-3">
                                <div className="flex justify-between items-end px-1">
                                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                                        <MessageSquare size={12} className="text-emerald-500" /> Relato do Atendimento
                                    </label>
                                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${csEditObs.length >= 10 && csEditObs.length <= 140 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                        {csEditObs.length}/140
                                    </span>
                                </div>
                                <textarea
                                    value={csEditObs}
                                    onChange={(e) => setCsEditObs(e.target.value)}
                                    className={`w-full bg-slate-950/80 border-2 rounded-2xl p-4 text-sm text-white min-h-[120px] outline-none transition-all resize-none shadow-inner
                                    ${csEditObs.length > 0 && (csEditObs.length < 10 || csEditObs.length > 140)
                                            ? 'border-rose-500/30 focus:border-rose-500'
                                            : 'border-slate-800 focus:border-emerald-500'}`}
                                    placeholder="O que o cliente relatou neste contato?..."
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-slate-500 block text-center">Resultado do Feedback</label>
                                <div className="flex justify-between items-center gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setCsEditSentimento("pos")}
                                        className={`cursor-pointer flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${csEditSentimento === "pos" ? "bg-emerald-500/20 border-emerald-500 text-emerald-500" : "bg-slate-950 border-white/5 text-slate-600 hover:text-white"}`}
                                    >
                                        <ThumbsUp size={22} /> <span className="text-[9px] font-black uppercase">Positivo</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCsEditSentimento("neg")}
                                        className={`cursor-pointer flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${csEditSentimento === "neg" ? "bg-rose-500/20 border-rose-500 text-rose-500" : "bg-slate-950 border-white/5 text-slate-600 hover:text-white"}`}
                                    >
                                        <ThumbsDown size={22} /> <span className="text-[9px] font-black uppercase">Negativo</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCsEditSentimento("na")}
                                        className={`cursor-pointer flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all ${csEditSentimento === "na" ? "bg-slate-700 border-white/30 text-white" : "bg-slate-950 border-white/5 text-slate-600 hover:text-white"}`}
                                    >
                                        <Minus size={22} /> <span className="text-[9px] font-black uppercase">N/A</span>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2 px-1">
                                    <Calendar size={12} className="text-emerald-500" /> Data do Atendimento
                                </label>
                                <input
                                    type="date"
                                    value={csEditData}
                                    onChange={(e) => setCsEditData(e.target.value)}
                                    className="w-full bg-slate-950/80 border-2 border-slate-800 rounded-2xl p-4 text-sm text-white outline-none transition-all focus:border-emerald-500 [color-scheme:dark]"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowEditCS(false); setCsEditando(null); }}
                                    className="cursor-pointer flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!isTextoValido(csEditObs) || !csEditSentimento || salvandoEdicaoCS}
                                    className="cursor-pointer flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-900/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                                >
                                    {salvandoEdicaoCS ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : "Salvar Edição"}
                                </button>
                            </div>
                        </form>
                    </CsNpsModal3DShell>
                </div>
            )}

            {showConfirmarOcultar && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <CsNpsModal3DShell className="relative bg-slate-900 border border-rose-500/30 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl shadow-rose-900/20 text-center">
                        <div className="flex justify-center mb-6">
                            <div className="p-4 bg-rose-500/10 rounded-full animate-pulse">
                                <AlertTriangle size={40} className="text-rose-500" />
                            </div>
                        </div>

                        <h3 className="text-xl font-black text-white uppercase mb-2 tracking-tighter">Atenção Total</h3>
                        <p className="text-sm text-slate-400 mb-8 px-4">
                            Você está prestes a <span className="text-rose-500 font-bold">Excluir</span> este cliente da listagem principal.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => handleOcultarCliente(cliente.id)}
                                className="cursor-pointer w-full py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-lg shadow-rose-900/40"
                            >
                                Sim, Excluir Agora
                            </button>
                            <button
                                onClick={() => setShowConfirmarOcultar(false)}
                                className="cursor-pointer w-full py-4 bg-slate-800 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-700 transition-all"
                            >
                                Cancelar e Voltar
                            </button>
                        </div>
                    </CsNpsModal3DShell>
                </div>
            )}

            <ModalSelecionarUsuario
                open={campoModalUsuario !== null}
                onClose={() => setCampoModalUsuario(null)}
                titulo={campoModalUsuario?.campo === "closerNome" ? "Selecionar Closer" : "Selecionar Analista"}
                onSelecionar={(nome) => {
                    if (campoModalUsuario) {
                        atualizarFormCard(campoModalUsuario.registroId, { [campoModalUsuario.campo]: nome });
                    }
                }}
            />
        </div>
    );
}
