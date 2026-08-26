"use client";

import { Loader2 } from "lucide-react";

import type { UsuarioPermissaoColegaDTO } from "@/actions/google-calendar-colegas";
import { Button } from "@/components/ui/button";
import type { GoogleCalendarioDTO, GoogleEventoDTO } from "@/lib/google-calendar/types";
import type { TemaAlpha } from "@/lib/temas";

import { AgendaModal3D } from "./AgendaModal3D";
import { FormularioEvento } from "./FormularioEvento";
import type { CalendarioSelecionadoView, ColegaAgendaView, EventoExibicao, ListaTarefasAgendaView } from "./lib/tipos";
import { PainelColegas, type SolicitacaoRecebidaView } from "./PainelColegas";
import { PainelPermissoesColegas } from "./PainelPermissoesColegas";
import { SeletorCalendarios } from "./SeletorCalendarios";

interface AgendaOverlaysProps {
  tema: TemaAlpha;
  conexaoId: string | null;
  calendarios: CalendarioSelecionadoView[];
  calendariosGoogle: GoogleCalendarioDTO[];
  carregandoCalendarios: boolean;
  configAberta: boolean;
  onConfigAbertaChange: (open: boolean) => void;
  colegasAberto: boolean;
  onColegasAbertoChange: (open: boolean) => void;
  isAdmin: boolean;
  colegasDisponiveis: { id: number; nome: string; email: string }[];
  colegas: ColegaAgendaView[];
  solicitacoesRecebidas: SolicitacaoRecebidaView[];
  permissoesAberto: boolean;
  onPermissoesAbertoChange: (open: boolean) => void;
  usuariosPermissao: UsuarioPermissaoColegaDTO[];
  formularioAberto: boolean;
  onFormularioAbertoChange: (open: boolean) => void;
  dataEvento: Date;
  evento?: EventoExibicao;
  detalhesEvento?: GoogleEventoDTO;
  listasTarefas: ListaTarefasAgendaView[];
  desativarAberto: boolean;
  onDesativarAbertoChange: (open: boolean) => void;
  desativando: boolean;
  onAtualizar: () => void;
  onAtualizarColegas: () => void;
  onAtualizarPermissoes: () => void;
  onConfirmarDesativacao: () => void;
}

export function AgendaOverlays(props: AgendaOverlaysProps) {
  return (
    <>
      {props.conexaoId && (
        <SeletorCalendarios
          open={props.configAberta}
          onOpenChange={props.onConfigAbertaChange}
          tema={props.tema}
          conexaoId={props.conexaoId}
          calendariosGoogle={props.calendariosGoogle}
          calendariosSelecionados={props.calendarios}
          onAtualizado={props.onAtualizar}
        />
      )}
      {props.carregandoCalendarios && props.configAberta && props.calendariosGoogle.length === 0 && (
        <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-300">
          <Loader2 className="size-3.5 animate-spin" /> Carregando agendas…
        </div>
      )}
      <PainelColegas
        open={props.colegasAberto}
        onOpenChange={props.onColegasAbertoChange}
        tema={props.tema}
        isAdmin={props.isAdmin}
        disponiveis={props.colegasDisponiveis}
        visiveis={props.colegas}
        solicitacoesRecebidas={props.solicitacoesRecebidas}
        onAtualizado={props.onAtualizarColegas}
      />
      {props.isAdmin && (
        <PainelPermissoesColegas
          open={props.permissoesAberto}
          onOpenChange={props.onPermissoesAbertoChange}
          tema={props.tema}
          usuarios={props.usuariosPermissao}
          onAtualizado={props.onAtualizarPermissoes}
        />
      )}
      {props.formularioAberto && (
        <FormularioEvento
          open
          onOpenChange={props.onFormularioAbertoChange}
          tema={props.tema}
          calendarios={props.calendarios}
          dataInicial={props.dataEvento}
          eventoParaEditar={props.evento}
          detalhesEvento={props.detalhesEvento}
          listasTarefas={props.listasTarefas}
          onSalvo={props.onAtualizar}
        />
      )}
      <AgendaModal3D
        open={props.desativarAberto}
        onOpenChange={props.onDesativarAbertoChange}
        tema={props.tema}
        title="Desativar Agenda Alpha?"
        description="A agenda deixa de aparecer no Painel sem remover a autorização corporativa do Google Workspace."
        size="sm"
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => props.onDesativarAbertoChange(false)} disabled={props.desativando}>Voltar</Button>
            <Button type="button" variant="destructive" onClick={props.onConfirmarDesativacao} disabled={props.desativando}>
              {props.desativando && <Loader2 className="mr-2 size-4 animate-spin" />} Sim, desativar
            </Button>
          </div>
        )}
      >
        <p className="text-sm leading-relaxed text-slate-300">
          Você poderá reativar o módulo depois. Seus eventos permanecem no Google Calendar.
        </p>
      </AgendaModal3D>
    </>
  );
}
