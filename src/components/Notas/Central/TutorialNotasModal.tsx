"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Archive,
  Bell,
  CircleHelp,
  History,
  LayoutGrid,
  ListFilter,
  MessageSquare,
  Paperclip,
  Pin,
  PlayCircle,
  Search,
  Share2,
  Star,
  Table2,
  Tags,
  Trash2,
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
    icone: LayoutGrid,
    titulo: "Visão geral",
    descricao: "O bloco de notas do painel é dividido em quatro colunas: seções e etiquetas à esquerda, a galeria de notas no meio, o editor da nota aberta e, por fim, o painel de propriedades com as ações daquela nota.",
    itens: [
      "Clique em Nova nota, no topo, para criar uma nota em branco e abri-la direto no editor.",
      "As notas são salvas automaticamente enquanto você digita — não existe botão de salvar.",
    ],
  },
  {
    icone: Search,
    titulo: "Busca",
    descricao: "O campo de pesquisa no topo filtra a lista em tempo real por qualquer trecho do título ou do conteúdo da nota.",
    itens: [],
  },
  {
    icone: ListFilter,
    titulo: "Seções",
    descricao: "A coluna da esquerda organiza suas notas por contexto:",
    itens: [
      "Recentes — tudo que você tem acesso, das mais editadas para as mais antigas.",
      "Favoritas e Fixadas — atalhos rápidos para o que você marcou como importante.",
      "Compartilhadas comigo e Criadas por mim — separam o que é seu do que outras pessoas compartilharam.",
      "Notas de equipe e Contextuais — notas vinculadas a um time ou a um registro do painel (cliente, chamado, parceiro).",
      "Arquivadas e Lixeira — notas guardadas ou marcadas para exclusão.",
    ],
  },
  {
    icone: Tags,
    titulo: "Etiquetas",
    descricao: "Abaixo das seções, clique em uma ou mais etiquetas para combinar filtros e encontrar notas de um mesmo assunto rapidamente.",
    itens: [],
  },
  {
    icone: Table2,
    titulo: "Editor e tabelas",
    descricao: "A barra de ferramentas do editor tem título, listas, checklist, citação, código e formatação de texto.",
    itens: [
      "Tabelas funcionam no estilo Word: escolha o tamanho na grade (linhas × colunas) e depois use o painel de edição para adicionar/remover linhas e colunas, mesclar ou dividir células.",
      "O indicador no canto superior direito do editor mostra se a nota está salva, pendente ou com erro de sincronização.",
      "Quando você só tem permissão de leitura sobre a nota, o editor fica bloqueado e mostra um aviso de somente leitura no lugar da barra de formatação.",
    ],
  },
  {
    icone: Pin,
    titulo: "Fixar",
    descricao: "Fixa a nota como aba permanente na barra de tarefas do painel — ela fica sempre visível, mesmo fechando a Central, e só pode ser fechada depois de desafixada.",
    itens: [],
  },
  {
    icone: Star,
    titulo: "Favoritar",
    descricao: "Marca a nota para aparecer na seção Favoritas, um atalho rápido para o que você mais usa.",
    itens: [],
  },
  {
    icone: Share2,
    titulo: "Compartilhar",
    descricao: "Compartilha a nota com pessoas, setores ou papéis do painel, escolhendo o nível de acesso de cada um:",
    itens: [
      "Leitor — só visualiza o conteúdo, não pode digitar nem alterar nada.",
      "Comentarista — visualiza e pode comentar, mas não edita o conteúdo.",
      "Editor — visualiza, comenta e edita o conteúdo da nota.",
      "Admin — faz tudo isso e também compartilha, altera permissões e exclui a nota.",
    ],
  },
  {
    icone: History,
    titulo: "Histórico de versões",
    descricao: "Toda edição salva gera uma versão. Abra o histórico para consultar quem alterou o quê e restaurar uma versão anterior quando precisar.",
    itens: [],
  },
  {
    icone: Bell,
    titulo: "Lembretes",
    descricao: "Cria um lembrete vinculado à nota — você recebe uma notificação no painel na data e hora marcadas.",
    itens: [],
  },
  {
    icone: Archive,
    titulo: "Arquivar",
    descricao: "Tira a nota das seções ativas sem apagar nada. Ela continua acessível a qualquer momento pela seção Arquivadas.",
    itens: [],
  },
  {
    icone: Trash2,
    titulo: "Lixeira e exclusão definitiva",
    descricao: "Mover para a lixeira é reversível por um tempo. Dentro da Lixeira, o botão Excluir definitivamente apaga a nota e todo o seu histórico permanentemente — essa ação não pode ser desfeita.",
    itens: [],
  },
  {
    icone: Paperclip,
    titulo: "Anexos",
    descricao: "No painel de propriedades, clique em Anexar para enviar um arquivo à nota.",
    itens: [
      "Clique no nome de um anexo já enviado para abrir a pré-visualização em tela — imagens e PDFs abrem direto, sem precisar baixar nem sair do painel.",
      "Dentro da pré-visualização também dá para baixar o arquivo ou abri-lo em uma nova guia, se preferir.",
    ],
  },
  {
    icone: MessageSquare,
    titulo: "Comentários",
    descricao: "Notas compartilhadas (não privadas) ganham uma área de comentários no painel de propriedades, para discutir o conteúdo com quem tem acesso.",
    itens: [],
  },
];

interface TutorialNotasModalProps {
  aberto: boolean;
  onFechar: () => void;
  onIniciarTour: () => void;
  accent: string;
}

export function TutorialNotasModal({ aberto, onFechar, onIniciarTour, accent }: TutorialNotasModalProps) {
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
                Como usar o Bloco de notas Alpha
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
