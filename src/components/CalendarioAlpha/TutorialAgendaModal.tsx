"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Bell,
  CalendarPlus,
  CalendarRange,
  CircleHelp,
  Palette,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { Dialog, DialogPortal } from "@/components/ui/dialog";

interface SecaoTutorial {
  icone: typeof CircleHelp;
  titulo: string;
  descricao: string;
  itens: string[];
}

const SECOES: SecaoTutorial[] = [
  {
    icone: CalendarRange,
    titulo: "Visão geral",
    descricao: "A Agenda Alpha mostra seus compromissos do Google Calendar direto no painel. A barra lateral traz o mini calendário e as agendas visíveis; a área principal mostra a grade da visão escolhida.",
    itens: [
      "Troque entre as visões Dia, Semana, Mês e Ano no grupo de botões no topo da grade.",
      "Use Hoje / seta anterior / seta próximo para navegar no tempo, ou clique num dia no mini calendário da lateral.",
      "Atalhos de teclado: C cria um evento, T volta para hoje, D/W/M trocam para as visões Dia/Semana/Mês (funcionam com o foco fora de qualquer campo de texto).",
    ],
  },
  {
    icone: CalendarPlus,
    titulo: "Criar e editar eventos",
    descricao: "Clique em Criar (topo ou lateral), num horário vazio da grade, ou no + que aparece ao passar o mouse num dia da Visão Mês.",
    itens: [
      "Campos disponíveis: agenda, título, dia inteiro, início/fim, localização, descrição, participantes (e-mails separados por vírgula) e criação de Google Meet.",
      "Clique num evento existente para abrir o detalhe — de lá dá para Editar ou Cancelar (agendas somente leitura não mostram essas opções).",
    ],
  },
  {
    icone: RefreshCw,
    titulo: "Conectar e sincronizar",
    descricao: "A Agenda Alpha lê e escreve na sua conta Google real. O status de sincronização fica visível no topo — clique para ver detalhes, forçar uma sincronização manual ou desativar a conexão.",
    itens: [
      "Em Gerenciar agendas, escolha quais calendários do Google aparecem no Painel e defina a cor de cada um.",
    ],
  },
  {
    icone: Palette,
    titulo: "Cor das agendas",
    descricao: "Clique na bolinha de cor de qualquer agenda (sua ou de um colega) para escolher entre 16 cores fixas — evita o seletor de cor do sistema, que era instável.",
    itens: [],
  },
  {
    icone: Users,
    titulo: "Compartilhar com colegas",
    descricao: "Em Gerenciar colegas, peça acesso à agenda de alguém escolhendo o papel: Visualizador (só vê horários ocupados) ou Editor (vê tudo e pode criar/editar eventos na agenda da pessoa).",
    itens: [
      "Ninguém vê a agenda de outra pessoa sem aprovação — nem Admin e CEO têm acesso automático.",
      "Pedidos recebidos aparecem no mesmo painel, com botões para aprovar ou recusar.",
    ],
  },
  {
    icone: ShieldCheck,
    titulo: "Permissões (Admin)",
    descricao: "Administradores e CEO controlam, em Permissões, quem no time pode pedir acesso à agenda de um colega. Isso não dá acesso automático a ninguém — só libera o botão de pedir.",
    itens: [],
  },
  {
    icone: Bell,
    titulo: "Notificações de compromisso",
    descricao: "O sino na barra de abas do Painel (ao lado da previsão do tempo) avisa 10 e 5 minutos antes de um compromisso começar, com som e um card na lista de recentes.",
    itens: [
      "Também avisa quando alguém pede acesso à sua agenda, e quando seu próprio pedido é aceito ou recusado.",
      "O sino fica visível em qualquer módulo do Painel, não só na Agenda.",
    ],
  },
];

interface TutorialAgendaModalProps {
  aberto: boolean;
  onFechar: () => void;
  onIniciarTour: () => void;
  accent: string;
}

export function TutorialAgendaModal({ aberto, onFechar, onIniciarTour, accent }: TutorialAgendaModalProps) {
  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && onFechar()}>
      <DialogPortal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/75 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-[100] grid max-h-[88vh] w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 grid-rows-[auto_1fr_auto] gap-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-2xl outline-none backdrop-blur-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:max-h-[85vh] sm:w-full sm:rounded-3xl"
        >
          <div
            className="flex items-center gap-2 border-b p-3.5 sm:gap-3 sm:p-5"
            style={{ borderColor: `rgba(${accent},0.18)`, background: `linear-gradient(135deg, rgba(${accent},0.14) 0%, rgba(2,6,23,0.4) 100%)` }}
          >
            <div
              className="hidden shrink-0 rounded-2xl border p-2.5 sm:flex"
              style={{ background: `rgba(${accent},0.2)`, borderColor: `rgba(${accent},0.25)` }}
            >
              <CircleHelp className="h-5 w-5" style={{ color: `rgba(${accent},1)` }} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <DialogPrimitive.Title className="truncate text-sm font-black uppercase italic tracking-tight text-white sm:text-lg">
                Como usar a Agenda Alpha
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-0.5 hidden text-xs text-slate-400 sm:block">
                Tudo o que o módulo oferece, incluindo cada botão de ação, explicado em um só lugar.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              onClick={onFechar}
              aria-label="Fechar tutorial"
              className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <X size={18} />
            </DialogPrimitive.Close>
          </div>

          <div className="overflow-y-auto p-3.5 sm:p-5">
            <div className="flex flex-col gap-5">
              {SECOES.map((secao) => {
                const Icone = secao.icone;
                return (
                  <section key={secao.titulo} className="flex gap-3">
                    <div
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border"
                      style={{ background: `rgba(${accent},0.12)`, borderColor: `rgba(${accent},0.2)` }}
                    >
                      <Icone size={15} style={{ color: `rgba(${accent},1)` }} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white">{secao.titulo}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">{secao.descricao}</p>
                      {secao.itens.length > 0 && (
                        <ul className="mt-2 flex flex-col gap-1.5">
                          {secao.itens.map((item) => (
                            <li key={item} className="flex gap-2 text-xs leading-relaxed text-slate-500">
                              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: `rgba(${accent},0.7)` }} />
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>

          <div
            className="flex flex-col items-stretch gap-2.5 border-t p-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-4"
            style={{ borderColor: `rgba(${accent},0.18)` }}
          >
            <p className="hidden text-[11px] leading-relaxed text-slate-500 sm:block">
              Prefere ver na prática? O tour guiado destaca cada botão diretamente na tela.
            </p>
            <button
              type="button"
              onClick={onIniciarTour}
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-black text-black transition-[filter] hover:brightness-110 sm:justify-start sm:py-2"
              style={{ background: `rgb(${accent})` }}
            >
              <PlayCircle size={14} /> Iniciar tour guiado
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
