"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listarColegasVisiveis,
  listarPermissoesColegasTodosUsuarios,
  listarUsuariosParaCompartilhar,
  type UsuarioPermissaoColegaDTO,
} from "@/actions/google-calendar-colegas";
import { desativarCalendarioAlpha, type StatusConexaoCalendarioAlpha } from "@/actions/google-calendar-conexao";
import { listarCalendariosGoogleDisponiveis } from "@/actions/google-calendar-eventos";
import type { GoogleCalendarioDTO } from "@/lib/google-calendar/types";
import { getTema } from "@/lib/temas";

import { EstadoDesconectado } from "./EstadoDesconectado";
import { FormularioEvento } from "./FormularioEvento";
import { HeaderCalendario } from "./HeaderCalendario";
import { PainelColegas } from "./PainelColegas";
import { PainelPermissoesColegas } from "./PainelPermissoesColegas";
import { SeletorCalendarios } from "./SeletorCalendarios";
import { VisaoAno } from "./VisaoAno";
import { VisaoDia } from "./VisaoDia";
import { VisaoMes } from "./VisaoMes";
import { VisaoSemana } from "./VisaoSemana";
import { dataAnterior, proximaData, type VisaoCalendario } from "./lib/datas";
import type { CalendarioSelecionadoView, EventoExibicao } from "./lib/tipos";

export function CalendarioAlphaDashboard({
  temaName,
  statusConexao,
  conexaoId,
  calendarios,
  eventos,
  isAdmin,
  visao,
  dataReferenciaISO,
  algumaFalhaSync,
}: {
  temaName: string;
  statusConexao: StatusConexaoCalendarioAlpha;
  conexaoId: string | null;
  calendarios: CalendarioSelecionadoView[];
  eventos: EventoExibicao[];
  isAdmin: boolean;
  visao: VisaoCalendario;
  dataReferenciaISO: string;
  algumaFalhaSync: boolean;
}) {
  const tema = getTema(temaName);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [formularioAberto, setFormularioAberto] = useState(false);
  const [eventoParaEditar, setEventoParaEditar] = useState<EventoExibicao | undefined>(undefined);
  const [dataParaNovoEvento, setDataParaNovoEvento] = useState<Date>(new Date());
  const [configAberta, setConfigAberta] = useState(false);
  const [calendariosGoogle, setCalendariosGoogle] = useState<GoogleCalendarioDTO[]>([]);
  const [carregandoCalendarios, setCarregandoCalendarios] = useState(false);
  const [desativarAberto, setDesativarAberto] = useState(false);
  const [desativando, startDesativando] = useTransition();

  const [colegasAberto, setColegasAberto] = useState(false);
  const [colegasDisponiveis, setColegasDisponiveis] = useState<{ id: number; nome: string; email: string }[]>([]);
  const [colegasVisiveis, setColegasVisiveis] = useState<
    { colegaId: number; cor: string; visivel: boolean; colega: { id: number; nome: string; email: string } }[]
  >([]);

  const [permissoesAberto, setPermissoesAberto] = useState(false);
  const [usuariosPermissao, setUsuariosPermissao] = useState<UsuarioPermissaoColegaDTO[]>([]);

  const dataReferencia = new Date(dataReferenciaISO);

  if (!statusConexao.conectado) {
    return <EstadoDesconectado tema={tema} emailUsuario={statusConexao.emailUsuario} onAtivado={() => router.refresh()} />;
  }

  function navegarPara(novaVisao: VisaoCalendario, novaData: Date) {
    const params = new URLSearchParams();
    params.set("visao", novaVisao);
    params.set("data", novaData.toISOString().slice(0, 10));
    startTransition(() => {
      router.push(`/PainelAlpha/CalendarioAlpha?${params.toString()}`);
    });
  }

  async function abrirConfiguracoes() {
    setCarregandoCalendarios(true);
    setConfigAberta(true);
    const resultado = await listarCalendariosGoogleDisponiveis();
    if (resultado.success) {
      setCalendariosGoogle(resultado.data);
    } else {
      toast.error(resultado.error);
    }
    setCarregandoCalendarios(false);
  }

  async function abrirColegas() {
    setColegasAberto(true);
    const [disponiveisResultado, visiveisResultado] = await Promise.all([
      listarUsuariosParaCompartilhar(),
      listarColegasVisiveis(),
    ]);
    if (disponiveisResultado.success) {
      setColegasDisponiveis(disponiveisResultado.data);
    } else {
      setColegasDisponiveis([]);
      toast.error(disponiveisResultado.error);
    }
    if (visiveisResultado.success) setColegasVisiveis(visiveisResultado.data);
  }

  async function abrirPermissoes() {
    setPermissoesAberto(true);
    const resultado = await listarPermissoesColegasTodosUsuarios();
    if (resultado.success) setUsuariosPermissao(resultado.data);
    else toast.error(resultado.error);
  }

  function abrirNovoEvento(data?: Date) {
    setEventoParaEditar(undefined);
    setDataParaNovoEvento(data ?? dataReferencia);
    setFormularioAberto(true);
  }

  function editarEvento(evento: EventoExibicao) {
    setEventoParaEditar(evento);
    setDataParaNovoEvento(evento.inicioEm ? new Date(evento.inicioEm) : dataReferencia);
    setFormularioAberto(true);
  }

  function irParaVisaoMes(data: Date) {
    navegarPara("mes", data);
  }

  function irParaVisaoDia(data: Date) {
    navegarPara("dia", data);
  }

  function confirmarDesativacao() {
    startDesativando(async () => {
      const resultado = await desativarCalendarioAlpha();
      if (!resultado.success) {
        toast.error(resultado.error ?? "Não foi possível desativar agora.");
        return;
      }
      toast.success("Calendário Alpha desativado.");
      setDesativarAberto(false);
      router.refresh();
    });
  }

  const calendariosGravaveis = calendarios.some((c) => c.gravavel);

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-[1600px] mx-auto">
      <HeaderCalendario
        tema={tema}
        visao={visao}
        dataReferencia={dataReferencia}
        emailUsuario={statusConexao.emailUsuario}
        sincronizando={isPending}
        isAdmin={isAdmin}
        onMudarVisao={(novaVisao) => navegarPara(novaVisao, dataReferencia)}
        onHoje={() => navegarPara(visao, new Date())}
        onAnterior={() => navegarPara(visao, dataAnterior(visao, dataReferencia))}
        onProximo={() => navegarPara(visao, proximaData(visao, dataReferencia))}
        onNovoEvento={() => abrirNovoEvento()}
        onAbrirConfiguracoes={abrirConfiguracoes}
        onAbrirColegas={abrirColegas}
        onAbrirPermissoes={abrirPermissoes}
        onDesativar={() => setDesativarAberto(true)}
      />

      {algumaFalhaSync && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-300">
          Alguns calendários não puderam ser sincronizados agora. Os dados exibidos podem estar desatualizados.
        </div>
      )}

      {calendarios.length === 0 ? (
        <div className="rounded-[2rem] border border-white/5 bg-white/[0.02] py-16 text-center">
          <p className="text-sm text-slate-400 mb-4">Nenhum calendário selecionado ainda.</p>
          <button
            type="button"
            onClick={abrirConfiguracoes}
            className="text-sm font-bold underline underline-offset-4 text-slate-200 hover:text-white"
          >
            Escolher calendários do Google
          </button>
        </div>
      ) : visao === "dia" ? (
        <VisaoDia
          dataReferencia={dataReferencia}
          eventos={eventos}
          tema={tema}
          onEditarEvento={editarEvento}
          onEventoCancelado={() => router.refresh()}
          onSelecionarHorario={(horario) => abrirNovoEvento(horario)}
        />
      ) : visao === "semana" ? (
        <VisaoSemana
          dataReferencia={dataReferencia}
          eventos={eventos}
          tema={tema}
          onEditarEvento={editarEvento}
          onEventoCancelado={() => router.refresh()}
          onSelecionarHorario={(horario) => abrirNovoEvento(horario)}
        />
      ) : visao === "mes" ? (
        <VisaoMes
          dataReferencia={dataReferencia}
          eventos={eventos}
          tema={tema}
          onEditarEvento={editarEvento}
          onEventoCancelado={() => router.refresh()}
          onSelecionarDia={(dia) => irParaVisaoDia(dia)}
          onNovoEventoNoDia={(dia) => abrirNovoEvento(dia)}
        />
      ) : (
        <VisaoAno
          dataReferencia={dataReferencia}
          eventos={eventos}
          tema={tema}
          onSelecionarMes={irParaVisaoMes}
          onSelecionarDia={irParaVisaoDia}
        />
      )}

      {conexaoId && (
        <SeletorCalendarios
          open={configAberta}
          onOpenChange={setConfigAberta}
          tema={tema}
          conexaoId={conexaoId}
          calendariosGoogle={calendariosGoogle}
          calendariosSelecionados={calendarios}
          onAtualizado={() => router.refresh()}
        />
      )}
      {carregandoCalendarios && configAberta && calendariosGoogle.length === 0 && (
        <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-2 rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-xs text-slate-300">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando calendários...
        </div>
      )}

      <PainelColegas
        open={colegasAberto}
        onOpenChange={setColegasAberto}
        tema={tema}
        isAdmin={isAdmin}
        disponiveis={colegasDisponiveis}
        visiveis={colegasVisiveis}
        onAtualizado={() => {
          router.refresh();
          abrirColegas();
        }}
      />

      {isAdmin && (
        <PainelPermissoesColegas
          open={permissoesAberto}
          onOpenChange={setPermissoesAberto}
          usuarios={usuariosPermissao}
          onAtualizado={abrirPermissoes}
        />
      )}

      <FormularioEvento
        open={formularioAberto}
        onOpenChange={setFormularioAberto}
        tema={tema}
        calendarios={calendarios}
        dataInicial={dataParaNovoEvento}
        eventoParaEditar={eventoParaEditar}
        onSalvo={() => router.refresh()}
      />

      <AlertDialog open={desativarAberto} onOpenChange={setDesativarAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar Calendário Alpha?</AlertDialogTitle>
            <AlertDialogDescription>
              O módulo para de exibir sua agenda aqui no Painel. Isso não remove o acesso autorizado pela
              empresa no Google Workspace — só quem tem acesso ao Admin Console pode revogar isso. Você pode
              reativar quando quiser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desativando}>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarDesativacao} disabled={desativando}>
              {desativando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Sim, desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!calendariosGravaveis && calendarios.length > 0 && (
        <p className="mt-4 text-center text-[11px] text-slate-500">
          Todos os calendários selecionados são somente leitura — criar eventos está desabilitado.
        </p>
      )}
    </div>
  );
}
