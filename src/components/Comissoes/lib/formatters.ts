/** Formata um valor em centavos (Int) para moeda pt-BR. Nunca usar Float neste módulo. */
export function formatarCentavosBRL(valorCents: number): string {
  return (valorCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatarDataComissao(data: Date | string | null): string {
  if (!data) return "--";
  const d = typeof data === "string" ? new Date(data) : data;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export const EVENT_TYPE_LABELS: Record<string, string> = {
  CONTRACTING: "Contratação",
  PROCESS_STARTED: "Processo Iniciado",
  PROCESS_SUCCESS: "Êxito",
  FIRST_ATTEMPT_SUCCESS: "Êxito na 1ª Tentativa",
  AUXILIARY_PARTICIPATION: "Participação Auxiliar",
  MANUAL_EVENT: "Lançamento Manual",
  CANCELLATION: "Cancelamento",
  REVERSAL: "Estorno",
};

export const STATUS_LABELS: Record<string, string> = {
  Pendente: "Pendente",
  AguardandoAprovacao: "Aguardando Aprovação",
  Programado: "Programado",
  Pago: "Pago",
  ParcialmentePago: "Parcialmente Pago",
  Vencido: "Vencido",
  Bloqueado: "Bloqueado",
  EmDivergencia: "Em Divergência",
  Cancelado: "Cancelado",
  Estornado: "Estornado",
  PENDING_REVIEW: "Pendente de Revisão",
  OK: "OK",
  BLOCKED: "Bloqueado",
  INTEGRATION_ERROR: "Erro de Integração",
};

/** Cor do status — verde=pago, amarelo=pendente, vermelho=vencido/bloqueado/divergente (padrão Ledger Vivo). */
export function corDoStatus(status: string): "verde" | "amarelo" | "vermelho" | "neutro" {
  if (status === "Pago" || status === "OK") return "verde";
  if (status === "Pendente" || status === "AguardandoAprovacao" || status === "Programado" || status === "ParcialmentePago") return "amarelo";
  if (status === "Vencido" || status === "Bloqueado" || status === "EmDivergencia" || status === "PENDING_REVIEW" || status === "BLOCKED" || status === "INTEGRATION_ERROR") return "vermelho";
  return "neutro";
}

/**
 * Tradução de `CommissionDivergence.tipo` (código técnico interno) para título, explicação
 * e orientação de como resolver — tudo em linguagem de negócio, SEM id/cuid/nome de campo
 * técnico. O texto cru em `detalhes` (gravado no banco só para auditoria/suporte) nunca
 * deve aparecer para o usuário final.
 */
export const DIVERGENCIA_LABELS: Record<string, { titulo: string; explicacao: string; comoResolver: string }> = {
  EMPRESA_SEM_CNPJ: {
    titulo: "Empresa sem CNPJ",
    explicacao: "Este lançamento chegou sem CNPJ preenchido, então o sistema não consegue confirmar a qual empresa ele pertence nem cruzar com o cadastro do cliente.",
    comoResolver: "Abra o cadastro da empresa de origem (CS&NPS ou Metas) e confirme se o CNPJ foi preenchido corretamente. Depois de corrigir lá, volte aqui e clique em \"Reprocessar\".",
  },
  CONTRATO_SEM_VALOR: {
    titulo: "Contrato sem valor definido",
    explicacao: "Este contrato não tem um valor registrado, então não é possível calcular quanto de comissão ou prêmio ele deveria gerar.",
    comoResolver: "Verifique no Metas ou no CS&NPS se o valor do contrato foi preenchido. Se estiver faltando, complete o cadastro e clique em \"Reprocessar\" para o sistema tentar calcular de novo.",
  },
  SERVICO_SEM_TARIFARIO: {
    titulo: "Serviço sem tarifário cadastrado",
    explicacao: "Não existe um valor de tabela (tarifário) cadastrado para este serviço na data em que o contrato foi fechado, então o sistema não tem uma referência de preço para calcular a comissão.",
    comoResolver: "Vá em Comissões → Configurações → Tarifários e cadastre o valor deste serviço com a data de início correspondente. Depois clique em \"Reprocessar\".",
  },
  COLABORADOR_SEM_CARGO: {
    titulo: "Colaborador sem cargo definido",
    explicacao: "O colaborador envolvido neste lançamento não tem um cargo cadastrado, então o sistema não sabe qual regra de comissão aplicar a ele.",
    comoResolver: "Vá até o cadastro do colaborador e preencha o cargo dele. Depois clique em \"Reprocessar\" para o sistema recalcular.",
  },
  COLABORADOR_SEM_VINCULO_VIGENTE: {
    titulo: "Colaborador sem vínculo ativo na data",
    explicacao: "Na data deste evento, o colaborador não tinha um contrato de trabalho (CLT ou PJ) ativo registrado — pode ser um contrato que venceu, ainda não começou, ou nunca foi cadastrado.",
    comoResolver: "Confirme no cadastro do colaborador se o contrato de trabalho dele cobre a data deste evento. Ajuste as datas de início/fim se necessário e clique em \"Reprocessar\".",
  },
  ANALISTA_SEM_NIVEL: {
    titulo: "Cargo de Analista sem nível definido",
    explicacao: "O nome do cargo começa com \"Analista\", mas não deixa claro o nível (Sênior, II ou Auxiliar), e cada nível tem uma comissão diferente.",
    comoResolver: "Ajuste o nome do cargo do colaborador para incluir o nível correto (ex: \"Analista Sênior\", \"Analista II\"). Depois clique em \"Reprocessar\".",
  },
  EVENTO_DUPLICADO: {
    titulo: "Possível lançamento duplicado",
    explicacao: "Existe outro lançamento com a mesma empresa, o mesmo serviço e o mesmo tipo de evento — pode ser um lançamento repetido por engano na sincronização.",
    comoResolver: "Compare os dois lançamentos no painel principal. Se for realmente duplicado, resolva mantendo só um deles (o financeiro deve decidir qual manter). Se forem contratos diferentes de fato, marque como resolvida.",
  },
  EXITO_SEM_CONTRATACAO: {
    titulo: "Êxito sem contratação correspondente",
    explicacao: "O sistema recebeu um sinal de que este cliente teve êxito no processo, mas não encontrou o registro da contratação original desse mesmo serviço — sem isso, não há como confirmar que o êxito é válido.",
    comoResolver: "Confirme se a contratação deste cliente para este serviço está corretamente cadastrada no CS&NPS/Metas. Se estava faltando e foi corrigida, clique em \"Reprocessar\".",
  },
  EXITO_SEM_BUSINESS_PROCESS: {
    titulo: "Êxito sem processo de atendimento vinculado",
    explicacao: "O sistema recebeu um sinal de êxito para este cliente, mas não encontrou o processo de atendimento (com as tentativas e o responsável) que deveria ter gerado esse resultado.",
    comoResolver: "Verifique se o processo de atendimento deste cliente foi registrado corretamente no sistema de origem. Depois de corrigido, clique em \"Reprocessar\".",
  },
  REGRAS_CONFLITANTES: {
    titulo: "Regras de comissão em conflito",
    explicacao: "Mais de uma regra de comissão se aplica a este lançamento com a mesma prioridade, e o sistema não consegue decidir sozinho qual delas usar — calcular errado aqui teria impacto financeiro real.",
    comoResolver: "Um responsável pelo módulo de Comissões precisa entrar em Configurações → Construtor de Regras e ajustar a prioridade das regras conflitantes, para que só uma se aplique a este caso.",
  },
  REGRA_NAO_ENCONTRADA: {
    titulo: "Nenhuma regra de comissão encontrada",
    explicacao: "Não existe nenhuma regra cadastrada que se aplique a este lançamento, então o sistema não conseguiu calcular nenhum valor de comissão para ele.",
    comoResolver: "Verifique em Configurações → Construtor de Regras se existe uma regra para o cargo/serviço/tipo de evento deste lançamento. Se não existir, cadastre uma nova regra e clique em \"Reprocessar\".",
  },
  DESCONTO_INCONSISTENTE: {
    titulo: "Desconto do contrato precisa de revisão",
    explicacao: "O desconto aplicado neste contrato está fora do padrão configurado (por exemplo, acima do limite normal), e o sistema não decide sozinho como tratar isso — precisa de uma confirmação humana.",
    comoResolver: "Um responsável financeiro precisa revisar o valor do contrato e decidir manualmente a base de cálculo correta para este caso antes de aprovar o lançamento.",
  },
  PAGAMENTO_SUPERIOR_AO_VALOR: {
    titulo: "Pagamento maior que o valor devido",
    explicacao: "O total já pago neste lançamento é maior do que o valor que deveria ser pago — pode ter havido um pagamento em duplicidade ou um erro de digitação no valor.",
    comoResolver: "Revise o histórico de pagamentos deste lançamento na aba \"Pagtos.\" do card do colaborador. Se identificar um pagamento indevido, use a opção \"Estornar\" nele.",
  },
  PRIMEIRA_TENTATIVA_INCONSISTENTE: {
    titulo: "Prêmio de primeira tentativa precisa de revisão",
    explicacao: "Este evento foi marcado como sucesso já na primeira tentativa, mas o processo de atendimento correspondente não confirma essa informação — sem essa confirmação, o prêmio de primeira tentativa pode estar sendo pago indevidamente.",
    comoResolver: "Verifique junto ao time operacional se este atendimento realmente teve êxito na primeira tentativa. Corrija o registro na origem e clique em \"Reprocessar\".",
  },
  DADOS_IMPORTADOS_ALTERADOS: {
    titulo: "Dado de origem foi atualizado depois da última sincronização",
    explicacao: "A informação original deste evento (no CS&NPS ou Metas) mudou depois da última vez que o sistema de Comissões sincronizou — os valores aqui podem estar desatualizados.",
    comoResolver: "Clique no botão \"Sincronizar\" no topo da tela de Comissões para trazer a versão mais recente dos dados. Depois, clique em \"Reprocessar\" nesta divergência.",
  },
  ERRO_DE_INTEGRACAO: {
    titulo: "Erro ao importar este lançamento",
    explicacao: "Houve um erro técnico ao trazer este evento dos sistemas integrados (CS&NPS, Metas ou Colaboradores) — o dado pode estar incompleto ou não ter sido importado corretamente.",
    comoResolver: "Tente sincronizar novamente pelo botão \"Sincronizar\". Se o erro persistir, repasse esta divergência para o time técnico com a data em que ela apareceu.",
  },
};

export function traduzirDivergencia(tipo: string): { titulo: string; explicacao: string; comoResolver: string } {
  return (
    DIVERGENCIA_LABELS[tipo] ?? {
      titulo: "Situação não reconhecida",
      explicacao: "Este tipo de divergência ainda não tem uma explicação cadastrada no sistema.",
      comoResolver: "Repasse este caso para o time técnico, informando a empresa/colaborador envolvido e a data em que apareceu.",
    }
  );
}
