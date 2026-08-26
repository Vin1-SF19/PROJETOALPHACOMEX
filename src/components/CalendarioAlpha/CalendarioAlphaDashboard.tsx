"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";

import type { StatusConexaoCalendarioAlpha } from "@/actions/google-calendar-conexao";
import { GuiaModuloTour } from "@/components/Guias/GuiaModuloTour";
import { marcarTutorialModuloComoVisto, tutorialModuloFoiVisto } from "@/lib/guias/tutorial-modulo";
import { getTema } from "@/lib/temas";

import { AgendaOverlays } from "./AgendaOverlays";
import { AgendaSidebar } from "./AgendaSidebar";
import { ConteudoAgenda } from "./ConteudoAgenda";
import { EstadoDesconectado } from "./EstadoDesconectado";
import { HeaderCalendario } from "./HeaderCalendario";
import { StatusSincronizacao } from "./StatusSincronizacao";
import { TutorialAgendaModal } from "./TutorialAgendaModal";
import { dataAnterior, proximaData, type VisaoCalendario } from "./lib/datas";
import { tarefasParaItensAgenda } from "./lib/itens-agenda";
import type { CalendarioSelecionadoView, EventoExibicao, ListaTarefasAgendaView, TarefaAgendaExibicao } from "./lib/tipos";
import { concluirTarefaAgendaAlpha } from "@/actions/google-calendar-tarefas";
import { toast } from "sonner";
import { TUTORIAL_AGENDA } from "./lib/tutorial-agenda";
import { useAgendaAlphaController } from "./lib/useAgendaAlphaController";

interface CalendarioAlphaDashboardProps {
  temaName: string;
  statusConexao: StatusConexaoCalendarioAlpha;
  conexaoId: string | null;
  calendarios: CalendarioSelecionadoView[];
  eventos: EventoExibicao[];
  tarefas: TarefaAgendaExibicao[];
  listasTarefas: ListaTarefasAgendaView[];
  isAdmin: boolean;
  visao: VisaoCalendario;
  dataReferenciaISO: string;
  algumaFalhaSync: boolean;
}

function alvoDigitavel(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function CalendarioAlphaDashboard({
  temaName,
  statusConexao,
  conexaoId,
  calendarios,
  eventos,
  tarefas,
  listasTarefas,
  isAdmin,
  visao,
  dataReferenciaISO,
  algumaFalhaSync,
}: CalendarioAlphaDashboardProps) {
  const tema = getTema(temaName);
  const accent = tema.accent;
  const agenda = useAgendaAlphaController({
    statusConexao,
    conexaoId,
    visao,
    dataReferenciaISO,
    algumaFalhaSync,
  });

  const { data: session } = useSession();
  const usuarioAtualId = Number((session?.user as { id?: string | number } | undefined)?.id ?? 0);
  const [tutorialAberto, setTutorialAberto] = useState(false);
  const [tourAberto, setTourAberto] = useState(false);
  const tarefasNaGrade = tarefasParaItensAgenda(tarefas);

  async function concluirTarefa(tarefaCacheId: string) {
    const resultado = await concluirTarefaAgendaAlpha({ tarefaCacheId });
    if (!resultado.success) {
      toast.error(resultado.error);
      return;
    }
    toast.success("Tarefa concluída.");
    agenda.atualizarAgenda();
  }

  useEffect(() => {
    if (!usuarioAtualId) return;
    const frame = window.requestAnimationFrame(() => {
      try {
        if (!tutorialModuloFoiVisto(window.localStorage, TUTORIAL_AGENDA, usuarioAtualId)) {
          setTutorialAberto(true);
        }
      } catch {
        setTutorialAberto(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [usuarioAtualId]);

  const finalizarTutorial = useCallback(() => {
    try {
      marcarTutorialModuloComoVisto(window.localStorage, TUTORIAL_AGENDA, usuarioAtualId);
    } catch {
      // O tour continua utilizável quando o navegador bloqueia armazenamento local.
    }
    setTutorialAberto(false);
  }, [usuarioAtualId]);

  const iniciarTourGuiado = useCallback(() => {
    setTutorialAberto(false);
    // Aguarda o modal terminar de fechar antes de medir posições de spotlight — abrir os dois
    // ao mesmo tempo faria o GuiaModuloTour calcular retângulos com o modal ainda ocupando tela.
    window.requestAnimationFrame(() => setTourAberto(true));
  }, []);

  const finalizarTour = useCallback(() => {
    try {
      marcarTutorialModuloComoVisto(window.localStorage, TUTORIAL_AGENDA, usuarioAtualId);
    } catch {
      // O tour continua utilizável quando o navegador bloqueia armazenamento local.
    }
    setTourAberto(false);
  }, [usuarioAtualId]);

  useEffect(() => {
    function atalhos(evento: KeyboardEvent) {
      if (
        evento.defaultPrevented
        || evento.metaKey
        || evento.ctrlKey
        || evento.altKey
        || alvoDigitavel(evento.target)
      ) return;
      const tecla = evento.key.toLowerCase();
      if (!["c", "t", "m", "w", "d"].includes(tecla)) return;
      evento.preventDefault();
      if (tecla === "c") agenda.abrirNovoEvento();
      if (tecla === "t") agenda.navegarPara(visao, new Date());
      if (tecla === "m") agenda.navegarPara("mes", agenda.dataReferencia);
      if (tecla === "w") agenda.navegarPara("semana", agenda.dataReferencia);
      if (tecla === "d") agenda.navegarPara("dia", agenda.dataReferencia);
    }
    window.addEventListener("keydown", atalhos);
    return () => window.removeEventListener("keydown", atalhos);
  }, [agenda, visao]);

  if (!statusConexao.conectado) {
    return (
      <EstadoDesconectado
        tema={tema}
        emailUsuario={statusConexao.emailUsuario}
        onAtivado={agenda.atualizarAgenda}
      />
    );
  }

  const status = (
    <StatusSincronizacao
      tema={tema}
      emailUsuario={statusConexao.emailUsuario}
      ultimaSincronizacaoEm={agenda.ultimaSincronizacaoEm}
      sincronizando={agenda.sincronizando}
      erro={agenda.erroSincronizacao}
      erroCompartilhadas={agenda.compartilhadas.erro}
      resumo={agenda.resumoSincronizacao}
      onSincronizar={agenda.sincronizarAgora}
      onDesativar={() => agenda.setDesativarAberto(true)}
    />
  );

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-[1800px] flex-col px-3 py-3 sm:px-4 xl:px-5">
      <HeaderCalendario
        tema={tema}
        visao={visao}
        dataReferencia={agenda.dataReferencia}
        status={status}
        onMudarVisao={(novaVisao) => agenda.navegarPara(novaVisao, agenda.dataReferencia)}
        onHoje={() => agenda.navegarPara(visao, new Date())}
        onAnterior={() => agenda.navegarPara(
          visao,
          dataAnterior(visao, agenda.dataReferencia),
        )}
        onProximo={() => agenda.navegarPara(
          visao,
          proximaData(visao, agenda.dataReferencia),
        )}
        onNovoEvento={() => agenda.abrirNovoEvento()}
        onAbrirSidebar={() => agenda.setSidebarMobileAberta(true)}
        onAbrirConfiguracoes={agenda.abrirConfiguracoes}
        onAbrirTutorial={() => setTutorialAberto(true)}
      />

      <div className="flex min-h-0 flex-1 gap-3">
        <AgendaSidebar
          tema={tema}
          dataReferencia={agenda.dataReferencia}
          calendarios={calendarios}
          colegas={agenda.compartilhadas.colegas}
          isAdmin={isAdmin}
          mobileOpen={agenda.sidebarMobileAberta}
          onMobileOpenChange={agenda.setSidebarMobileAberta}
          onCriar={() => agenda.abrirNovoEvento()}
          onSelecionarDia={(data) => agenda.navegarPara("dia", data)}
          onGerenciarCalendarios={agenda.abrirConfiguracoes}
          onGerenciarColegas={agenda.abrirColegas}
          onGerenciarPermissoes={agenda.abrirPermissoes}
          onAlternarCalendario={agenda.alternarCalendario}
          onAlternarColega={agenda.alternarColega}
          footer={status}
        />
        <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden" aria-label="Grade da Agenda Alpha">
          {agenda.carregandoEdicao && (
            <div role="status" className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
              <Loader2 className="size-4 animate-spin" /> Carregando detalhes do evento…
            </div>
          )}
          {agenda.erroEdicao && agenda.alvoEdicao && (
            <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
              <span>{agenda.erroEdicao}</span>
              <button type="button" onClick={() => void agenda.editarEvento(agenda.alvoEdicao!)} className="shrink-0 font-bold underline underline-offset-4">
                Tentar novamente
              </button>
            </div>
          )}
          {agenda.compartilhadas.carregando && (
            <div role="status" className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
              <Loader2 className="size-4 animate-spin" /> Atualizando agendas compartilhadas…
            </div>
          )}
          {agenda.compartilhadas.erro && (
            <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              <span>{agenda.compartilhadas.erro}</span>
              <button type="button" onClick={() => void agenda.compartilhadas.carregar()} className="shrink-0 font-bold underline underline-offset-4">
                Tentar novamente
              </button>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-hidden">
            <ConteudoAgenda
              tema={tema}
              visao={visao}
              dataReferencia={agenda.dataReferencia}
              eventos={[...eventos, ...tarefasNaGrade, ...agenda.compartilhadas.eventos]}
              possuiCalendarios={calendarios.length > 0}
              onEditarEvento={agenda.editarEvento}
              onEventoCancelado={agenda.notificarAlteracaoAgenda}
              onSelecionarHorario={agenda.abrirNovoEvento}
              onSelecionarDia={(data) => agenda.navegarPara("dia", data)}
              onSelecionarMes={(data) => agenda.navegarPara("mes", data)}
              onAbrirConfiguracoes={agenda.abrirConfiguracoes}
              onConcluirTarefa={concluirTarefa}
            />
          </div>
        </main>
      </div>

      <AgendaOverlays
        tema={tema}
        conexaoId={conexaoId}
        calendarios={calendarios}
        calendariosGoogle={agenda.calendariosGoogle}
        carregandoCalendarios={agenda.carregandoCalendarios}
        configAberta={agenda.configAberta}
        onConfigAbertaChange={agenda.setConfigAberta}
        colegasAberto={agenda.colegasAberto}
        onColegasAbertoChange={agenda.setColegasAberto}
        isAdmin={isAdmin}
        colegasDisponiveis={agenda.colegasDisponiveis}
        colegas={agenda.compartilhadas.colegas}
        solicitacoesRecebidas={agenda.solicitacoesRecebidas}
        permissoesAberto={agenda.permissoesAberto}
        onPermissoesAbertoChange={agenda.setPermissoesAberto}
        usuariosPermissao={agenda.usuariosPermissao}
        formularioAberto={agenda.formularioAberto}
        onFormularioAbertoChange={agenda.alterarFormularioAberto}
        dataEvento={agenda.dataParaNovoEvento}
        evento={agenda.sessaoEdicao?.evento}
        detalhesEvento={agenda.sessaoEdicao?.detalhes}
        listasTarefas={listasTarefas}
        desativarAberto={agenda.desativarAberto}
        onDesativarAbertoChange={agenda.setDesativarAberto}
        desativando={agenda.desativando}
        onAtualizar={agenda.notificarAlteracaoAgenda}
        onAtualizarColegas={agenda.abrirColegas}
        onAtualizarPermissoes={agenda.abrirPermissoes}
        onConfirmarDesativacao={agenda.confirmarDesativacao}
      />

      <TutorialAgendaModal
        aberto={tutorialAberto}
        onFechar={finalizarTutorial}
        onIniciarTour={iniciarTourGuiado}
        accent={accent}
      />
      <GuiaModuloTour aberto={tourAberto} config={TUTORIAL_AGENDA} accent={accent} onFinalizar={finalizarTour} />
    </div>
  );
}
