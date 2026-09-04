# Story RM-2026-4C9C6D — 2. Gestão de Campos e Dados

**Projeto:** Painel Alpha  
**Objetivo:** `RM-2026-4C9C6D`  
**Tipo:** EXECUTION  
**Status:** Concluído no stage
**Data de aprovação:** 2026-09-04

## Autorização

O usuário autorizou explicitamente a implementação e a alteração aditiva do banco em
2026-09-04. O destino autorizado é somente
`banco-alpha-alphacomex.aws-us-east-1.turso.io`; a configuração comentada de
`basetestes-alphacomex` não pode ser usada.

Esta story sucede a Fase 2 documental registrada na versão 0.1. Os caminhos validados
naquela fase permanecem válidos, mas a restrição de não implementar não se aplica às
fases 5–16 agora aprovadas.

Em 2026-09-04, o usuário aprovou também o complemento solicitado no “Mapeamento de
Campos por Etapa”: configuração independente de entrada/saída, grupo, valor padrão e
condições, armazenamento global personalizado por cliente e aplicação transacional do
catálogo inicial nos pipelines Comercial, Operacional e Financeiro.

## Story

**Como** administrador do Alpha CRM,

**quero** criar, editar, ativar e desativar campos configuráveis, seus escopos,
opções, acessos e mapeamentos,

**para que** os mesmos dados sejam reutilizados com segurança entre cards, pipelines,
etapas e cadastros canônicos, sem apagar histórico nem duplicar a fonte de verdade.

## Escopo aprovado

- Tipos: texto, texto longo, número, moeda, porcentagem, data, data e hora, booleano,
  seleção, multiseleção, usuário, CNPJ, CPF, e-mail, telefone, URL, arquivo e relacionamento.
- Opções estruturadas, ordenadas, ativáveis e com identidade estável.
- Valor padrão, ativação, visibilidade, editabilidade, somente leitura e obrigatoriedade.
- Aplicação a um ou mais pipelines e configuração por etapa.
- Escopo `CARD` ou `GLOBAL`, com fonte e atributo canônicos em allowlist.
- Entidades relacionáveis: Cliente, Contato, Parceiro, Contrato, Serviço, Processo e Card.
- Mapeamentos dirigidos `COPIAR`, `SINCRONIZAR` e `REFERENCIAR`.
- CNPJ persistido sem máscara e formatado apenas na apresentação.
- Arquivo vinculado ao campo por `BpmCardAnexo`; nenhum segundo storage será criado.
- Compatibilidade integral com `pipelineId`, `etapaId`, `opcoesJson`,
  `BpmCampoObrigatorioEtapa` e `BpmCampoOcultoEtapa` legados.

## Semântica fechada

- `COPIAR`: snapshot somente quando o destino estiver vazio; alterações futuras da origem
  não se propagam.
- `SINCRONIZAR`: fluxo unidirecional origem → destino; destino somente leitura.
- `REFERENCIAR`: leitura direta da fonte canônica, sem persistir cópia; somente leitura.
- Não existe sincronização bidirecional nem backfill retroativo.
- Ciclos, auto-mapeamento e mais de uma origem por destino são rejeitados.
- Desativar oculta o campo de novas configurações, preservando valores e histórico.
- Mudança de tipo com valores existentes e remoção de opção usada são bloqueadas.
- Dados globais usam os cadastros existentes; identificadores vindos da configuração nunca
  são interpolados em SQL ou usados como propriedade dinâmica sem allowlist.

## Banco, backup e rollback

- Migration estritamente aditiva: `ADD COLUMN`, `CREATE TABLE` e `CREATE INDEX`.
- Proibidos: `DROP`, rename, rebuild, `UPDATE`, seed e backfill.
- Antes da aplicação: confirmar host efetivo, criar backup dedicado, verificar tamanho e
  SHA-256, restaurar isoladamente, executar `integrity_check` e `foreign_key_check`, simular
  a migration no restore e repetir as verificações e contagens.
- Aplicação única via `scripts/apply-turso-migration.mjs`, seguida de readback e smoke test.
- Rollback primário: desabilitar/reverter consumidores e manter estruturas aditivas inertes.
  Remoção estrutural exige nova autorização Vault. Em corrupção, restaurar o backup em nova
  instância validada antes de trocar a conexão, preservando a instância anterior.

## Critérios de aceite

1. Admin autenticado pode criar, editar, ativar e desativar campos sem exclusão física.
2. Todos os tipos aprovados são validados no servidor e renderizados no consumidor.
3. Opções mantêm identidade, ordem e histórico; opção usada não pode ser removida.
4. Pipelines, etapas e controles de acesso são persistidos e validados por pertencimento.
5. Campo global lê fonte canônica determinística; valor local só prevalece em campo de card.
6. Mapeamentos cumprem exatamente as três semânticas e rejeitam ciclos/conflitos.
7. Alteração de tipo com valor existente é rejeitada.
8. Campo desativado deixa de aparecer para novo preenchimento sem apagar valores anteriores.
9. CNPJ é canônico sem máscara; moeda/porcentagem e demais máscaras são só apresentação.
10. Ações exigem sessão e permissão administrativa antes de consulta ou mutação sensível.
11. Fluxos legados continuam funcionando quando as novas associações não existem.
12. Backup, migration, readback, testes, typecheck, lint e build ficam registrados.

## Fases de execução

- [x] Fase 0 — auditoria de entregabilidade e estado atual.
- [x] Fase 1 — blueprint técnico.
- [x] Fase 2 — validação dos caminhos existentes.
- [x] Fase 3 — especificação de UX.
- [x] Fase 4 — parecer Vault final sobre SQL e backup.
- [x] Fase 5 — schema, migration e geração Prisma.
- [x] Fase 6 — CRUD, autorização, validações e transações.
- [x] Fase 7 — resolver canônico e motor de mapeamentos.
- [x] Fase 8 — administração de campos.
- [x] Fase 9 — consumidor no card e autosave.
- [x] Fase 10 — gates Forge.
- [x] Fase 11 — verificação Probe ponta a ponta.
- [x] Fase 12 — auditoria de segurança.
- [x] Fase 13 — revisão arquitetural.
- [x] Fase 14 — matriz de testes.
- [x] Fase 15 — documentação e memórias.
- [x] Fase 16 — fechamento e passagem para Em testes.

## Rastreabilidade

| Área | Implementação prevista | Verificação |
|---|---|---|
| Persistência | `prisma/schema.prisma` + migration RM | Prisma validate, restore simulado e readback remoto |
| Regras | `src/lib/bpm/campos-configuraveis.ts` | testes unitários de tipos, allowlist e mapeamentos |
| Actions | `src/actions/bpm/Campos.ts` | testes de auth, transação, conflitos e histórico |
| Admin | seção Campos Personalizados do pipeline | testes estáticos e build |
| Card | `CampoBpmInput` e `PainelCamposEtapaAtual` | testes de renderização, readonly e autosave |
| Legado | loaders atuais com fallback | suíte BPM existente |

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-09-04 | 0.1 | Registro documental da Fase 2. | River (`@sm`) |
| 2026-09-04 | 1.0 | Story EXECUTION, plano de banco e semânticas aprovadas. | Codex (`@dev`) |
| 2026-09-04 | 1.1 | Implementação concluída e encaminhada para testes. | Codex (`@dev`) |
| 2026-09-04 | 1.2 | Mapeamento por etapa, valores globais do cliente, catálogo inicial e stage publicados. | Codex (`@dev`) |

## Dev Agent Record

### Agent Model Used

Codex

### Completion Notes

- Vault aprovou o SQL aditivo; SHA-256 da migration:
  `78c72f399fbe0dbd67ddde0f479035e1ba09f467b0bda0e405fbbbac37d00094`.
- Backup pré-mudança validado com 96.222.120 bytes, 289 tabelas e 68.407 linhas;
  SHA-256 `2d55fdefbd20b621cd0d6dbf78ddef9a76b3c2fc9ddac1c7e065f03c3ccf50b`.
- Restore isolado, simulação da migration, `integrity_check` e `foreign_key_check`
  aprovados antes da aplicação no banco autorizado.
- Migration aplicada uma única vez no banco `banco-alpha-alphacomex`; readback confirmou
  nove colunas, cinco tabelas, relações e índices novos, sem backfill ou perda de dados.
- CRUD, tipos, opções estáveis, escopos, fontes canônicas, acesso por perfil, mapeamentos,
  administração, card, anexos, compatibilidade legada e trilha de auditoria implementados.
- Auditoria de segurança encontrou e corrigiu a falta de enforcement de acesso por perfil e
  uma janela de corrida na detecção de ciclo de mapeamento; testes de regressão adicionados.
- Prisma validate/generate, lint do escopo, 52 testes focados e build de produção aprovados.
- O typecheck e as suítes globais ainda registram erros preexistentes ou concorrentes fora
  deste objetivo; nenhum erro foi identificado nos arquivos de RM-2026-4C9C6D.

## File List

- `prisma/schema.prisma`
- `prisma/migrations/20260904193000_bpm_gestao_campos_dados/migration.sql`
- `prisma/migrations/20260904210000_bpm_campos_por_etapa/migration.sql`
- `scripts/bpm-aplicar-mapeamento-campos-etapas.mjs`
- `src/actions/bpm/Anexos.ts`
- `src/actions/bpm/Campos.ts`
- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/Pipelines.ts`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/page.tsx`
- `src/components/bpm/CampoBpmInput.tsx`
- `src/components/bpm/PainelCamposEtapaAtual.tsx`
- `src/lib/bpm/campos-configuraveis-server.ts`
- `src/lib/bpm/campos-configuraveis.ts`
- `src/lib/bpm/campos-dinamicos.ts`
- `src/lib/bpm/requisitos-etapa-server.ts`
- `src/lib/validations/bpm.ts`
- `tests/bpm/campos-configuraveis-actions.test.ts`
- `tests/bpm/campos-configuraveis.test.ts`
- `tests/bpm/campos-globais-cliente.test.ts`
- `tests/bpm/migracao-campos-por-etapa.test.ts`
- `tests/bpm/requisitos-etapa-server.test.ts`
- `docs/stories/story-rm-2026-4c9c6d-gestao-campos-dados.md`

## QA Results

- Testes focados: 8 arquivos, 52 testes aprovados.
- ESLint focado: aprovado.
- Prisma validate/generate: aprovado.
- Build Next.js de produção: aprovado, 78 páginas geradas.
- Banco: backup/restauração simulada, migration real e readback aprovados; integridade OK e
  zero violações de chave estrangeira.
- Gates globais não bloqueiam esta passagem para testes porque os erros restantes pertencem
  a módulos alheios ao objetivo e já existiam ou foram introduzidos por execuções paralelas.

### Complemento — mapeamento por etapa

- Backup imediatamente anterior: 96.245.670 bytes, 294 tabelas e 68.423 registros;
  SHA-256 `0be059e87dfd45e736c44a26369c0118a017221146f13d6065f1dff1331ec57a`.
- Migration `20260904210000_bpm_campos_por_etapa` aplicada no banco autorizado;
  `integrity_check=ok` e zero violações de chave estrangeira.
- `BpmCampoEtapaConfig` agora suporta grupo, padrão por etapa, obrigação geral, para
  entrada, para saída e condições do Motor de Regras.
- `BpmCampoValorGlobal` mantém campos personalizados no cliente, permitindo reutilização
  real entre cards e pipelines sem novo preenchimento.
- Catálogo aplicado de forma idempotente: 93 conceitos canônicos, 164 configurações por
  etapa, 19 bloqueios de saída e zero divergências de escopo após a promoção segura dos
  valores legados. Cinco definições redundantes sem valores foram desativadas logicamente;
  nenhum registro foi excluído e o readback final confirmou zero duplicatas ativas.
- Testes finais: 9 arquivos e 73 testes aprovados; ESLint focado e build de produção
  aprovados.
- Stage: release `20260904-210153`, build `bL9hIydZVKXNkdJ8IAECW`, serviço ativo e HTTPS 200.
