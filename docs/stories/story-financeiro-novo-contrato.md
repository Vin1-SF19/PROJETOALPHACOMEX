# Story — Financeiro: Novo contrato (Solicitação de Contrato)

## Status

In Progress — código implementado e configuração publicada no Turso após aprovação específica e backup verificado. Pendente smoke visual do aplicativo com a versão atualizada.

## Story

**Como** integrante do Financeiro, **quero** receber o card após o fechamento da negociação, completar dados cadastrais e da contratação, calcular retenções e preparar o pagamento, **para** elaborar o contrato com dados válidos e valor efetivamente negociado.

**Escopo:** somente a primeira etapa do pipeline Financeiro, chamada `Solicitação de Contrato` no inventário de 24/09/2026 e `Novo contrato` no pedido. O destino do avanço é `Elaboração do Contrato`. As demais etapas permanecem fora desta story, exceto a condição explícita para o estado `Aguardando pagamento`.

## Campos solicitados

| Grupo | Campos |
| --- | --- |
| Dados cadastrais | CNPJ; Razão Social; Rua; Número; Complemento; Bairro; CEP; Município; Estado; E-mail; Regime tributário do cliente |
| Dados da contratação | Serviço contratado; Valor bruto do contrato; Forma de pagamento; Condição negociada; Vendedor responsável; Origem do cliente; Parceiro responsável, quando houver |
| Campos financeiros | Regime tributário do prestador; IRRF aplicável; Alíquota IRRF; Valor IRRF; CSRF aplicável; Alíquota CSRF; Valor CSRF; Total de retenções; Valor líquido para pagamento; Vencimento; Link/dados para pagamento |

Os campos necessários devem existir e aparecer no formulário publicado da etapa por meio do cadastro/configuração editável de campos e de sua composição, inclusive os financeiros que hoje aparecem em etapas posteriores. Metadados editáveis devem definir rótulo, tipo, opções, ordem, visibilidade e obrigatoriedade estática. Regras de cálculo e condicionais dependem do motor, que deve referenciar chaves estáveis de campos configurados; o texto exibido no formulário não deve ser a identidade da regra. Preservar valores históricos ao reconciliar campos legados com campos ativos, sem criar duas versões editáveis do mesmo dado.

## Critérios de aceite

1. [ ] O card entra nesta etapa após o fechamento da negociação no pipeline comercial `Revisão de Radar`, vinculado ao card de origem. Todas as informações preenchíveis desta etapa que já existirem no card comercial são trazidas para o Financeiro por mapeamento de campos configurável, preservando sua identidade e o valor efetivamente negociado. Dados ausentes permanecem vazios e editáveis. Repetir o gatilho não cria card Financeiro ativo duplicado nem sobrescreve correções manuais feitas no card Financeiro.
2. [ ] O formulário publicado da etapa contém todos os campos da tabela nos grupos indicados, com tipos/opções coerentes, configuráveis pelo administrador. `Parceiro responsável` é exigido quando a origem envolver parceiro vinculado ou a opção selecionada for explicitamente `Parceiro`; a opção `Indicação` isolada não exige parceiro. `Complemento` é opcional.
3. [ ] Antes de avançar para `Elaboração do Contrato`, são obrigatórios: CNPJ, Razão Social, Rua, Número, Bairro, CEP, Município, Estado, E-mail, Regime tributário do cliente, Serviço contratado, Valor bruto do contrato, Forma de pagamento, Condição negociada, Vendedor responsável e Origem do cliente. O campo `Parceiro responsável` também é obrigatório sob a condição do item 2. O avanço bloqueado devolve os nomes de todos os campos pendentes.
4. [ ] CNPJ deve ser válido; E-mail deve ser válido; CEP deve ser válido; Estado deve ser uma UF válida; Valor bruto do contrato deve ser maior que zero; Regime tributário e Forma de pagamento devem ser opções selecionadas válidas. A validação ocorre no servidor também, inclusive para valores existentes no card e novos valores enviados no movimento.
5. [ ] O valor bruto usado no contrato e no cálculo reflete o valor efetivamente negociado. O campo ativo publicado satisfaz o validador de avanço e alimenta o cálculo, sem exigir uma chave legada inativa/invisível.
6. [ ] Ao preencher CNPJ válido, consultar a API de CNPJ existente e preencher, quando disponíveis, Razão Social, Rua, Número, Complemento, Bairro, CEP, Município e Estado. Falha, indisponibilidade ou dado ausente na API não substitui valor informado pelo usuário nem impede preenchimento manual. O regime tributário para retenções não é presumido a partir da consulta quando a fonte não é confiável para essa finalidade.
7. [ ] Com regime tributário e Valor bruto do contrato disponíveis, a equipe informa no formulário `IRRF aplicável`, `CSRF aplicável` e suas alíquotas; o sistema calcula Valor IRRF, Valor CSRF, Total de retenções e Valor líquido para pagamento e registra memória de cálculo no card. `Total de retenções = Valor IRRF + Valor CSRF`; `Valor líquido = Valor bruto - Total de retenções`. Nenhum regime, indicador ou alíquota é presumido da consulta CNPJ. O cadastro antigo de regras financeiras foi removido e não participa desta etapa.
8. [ ] Se `IRRF aplicável = Sim`, a alíquota IRRF informada é obrigatória e válida, e o Valor IRRF calculado deve estar disponível; se `CSRF aplicável = Sim`, o mesmo vale para CSRF. Alíquota ausente não vira zero implicitamente. Quando a retenção não se aplica, seu valor no cálculo é zero. Recalcular após alteração de valor bruto, regime, indicador ou alíquota, mantendo memória auditável do resultado usado.
9. [ ] Antes de registrar dados para pagamento, aplicar o cálculo do item 7. Depois de calculado o líquido, a equipe preenche `Vencimento` e `Link/dados para pagamento` no formulário; o sistema disponibiliza essas informações para envio ao cliente. Ambos devem estar preenchidos antes de colocar o status financeiro em `Aguardando pagamento`; sem esses dados, o status não muda. Não introduzir integração de cobrança ou envio automático ao cliente sem contrato existente e requisito próprio.
10. [ ] Ao tentar avançar, todos os requisitos dos itens 2 a 5 são avaliados na transição real, sem salto de etapas. Com tudo válido, liberar `Elaboração do Contrato`; com pendências, impedir a alteração e informar os campos específicos. Salvar o formulário e mover o card usam a mesma identidade de campo configurado.
11. [ ] Administrador consegue ajustar os campos, opções, apresentação e obrigatoriedade configurável no editor de formulário, publicar e ver o resultado no card. A publicação preserva a compatibilidade dos cards existentes e o histórico de valores.

## Tarefas / checklist de execução

- [x] Inventariar somente leitura a configuração publicada desta etapa, campos ativos/inativos, chaves canônicas, opções e fluxo real de entrada por fechamento no `Revisão de Radar` (AC 1, 2, 5, 7).
- [x] Configurar mapeamentos do valor negociado e regime tributário comercial, mais cópia dos campos CARD disponíveis na origem, sem sobrescrever edição financeira (AC 1, 5).
- [x] Reconciliar `Valor acordado no contrato` com o campo CARD `Valor bruto do contrato`; usar campos ativos de forma de pagamento e origem, e mapear o regime comercial (AC 2, 5, 11).
- [x] Publicar composição configurável da etapa, com 31 campos em três grupos e opção de status, sem criar coluna/tabela (AC 2, 11).
- [x] Implementar validações e pendências nominais no servidor para o avanço (AC 3, 4, 8, 10).
- [x] Integrar consulta CNPJ ao formulário, preenchendo somente dados vazios e editáveis, sem inferir regime (AC 6).
- [x] Implementar cálculo com indicadores/alíquotas manuais, memória no card e pré-condições de vencimento/dados de pagamento para o status (AC 7 a 9).
- [x] Executar testes de validação, cálculo, cópia, recálculo com campos globais, formulário e automação; o índice isolado do commit passou em 510 arquivos/3.828 testes. Conferência visual autenticada permanece pendente (AC 1 a 11).
- [x] Rodar `npm run lint` (zero erros; 1.192 avisos no índice isolado), `npm run typecheck`, `npm test` e `npm run build`; todos passaram no índice isolado. Atualizar checklist e File List.

## Dependências e limites de decisão

- **Story base:** `docs/stories/story-rm-2026-cb8371-pipeline-financeiro.md` define seis etapas, transição sem salto, cálculo no servidor e memória auditável. `docs/stories/story-rm-2026-15f807-blueprint.md` documenta a entrada após `Fechado` e a criação vinculada.
- **Configuração observada:** `docs/reports/crm-campos-etapas-2026-09-24.csv` registra na etapa ativa `Valor acordado no contrato` (`alpha.valor.acordado.no.contrato`) e `Forma de pagamento` (`alpha.forma.de.pagamento`); `Valor bruto do contrato` (`alpha.legacy.valor.bruto.contrato`) está inativo. Também há `Canal de origem` ativo e `Origem do cliente` legado inativo. O diagnóstico anterior apontou que o validador ainda exige chaves legadas. A implementação deve validar este estado antes da alteração.
- **Pontos de integração:** `src/lib/bpm/pipeline-financeiro.ts` contém validações e cálculo; `src/lib/bpm/transicao-command.ts` monta o contexto de avanço; `src/actions/bpm/PipelineFinanceiro.ts` e `src/actions/bpm/Campos.ts` operam configuração; `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx` é o editor; `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx` renderiza a etapa; `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NovoCardModal.tsx` já consulta `/api/ReceitaFederal` no cadastro de card. Reutilizar contratos existentes após conferi-los.
- **Decisões operacionais:** a origem é o card comercial `Revisão de Radar`; campos GLOBAL personalizados já são compartilhados pela identidade do cliente, e o valor negociado é copiado para campo CARD próprio do Financeiro. Os demais campos CARD disponíveis usam a mesma identidade ou mapeamento configurado. IRRF/CSRF e alíquotas são informados pela equipe; dados de pagamento também são preenchidos pela equipe. O módulo de regras financeiras foi removido. A opção `Aguardando pagamento` será cadastrada no status financeiro. `[AUTO-DECISION]` A sincronização na criação não sobrescreve edição financeira manual.
- **Fronteira do banco:** alterar cadastro de campos, opções, composição/formulário, regras ou dados em massa em produção é mutação protegida pelo AGENTS.md. Antes de qualquer aplicação, acionar Vault, informar ambiente/banco, comandos, impacto, riscos, alternativa não destrutiva e rollback, obter backup completo verificado com até 48 horas em `database-backups/pre-change/` e confirmação humana explícita e específica. Nenhum desses passos foi executado ao redigir esta story. Preparação de código, leitura e testes locais não exigem esse checkpoint.
- **Contexto acumulado:** `accumulated-context.md` e `.aiox/gotchas.json` não existem nesta worktree; a coerência foi conferida pelas stories relacionadas, Constitution, inventário e código atual. `[AUTO-DECISION]` Não criar esses artefatos nem presumir conteúdo ausente.

## Testes de aceite

1. Card vindo de `Fechado` no `Revisão de Radar` abre na primeira etapa uma vez com valores preenchíveis disponíveis mapeados; valores ausentes ficam vazios/editáveis; repetição não duplica nem sobrescreve edição manual. O editor publica a composição e o card a renderiza.
2. Remover cada obrigatório, enviar valor inválido ou escolher origem com parceiro sem parceiro: avanço negado com lista nominal, sem mudança de etapa.
3. Card com campos completos, inclusive valor bruto ativo > 0 e opções válidas: avanço para `Elaboração do Contrato` ocorre uma vez.
4. API de CNPJ retorna dados parciais ou falha: campos disponíveis são preenchidos, os demais permanecem editáveis; regime para retenções não é inferido da consulta.
5. Equipe informa casos IRRF/CSRF Sim/Não e alíquotas; valores e memória conferem com as fórmulas, sem transformar alíquota ausente em zero.
6. Sem vencimento ou dados de pagamento preenchidos pela equipe, `Aguardando pagamento` é negado; após cálculo e preenchimento, status e informações para envio ficam disponíveis.
7. Valor bruto/regime alterado: recálculo e memória atualizados; cards antigos continuam legíveis e usam a chave ativa reconciliada.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** principal Integração; secundários API, Frontend e configuração de dados; complexidade alta pela transição e retenções.
- **Specialized Agents:** @dev implementa; @architect valida identidade de campos e fonte das regras; @qa revisa cenários de transição; Vault atua antes de qualquer mutação protegida; @github-devops atua em PR/deploy.
- **Quality Gates:** Pre-Commit (@dev) com lint, typecheck, testes, build e revisão; Pre-PR (@github-devops) com compatibilidade de cards existentes; Pre-Deployment (@github-devops) com configuração publicada, backup/rollback quando aplicável.
- **Self-Healing (Story 6.3.3):** @dev light, até 2 iterações/15 min, auto-corrigir CRITICAL e documentar HIGH; @qa full, até 3 iterações/30 min, tratar CRITICAL/HIGH e documentar MEDIUM; @github-devops check, reportar sem correção automática. O gate do repositório mantém `coderabbit_integration.self_healing` configurado em full; aplicar o gate real conforme a execução.
- **Focus Areas:** identidade canônica e campos legados; validação no servidor; cálculo/precisão e memória; falha de API; idempotência; dados históricos; acessibilidade do formulário.

## Dev Agent Record

### File List

- `docs/stories/story-financeiro-novo-contrato.md` — critérios, checklist e registro da implementação.
- `src/lib/bpm/pipeline-financeiro.ts`, `src/lib/bpm/transicao-command.ts` — validação, cálculo e transição.
- `src/lib/bpm/copiar-campos-card-vinculado.ts`, `src/lib/bpm/novo-contrato-financeiro-server.ts`, `src/lib/bpm/automacoes.ts`, `src/lib/bpm/automacoes/central-runtime.ts` — cópia e recálculo.
- `src/actions/bpm/Cards.ts`, `src/actions/bpm/ConsultaCnpjFinanceiro.ts`, `src/lib/cnpj/receita-federal.ts` — persistência e consulta CNPJ.
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`, `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx` — formulário e administração.
- `scripts/bpm-novo-contrato-config.mjs`, `scripts/turso-backup.mjs` — plano protegido de configuração e backup.
- `scripts/verify-novo-contrato-config.mjs` — verificação somente leitura da publicação.
- `docs/reports/financeiro-novo-contrato-publicacao.md` — relatório Vault e plano de aplicação/reversão.
- `tests/bpm/pipeline-financeiro.test.ts`, `tests/bpm/copiar-campos-card-vinculado.test.ts`, `tests/bpm/novo-contrato-financeiro-server.test.ts`, `tests/bpm/autosave-tipos-imediatos-react.test.ts`, `tests/bpm/cpf-pendencias-react.test.ts`, `tests/bpm/cpf-fechamento-react.test.ts` — regressão.

### Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-25 | 0.1 | Draft da primeira etapa e critérios de aceite derivados do pedido | River (@sm) |
| 2026-09-25 | 0.2 | Código, testes e plano da configuração preparados; backup verificado; publicação pendente de confirmação | Codex |
| 2026-09-25 | 0.3 | Publicação aprovada, aplicada e conferida no banco; smoke visual pendente | Codex |

## Validação do draft

Checklist `story-draft-checklist.md`: objetivo/contexto **PASS**; orientação técnica **PARTIAL** (mapeamento comercial e regra/status cadastrado ainda devem ser inventariados); referências **PASS**; autossuficiência **PASS**; testes **PASS**; CodeRabbit **PASS**. **Resultado: READY para investigação e implementação local; aplicação de configuração protegida depende do checkpoint Vault.** A equipe preenche indicadores, alíquotas e dados de pagamento; nenhum provedor externo é pressuposto.
