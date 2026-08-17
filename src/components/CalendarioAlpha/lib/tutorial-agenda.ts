import type { ConfigTutorialModulo } from "@/lib/guias/tutorial-modulo";

/**
 * Passos do tour guiado com spotlight — cada `seletor` precisa apontar para um elemento real,
 * marcado com data-guia-agenda na respectiva JSX. O passo "permissoes" só existe no DOM para
 * Admin/CEO: filtrarPassosTutorialDisponiveis (chamado pelo GuiaModuloTour) descarta
 * automaticamente qualquer passo sem alvo no momento em que o tour abre, mesmo padrão já usado
 * em Notas para passos condicionais (ver CentralDeNotas.tsx).
 */
export const TUTORIAL_AGENDA: ConfigTutorialModulo = {
  modulo: "agenda",
  versao: 1,
  titulo: "Tutorial da Agenda Alpha",
  passos: [
    {
      id: "visao-geral",
      seletor: '[data-guia-agenda="visao-geral"]',
      titulo: "Bem-vindo à Agenda Alpha",
      descricao: "Sua agenda do Google Calendar direto no Painel. Vamos percorrer rapidamente cada área e cada botão de ação.",
    },
    {
      id: "trocar-visao",
      seletor: '[data-guia-agenda="trocar-visao"]',
      titulo: "Troque a visão",
      descricao: "Alterne entre Dia, Semana, Mês e Ano. Atalhos de teclado: D, W, M trocam de visão; T volta para hoje.",
    },
    {
      id: "navegacao-data",
      seletor: '[data-guia-agenda="navegacao-data"]',
      titulo: "Navegue no tempo",
      descricao: "Hoje volta para a data atual; as setas avançam ou retrocedem um período (dia, semana, mês ou ano, conforme a visão escolhida).",
    },
    {
      id: "mini-calendario",
      seletor: '[data-guia-agenda="mini-calendario"]',
      titulo: "Mini calendário",
      descricao: "Clique em qualquer dia aqui para ir direto para a Visão Dia daquela data.",
    },
    {
      id: "criar-evento",
      seletor: '[data-guia-agenda="criar-evento"]',
      titulo: "Criar um evento",
      descricao: "Abre o formulário de novo evento — título, data/hora, dia inteiro, localização, descrição, participantes e criação de Google Meet. Também dá para clicar direto num horário vazio da grade, ou apertar a tecla C.",
    },
    {
      id: "minhas-agendas",
      seletor: '[data-guia-agenda="minhas-agendas"]',
      titulo: "Minhas agendas",
      descricao: "Mostra ou oculta cada calendário do Google na grade. Clique em Gerenciar agendas para conectar mais calendários e escolher a cor de cada um (paleta de 16 cores fixas).",
    },
    {
      id: "compartilhadas",
      seletor: '[data-guia-agenda="compartilhadas"]',
      titulo: "Agendas compartilhadas",
      descricao: "Peça acesso à agenda de um colega escolhendo o papel — Visualizador ou Editor. O dono da agenda precisa aprovar antes de aparecer aqui, mesmo para Admin e CEO.",
    },
    {
      id: "permissoes",
      seletor: '[data-guia-agenda="permissoes"]',
      titulo: "Permissões (Admin)",
      descricao: "Só visível para Admin/CEO: controla quem no time pode pedir acesso à agenda de um colega. Não dá acesso automático a ninguém.",
    },
    {
      id: "status-sincronizacao",
      seletor: '[data-guia-agenda="status-sincronizacao"]',
      titulo: "Status de sincronização",
      descricao: "Mostra quando a agenda sincronizou pela última vez com o Google. Clique para forçar uma sincronização manual ou desativar a conexão.",
    },
    {
      id: "sino-notificacoes",
      seletor: '[data-guia-agenda="sino-notificacoes"]',
      titulo: "Notificações de compromisso",
      descricao: "Fica na barra de abas do Painel, visível em qualquer módulo. Avisa 10 e 5 minutos antes de um compromisso, e também sobre pedidos de compartilhamento.",
    },
  ],
};
