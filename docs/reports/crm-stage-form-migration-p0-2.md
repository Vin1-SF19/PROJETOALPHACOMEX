# P0-2 — CRM-STAGE-FORM-MIGRATION

**RM:** RM-2026-045CC0
**Data:** 2026-09-09
**Branch isolada:** `feat/crm-stage-form-migration`
**Base:** `a43c6f64` — P0-1 CRM-CONFIG-CANONICAL-SOURCES
**Resultado:** PASS no escopo; reconciliação aplicada no Turso de produção.

## Fontes e contrato final

- `BpmCampoEtapaConfig` determina se um campo pertence e é visível em uma etapa.
- `BpmEtapaFormulario`/`BpmFormularioSecao`/`BpmFormularioComponente` representam somente a composição e a ordem visual.
- `BpmCampoPipeline` autoriza compartilhamento de catálogo; não faz o campo aparecer em todas as etapas.
- `src/lib/bpm/ontology.ts` + `src/lib/bpm/formularios-etapa.ts` formam o registry validado de capabilities e do target `STAGE_CHECKLIST`.
- `SalvarFormularioEtapaBpm` exige a configuração canônica visível, preserva identidades, usa compare-and-swap por versão e faz atualização diferencial.

Não houve alteração de `prisma/schema.prisma` nem migration estrutural.

## Causa raiz

A migration `20260905143000_bpm_ontologia_canonica` criou os formulários v1 copiando para cada etapa todos os campos ativos alcançáveis pelo pipeline proprietário, `BpmCampo.etapaId` legado ou `BpmCampoPipeline`. Campo de pipeline foi, portanto, interpretado como campo de todas as etapas. A P0-1 consolidou a aplicabilidade em `BpmCampoEtapaConfig`, mas os componentes já materializados continuaram representando o contrato antigo.

Os IDs determinísticos `form:<etapa>`, `section:<etapa>:fields` e `component:<etapa>:field:<campo>`, junto da permanência dos 32 formulários na versão 1, provaram que os componentes divergentes eram cópias da migration, não edições administrativas posteriores.

O baseline histórico de 1.073 incompatíveis foi reduzido para 1.057 antes da P0-2 porque a P0-1 materializou 16 configurações campo-etapa válidas.

## Inventário e classificação

| Categoria | Quantidade | Tratamento |
|---|---:|---|
| A — configuração ausente com evidência específica | 0 | Nenhum caso |
| B — campo de outra etapa copiado automaticamente | 1.043 | Removido somente da composição |
| C — compartilhamento legítimo incompleto | 0 | Nenhum caso |
| D — legado com mapeamento canônico explícito | 0 | Nenhum remapeamento necessário |
| E — campo inativo com relevância histórica | 0 | Nenhum componente encontrado |
| F — órfão/inexistente | 0 | Nenhum caso |
| G — duplicado no mesmo formulário | 0 | Nenhum caso |
| H — configuração canônica `visivel=false` | 14 | Removido da composição; canônico prevaleceu |
| I — ambíguo / `REVIEW_REQUIRED` | 0 | Nenhuma decisão humana pendente |

Não foram criadas configurações para “resolver” a divergência e nenhum campo foi associado a todas as etapas.

### Legados semanticamente semelhantes

- CNPJ: a definição global ativa já é a usada pelos formulários e possui valores históricos; a definição local inativa não aparecia em componentes.
- Forma de pagamento: a definição global ativa já é a usada; a definição local inativa não aparecia em componentes.

Como não existe `BpmCampoMapeamento` ativo e não houve componente apontando para as definições inativas, nenhum merge por nome ou remapeamento especulativo foi feito.

## Antes e depois em produção

| Indicador | Antes | Depois |
|---|---:|---:|
| Formulários ativos | 32 | 32 |
| Formulários versão 1 | 32 | 3 |
| Seções | 64 | 64 |
| Componentes totais | 1.306 | 249 |
| Componentes `CAMPO` | 1.237 | 180 |
| `CAMPO` válidos | 180 | 180 |
| `CAMPO` incompatíveis | 1.057 | 0 |
| Formulários afetados | 29 | 0 |
| `CHECKLIST` | 32 | 32 |
| `CAPABILITY` | 37 | 37 |
| Referências checklist/capability inválidas | 0 | 0 |

Os 29 formulários alterados avançaram de versão 1 para 2. Os três sem alteração permanecem em v1.

A prova de cobertura canônica posterior encontrou 180 configurações ativas e visíveis, 180 componentes `CAMPO` correspondentes representados exatamente uma vez, zero configurações ausentes do formulário e zero representações duplicadas.

## Etapas críticas

| Pipeline / etapa | Campos antes | Inválidos antes | Campos depois | Inválidos depois |
|---|---:|---:|---:|---:|
| Operacional / Indeferido | 48 | 48 | 0 | 0 |
| Operacional / Envio do checklist | 48 | 48 | 0 | 0 |
| Operacional / Alinhamento Estratégico agendado | 49 | 46 | 3 | 0 |
| Financeiro / Elaboração do Contrato (`cmsd9...gbun`) | 47 | 42 | 5 | 0 |
| Financeiro / Elaboração do Contrato (`cmsd9...wb65`) | 47 | 47 | 0 | 0 |
| Financeiro / Nota Fiscal | 47 | 42 | 5 | 0 |
| Financeiro / Formalização | 56 | 33 | 23 | 0 |
| Revisão de Radar / Agendar reunião | 30 | 30 | 0 | 0 |
| Revisão de Radar / Em tratativa | 30 | 28 | 2 | 0 |
| Revisão de Radar / Monitoramento | 30 | 30 | 0 | 0 |

Etapas que ficaram sem componente `CAMPO` continuam com suas referências de checklist/capability. Isso reflete a configuração canônica atual e não uma validação relaxada.

## Salvamento e prevenção

- O replace-all de seções/componentes foi removido.
- IDs de seções e componentes existentes são enviados pela UI e preservados.
- Um ID externo ao formulário, troca de chave, tipo ou target é recusado.
- Componentes omitidos são os únicos removidos; novos componentes são os únicos que recebem IDs novos.
- `versaoEsperada` implementa compare-and-swap e impede last-write-wins silencioso.
- Read → save sem mudança não incrementa versão, não audita e não notifica.
- `CHECKLIST` preserva obrigatoriamente `STAGE_CHECKLIST`.
- `CAPABILITY` aceita somente registry canônico e precisa estar habilitada na etapa.
- A UI oferece somente campos ativos com `BpmCampoEtapaConfig.visivel=true` na etapa e impede duplicação entre seções.
- O backend repete todas as guardas; manipular o cliente não contorna a fonte canônica.

## Migração, snapshot e rollback

Comando canônico: `npm run bpm:stage-forms`.

- Dry-run é o padrão e gera snapshot lógico + plano com hash.
- Apply exige `--environment`, confirmação literal e `--plan <hash>`.
- O plano reconsulta o estado dentro da transação e aborta em drift.
- Rollback exige confirmação própria e só executa se as versões aplicadas ainda forem as esperadas.
- Plano aplicado: `101019953b85f53f272d0e5f0cf25bdc1e1d46f6c8400f27329e5fc078e239db`.
- Dry-run posterior: zero ações determinísticas e zero `REVIEW_REQUIRED`.

### Evidência Vault

- Backup completo: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-09T18-20-46-380Z.sql`.
- Manifest: arquivo homônimo `.manifest.json`.
- SHA-256: `4f9f19cbb234f07e7d3b12721cdb48e847277f2a514ea4e5ae32d86ae2b93ff2`.
- Tamanho: 107.844.625 bytes; 306 tabelas; 84.942 registros.
- Restauração: `PRAGMA integrity_check=ok`, zero violações de FK, 32 formulários.
- Rollback da P0-2: `database-backups/pre-change/p0-2-stage-forms-rollback-2026-09-09T18-25-48-348Z.json`.
- SHA-256 do rollback: `fbde661609bd5031eb98d1fece46db82da6ee7fa2ca499ca2ebc3bcfae01224b`.
- Autorização específica recebida para teste restaurado e produção.

O ensaio executou dry-run → apply → rollback → novo apply → segundo apply. O rollback restaurou os 1.306 componentes e 32 formulários v1; a reaplicação voltou a zero incompatíveis; a segunda aplicação não produziu mudanças.

## Preservação de dados dos cards

| Entidade | Antes/depois | Fingerprint SHA-256 |
|---|---:|---|
| `BpmCard` | 3 | `f88a9511813b7bbef47aca49867f917b75623789d8b225aa575c965691bbdb1b` |
| `BpmCardCampoValor` | 22 | `11950ee3e2557ece00c53ecae3010383e39d53af250abba841feacd345d04fb1` |
| `BpmCardChecklist` | 2 | `9dbd2f2db273cfbd643e5af5266fe5267e5aea6379cb877a31d7947bbe94a6c1` |
| `BpmCardChecklistItem` | 6 | `31b78b7ec98f5600db89656982d9aca97e65472c635d8d196f22bd9323c76f32` |
| `BpmCardHistorico` | 29 | `73ac44050d2a245368de7d9cdaa60ab875b644aebc9e08cf221824e978f071ef` |
| `BpmCardAnexo` | 0 | `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945` |

Fingerprint agregado antes/depois: `90b14708c2dc41f399f1fb86ce9c5d5c3decea96b5cc74d4180cef8ede373650`.

## Testes e gates

- P0-2: 34/34 testes em quatro arquivos.
- Regressão focada P0-1/P0-2, campos, SLA, cadência e requisitos: 69/69.
- Reexecução final após adicionar a prova de cobertura canônica: 67/67 em nove arquivos focados.
- Suíte BPM completa: 845/854; nove falhas preexistentes fora do delta.
- `npm test`: 2.657 aprovados, 31 falhas preexistentes, 1 todo.
- ESLint do escopo: zero erros e zero warnings.
- ESLint global: baseline de 2.482 erros e 1.254 warnings fora do escopo.
- Typecheck: zero diagnóstico nos arquivos da P0-2; 18 erros globais preexistentes em módulos externos.
- Build Next.js: aprovado, 78 páginas estáticas geradas e rota administrativa presente.
- `prisma migrate diff`: migration vazia, confirmando ausência de alteração estrutural.
- Segurança: auth, autorização dentro/fora da transação, Zod, vínculo etapa/pipeline, IDs pertencentes ao formulário e SQL parametrizado verificados; zero achado bloqueante.

## Deliberadamente deixado para P0-3/P0-4

- Renderer único compartilhado entre builder, preview e card real.
- Substituição dos painéis hardcoded por etapa.
- Preview real, biblioteca visual e drag-and-drop completo.
- Draft/PUBLISHED e revisão editorial completa.
- Decisões de produto para adicionar explicitamente novos campos às etapas que hoje possuem zero campos canônicos.

Nenhum desses itens é necessário para a integridade estrutural entregue nesta P0-2.

## Git diff --stat

Snapshot final pré-commit: 18 arquivos, 2.749 inserções e 117 remoções.

## Git status --short

Os 18 arquivos da task estavam staged, sem alteração unstaged e sem arquivo não rastreado. Após o commit, o worktree ficou limpo.
