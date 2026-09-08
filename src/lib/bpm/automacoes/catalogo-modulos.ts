import {
  TIPOS_ACAO_CENTRAL,
  type TipoAcaoCentral,
} from "@/lib/bpm/automacoes/central-schemas";

export type StatusAuditoriaAutomacao = "EXECUTAVEL_MOTOR" | "INTEGRACAO_MANUAL";

export type ItemAuditoriaAutomacao = {
  id: string;
  acaoTipo: TipoAcaoCentral | null;
  nome: string;
  modulo: string;
  descricao: string;
  status: StatusAuditoriaAutomacao;
  fluxo: string[];
  preRequisitos: string[];
  resultado: string;
  evidencias: string[];
  destaque?: boolean;
};

type MetadadosAcao = Omit<ItemAuditoriaAutomacao, "id" | "acaoTipo" | "status">;

/**
 * Registro tipado do que o Motor Central aceita e executa. O Record obriga que
 * toda ação do contrato canônico possua uma explicação de auditoria na UI.
 */
const METADADOS_ACOES_CENTRAIS = {
  ALTERAR_CAMPO: {
    nome: "Alterar campo do card",
    modulo: "Alpha CRM · Campos",
    descricao: "Atualiza um campo dinâmico pertencente ao pipeline do card.",
    fluxo: ["Evento do CRM", "Motor de regras", "Validação do campo", "Valor persistido no card"],
    preRequisitos: ["Campo dinâmico do mesmo pipeline", "Valor compatível com a configuração"],
    resultado: "Campo atualizado e novo evento CAMPO_ALTERADO publicado.",
    evidencias: ["src/lib/bpm/automacoes/central-schemas.ts", "src/lib/bpm/automacoes/central-runtime.ts"],
  },
  MOVER_CARD: {
    nome: "Mover card de etapa",
    modulo: "Alpha CRM · Pipeline",
    descricao: "Move o card pelo fluxo canônico e pode validar transição e campos obrigatórios.",
    fluxo: ["Evento do CRM", "Motor de regras", "Requisitos da etapa", "Movimentação e cadências"],
    preRequisitos: ["Etapa ativa no mesmo pipeline", "Requisitos de saída atendidos quando habilitados"],
    resultado: "Card movido, histórico gravado e evento CARD_MOVIDO publicado.",
    evidencias: ["src/lib/bpm/automacoes/central-runtime.ts", "src/lib/bpm/requisitos-etapa-server.ts"],
  },
  ALTERAR_SUBSTATUS: {
    nome: "Alterar substatus",
    modulo: "Alpha CRM · Substatus",
    descricao: "Aplica ao card um substatus ativo da etapa atual.",
    fluxo: ["Evento do CRM", "Motor de regras", "Validação do substatus", "Histórico do card"],
    preRequisitos: ["Substatus ativo e vinculado à etapa atual"],
    resultado: "Substatus auditado no histórico e evento CARD_ATUALIZADO publicado.",
    evidencias: ["src/lib/bpm/automacoes/central-schemas.ts", "src/lib/bpm/automacoes/central-runtime.ts"],
  },
  CRIAR_TAREFA: {
    nome: "Criar tarefa",
    modulo: "Alpha CRM · Tarefas",
    descricao: "Cria uma tarefa com responsável, prazo, prioridade e alerta opcionais.",
    fluxo: ["Evento do CRM", "Motor de regras", "Criação da tarefa", "Notificação do pipeline"],
    preRequisitos: ["Título e tipo da tarefa", "Responsável elegível quando informado"],
    resultado: "Tarefa persistida e evento TAREFA_CRIADA publicado.",
    evidencias: ["src/lib/bpm/automacoes/central-schemas.ts", "src/lib/bpm/automacoes/central-runtime.ts"],
  },
  CRIAR_SLA: {
    nome: "Iniciar SLA",
    modulo: "Alpha CRM · SLA",
    descricao: "Cria uma instância do SLA configurado para o pipeline.",
    fluxo: ["Evento do CRM", "Motor de regras", "Configuração de SLA", "Prazo calculado"],
    preRequisitos: ["Configuração de SLA ativa e compatível com o pipeline"],
    resultado: "Instância de SLA criada sem duplicar uma instância ainda aberta.",
    evidencias: ["src/lib/bpm/automacoes/central-runtime.ts", "src/lib/bpm/sla.ts"],
  },
  CRIAR_ALERTA: {
    nome: "Criar alerta no card",
    modulo: "Alpha CRM · Histórico",
    descricao: "Registra um alerta rastreável no histórico do card.",
    fluxo: ["Evento do CRM", "Motor de regras", "Texto do alerta", "Histórico do card"],
    preRequisitos: ["Texto do alerta"],
    resultado: "Registro ALERTA_AUTOMACAO criado no histórico.",
    evidencias: ["src/lib/bpm/automacoes/central-schemas.ts", "src/lib/bpm/automacoes/central-runtime.ts"],
  },
  ADICIONAR_ANOTACAO: {
    nome: "Adicionar anotação",
    modulo: "Alpha CRM · Histórico",
    descricao: "Adiciona uma anotação automática ao histórico do card.",
    fluxo: ["Evento do CRM", "Motor de regras", "Texto da anotação", "Histórico do card"],
    preRequisitos: ["Texto da anotação"],
    resultado: "Registro ANOTACAO_AUTOMACAO criado no histórico.",
    evidencias: ["src/lib/bpm/automacoes/central-schemas.ts", "src/lib/bpm/automacoes/central-runtime.ts"],
  },
  CRIAR_CARD_OUTRO_PIPELINE: {
    nome: "Criar card em outro pipeline",
    modulo: "Alpha CRM · Pipelines",
    descricao: "Abre um card da mesma empresa em outro processo e pode vinculá-lo ao original.",
    fluxo: ["Evento do CRM", "Motor de regras", "Pipeline e etapa de destino", "Novo card vinculado"],
    preRequisitos: ["Pipeline e etapa ativos", "Responsável elegível"],
    resultado: "Novo card criado, vínculo opcional gravado e evento CARD_CRIADO publicado.",
    evidencias: ["src/lib/bpm/automacoes/central-schemas.ts", "src/lib/bpm/automacoes/central-runtime.ts"],
  },
  ATUALIZAR_CARD_RELACIONADO: {
    nome: "Atualizar card relacionado",
    modulo: "Alpha CRM · Vínculos",
    descricao: "Atualiza campo, etapa ou responsável de cards vinculados.",
    fluxo: ["Evento do CRM", "Motor de regras", "Busca dos vínculos", "Atualização dos cards relacionados"],
    preRequisitos: ["Vínculo entre cards", "Ao menos uma alteração configurada"],
    resultado: "Cards relacionados atualizados e IDs devolvidos na execução.",
    evidencias: ["src/lib/bpm/automacoes/central-schemas.ts", "src/lib/bpm/automacoes/central-runtime.ts"],
  },
  ATRIBUIR_RESPONSAVEL: {
    nome: "Atribuir responsável",
    modulo: "Alpha CRM · Equipe",
    descricao: "Troca o responsável principal e ajusta os membros do card.",
    fluxo: ["Evento do CRM", "Motor de regras", "Validação do usuário", "Responsável e membros"],
    preRequisitos: ["Usuário ativo"],
    resultado: "Responsável alterado e evento RESPONSAVEL_ATRIBUIDO publicado.",
    evidencias: ["src/lib/bpm/automacoes/central-schemas.ts", "src/lib/bpm/automacoes/central-runtime.ts"],
  },
  COMUNICACAO_EXISTENTE: {
    nome: "Acionar comunicação existente",
    modulo: "Alpha Comm · Comunicação",
    descricao: "Usa e-mail diretamente ou registra uma comunicação pendente para os canais integrados.",
    fluxo: ["Evento do CRM", "Motor de regras", "Canal configurado", "Envio ou pendência auditada"],
    preRequisitos: ["Mensagem", "Destinatário e provedor quando o canal for e-mail"],
    resultado: "Mensagem enviada por e-mail ou pendência registrada no histórico.",
    evidencias: ["src/lib/bpm/automacoes/central-schemas.ts", "src/lib/bpm/automacoes/central-runtime.ts"],
  },
  HTTP: {
    nome: "Chamar API HTTPS",
    modulo: "Integrações · HTTP",
    descricao: "Executa uma chamada HTTPS com limites de segurança e proteção contra SSRF.",
    fluxo: ["Evento do CRM", "Motor de regras", "Política de URL segura", "Resposta da API"],
    preRequisitos: ["URL HTTPS pública", "Método e corpo permitidos"],
    resultado: "Resposta sanitizada e evento CHAMADA_EXTERNA_CONCLUIDA publicado.",
    evidencias: ["src/lib/bpm/automacoes/central-runtime.ts", "src/lib/bpm/automacoes/safe-http.ts"],
  },
  WEBHOOK: {
    nome: "Enviar webhook",
    modulo: "Integrações · Webhooks",
    descricao: "Envia dados para um endpoint HTTPS usando o executor seguro do Motor Central.",
    fluxo: ["Evento do CRM", "Motor de regras", "Política de URL segura", "Webhook externo"],
    preRequisitos: ["Endpoint HTTPS público", "Método e corpo permitidos"],
    resultado: "Resposta sanitizada e evento CHAMADA_EXTERNA_CONCLUIDA publicado.",
    evidencias: ["src/lib/bpm/automacoes/central-runtime.ts", "src/lib/bpm/automacoes/safe-http.ts"],
  },
  ENVIAR_EMAIL: {
    nome: "Enviar e-mail",
    modulo: "Alpha Comm · E-mail",
    descricao: "Renderiza dados do card e envia uma mensagem pelo provedor configurado.",
    fluxo: ["Evento do CRM", "Motor de regras", "Renderização dos placeholders", "Provedor de e-mail"],
    preRequisitos: ["Destinatário, assunto e corpo", "Provedor de e-mail configurado"],
    resultado: "E-mail enviado com chave de idempotência e ID da mensagem.",
    evidencias: ["src/lib/bpm/automacoes/executor.ts", "src/lib/bpm/automacoes/placeholders.ts"],
  },
  GERAR_CONTRATO: {
    nome: "Gerar contrato da empresa",
    modulo: "Gerador de Documentos",
    descricao: "Usa um template ativo, preenche os dados da empresa e cria o contrato para conferência.",
    fluxo: ["Evento do CRM", "Motor de regras", "Template do Gerador de Documentos", "Documento da empresa", "Conferência/PDF"],
    preRequisitos: ["Template de contrato ativo", "Empresa vinculada ao card", "Variáveis obrigatórias preenchidas"],
    resultado: "DocumentoGerado vinculado à empresa, cláusulas renderizadas e URL de conferência; PDF quando o Blob está configurado.",
    evidencias: ["src/lib/bpm/automacoes/executor.ts", "src/lib/gerador-documentos/schemas.ts", "src/app/PainelAlpha/GeradorDocumentos"],
    destaque: true,
  },
  GERAR_FICHA: {
    nome: "Gerar ficha de reunião",
    modulo: "Sistema de Pré-Análise",
    descricao: "Gera a ficha PDF com o serviço de pré-análise e anexa o arquivo ao card.",
    fluxo: ["Evento do CRM", "Motor de regras", "CNPJ da empresa", "Gerador de ficha", "Anexo do card"],
    preRequisitos: ["Empresa com CNPJ", "Serviço de geração de ficha disponível"],
    resultado: "Ficha PDF gerada e BpmCardAnexo criado ou reutilizado.",
    evidencias: ["src/lib/bpm/automacoes/executor.ts", "src/lib/bibble/gerar-ficha-server.ts", "src/app/PainelAlpha/SistemaPreAnalise"],
    destaque: true,
  },
  MATERIALIZAR_CHECKLIST: {
    nome: "Criar checklist da etapa",
    modulo: "Alpha CRM · Checklist",
    descricao: "Materializa no card os checklists aplicáveis ao seu contexto atual.",
    fluxo: ["Evento do CRM", "Motor de regras", "Templates aplicáveis", "Checklist do card"],
    preRequisitos: ["Template de checklist aplicável"],
    resultado: "Itens de checklist criados de forma idempotente no card.",
    evidencias: ["src/lib/bpm/automacoes/executor.ts", "src/lib/bpm/checklists/service.ts"],
  },
  DISTRIBUIR_RESPONSAVEL: {
    nome: "Distribuir responsável",
    modulo: "Alpha CRM · Distribuição",
    descricao: "Distribui card ou tarefa por responsável fixo, rodízio ou menor carga.",
    fluxo: ["Evento do CRM", "Motor de regras", "Candidatos elegíveis", "Estratégia de distribuição"],
    preRequisitos: ["Lista de usuários elegíveis", "Estratégia configurada"],
    resultado: "Responsável atribuído com histórico e proteção contra duplicidade.",
    evidencias: ["src/lib/bpm/automacoes/executor.ts", "src/lib/bpm/automacoes/distribuicao-oportunidades.ts"],
  },
  IDENTIFICAR_OPORTUNIDADE: {
    nome: "Identificar oportunidade",
    modulo: "Alpha CRM · Oportunidades",
    descricao: "Detecta ausência de um serviço e executa a ação comercial configurada.",
    fluxo: ["Evento do CRM", "Motor de regras", "Serviço alvo", "Ação comercial"],
    preRequisitos: ["Serviço comercial ativo", "Condição e ação configuradas"],
    resultado: "Oportunidade registrada e ação comercial executada ou encaminhada.",
    evidencias: ["src/lib/bpm/automacoes/executor.ts", "src/lib/bpm/automacoes/distribuicao-oportunidades.ts"],
  },
  CRIAR_TAREFAS_POR_META: {
    nome: "Criar tarefas por meta",
    modulo: "Alpha CRM · Metas de interação",
    descricao: "Completa automaticamente a quantidade diária de tarefas necessária para uma meta.",
    fluxo: ["Evento do CRM", "Motor de regras", "Interações realizadas", "Tarefas restantes"],
    preRequisitos: ["Meta, tipo de interação e tipo de tarefa"],
    resultado: "Somente as tarefas restantes da meta são criadas.",
    evidencias: ["src/lib/bpm/automacoes/central-schemas.ts", "src/lib/bpm/automacoes/central-runtime.ts"],
  },
  MARCAR_ALERTA_TAREFA: {
    nome: "Disparar alerta de tarefa",
    modulo: "Alpha CRM · Tarefas",
    descricao: "Marca como disparado o alerta vencido de uma tarefa pendente.",
    fluxo: ["Evento de tarefa", "Motor de regras", "Validação do prazo", "Alerta e histórico"],
    preRequisitos: ["Evento referente a uma tarefa pendente com alerta vencido"],
    resultado: "Alerta marcado uma única vez e pipeline notificado.",
    evidencias: ["src/lib/bpm/automacoes/central-schemas.ts", "src/lib/bpm/automacoes/central-runtime.ts"],
  },
  SINCRONIZAR_TRANSCRICAO_REUNIAO: {
    nome: "Sincronizar transcrição da reunião",
    modulo: "Google Meet · Reuniões",
    descricao: "Consulta a reunião vinculada ao card e sincroniza sua transcrição automaticamente.",
    fluxo: ["Evento/recorrência do CRM", "Motor de regras", "Reunião Google vinculada", "Transcrição no card"],
    preRequisitos: ["Card com reunião Google vinculada", "Integração Google autorizada"],
    resultado: "Transcrição e estado de sincronização atualizados no card.",
    evidencias: ["src/lib/bpm/automacoes/central-runtime.ts", "src/lib/bpm/transcricao-reuniao-server.ts"],
    destaque: true,
  },
} satisfies Record<TipoAcaoCentral, MetadadosAcao>;

export const AUTOMACOES_EXECUTAVEIS_AUDITADAS: ItemAuditoriaAutomacao[] =
  TIPOS_ACAO_CENTRAL.map((acaoTipo) => ({
    id: acaoTipo,
    acaoTipo,
    status: "EXECUTAVEL_MOTOR" as const,
    ...METADADOS_ACOES_CENTRAIS[acaoTipo],
  }));

export const INTEGRACOES_MANUAIS_AUDITADAS: ItemAuditoriaAutomacao[] = [
  {
    id: "AGENDAR_GOOGLE_MEET",
    acaoTipo: null,
    nome: "Agendar reunião no Google Meet",
    modulo: "Google Meet · Reuniões",
    descricao: "A integração cria o evento, o link do Meet e grava tudo no card, mas hoje depende da ação do usuário dentro do card.",
    status: "INTEGRACAO_MANUAL",
    fluxo: ["Card na etapa de reunião", "Usuário informa data e e-mail", "Google Calendar cria evento + Meet", "IDs e link gravados no card"],
    preRequisitos: ["Calendário Google gravável", "Card em etapa de reunião", "Data/hora e e-mail do cliente"],
    resultado: "Evento e link do Google Meet persistidos no card com histórico e notificação.",
    evidencias: ["src/actions/bpm/GoogleMeet.ts", "src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx", "src/actions/google-calendar-eventos.ts"],
    destaque: true,
  },
];

export const CATALOGO_AUDITORIA_AUTOMACOES = [
  ...AUTOMACOES_EXECUTAVEIS_AUDITADAS,
  ...INTEGRACOES_MANUAIS_AUDITADAS,
];

export function obterAuditoriaAcao(acaoTipo: string) {
  return AUTOMACOES_EXECUTAVEIS_AUDITADAS.find((item) => item.acaoTipo === acaoTipo);
}
