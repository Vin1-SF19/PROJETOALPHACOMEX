"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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

import { formatarDataCivil, type VisaoCalendario } from "./datas";
import type { CalendarioSelecionadoView, EventoExibicao } from "./tipos";
import { useAgendasCompartilhadas } from "./useAgendasCompartilhadas";
import type { SolicitacaoRecebidaView } from "../PainelColegas";

interface UseAgendaAlphaControllerParams {
  statusConexao: StatusConexaoCalendarioAlpha;
  conexaoId: string | null;
  visao: VisaoCalendario;
  dataReferenciaISO: string;
  algumaFalhaSync: boolean;
}

interface SessaoEdicao {
  evento: EventoExibicao;
  detalhes: GoogleEventoDTO;
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
  algumaFalhaSync,
}: UseAgendaAlphaControllerParams) {
  const router = useRouter();
  const [, startTransition] = useTransition();
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
  const [erroSincronizacao, setErroSincronizacao] = useState<string | null>(
    algumaFalhaSync ? "Algumas agendas não puderam ser lidas do cache." : null,
  );
  const [resumoSincronizacao, setResumoSincronizacao] =
    useState<ResumoSincronizacaoAgenda | null>(null);
  const sequenciaEdicao = useRef(0);
  const chaveEdicaoAtual = useRef<string | null>(null);
  const dataReferencia = new Date(dataReferenciaISO);
  const compartilhadas = useAgendasCompartilhadas({ visao, dataReferenciaISO });
  const recarregarCompartilhadasSeAtivo = compartilhadas.recarregarSeAtivo;

  const atualizarAgenda = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  const notificarAlteracaoAgenda = useCallback(() => {
    notificarCalendarioAlphaAlterado();
  }, []);

  const navegarPara = useCallback((novaVisao: VisaoCalendario, novaData: Date) => {
    const params = new URLSearchParams({
      visao: novaVisao,
      data: formatarDataCivil(novaData),
    });
    startTransition(() => {
      router.push(`/PainelAlpha/CalendarioAlpha?${params.toString()}`);
    });
  }, [router]);

  useEffect(() => assinarInvalidacaoCalendarioAlpha(() => {
    void recarregarCompartilhadasSeAtivo();
    startTransition(() => router.refresh());
  }), [recarregarCompartilhadasSeAtivo, router]);

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
      const resultado = await sincronizarAgendaAlpha();
      const resultadoTarefas = await sincronizarTarefasAgendaAlpha();
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
    else atualizarAgenda();
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

  return {
    dataReferencia,
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
