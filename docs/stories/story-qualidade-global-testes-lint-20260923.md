# Story: Restaurar os gates globais de testes e lint

## Status

Ready for Review

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`

## Story

**Como** mantenedor do Painel Alpha, **quero** que a suíte global e o lint terminem sem erros, **para** que a revisão da integridade das APIs tributárias não fique bloqueada por falhas de outros módulos.

## Contexto e origem

Pedido explícito do usuário em 2026-09-23 para resolver as pendências citadas após a conclusão da Pré-Análise: 17 testes falhos em Alpha SEO, Bibble, Apresentações, Gerador de Documentos, Onyx e Parceiros, além dos erros globais de lint. A referência é `story-pre-analise-integridade-apis-tributarias.md` e o log local `/tmp/preanalise-test-20260923.log`. Esta story cobre somente a limpeza de qualidade global; não muda o contrato funcional da Pré-Análise.

## Acceptance Criteria

1. Cada falha da suíte global identificada no baseline é corrigida conforme o contrato atual do módulo; testes desatualizados são alinhados ao comportamento documentado, sem enfraquecer controles de segurança ou validação.
2. `npm test` termina sem falhas; `npm run lint` termina sem erros.
3. `npm run typecheck` e `npm run build` terminam com sucesso depois das correções.
4. O checklist, a File List e o registro de QA documentam o resultado final dos quatro gates e quaisquer limitações verificadas.
5. Nenhuma migration, alteração de schema, seed, backfill, push ou deploy faz parte desta story.

## Tasks / Subtasks

- [x] Atualizar fixtures e expectativas dos testes de Apresentações, Gerador de Documentos, Onyx e Parceiros para os contratos atuais (AC: 1).
- [x] Resolver as falhas globais restantes em Alpha SEO e Bibble (AC: 1, 2).
- [x] Resolver os erros globais de lint no escopo necessário e executar `npm run lint` (AC: 2).
- [x] Executar `npm test`, `npm run typecheck` e `npm run build` após as correções (AC: 2, 3).
- [x] Atualizar checklist, File List e QA final com evidências dos gates (AC: 4).

## Dev Notes

- Não reduzir a validação de CNPJ: o schema exige dígitos verificadores válidos.
- O cliente Onyx exige PAT individual para operações de usuário; uma variável global configurada não autoriza chamadas sem esse token.
- O importador PPTX preserva a imagem raster e fornece metadados de recorte; o SVG é montado na etapa de mapeamento.
- O Kanban de Parceiros permite movimento direto entre etapas ativas.
- O upload do Gerador de Documentos converte HTML opcionalmente; o teste deve simular essa dependência e a gravação associada.
- Quatro testes de paridade com a fonte histórica OpenSEO são condicionais à presença do checkout local `../open-seo-main`, indisponível neste ambiente; um teste independente confirma que o doctor registra a ausência como falha de contrato. O usuário informou que não possui esse checkout.

## Testing

- Executar primeiro testes focados por módulo; repetir a suíte global ao concluir.
- Confirmar explicitamente que chamadas Onyx sem token individual falham antes de `fetch` e que CNPJ inválido segue rejeitado.
- Executar os quatro gates na árvore de trabalho final, em sequência para evitar arquivos transitórios de build.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** manutenção de testes e qualidade; integração e segurança nos recortes Onyx/CNPJ.
- **Specialized Agent Assignment:** `@dev` corrige, `@qa` avalia os gates.
- **Quality Gate Tasks:** revisão do diff e quatro comandos globais antes de marcar Ready for Review.
- **Focus Areas:** cobertura preservada, mocks fiéis aos contratos, ausência de relaxamento de autenticação e validação.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-09-23 | 1.0 | Story criada a partir do pedido de limpar falhas globais. | River |

## Dev Agent Record

### Completion Notes List

- Atualizadas expectativas e fixtures dos testes de Apresentações, Gerador de Documentos, Onyx, Parceiros, Alpha SEO e Bibble para os contratos atuais.
- Corrigidos erros de lint com tipos concretos, validação de payloads e ajustes nos efeitos React. As cotas compartilhadas da Pré-Análise estão documentadas na story específica.
- Quatro testes de paridade do Alpha SEO continuam condicionais porque o checkout histórico não existe neste ambiente; o usuário confirmou que não o possui.

### File List

- `docs/stories/story-qualidade-global-testes-lint-20260923.md`
- `tests/apresentacoes/pptx-parser.test.ts`
- `tests/gerador-documentos/criar-template-via-upload.test.ts`
- `tests/gerador-documentos/empresas-contratadas.test.ts`
- `tests/onyx/client-user-token.test.ts`
- `tests/onyx/routes-user-token.test.ts`
- `tests/parceiros/aquisicao.test.ts`
- `tests/alpha-seo/doctor-worker.test.ts`
- `tests/alpha-seo/integration-wiring.test.ts`
- `tests/alpha-seo/inventory.test.ts`
- `tests/alpha-seo/schema-draft.test.ts`
- `tests/bibble/adaptive-integration.test.ts`
- `tests/bibble/admin-behavioral-profile-tool.test.ts`
- `tests/bibble/attachment-readiness.test.ts`
- `tests/bibble/interruption-and-runtime.test.ts`
- `tests/bibble/module-knowledge.test.ts`
- `eslint.config.mjs`

### Arquivos de correção de lint e tipos

- `src/actions/ChatAction.ts`
- `src/actions/ComercialControle.ts`
- `src/actions/ConfirmacaoLeituraDocumento.ts`
- `src/actions/PreAnalise.ts`
- `src/actions/RadarFiscal.ts`
- `src/actions/Reservas.ts`
- `src/actions/Tarefas.ts`
- `src/actions/UploadDocs.ts`
- `src/actions/UploadVideosLote.ts`
- `src/actions/questoes.ts`
- `src/app/PainelAlpha/AlphaComm/page.tsx`
- `src/app/PainelAlpha/AlphaSchools/AlphaPresets.tsx`
- `src/app/PainelAlpha/AlphaSchools/AlphaSchoolsWelcome.tsx`
- `src/app/PainelAlpha/AlphaSchools/SaladeAula.tsx`
- `src/app/PainelAlpha/AlphaSchools/page.tsx`
- `src/app/PainelAlpha/AlphaSchools/presets/GerenciadorBancoQuestoes.tsx`
- `src/app/PainelAlpha/AlphaSchools/presets/ModalConfiguracaoPreset.tsx`
- `src/app/PainelAlpha/AlphaSchools/presets/Questoes.tsx`
- `src/app/PainelAlpha/AlphaSchools/presets/page.tsx`
- `src/app/PainelAlpha/AlphaSkills/AlphaSkillsClient.tsx`
- `src/app/PainelAlpha/AlphaSkills/Gerenciamento/CriarCurso.tsx`
- `src/app/PainelAlpha/AlphaSkills/Gerenciamento/CriarModulo.tsx`
- `src/app/PainelAlpha/AlphaSkills/Gerenciamento/ModalEditar.tsx`
- `src/app/PainelAlpha/AlphaSkills/Gerenciamento/Upload.tsx`
- `src/app/PainelAlpha/AlphaSkills/Gerenciamento/page.tsx`
- `src/app/PainelAlpha/AlphaSkills/TrilhaCarrossel.tsx`
- `src/app/PainelAlpha/AlphaVault/EditarColaborador/ModalEditarAgente.tsx`
- `src/app/PainelAlpha/AlphaVault/GradeAgentes/CardAgentes.tsx`
- `src/app/PainelAlpha/AlphaVault/GradeAgentes/GradeAgentes.tsx`
- `src/app/PainelAlpha/AlphaVault/page.tsx`
- `src/app/PainelAlpha/AlphaVault/types.ts`
- `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modal.tsx`
- `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx`
- `src/app/PainelAlpha/CheckList/ChecklistBackground.tsx`
- `src/app/PainelAlpha/ControleLeads/Lançamentos.tsx`
- `src/app/PainelAlpha/ControleLeads/Marketing/dashboard.tsx`
- `src/app/PainelAlpha/ControleLeads/PaginaControle.tsx`
- `src/app/PainelAlpha/PainelTarefas/GerenciarTarefas/GerenciamentoUserTarefa/page.tsx`
- `src/app/PainelAlpha/PainelTarefas/GerenciarTarefas/page.tsx`
- `src/app/PainelAlpha/PainelTarefas/PainelTarefaC/page.tsx`
- `src/app/PainelAlpha/PainelTarefas/painelTarefaSG/ListaCompras.tsx`
- `src/app/PainelAlpha/PainelTarefas/painelTarefaSG/page.tsx`
- `src/app/PainelAlpha/ReservaSalas/page.tsx`
- `src/app/PainelAlpha/SistemaPreAnalise/BlocoResultados.tsx`
- `src/app/PainelAlpha/SistemaPreAnalise/ProgressCard.tsx`
- `src/app/PainelAlpha/SistemaPreAnalise/SistemaPreAnaliseClient.tsx`
- `src/app/api/ConsultaCompleta/route.ts`
- `src/app/api/SalvarPlanilhaFiscal/route.ts`
- `src/app/api/chat/upload/route.ts`
- `src/app/api/upload/route.ts`
- `src/components/Apresentacoes/Dashboard/ModalCompartilharApresentacao.tsx`
- `src/components/Bibble.tsx`
- `src/components/BroadcastBanner.tsx`
- `src/components/Colaboradores/BotoesHeader.tsx`
- `src/components/ComponentesRadar/BotoesModal.tsx`
- `src/components/ComponentesRadar/DropzoneRadar.tsx`
- `src/components/ComponentesRadar/ImportacaoLote.tsx`
- `src/components/ComponentesRadar/ModalHistorico.tsx`
- `src/components/ComponentesRadar/RadarBackground.tsx`
- `src/components/EngrenagemFlutuante.tsx`
- `src/components/Metas/ModalJustificativaMeta.tsx`
- `src/components/Metas/PreviewArquivoLocal.tsx`
- `src/components/ModalBroadcast.tsx`
- `src/components/ModalDetalhesEmpresa.tsx`
- `src/components/ModalOnboarding.tsx`
- `src/components/ModalPdf.tsx`
- `src/components/PainelAlphaClient.tsx`
- `src/components/Parceiros/ParceirosClient.tsx`
- `src/components/PusherGlobal.tsx.tsx`
- `src/components/ThemeProviderAlpha.tsx`
- `src/components/VideoIntrodutorio/BotaoVideoIntrodutorio.tsx`
- `src/hooks/useSidebarState.ts`
- `src/lib/bibble/gerar-ficha-server.ts`
- `src/lib/dateUtils.ts`

## QA Results

- **Recorte concluído:** `npx vitest run` nos seis arquivos acima passou com 62/62 testes; `npx eslint` nesses seis arquivos passou.
- **Testes globais:** `npm test` passou com 497 arquivos, 3.755 testes aprovados, quatro condicionais ignorados por falta do checkout histórico e um `todo` preexistente.
- **Lint final:** `npm run lint` passou com 0 erros e 1.192 avisos. A configuração de CommonJS eliminou 1.868 falsos erros de `require` em scripts Node; os erros restantes foram corrigidos com tipos concretos e ajustes nos efeitos React. Baseline: 2.409 erros.
- **Typecheck final:** `npm run typecheck` passou.
- **Testes finais:** a primeira execução de `npm test` foi interrompida por colisão no diretório temporário de cobertura com outro processo Vitest do mesmo workspace. A repetição `npm test -- --coverage.reportsDirectory=/tmp/qualidade-final-coverage` passou: 497 arquivos, 3.756 testes aprovados, quatro testes de paridade ignorados pela ausência de `../open-seo-main` e um `todo` preexistente. Log: `/tmp/qualidade-final-test-isolado.log`.
- **Build final:** `npm run build` passou, inclusive 78 páginas estáticas. Mantém avisos já observados sobre o worker PDF do Bibble. Log: `/tmp/qualidade-final-build.log`.
- **Diff:** `git diff --check` passou. Nenhuma migration, alteração de schema, push ou deploy foi realizada nesta story.
- **Revalidação antes do commit conjunto:** `npm run lint` passou com 0 erros e 1.192 avisos; `npm run typecheck` passou após a correção de um teste de CRM editado concorrentemente; `npm test -- --coverage.reportsDirectory=/tmp/commit-all-coverage` passou com 500 arquivos, 3.763 testes aprovados, quatro ignorados e um `todo`; `npm run build` passou. Logs em `/tmp/commit-all-{lint,typecheck-retry,test,build}.log`.
