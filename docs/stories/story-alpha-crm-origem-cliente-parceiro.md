# Story: Padronizar origem do cliente e seleção de parceiro no Alpha CRM

**ID:** STORY-ALPHA-CRM-ORIGEM-CLIENTE-PARCEIRO
**Status:** Ready for Review
**Origem:** Solicitação do usuário em 2026-10-20.

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: [lint, typecheck, tests, review]
```

## Story

**Como** usuário do Painel Alpha, **quero** que todos os campos configurados como `Origem do cliente` no CRM sigam a origem do lead usada em Metas e no cadastro de clientes e exibam o seletor de parceiro ao escolher indicação de parceiro, **para** registrar a procedência do cliente de forma consistente e identificar quem indicou.

## Contexto e referências

O pedido define a correção diretamente; não foi fornecido epic específico. O formulário de Metas já apresenta `Indicação de parceiros`, armazena `Indicação Parceiro` e usa `SeletorParceiroPesquisavel`. Esse componente permite pesquisar parceiro, nome fantasia e representante, com tratamento de acentos, seleção, limpeza e estados de carregamento/vazio. A story `docs/stories/story-metas-parceiro-nao-cadastrado.md`, seções Acceptance Criteria e Dev Agent Record, documenta esse comportamento.

Os catálogos existentes ainda diferem: CadastroClientes inclui `China`, `Discadora` e `Prospecção ativa (Log Comex)`; Metas inclui `WhatsApp`, `Instagram`, `Orgânico`, `Outro` e a opção de prospecção ativa com detalhe. A padronização deve reconciliar essas fontes sem descartar valores já utilizados.

Fontes verificadas:

- `src/app/PainelAlpha/CadastroClientes/ModalCadastro/origens-lead.ts`: `ORIGENS_LEAD_PADRAO`.
- `src/components/comercial/ModalGerenciamentoLeads.tsx`: `CANAIS_AQUISICAO`, bloco Canal de Aquisição e seleção condicional de parceiro.
- `src/lib/comercial/parceiro-nao-cadastrado.ts`: valores e rótulos compartilhados das indicações.
- `src/components/comercial/SeletorParceiroPesquisavel.tsx`: componente existente de seleção pesquisável.
- `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx`: renderizador reutilizado nos campos da etapa atual e da próxima etapa.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`: edição, rascunho e salvamento de campos dinâmicos.
- `src/actions/bpm/Campos.ts`: configuração de campos, opções estruturadas e permissões.

`accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados. A coerência entre stories foi conferida pelas referências acima e pela story `story-metas-empresa-em-constituicao.md`, que registra alterações recentes no mesmo formulário de Metas e exige preservação dos demais comportamentos. As alterações concorrentes existentes no repositório devem ser preservadas.

## Acceptance Criteria

1. Todos os pontos de criação e edição do CRM que renderizam um campo configurado como `Origem do cliente` apresentam o catálogo de origens alinhado ao usado por Metas e CadastroClientes, incluindo formulários de etapa atual e próxima etapa quando o campo estiver presente.
2. As opções e os valores canônicos são definidos de forma coerente entre os três módulos, preservando as origens existentes e os valores legados já gravados; a mudança não apaga silenciosamente um valor ao abrir ou salvar um registro.
3. Ao selecionar a opção correspondente a parceiro (`Indicação Parceiro`, apresentada de forma consistente com `Indicação de parceiros` de Metas), aparece o seletor pesquisável dos parceiros cadastrados, com o mesmo comportamento de pesquisa e seleção de Metas.
4. A origem e o parceiro escolhido são salvos pelo fluxo normal do CRM e reapresentados corretamente ao reabrir o card/formulário. A seleção não se perde durante o salvamento ou a navegação entre etapas.
5. Ao trocar a origem para uma opção que não corresponda a parceiro, o seletor é ocultado e o parceiro anterior não permanece como indicação ativa indevida. Campos desabilitados ou somente leitura continuam respeitando suas permissões.
6. Campos com nomes/finalidades diferentes mantêm seu comportamento. Os fluxos existentes de CadastroClientes e Metas, incluindo origens específicas, `Outro`, prospecção ativa e parceiro não cadastrado, continuam funcionando.
7. O comportamento é implementado com os mecanismos existentes de armazenamento e CRUD. Qualquer necessidade identificada de migration, alteração estrutural ou mutação em massa fica sujeita ao relatório Vault, backup verificado e confirmação específica previstos no `AGENTS.md`, antes da execução.

## Tasks / Subtasks

- [x] Inventariar todos os renderizadores e caminhos de criação/edição dos campos de origem no CRM, incluindo origem legada e configurações já existentes (AC 1, 2, 6).
- [x] Reconciliar e reutilizar as definições de origem entre CRM, Metas e CadastroClientes, mantendo compatibilidade com valores existentes (AC 1, 2, 6).
- [x] Reutilizar o seletor pesquisável de parceiros no campo de origem do CRM e preservar estados de leitura, carregamento e ausência de opções (AC 3, 5).
- [x] Integrar a escolha de origem/parceiro ao salvamento, leitura e troca de etapas, com tratamento da alternância para outra origem (AC 4, 5).
- [x] Cobrir o comportamento com testes de domínio e interação, além da persistência pelo caminho efetivamente adotado (AC 1–6).
- [x] Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`; registrar resultados e eventuais limitações preexistentes.
- [x] Atualizar checklist, File List efetiva e evidências de validação antes da conclusão.

## Dev Notes

Não foi encontrada orientação específica deste fluxo nos arquivos de arquitetura de `docs/architecture/`. O contexto técnico desta correção está nas fontes de código e stories citadas, sem introdução de bibliotecas ou contratos externos novos.

- `CampoBpmInput` recebe um `CampoBpmEditavel` com `nome`, `chave`, `tipo`, opções, metadados de fonte e flags de leitura, além de `value: string` e `onChange(value: string)`. Verificar a representação de origem/parceiro escolhida contra validação, visualização e consumidores dos valores; um ajuste somente visual não satisfaz o AC 4. [Source: `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx#CampoBpmEditavel`]
- `PainelCamposEtapaAtual` mantém rascunhos, revisão e bases confirmadas dos campos; preservar esses mecanismos ao integrar a origem. [Source: `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx#PainelCamposEtapaAtual`]
- Metas carrega parceiros por `listarParceirosSimples` e mantém `indicadoPorParceiroId` separado do canal. A autorização e a representação do vínculo devem ser conferidas no contexto do CRM antes de reutilizar a action. [Source: `src/components/comercial/ModalGerenciamentoLeads.tsx#ModalGerenciamentoLeads`]
- As opções de cadastro de clientes são usadas tanto no cadastro quanto nos dados de contratos. Considerar ambos os consumidores ao compartilhar catálogo. [Source: `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modal.tsx`; `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx`]
- [AUTO-DECISION] Criar epic ou sincronização externa? → Somente a story local solicitada pelo responsável; não há epic ou integração externa necessária ao pedido.
- [AUTO-DECISION] Qual lista descartar ao unificar origens? → Nenhuma lista será descartada silenciosamente; reconciliar opções preservando compatibilidade, pois o usuário pediu igualdade entre módulos que hoje diferem.
- [AUTO-DECISION] Levar também o cadastro de parceiro pendente para CRM? → Fora do escopo obrigatório; o pedido especifica selecionar parceiro, e o fluxo pendente existente em Metas deve ser preservado.

### Testing

Usar Vitest e o ambiente React já disponíveis no projeto, com mocks de actions e sem alterar dados reais. Cobrir:

- catálogo apresentado pelo CRM e coerência com as fontes compartilhadas;
- reconhecimento do campo configurado, incluindo representação legada pertinente, sem alterar campos não relacionados;
- seleção de indicação de parceiro, abertura do seletor, pesquisa e escolha;
- gravação e reabertura com origem e parceiro preservados;
- troca de origem, limpeza/desativação do vínculo e modo somente leitura;
- caminhos da etapa atual, próxima etapa e criação em que o campo apareça;
- regressão dos comportamentos existentes de Metas e CadastroClientes.

## 🤖 CodeRabbit Integration

**Story Type Analysis:** Frontend; secundário integração interna/persistência; complexidade média.

**Specialized Agent Assignment:** `@dev` como executor; `@ux-design-expert` para consistência e acessibilidade do seletor; `@qa` para regressão.

**Quality Gate Tasks:** Pre-Commit por `@dev` antes da conclusão. Pre-PR por `@devops` apenas se houver solicitação posterior de PR; Pre-Deployment não se aplica ao escopo atual. Registrar indisponibilidade da CLI conforme `skip_if_not_installed` da configuração.

**Self-Healing Configuration:** `@dev`, modo light, até 2 iterações/15 minutos; CRITICAL corrigido, HIGH documentado, MEDIUM/LOW fora da correção automática. Revisão `@qa`, quando executada, usa modo full, até 3 iterações/30 minutos, CRITICAL/HIGH corrigidos.

**Focus Areas:** catálogo coerente, valores legados, persistência de parceiro, permissões existentes, rascunhos/salvamento e pesquisa acessível.

## Dev Agent Record

### File List inicial

Arquivos efetivamente criados ou alterados nesta implementação (preservadas alterações concorrentes):

- `docs/stories/story-alpha-crm-origem-cliente-parceiro.md`.
- `src/lib/comercial/origens-lead.ts`.
- `src/app/PainelAlpha/CadastroClientes/ModalCadastro/origens-lead.ts`.
- `src/components/comercial/ModalGerenciamentoLeads.tsx`.
- `src/lib/bpm/origem-cliente.ts`.
- `src/lib/bpm/origem-cliente-server.ts`.
- `src/lib/bpm/campos-dinamicos.ts`.
- `src/lib/bpm/requisitos-etapa.ts`.
- `src/lib/bpm/requisitos-etapa-server.ts`.
- `src/lib/bpm/transicao-command.ts`.
- `src/lib/validations/bpm.ts`.
- `src/actions/bpm/Cards.ts`.
- `src/app/PainelAlpha/AlphaCRM/CampoOrigemCliente.tsx`.
- `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx`.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx`.
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx`.
- `tests/bpm/origem-cliente.test.ts`.
- `tests/bpm/origem-cliente-react.test.ts`.
- `tests/bpm/edicao-campos-card.test.ts`.
- `tests/bpm/card-modal-integration.test.ts`.

Componente reutilizado sem alteração: `src/components/comercial/SeletorParceiroPesquisavel.tsx`.

### Resultados

- Catálogo único reúne as origens existentes de Metas e CadastroClientes; CRM aceita essas opções mesmo em campos com catálogo legado.
- Campo central e criação de lead reutilizam seleção pesquisável; origem de parceiro exibe a seleção, troca de canal limpa o parceiro e modo somente leitura permanece bloqueado.
- Rascunho composto preserva escolha, retry e detecção de concorrência. Antes das actions, a UI separa texto da origem e payload tipado de parceiro; nenhum JSON de rascunho é persistido no campo.
- `AtualizarCardBpm` e transição validam campo autorizado e parceiro existente; origem e indicação são gravadas na mesma transação. Prévia de transição apenas lê. Reabertura carrega a indicação ativa pelo vínculo explícito ao card.
- Troca de parceiro/origem preserva o registro anterior como `DESVINCULADA`, sem deixá-lo em contagens ativas. O servidor também deriva limpeza/preservação se clientes antigos omitirem o argumento novo.
- Nenhuma migration, alteração estrutural ou mutação de dados reais executada.
- `npm test`: **657 arquivos aprovados, 4.969 testes aprovados, 4 ignorados e 1 todo**. Inclui testes de seleção/hidratação, salvamento manual, troca só de parceiro, validação e payload omitido. Log: `/tmp/alpha-origem-tests-final.log`.
- `npm run lint`: **0 erros**, 1.193 warnings existentes no repositório. Lint escopado dos arquivos desta implementação também passou. Logs: `/tmp/alpha-origem-lint.log`, `/tmp/alpha-origem-lint-final.log`.
- `npm run typecheck`: bloqueado por TS2307 em `database-backups/pre-change/rd-historico-autoria-2026-10-20/code-baseline/RdStationHistorico.ts:7` (`../../../auth`), fora dos arquivos alterados. Nenhum erro dos arquivos da implementação nessa execução. Log: `/tmp/alpha-origem-typecheck-final.log`.
- `npm run build`: Prisma Client e bundle do player gerados; compilação webpack do servidor concluiu com warnings de `pdfjs-polyfill.ts`, mas o worker terminou com `SIGTERM` antes de completar o build. Duas tentativas tiveram o mesmo resultado; a segunda ocorreu após a suíte de testes. Causa do sinal não determinada. Log: `/tmp/alpha-origem-build-final.log`.
- CodeRabbit CLI não instalado neste ambiente. Revisão independente AIOX QA: **APPROVED**, após corrigir status da indicação anterior e consistência do payload omitido; 60 testes focados aprovados na revisão.

### Validação do commit isolado para staging

- Escopo isolado sobre `origin/staging` (`0afe83b4`): somente os 21 arquivos desta story; alterações concorrentes da área de trabalho ficaram fora do commit.
- `npm run lint`: aprovado, 0 erros e 1.193 warnings.
- `npm test`: 631 arquivos aprovados, 4.711 testes aprovados; 4 arquivos com falhas preexistentes (6 testes e 1 falha de importação), 1 arquivo ignorado. As mesmas falhas foram reproduzidas ao restaurar os arquivos alterados para a base `0afe83b4`: Builder/embed, regras de Em Tratativa, layout do CardModal e importação `next/server` no teste de arquivamento. Uma falha inicial adicional de fixture foi resolvida criando o diretório local `.cache`, sem alterar código.
- `npm run build`: geração do Prisma Client e do player concluída; worker Next.js encerrado com `SIGTERM`, sem build completo. Log: `/tmp/origem-isolated-build.log`.
- `npm run typecheck`: aprovado após gerar o bundle do player, em execução separada. Log: `/tmp/origem-isolated-typecheck-solo.log`.
- Evidências locais: `/tmp/origem-isolated-tests-final.log`, `/tmp/origem-isolated-baseline-tests.log`, `/tmp/origem-isolated-lint.log`.
- Publicação em `staging` solicitada explicitamente pelo usuário após o relato das limitações anteriores; não inclui migrações nem alterações em banco.

## Validação do draft

Checklist aplicado: `.aiox-core/product/checklists/story-draft-checklist.md`.

| Categoria | Resultado | Observação |
| --- | --- | --- |
| Objetivo e contexto | PASS | Pedido direto e escopo CRM explicitados |
| Orientação técnica | PASS | Renderizadores, catálogo e salvamento referenciados |
| Referências | PASS | Fontes locais verificadas e resumidas |
| Autossuficiência | PASS | Divergência entre catálogos e limites registrados |
| Testes | PASS | Cenários funcionais e regressão definidos |
| CodeRabbit | PASS | Agentes, gates, self-healing e focos definidos |

**Resultado:** READY para implementação; clareza 9/10. A representação final do vínculo no CRM deve ser confirmada pelo executor durante a integração com os contratos existentes. Nenhuma dependência externa bloqueante identificada na preparação. A implementação posterior está registrada acima como `Ready for Review`.

## Change Log

| Data | Versão | Alteração | Autor |
| --- | --- | --- | --- |
| 2026-10-20 | 1.0 | Story criada a partir do pedido, fontes verificadas e checklist de draft aplicado | River (SM) |

| 2026-10-20 | 1.1 | Catálogo compartilhado, seleção e persistência atômica de parceiro; testes e revisão QA concluídos | Codex |
