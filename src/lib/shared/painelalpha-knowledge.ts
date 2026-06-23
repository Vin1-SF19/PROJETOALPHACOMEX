/**
 * BASE DE CONHECIMENTO DO PAINELALPHA — fonte única de verdade.
 *
 * Documenta os PROCESSOS operacionais, comerciais e o vocabulário interno do
 * sistema. Consumida tanto pelo Bibble (system-prompt) quanto pelos agentes
 * Onyx (system-knowledge), garantindo que TODAS as IAs tenham o mesmo
 * conhecimento processual.
 *
 * Diferença em relação à lista de módulos:
 * - Módulos = O QUE existe e ONDE fica (navegação).
 * - Este arquivo = COMO os processos funcionam (procedimento, vocabulário).
 *
 * Quando um processo muda, atualize AQUI — as duas IAs herdam automaticamente.
 */

// ─── Vocabulário interno ────────────────────────────────────────────────────

export const VOCABULARIO_PAINELALPHA = `## VOCABULÁRIO INTERNO DO PAINELALPHA

- **Chamado**: registro de incidente/solicitação de suporte interno. Tem título, descrição, prioridade (BAIXA, MEDIA, ALTA, URGENTE) e status (ABERTO, EM_ANDAMENTO, FECHADO).
- **Lead**: contato comercial em potencial, ainda não qualificado. Vive no Alpha Leads.
- **Qualificação**: processo de avaliar se um lead tem perfil/intenção de compra antes de virar oportunidade no CRM.
- **Pré-Análise**: consulta completa de um CNPJ (Receita Federal + RADAR + EmpresaQui) que gera uma ficha de reunião em PDF. Usada antes de reuniões comerciais.
- **Ficha de reunião**: PDF gerado pela Pré-Análise com os dados consolidados da empresa para o consultor levar à reunião.
- **RADAR**: habilitação aduaneira (Receita Federal) que permite a empresa operar comércio exterior. Consultável no módulo Consulta RADAR.
- **POP**: Procedimento Operacional Padrão — documentos oficiais de processos da empresa, no módulo POP/DocsAlpha.
- **Alpha CheckList**: checklists de conformidade que devem ser cumpridos em operações específicas.
- **CS / NPS**: Customer Success e Net Promoter Score — acompanhamento e satisfação de clientes ativos.`;

// ─── Processos operacionais ─────────────────────────────────────────────────

export const PROCESSOS_PAINELALPHA = `## PROCESSOS OPERACIONAIS DO PAINELALPHA

### Como abrir um chamado (registrar um incidente)
1. O usuário acessa o módulo **Chamados** (/PainelAlpha/Chamados) ou pede para a IA abrir.
2. Informa: título resumido do problema, descrição detalhada e prioridade.
3. O chamado entra com status ABERTO e é encaminhado ao time de suporte.
4. A IA pode abrir chamados diretamente via a ação "abrir_chamado".

### Fluxo comercial: do Lead à Tarefa Comercial
1. O **Lead** entra no Alpha Leads (origem: marketing, indicação, campanha).
2. Passa pela **Qualificação** — avalia-se perfil, intenção e fit.
3. Lead qualificado vira **oportunidade** no Alpha CRM (pipeline de vendas).
4. Antes de uma reunião, gera-se a **Pré-Análise** do CNPJ (ficha de reunião).
5. As ações de acompanhamento viram **Tarefas Comercial** (PainelTarefaC).

### Etapas da Pré-Análise (consulta de CNPJ)
1. Informa-se o CNPJ da empresa-alvo.
2. O sistema consulta Receita Federal (dados cadastrais), RADAR (habilitação aduaneira) e EmpresaQui (dados complementares).
3. Os dados são consolidados em uma **ficha de reunião** (PDF).
4. A IA pode gerar essa ficha via a ação "gerar_ficha_pre_analise" e devolve o link de download.

### Consulta RADAR (habilitação aduaneira)
1. Acessa-se Consulta RADAR (/PainelAlpha/HabilitacaoRadar).
2. Informa-se o CNPJ — retorna a situação da habilitação aduaneira (modalidade, limite, status).

### CS & NPS (pós-venda)
- Clientes ativos são acompanhados via CS & NPS (/PainelAlpha/CadastroClientes).
- Mede-se satisfação (NPS) e registram-se feedbacks para retenção e expansão.`;

// ─── Montagem da base completa ──────────────────────────────────────────────

/**
 * Retorna a base de conhecimento processual completa (vocabulário + processos),
 * pronta para ser injetada no contexto de qualquer IA.
 */
export function getPainelAlphaKnowledge(): string {
  return [VOCABULARIO_PAINELALPHA, "", PROCESSOS_PAINELALPHA].join("\n");
}
