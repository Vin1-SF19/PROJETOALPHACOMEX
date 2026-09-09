"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { carregarIntervaloAgendaAlpha } from "@/actions/google-calendar-agenda";
import { carregarDetalhesEventoColegaParaEdicao } from "@/actions/google-calendar-admin";
import {
  alternarVisibilidadeColega,
  listarColegasVisiveis,
  listarPermissoesColegasTodosUsuarios,
  listarUsuariosParaCompartilhar,
  type UsuarioPermissaoColegaDTO,
} from "@/actions/google-calendar-colegas";
import { listarSolicitacoesPendentesRecebidas } from "@/actions/google-calendar-solicitacoes";
import {
  desativarCalendarioAlpha,
  type StatusConexaoCalendarioAlpha,
} from "@/actions/google-calendar-conexao";
import {
  carregarDetalhesEventoParaEdicao,
  definirCalendarioSelecionado,
  listarCalendariosGoogleDisponiveis,
} from "@/actions/google-calendar-eventos";
import {
  sincronizarAgendaAlpha,
  type ResumoSincronizacaoAgenda,
} from "@/actions/google-calendar-sync";
import { sincronizarTarefasAgendaAlpha } from "@/actions/google-calendar-tarefas";
import {
  assinarInvalidacaoCalendarioAlpha,
  notificarCalendarioAlphaAlterado,
} from "@/lib/google-calendar/invalidation";
import type { GoogleCalendarioDTO, GoogleEventoDTO } from "@/lib/google-calendar/types";

import {
  calcularIntervaloVisao,
  formatarDataCivil,
  parsearDataCivil,
  type VisaoCalendario,
} from "./datas";
import {
  chaveSnapshotAgenda,
  lerSnapshotAgenda,
  salvarSnapshotAgenda,
  type SnapshotAgendaLocal,
} from "./cache-local";
import { tarefasParaItensAgenda } from "./itens-agenda";
import type {
  CalendarioSelecionadoView,
  EventoExibicao,
  TarefaAgendaExibicao,
} from "./tipos";
import { useAgendasCompartilhadas } from "./useAgendasCompartilhadas";
import type { SolicitacaoRecebidaView } from "../PainelColegas";

interface UseAgendaAlphaControllerParams {
  statusConexao: StatusConexaoCalendarioAlpha;
  conexaoId: string | null;
  visao: VisaoCalendario;
  dataReferenciaISO: string;
}

const INTERVALO_REVALIDACAO_MS = 60_000;

type ResultadoMutacaoOtimista =
  | { success: true }
  | { success: false; error: string };

export interface MutacaoOtimistaAgenda {
  item: EventoExibicao;
  executar: () => Promise<ResultadoMutacaoOtimista>;
  mensagemSalvando: string;
  mensagemSucesso: string;
}

interface SessaoEdicao {
  evento: EventoExibicao;
  detalhes?: GoogleEventoDTO;
}

function chaveEvento(evento: EventoExibicao): string {
  return [
    evento.colegaId ?? "proprio",
    evento.calendarioGoogleId,
    evento.googleEventId,
  ].join(":");
}

export function useAgendaAlphaController({
  statusConexao,
  conexaoId,
  visao,
  dataReferenciaISO,
}: UseAgendaAlphaControllerParams) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [visaoAtual, setVisaoAtual] = useState(visao);
  const [dataReferenciaAtualISO, setDataReferenciaAtualISO] = useState(
    dataReferenciaISO,
  );
  const [eventos, setEventos] = useState<EventoExibicao[]>([]);
  const [tarefas, setTarefas] = useState<TarefaAgendaExibicao[]>([]);
  const [itensOtimistas, setItensOtimistas] = useState<
    Map<string, EventoExibicao>
  >(() => new Map());
  const [carregandoPeriodo, setCarregandoPeriodo] = useState(
    statusConexao.conectado,
  );
  const [erroPeriodo, setErroPeriodo] = useState<string | null>(null);
  const [snapshotCarregadoEm, setSnapshotCarregadoEm] = useState<string | null>(
    null,
  );
  const [formularioAberto, setFormularioAberto] = useState(false);
  const [sessaoEdicao, setSessaoEdicao] = useState<SessaoEdicao>();
  const [alvoEdicao, setAlvoEdicao] = useState<EventoExibicao>();
  const [carregandoEdicao, setCarregandoEdicao] = useState(false);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);
  const [dataParaNovoEvento, setDataParaNovoEvento] = useState(new Date());
  const [sidebarMobileAberta, setSidebarMobileAberta] = useState(false);
  const [configAberta, setConfigAberta] = useState(false);
  const [calendariosGoogle, setCalendariosGoogle] = useState<GoogleCalendarioDTO[]>([]);
  const [carregandoCalendarios, setCarregandoCalendarios] = useState(false);
  const [colegasAberto, setColegasAberto] = useState(false);
  const [colegasDisponiveis, setColegasDisponiveis] = useState<
    { id: number; nome: string; email: string }[]
  >([]);
  const [solicitacoesRecebidas, setSolicitacoesRecebidas] = useState<SolicitacaoRecebidaView[]>([]);
  const [permissoesAberto, setPermissoesAberto] = useState(false);
  const [usuariosPermissao, setUsuariosPermissao] = useState<UsuarioPermissaoColegaDTO[]>([]);
  const [desativarAberto, setDesativarAberto] = useState(false);
  const [desativando, startDesativando] = useTransition();
  const [sincronizando, setSincronizando] = useState(false);
  const sincronizacaoEmAndamento = useRef(false);
  const [ultimaSincronizacaoEm, setUltimaSincronizacaoEm] = useState(
    statusConexao.ultimaSincronizacaoEm,
  );
  const [erroSincronizacao, setErroSincronizacao] = useState<string | null>(null);
  const [resumoSincronizacao, setResumoSincronizacao] =
    useState<ResumoSincronizacaoAgenda | null>(null);
  const sequenciaEdicao = useRef(0);
  const chaveEdicaoAtual = useRef<string | null>(null);
  const sequenciaPeriodo = useRef(0);
  const inicializouPeriodo = useRef(false);
  const snapshotsMemoria = useRef(new Map<string, SnapshotAgendaLocal>());
  const itensOtimistasConfirmados = useRef(new Set<string>());
  const parametrosAtuais = useRef({
    visao: visaoAtual,
    dataReferenciaISO: dataReferenciaAtualISO,
  });
  const dataReferencia = new Date(dataReferenciaAtualISO);
  const compartilhadas = useAgendasCompartilhadas({
    visao: visaoAtual,
    dataReferenciaISO: dataReferenciaAtualISO,
  });
  const carregarCompartilhadas = compartilhadas.carregar;
  const recarregarCompartilhadasSeAtivo = compartilhadas.recarregarSeAtivo;

  useEffect(() => {
    parametrosAtuais.current = {
      visao: visaoAtual,
      dataReferenciaISO: dataReferenciaAtualISO,
    };
  }, [dataReferenciaAtualISO, visaoAtual]);

  const itens = useMemo(() => {
    const mesclados = new Map(
      [...eventos, ...tarefasParaItensAgenda(tarefas)].map((item) => [
        item.id,
        item,
      ]),
    );
    for (const item of itensOtimistas.values()) mesclados.set(item.id, item);
    return Array.from(mesclados.values());
  }, [eventos, itensOtimistas, tarefas]);

  const aplicarSnapshot = useCallback(
    (snapshot: Pick<SnapshotAgendaLocal, "eventos" | "tarefas" | "carregadoEm">) => {
      setEventos(snapshot.eventos);
      setTarefas(snapshot.tarefas);
      setSnapshotCarregadoEm(snapshot.carregadoEm);
    },
    [],
  );

  const carregarPeriodo = useCallback(async (
    alvoVisao: VisaoCalendario,
    alvoData: Date,
    opcoes: { usarCacheLocal?: boolean; silencioso?: boolean } = {},
  ): Promise<boolean> => {
    if (!conexaoId) return false;

    const sequencia = sequenciaPeriodo.current + 1;
    sequenciaPeriodo.current = sequencia;
    const chave = chaveSnapshotAgenda(conexaoId, alvoVisao, alvoData);
    const { inicio, fim } = calcularIntervaloVisao(alvoVisao, alvoData);
    const usarCacheLocal = opcoes.usarCacheLocal !== false;

    if (!opcoes.silencioso) setCarregandoPeriodo(true);
    setErroPeriodo(null);

    const remoto = carregarIntervaloAgendaAlpha({
      inicioISO: inicio.toISOString(),
      fimISO: fim.toISOString(),
    });

    if (usarCacheLocal) {
      const snapshotLocal =
        snapshotsMemoria.current.get(chave) ?? await lerSnapshotAgenda(chave);
      if (snapshotLocal && sequenciaPeriodo.current === sequencia) {
        snapshotsMemoria.current.set(chave, snapshotLocal);
        aplicarSnapshot(snapshotLocal);
      }
    }

    let resultado: Awaited<ReturnType<typeof carregarIntervaloAgendaAlpha>>;
    try {
      resultado = await remoto;
    } catch {
      if (sequenciaPeriodo.current === sequencia) {
        setErroPeriodo("Não foi possível atualizar a agenda agora.");
        setCarregandoPeriodo(false);
      }
      return false;
    }
    if (!resultado.success) {
      if (sequenciaPeriodo.current === sequencia) {
        setErroPeriodo(resultado.error);
        setCarregandoPeriodo(false);
      }
      return false;
    }

    const snapshot: SnapshotAgendaLocal = {
      ...resultado.data,
      chave,
      conexaoId,
      salvoEm: Date.now(),
    };
    snapshotsMemoria.current.set(chave, snapshot);
    void salvarSnapshotAgenda(snapshot);

    if (sequenciaPeriodo.current === sequencia) {
      aplicarSnapshot(snapshot);
      if (itensOtimistasConfirmados.current.size > 0) {
        const confirmados = new Set(itensOtimistasConfirmados.current);
        itensOtimistasConfirmados.current.clear();
        setItensOtimistas((atuais) => {
          const proximos = new Map(atuais);
          for (const id of confirmados) proximos.delete(id);
          return proximos;
        });
      }
      setCarregandoPeriodo(false);
    }
    return true;
  }, [aplicarSnapshot, conexaoId]);

  const recarregarPeriodoAtual = useCallback((silencioso = false) => {
    const parametros = parametrosAtuais.current;
    return carregarPeriodo(
      parametros.visao,
      new Date(parametros.dataReferenciaISO),
      { usarCacheLocal: false, silencioso },
    );
  }, [carregarPeriodo]);

  const atualizarAgenda = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  const notificarAlteracaoAgenda = useCallback(() => {
    notificarCalendarioAlphaAlterado();
  }, []);

  const navegarPara = useCallback((novaVisao: VisaoCalendario, novaData: Date) => {
    const novaDataISO = novaData.toISOString();
    parametrosAtuais.current = {
      visao: novaVisao,
      dataReferenciaISO: novaDataISO,
    };
    setVisaoAtual(novaVisao);
    setDataReferenciaAtualISO(novaDataISO);
    const params = new URLSearchParams({
      visao: novaVisao,
      data: formatarDataCivil(novaData),
    });
    window.history.pushState(
      null,
      "",
      `/PainelAlpha/CalendarioAlpha?${params.toString()}`,
    );
    void carregarPeriodo(novaVisao, novaData);
  }, [carregarPeriodo]);

  useEffect(() => {
    if (!statusConexao.conectado || inicializouPeriodo.current) return;
    inicializouPeriodo.current = true;
    void carregarPeriodo(visao, new Date(dataReferenciaISO));
  }, [carregarPeriodo, dataReferenciaISO, statusConexao.conectado, visao]);

  useEffect(() => {
    if (statusConexao.conectado) void carregarCompartilhadas();
  }, [carregarCompartilhadas, statusConexao.conectado]);

  useEffect(() => {
    function aoVoltarOuAvancar() {
      const params = new URLSearchParams(window.location.search);
      const visaoUrl = params.get("visao");
      const dataUrl = parsearDataCivil(params.get("data"));
      const proximaVisao: VisaoCalendario =
        visaoUrl === "dia" || visaoUrl === "semana" || visaoUrl === "mes" || visaoUrl === "ano"
          ? visaoUrl
          : "semana";
      const proximaData = dataUrl ?? new Date();
      parametrosAtuais.current = {
        visao: proximaVisao,
        dataReferenciaISO: proximaData.toISOString(),
      };
      setVisaoAtual(proximaVisao);
      setDataReferenciaAtualISO(proximaData.toISOString());
      void carregarPeriodo(proximaVisao, proximaData);
    }

    window.addEventListener("popstate", aoVoltarOuAvancar);
    return () => window.removeEventListener("popstate", aoVoltarOuAvancar);
  }, [carregarPeriodo]);

  useEffect(() => assinarInvalidacaoCalendarioAlpha(() => {
    void recarregarCompartilhadasSeAtivo();
    void recarregarPeriodoAtual(true);
  }), [recarregarCompartilhadasSeAtivo, recarregarPeriodoAtual]);

  useEffect(() => {
    function aoRetomar() {
      if (document.visibilityState === "visible") {
        void recarregarPeriodoAtual(true);
      }
    }
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void recarregarPeriodoAtual(true);
      }
    }, INTERVALO_REVALIDACAO_MS);
    window.addEventListener("focus", aoRetomar);
    document.addEventListener("visibilitychange", aoRetomar);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", aoRetomar);
      document.removeEventListener("visibilitychange", aoRetomar);
    };
  }, [recarregarPeriodoAtual]);

  async function abrirConfiguracoes() {
    setSidebarMobileAberta(false);
    setCarregandoCalendarios(true);
    setConfigAberta(true);
    const resultado = await listarCalendariosGoogleDisponiveis();
    if (resultado.success) setCalendariosGoogle(resultado.data);
    else toast.error(resultado.error);
    setCarregandoCalendarios(false);
  }

  async function abrirColegas() {
    setSidebarMobileAberta(false);
    setColegasAberto(true);
    const [disponiveis, visiveis, pendentes] = await Promise.all([
      listarUsuariosParaCompartilhar(),
      listarColegasVisiveis(),
      listarSolicitacoesPendentesRecebidas(),
    ]);
    if (disponiveis.success) setColegasDisponiveis(disponiveis.data);
    else toast.error(disponiveis.error);
    if (visiveis.success) compartilhadas.substituirColegas(visiveis.data);
    if (pendentes.success) setSolicitacoesRecebidas(pendentes.data);
    void compartilhadas.carregar();
  }

  async function abrirPermissoes() {
    setSidebarMobileAberta(false);
    setPermissoesAberto(true);
    const resultado = await listarPermissoesColegasTodosUsuarios();
    if (resultado.success) setUsuariosPermissao(resultado.data);
    else toast.error(resultado.error);
  }

  function invalidarEdicaoPendente() {
    sequenciaEdicao.current += 1;
    chaveEdicaoAtual.current = null;
    setCarregandoEdicao(false);
  }

  function abrirNovoEvento(data = dataReferencia) {
    invalidarEdicaoPendente();
    setAlvoEdicao(undefined);
    setSessaoEdicao(undefined);
    setErroEdicao(null);
    setDataParaNovoEvento(data);
    setFormularioAberto(true);
  }

  function solicitacaoEdicaoAindaAtiva(sequencia: number, chave: string): boolean {
    return sequenciaEdicao.current === sequencia && chaveEdicaoAtual.current === chave;
  }

  async function editarEvento(evento: EventoExibicao) {
    if (evento.sincronizacaoPendente) {
      toast.info("Este item ainda está sendo salvo no Google.");
      return;
    }
    if (evento.tipo === "tarefa") {
      if (!evento.calendarioGravavel) {
        toast.info(
          "Esta tarefa acompanha um chamado aberto por você e é somente leitura.",
        );
        return;
      }
      invalidarEdicaoPendente();
      setAlvoEdicao(evento);
      setSessaoEdicao({ evento, detalhes: undefined });
      setErroEdicao(null);
      setDataParaNovoEvento(evento.inicioEm ? new Date(evento.inicioEm) : dataReferencia);
      setFormularioAberto(true);
      return;
    }
    const sequencia = sequenciaEdicao.current + 1;
    const chave = chaveEvento(evento);
    sequenciaEdicao.current = sequencia;
    chaveEdicaoAtual.current = chave;
    setAlvoEdicao(evento);
    setSessaoEdicao(undefined);
    setFormularioAberto(false);
    setErroEdicao(null);
    setCarregandoEdicao(true);

    try {
      const resultado = evento.colegaId
        ? await carregarDetalhesEventoColegaParaEdicao(evento.colegaId, {
            calendarId: evento.calendarioGoogleId,
            googleEventId: evento.googleEventId,
          })
        : await carregarDetalhesEventoParaEdicao({
            calendarioId: evento.calendarioId,
            googleEventId: evento.googleEventId,
          });

      if (!solicitacaoEdicaoAindaAtiva(sequencia, chave)) return;
      if (!resultado.success) {
        setErroEdicao(resultado.error);
        return;
      }

      setDataParaNovoEvento(evento.inicioEm ? new Date(evento.inicioEm) : dataReferencia);
      setSessaoEdicao({ evento, detalhes: resultado.data });
      setFormularioAberto(true);
    } catch {
      if (solicitacaoEdicaoAindaAtiva(sequencia, chave)) {
        setErroEdicao("Não foi possível carregar os detalhes do evento.");
      }
    } finally {
      if (solicitacaoEdicaoAindaAtiva(sequencia, chave)) setCarregandoEdicao(false);
    }
  }

  function alterarFormularioAberto(aberto: boolean) {
    if (!aberto) invalidarEdicaoPendente();
    setFormularioAberto(aberto);
  }

  async function sincronizarAgora() {
    if (sincronizacaoEmAndamento.current) return;
    sincronizacaoEmAndamento.current = true;
    setSincronizando(true);
    try {
      const [resultado, resultadoTarefas] = await Promise.all([
        sincronizarAgendaAlpha(),
        sincronizarTarefasAgendaAlpha(),
      ]);
      await compartilhadas.carregar();
      if (!resultado.success) {
        setErroSincronizacao(resultado.error);
        toast.error(resultado.error);
        return;
      }
      if (!resultadoTarefas.success) {
        setErroSincronizacao(resultadoTarefas.error);
      }
      setResumoSincronizacao(resultado.data);
      setUltimaSincronizacaoEm(resultado.data.ultimaSincronizacaoEm);
      const primeiroErro = resultado.data.erros[0]?.mensagem;
      setErroSincronizacao(primeiroErro ?? null);
      if (primeiroErro) toast.error("A sincronização terminou com pendências.");
      else toast.success("Agenda sincronizada.");
      await recarregarPeriodoAtual(true);
      notificarAlteracaoAgenda();
    } finally {
      sincronizacaoEmAndamento.current = false;
      setSincronizando(false);
    }
  }

  async function alternarCalendario(calendario: CalendarioSelecionadoView) {
    if (!conexaoId) return;
    const resultado = await definirCalendarioSelecionado({
      conexaoId,
      googleCalendarId: calendario.googleCalendarId,
      visivel: !calendario.visivel,
      gravavel: calendario.gravavel,
    });
    if (!resultado.success) toast.error(resultado.error);
    else {
      atualizarAgenda();
      void recarregarPeriodoAtual(true);
    }
  }

  async function alternarColega(colegaId: number, visivel: boolean) {
    const resultado = await alternarVisibilidadeColega(colegaId, visivel);
    if (!resultado.success) toast.error(resultado.error);
    else {
      compartilhadas.atualizarVisibilidade(colegaId, visivel);
      atualizarAgenda();
    }
  }

  function confirmarDesativacao() {
    startDesativando(async () => {
      const resultado = await desativarCalendarioAlpha();
      if (!resultado.success) {
        toast.error(resultado.error ?? "Não foi possível desativar agora.");
        return;
      }
      toast.success("Agenda Alpha desativada.");
      setDesativarAberto(false);
      router.refresh();
    });
  }

  function executarMutacaoOtimista(mutacao: MutacaoOtimistaAgenda) {
    setItensOtimistas((atuais) => {
      const proximos = new Map(atuais);
      proximos.set(mutacao.item.id, mutacao.item);
      return proximos;
    });
    const toastId = toast.loading(mutacao.mensagemSalvando);

    void (async () => {
      try {
        const resultado = await mutacao.executar();
        if (!resultado.success) {
          setItensOtimistas((atuais) => {
            const proximos = new Map(atuais);
            proximos.delete(mutacao.item.id);
            return proximos;
          });
          toast.error(resultado.error, { id: toastId });
          return;
        }

        itensOtimistasConfirmados.current.add(mutacao.item.id);
        await recarregarPeriodoAtual(true);
        toast.success(mutacao.mensagemSucesso, { id: toastId });
        notificarAlteracaoAgenda();
      } catch {
        setItensOtimistas((atuais) => {
          const proximos = new Map(atuais);
          proximos.delete(mutacao.item.id);
          return proximos;
        });
        toast.error("Não foi possível concluir a alteração. Tente novamente.", {
          id: toastId,
        });
      }
    })();
  }

  return {
    dataReferencia,
    visaoAtual,
    itens,
    carregandoPeriodo,
    erroPeriodo,
    snapshotCarregadoEm,
    formularioAberto,
    alterarFormularioAberto,
    sessaoEdicao,
    alvoEdicao,
    carregandoEdicao,
    erroEdicao,
    dataParaNovoEvento,
    sidebarMobileAberta,
    setSidebarMobileAberta,
    configAberta,
    setConfigAberta,
    calendariosGoogle,
    carregandoCalendarios,
    colegasAberto,
    setColegasAberto,
    colegasDisponiveis,
    solicitacoesRecebidas,
    permissoesAberto,
    setPermissoesAberto,
    usuariosPermissao,
    desativarAberto,
    setDesativarAberto,
    desativando,
    sincronizando,
    ultimaSincronizacaoEm,
    erroSincronizacao,
    resumoSincronizacao,
    compartilhadas,
    atualizarAgenda,
    notificarAlteracaoAgenda,
    navegarPara,
    recarregarPeriodoAtual,
    executarMutacaoOtimista,
    abrirConfiguracoes,
    abrirColegas,
    abrirPermissoes,
    abrirNovoEvento,
    editarEvento,
    sincronizarAgora,
    alternarCalendario,
    alternarColega,
    confirmarDesativacao,
  };
}
