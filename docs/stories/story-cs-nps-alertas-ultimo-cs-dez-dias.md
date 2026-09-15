# Story: CS & NPS — alertas de Último CS vencido em 10 dias

**ID:** STORY-CS-NPS-ALERTAS-ULTIMO-CS-DEZ-DIAS
**Módulo:** CS & NPS + central global de notificações
**Status:** InProgress
**Prioridade:** Alta
**Data de criação:** 2026-09-15

## Executor Assignment

executor: "@dev"
quality_gate: "@ux-design-expert"
quality_gate_tools: ["eslint", "typescript", "vitest", "next-build", "coderabbit"]

## Story

**Como** membro de TI ou Recursos Humanos responsável pelo acompanhamento de clientes,
**quero** ser alertado quando um serviço em andamento completar 10 dias desde seu último registro de CS e atualizar esse CS por um fluxo rápido,
**para** manter o acompanhamento das empresas em dia sem procurar manualmente cada cadastro.

## Contexto e objetivo

O módulo já mostra a coluna **Último CS**, calculada a partir do histórico de CS, e o shell do Painel Alpha já agrega notificações no sino global. Esta entrega conecta esses contratos: identifica registros em **Em Andamento** cujo último CS completou 10 dias, destaca a data na listagem, apresenta um alerta exclusivo para TI/RH e permite registrar um novo CS sem abrir toda a gestão da empresa. Também corrige a linha **Status** do filtro avançado, que hoje oferece ordenação A-Z/Z-A em vez dos status reais do módulo.

## Acceptance Criteria

1. Um registro fica pendente quando, simultaneamente: pertence a um `ClienteServico` não arquivado, seu status é exatamente **Em Andamento**, possui ao menos um registro de CS com data válida e o instante atual é maior ou igual à data do CS mais recente acrescida de 10 dias corridos.
2. O CS mais recente é determinado pelo maior `dataRegistro` persistido em `ClienteServicoLogCs`; o campo legado `ClienteServico.ultimoCs` não é usado como fonte da data. Registros sem histórico de CS, com outro status ou ainda dentro da janela de 10 dias não geram destaque nem alerta.
3. Ao completar a janela definida no AC 1, a data exibida em **Último CS** fica vermelha e com indicação visual acessível que não dependa somente da cor. O estado normal das demais datas permanece inalterado.
4. A regra de vencimento é compartilhada entre listagem, contador/notificação e modal de pendências, evitando resultados divergentes na fronteira exata de 10 dias.
5. O sino global recebe um item de origem **CS & NPS** somente quando existe ao menos uma pendência. O item informa a quantidade atual de registros pendentes e segue o padrão visual, de badge, ordenação e interação da central existente.
6. O item e sua consulta são disponibilizados somente quando a role normalizada do usuário é exatamente `TI` ou `RECURSOSHUMANOS`, aceitando variações de caixa, espaços, acentos e pontuação já tratadas por `normalizeRole`. Admin, CEO e outras roles não recebem o alerta por bypass administrativo. A restrição é validada no servidor, não apenas por ocultação na UI.
7. A pendência é derivada dos dados persistidos de cliente, serviço e histórico de CS, sem criar uma cópia em nova tabela. A central a reconcilia ao carregar o shell, ao recuperar foco, ao atingir uma nova fronteira temporal durante a sessão e após um salvamento pelo fluxo rápido.
8. Clicar no item de **CS & NPS** fecha o dropdown da central e abre um modal global, responsivo e acessível, com todas as pendências autorizadas. Cada linha identifica a empresa e o serviço correspondente, mostra o último CS e permite selecionar o registro correto quando um mesmo CNPJ possui múltiplos serviços.
9. Clicar em uma pendência abre um segundo modal contendo somente o formulário de **Novo CS** daquele `ClienteServico`: relato do atendimento, sentimento e data do atendimento, preservando as validações e valores aceitos pelo fluxo existente.
10. Cancelar o segundo modal retorna à lista sem alterar a pendência. Após salvamento confirmado pelo servidor, o sistema retorna ao modal de listagem, refaz a consulta e remove a linha quando o novo CS a torna não vencida; falha de persistência mantém a empresa na lista e apresenta feedback claro.
11. Ao zerar a lista após uma atualização, o modal apresenta o estado concluído/vazio e o item derivado de **CS & NPS** deixa a central. Marcar notificações como lidas não resolve nem apaga a pendência operacional; somente a atualização persistida do CS ou a mudança dos critérios do AC 1 altera a fila.
12. No **Filtro Avançado**, a linha **Status** deixa de oferecer **A-Z/Z-A** e passa a filtrar pelos valores reais disponíveis na edição do módulo: **Em Andamento**, **Deferido**, **Stand By**, **Cancelado - Indeferimento** e **Cancelado - Troca de Empresa**.
13. O filtro por status pode ser limpo para voltar a mostrar todos os registros, atua de forma independente da ordenação escolhida nos demais campos e é aplicado às linhas de empresa exibidas pela listagem atual.
14. A entrega não cria ou altera tabela, coluna, índice, constraint, seed, migration ou backfill e não introduz variável de ambiente nova.
15. Há testes para a fronteira temporal de 10 dias, seleção do último histórico, critérios de status/histórico, autorização TI/RH, integração com o sino, sequência dos dois modais, reconciliação após salvar, erro de persistência e opções reais do filtro de status.

## Fora de escopo

- Alertar serviços sem nenhum CS registrado.
- Enviar e-mail, WhatsApp, push de navegador ou criar um cron persistente.
- Criar status novos ou alterar os cinco valores já expostos pelo formulário de edição.
- Alterar as regras de NPS, Feedback Google, sócios, dados cadastrais ou troca de serviço.
- Alterar schema, executar migration, backfill ou mutação em massa.
- Conceder a Admin/CEO o alerta específico por meio do bypass de `isAdminRole`.

## Tasks / Subtasks

- [x] **Task 1 — Centralizar a regra temporal e a consulta autorizada** (AC: 1, 2, 4, 6, 7, 14)
  - [x] Implementar função pura para resolver o último `dataRegistro` válido e a fronteira de 10 dias corridos.
  - [x] Criar leitura server-side mínima dos `ClienteServico` elegíveis, incluindo identificação da empresa/serviço e último CS, com autorização exata para TI/RH.
  - [x] Ordenar as pendências deterministicamente pela maior defasagem e usar DTO serializável para o Client Component.
  - [x] Reutilizar a mesma função de domínio na consulta e no destaque da listagem, sem ler `ultimoCs` como data.

- [x] **Task 2 — Destacar Último CS e corrigir o filtro avançado** (AC: 3, 4, 12, 13)
  - [x] Aplicar estilo vermelho e indicador textual/semântico à data vencida na coluna existente.
  - [x] Separar estado de filtro de status do estado de ordenação do grid.
  - [x] Substituir A-Z/Z-A da linha Status pelos cinco valores canônicos já usados em `modalDados.tsx` e fornecer forma de limpar o filtro.
  - [x] Preservar busca, agrupamento por CNPJ e ordenações dos demais campos.

- [x] **Task 3 — Integrar o alerta derivado à central global** (AC: 5–8, 11)
  - [x] Carregar/reconciliar as pendências apenas para roles TI/RH e manter a consulta protegida no servidor.
  - [x] Agregar o item **CS & NPS** a `CentralNotificacoesPainel`, com contador e abertura do modal global pelo shell.
  - [x] Atualizar na carga, foco, fronteira temporal relevante e após salvar, limpando timers/listeners no unmount e evitando consultas sobrepostas.
  - [x] Preservar as fontes atuais da central, o gerenciador de abas, modo TV e execução dentro/fora dos iframes.

- [x] **Task 4 — Implementar lista e atualização rápida de CS** (AC: 8–11)
  - [x] Criar modal de pendências com estados carregando, erro, vazio e lista responsiva/acessível.
  - [x] Identificar explicitamente empresa e serviço para que múltiplos serviços do mesmo CNPJ não atualizem o registro errado.
  - [x] Reutilizar o contrato de `salvarLogCS` e as regras do formulário **Novo CS**, sem expor os demais campos da gestão do cliente.
  - [x] Após sucesso, retornar à lista e reconciliar pelo servidor; em cancelamento/erro, preservar a pendência.

- [ ] **Task 5 — Testes e quality gates** (AC: 1–15)
  - [x] Cobrir função temporal em antes, exatamente em e depois de 10 dias, histórico fora de ordem/data inválida e relógio controlado.
  - [x] Cobrir consulta autorizada para `TI`, variação legada `T.I` e `Recursos Humanos`, com negação para Admin/CEO/demais roles.
  - [x] Cobrir integração do item agregado, contador, modal lista → Novo CS → lista, cancelamento, sucesso e falha.
  - [x] Cobrir visual acessível da data e filtro pelos cinco status, limpeza e independência da ordenação.
  - [ ] Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; atualizar checklist, Dev Agent Record e File List antes de concluir.

## Dev Notes

### Contratos de domínio existentes

- `ClienteServico` guarda `status` e se relaciona com vários `ClienteServicoLogCs`; cada serviço é único por `clienteId + servico`. O status default é **Em Andamento**. [Source: `prisma/schema.prisma#model-ClienteServico`]
- `ClienteServicoLogCs.dataRegistro` é `DateTime` e representa a data real de cada atendimento de CS. [Source: `prisma/schema.prisma#model-ClienteServicoLogCs`]
- `buscarClientes` já carrega `logCs` por `dataRegistro desc`, exclui status **Arquivado** e achata `ClienteServico + Cliente` para a UI. A regra deve continuar robusta a arrays fora de ordem, escolhendo explicitamente a maior data. [Source: `src/actions/Clientes.ts#buscarClientes`]
- A coluna **Último CS** atual calcula a maior data de `logCs` e a formata com `fmtDate`; esse é o ponto visual do destaque. [Source: `src/app/PainelAlpha/CadastroClientes/page.tsx#ÚLTIMO-CS`]
- A página agrupa registros por CNPJ e mantém todos os serviços em `grupo.servicos`; o modal operacional precisa transportar o `ClienteServico.id`, não apenas CNPJ, para salvar no serviço correto. [Source: `src/app/PainelAlpha/CadastroClientes/page.tsx#gruposPorCnpj`]

### Fluxo de atualização existente

- `salvarLogCS(clienteServicoId, dados)` valida sessão e `logRegistroSchema`, persiste `colaborador`, `sentimento`, `observacao` e `dataRegistro`, revalida `/PainelAlpha/CadastroClientes` e devolve o registro criado. [Source: `src/actions/Clientes.ts#salvarLogCS`]
- O formulário **Novo CS** existente aceita sentimentos `pos`, `neg` e `na`, exige relato entre 10 e 140 caracteres na UI, permite escolher a data e impede submissão duplicada enquanto salva. O fluxo rápido deve reutilizar esse contrato/comportamento em vez de criar um formato concorrente. [Source: `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx#handleSalvarCS`; `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx#Novo-CS`]
- `logRegistroSchema` exige sentimento, data e observação de até 2000 caracteres; a experiência atual aplica o limite mais estrito de 10–140 caracteres no formulário. [Source: `src/lib/validations/cs-nps.ts#logRegistroSchema`]

### Notificações, autorização e shell

- `CentralNotificacoesPainel` agrega itens de Agenda, Chamados, Checklist, Notas e Holerites, calcula não lidas, ordena por data e fecha o dropdown antes de executar `item.abrir`. O item de CS & NPS deve entrar nesse contrato sem remover fontes atuais. [Source: `src/components/layout/CentralNotificacoesPainel.tsx`]
- `PainelLayoutClient` é o proprietário do sino, das abas e das camadas globais fora dos iframes; portanto é o ponto de montagem do modal acessível a partir da central. [Source: `src/components/layout/PainelLayoutClient.tsx#Tab-bar-widget-de-clima`]
- `normalizeRole` remove acentos, pontuação e caixa. `isAdminRole` inclui Admin, CEO e TI, por isso não serve sozinho para o público estrito desta story; comparar os valores normalizados explicitamente. [Source: `src/lib/roles.ts`]
- A central hoje marca itens como lidos após abrir e oferece remoção em suas fontes. Para esta fila derivada, leitura é apenas estado de apresentação: a fonte de verdade continua sendo a elegibilidade persistida do AC 1. [Source: `src/components/layout/CentralNotificacoesPainel.tsx#marcarTodasLidas`]

### Status e filtro

- Os status expostos atualmente na edição são exatamente: **Em Andamento**, **Deferido**, **Stand By**, **Cancelado - Indeferimento** e **Cancelado - Troca de Empresa**. [Source: `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx#Status-Atual`]
- `ModalFiltros` classifica Status como texto e por isso renderiza Z-A/A-Z; `page.tsx` mantém apenas `ordenacao`, então a correção requer estado separado para filtragem. [Source: `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalFiltros.tsx`; `src/app/PainelAlpha/CadastroClientes/page.tsx`]

### Decisões e limites

- [AUTO-DECISION] Como interpretar “10 dias”? → 10 dias corridos, com elegibilidade em `agora >= ultimoCs + 10 dias` (reason: o pedido não menciona dias úteis e o dado persistido é um `DateTime`).
- [AUTO-DECISION] Como tratar empresas com múltiplos serviços? → Calcular a pendência por `ClienteServico` e identificar empresa + serviço no modal (reason: status e histórico de CS pertencem ao serviço; atualizar só por CNPJ poderia gravar no registro errado).
- [AUTO-DECISION] Como representar o alerta no sino? → Um item agregado com a contagem atual que abre a lista completa (reason: o pedido define que clicar no alerta abre um modal com todas as empresas).
- Não há alteração estrutural, migration, backfill ou mutação em massa nesta story; a política Vault não é acionada durante a implementação prevista. Se o executor optar por mudar schema, deve interromper e cumprir integralmente o gate Vault antes de qualquer alteração.
- `accumulated-context.md`, a arquitetura sharded configurada e `.aiox/gotchas.json` não existem neste checkout. O contexto foi derivado do pedido atual, dos contratos reais acima e das stories de CS & NPS/notificações já presentes.

### Arquivos previstos

- `src/lib/cs-nps/alertas-ultimo-cs.ts` — regra temporal pura e DTO/constantes compartilhados.
- `src/actions/Clientes.ts` — consulta autorizada das pendências e reutilização do salvamento existente.
- `src/app/PainelAlpha/CadastroClientes/page.tsx` — destaque da data e aplicação do filtro de status.
- `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalFiltros.tsx` — opções reais do filtro Status.
- `src/components/cs-nps/CsNpsPendenciasModal.tsx` — lista global e modal enxuto de Novo CS.
- `src/components/layout/CentralNotificacoesPainel.tsx` — item agregado de CS & NPS.
- `src/components/layout/PainelLayoutClient.tsx` — carga autorizada, reconciliação e montagem do modal global.
- `tests/cs-nps/alertas-ultimo-cs.test.ts` — regra temporal, query/autorização e salvamento/reconciliação.
- `tests/cs-nps/alertas-ultimo-cs-ui.test.ts` — integração da central, modais, destaque e filtro.
- Não requer variável de ambiente nova.

## Testing

- **Framework:** Vitest, seguindo `tests/cs-nps/` e os testes estruturais da central em `tests/chamados/central-notificacoes-painel.test.ts`.
- **Unitário:** relógio fixo; `9d 23:59:59`, fronteira exata e `10d+`; maior data entre logs; inválido/ausente; status elegíveis e não elegíveis.
- **Server-side:** payload mínimo e serializável; TI/RH permitidos; Admin/CEO/outros negados; consulta filtra `Em Andamento` e exige histórico.
- **UI/integração:** vermelho + texto acessível; item/contador no sino; lista completa; seleção do `ClienteServico.id`; cancelar; salvar; retorno e remoção reconciliada; erro mantém item.
- **Filtro:** cinco status canônicos, limpar filtro, combinação com busca e manutenção das ordenações existentes.
- **Regressão:** demais fontes da central global, cadastro/edição completa de CS, agrupamento por CNPJ e filtros não relacionados continuam funcionando.

## 🤖 CodeRabbit Integration

### Story Type Analysis

- **Tipo primário:** Frontend
- **Tipos secundários:** Server Action, autorização e integração
- **Complexidade:** Alta — cruza o shell global, um módulo executado em iframe, cálculo temporal, autorização estrita e dois modais encadeados.

### Specialized Agent Assignment

- **Agente primário:** `@dev`
- **Quality gate:** `@ux-design-expert`
- **Apoio:** `@qa` para fronteiras temporais/autorização e `@architect` para integração shell/iframe.

### Quality Gate Tasks

- [ ] **Pre-Commit (`@dev`):** executar CodeRabbit nas alterações não commitadas, testes focados e gates locais antes de marcar a story completa.
- [ ] **Pre-PR (`@devops`):** revisar compatibilidade com `main`, autorização, central global e regressões do CS & NPS antes de criar PR.
- **Pre-Deployment:** não aplicável; a story não define mudança de infraestrutura.

### Self-Healing Configuration

- **Modo:** light (`@dev`), máximo de 2 iterações, 15 minutos, filtro CRITICAL.
- **Comportamento:** CRITICAL recebe tentativa automática de correção; HIGH é documentado; MEDIUM e LOW ficam fora do auto-fix desta etapa.

### Focus Areas

- Autorização server-side exclusiva para TI/RH, sem bypass Admin/CEO.
- Consistência da fronteira temporal entre tabela, sino e modal.
- Identidade correta de `ClienteServico` em empresas com múltiplos serviços.
- Acessibilidade, foco e empilhamento dos dois modais no shell externo.
- Limpeza de timers/listeners, ausência de consultas sobrepostas e preservação das demais notificações.
- Reconciliação após persistência sem remoção otimista falsa.

## Story Draft Checklist Validation

| Categoria | Status | Observação |
|---|---|---|
| Goal & Context Clarity | PASS | Público, regra de 10 dias, fluxo completo e valor operacional estão explícitos. |
| Technical Implementation Guidance | PASS | Modelos, regra temporal, autorização, shell, modais, filtro e arquivos principais foram identificados. |
| Reference Effectiveness | PASS | As referências apontam para contratos reais do código; ausências documentais estão registradas. |
| Self-Containment Assessment | PASS | Critérios, roles, cinco status, múltiplos serviços, leitura versus resolução e erros estão definidos. |
| Testing Guidance | PASS | Fronteiras, autorização, integração, acessibilidade, falhas e regressões possuem cenários mensuráveis. |
| CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e focos de revisão estão preenchidos. |

**Final Assessment:** READY — clareza 9/10; sem bloqueio funcional e sem necessidade de schema/migration. A story pode seguir para desenvolvimento.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-09-15 | 1.0.0 | Story criada a partir do pedido do usuário, validada e aprovada para desenvolvimento. | River (SM) |
| 2026-09-15 | 1.1.0 | Development started (yolo mode) — Status: Ready → InProgress. | @dev |

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `npx vitest run tests/cs-nps/alertas-ultimo-cs.test.ts tests/cs-nps/alertas-ultimo-cs-ui.test.ts tests/chamados/central-notificacoes-painel.test.ts tests/cs-nps/clientes-logs.test.ts --coverage=false` — 34/34 aprovados.
- ESLint focado nos 11 arquivos TypeScript/TSX alterados — aprovado sem erros ou avisos.
- `npm run build` — aprovado, 78 páginas geradas; avisos preexistentes do `pdfjs-polyfill` não bloquearam.
- `npm test` — 3.085 aprovados, 1 todo e 18 falhas preexistentes fora do escopo, em 10 arquivos de Alpha SEO, BPM, Parceiros, Gerador de Documentos e PPTX.
- `npm run typecheck` — bloqueado por erros preexistentes em Exclusão Fiscal, Gerador de Documentos, Radar e `node:sqlite`; nenhum erro no recorte desta story após correção.
- `NODE_OPTIONS=--max-old-space-size=8192 npm run lint -- --quiet` — bloqueado por 10.103 erros preexistentes, principalmente porque o lint global inclui `.aiox-core` e `.agents`; lint focado aprovado.
- CodeRabbit CLI indisponível; fallback manual registrado em `docs/qa/coderabbit-reports/story-cs-nps-alertas-ultimo-cs-dez-dias.md`.

### Completion Notes List

- Regra única calcula o último CS válido e a fronteira inclusiva de 10 dias corridos, sem usar o campo legado `ultimoCs`.
- Consulta e salvamento do fluxo global negam Admin/CEO e autorizam exclusivamente TI/RH por role normalizada.
- Sino global mostra um único item agregado e abre a lista de empresa + serviço; a pendência não pode ser descartada sem atualização persistida.
- Modal rápido salva somente sentimento, data e relato do CS, volta à lista e força reconciliação nova mesmo quando já havia consulta em andamento.
- Filtro Status agora é independente da ordenação e oferece os cinco status reais, com limpeza explícita.
- Nenhuma alteração de schema, migration, seed, backfill ou variável de ambiente foi realizada; Vault não foi necessário.
- A implementação está funcional e o build passa, mas a story permanece `InProgress` porque os gates globais de lint, typecheck e regressão já estão quebrados por itens fora deste escopo.

### File List

- `src/lib/cs-nps/alertas-ultimo-cs.ts` — criado.
- `src/actions/Clientes.ts` — modificado.
- `src/store/useCsNpsNotificacoes.ts` — criado.
- `src/hooks/useCsNpsNotifications.ts` — criado.
- `src/components/cs-nps/CsNpsPendenciasModal.tsx` — criado.
- `src/components/layout/CentralNotificacoesPainel.tsx` — modificado.
- `src/components/layout/PainelLayoutClient.tsx` — modificado.
- `src/app/PainelAlpha/CadastroClientes/page.tsx` — modificado.
- `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalFiltros.tsx` — modificado.
- `tests/cs-nps/alertas-ultimo-cs.test.ts` — criado.
- `tests/cs-nps/alertas-ultimo-cs-ui.test.ts` — criado.
- `docs/qa/coderabbit-reports/story-cs-nps-alertas-ultimo-cs-dez-dias.md` — criado.
- `docs/stories/story-cs-nps-alertas-ultimo-cs-dez-dias.md` — criado/modificado.

## QA Results

_A preencher pelo agente de QA._
