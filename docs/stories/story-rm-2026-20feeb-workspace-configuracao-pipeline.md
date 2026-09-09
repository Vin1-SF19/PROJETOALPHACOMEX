# RM-2026-20FEEB — Workspace administrativo de configuração de pipeline

## Status

Concluída — Em testes

## Contexto

A configuração funcional estabilizada pela RM-2026-9E89F2 ainda é apresentada como uma página estreita, longa e formada por blocos/accordions. O administrador precisa compreender o pipeline como conjunto e acessar rapidamente a configuração que exige atenção.

O anexo `pagina-configuracao-pipeline-estabilizada-7fb9f9a90de1908a.md` foi lido integralmente e termina de forma incompleta na frase “Cada item pode”. O documento-base citado, `2026-09-05-painel-alpha-crm-configuracao-pipeline-revisao-radar-codex.md`, não existe nos projetos locais. A entrega se limita aos requisitos completos disponíveis no anexo e aos contratos canônicos já verificados no código.

## Escopo

1. Remover a largura estreita e criar navegação secundária para Visão geral, Etapas e fluxo, Campos e formulários, Card do Kanban, SLA, Automações, Permissões e Histórico.
2. Exibir saúde acionável do pipeline, baseada em dados reais e com navegação para a correção.
3. Substituir os accordions de etapas por lista, matriz de transições e painel de edição da etapa selecionada.
4. Substituir agrupamentos repetidos de campos por tabela única pesquisável e filtrável, com editor lateral.
5. Expor visualmente a composição canônica `BpmEtapaFormulario` sem duplicar valores ou regras dos campos.
6. Criar áreas dedicadas para preview do card, SLA, automações, permissões e auditoria administrativa.
7. Manter mutations existentes explícitas, confirmadas pelo servidor e sem writes disparados continuamente por cor/hover.

## Fora de escopo

- Inventar o restante truncado do anexo.
- Reintroduzir `BpmCampo.etapaId`, `BpmCampo.obrigatorio` ou `BpmEtapa.slaDias` como fonte moderna.
- Alterar o schema apenas para guardar uma versão: a publicação usa o `updatedAt` canônico como CAS, mantém snapshot completo e registra a versão na auditoria existente.
- Alteração de schema, migration, seed, backfill ou escrita direta de dados.
- Commit, push, PR, deploy ou promoção para produção.

## Critérios de aceite

- [x] **AC1:** página usa a largura do painel e possui oito áreas navegáveis sem rolagem pela configuração inteira.
- [x] **AC2:** cabeçalho informa Salvo, alteração não publicada, Salvando/Publicando ou erro, com ações coerentes ao editor ativo.
- [x] **AC3:** saúde apresenta contagens e problemas reais de etapa inicial/final, seleção inválida, SLA sobreposto e alcançabilidade, com atalho para correção.
- [x] **AC4:** etapas aparecem em lista compacta com cor, estado, papel, campos, transições e SLA; edição ocorre em painel lateral e há reordenação acessível.
- [x] **AC5:** matriz distingue Permitida, Bloqueada e Não configurada; ausência jamais aparece como permissão.
- [x] **AC6:** tabela única de campos oferece busca e filtros de status, tipo, etapa, escopo e propriedade.
- [x] **AC7:** editor lateral de campo organiza identidade, aplicabilidade, comportamento, regras por etapa, permissões e mapeamento, avisando impacto compartilhado.
- [x] **AC8:** composição de formulário usa `BpmEtapaFormulario`/seções/componentes e permite salvar apresentação sem mover ou duplicar o dado do campo.
- [x] **AC9:** Card do Kanban apresenta configuração e preview por etapa a partir das configurações reais de campo.
- [x] **AC10:** SLA, automações, permissões e histórico usam dados/actions reais e preservam autorização administrativa.
- [x] **AC11:** nenhum write ocorre em GET, nenhum seletor de cor grava por movimento e toda falha restaura ou mantém o estado confirmado.
- [x] **AC12:** testes focados, lint escopado, typecheck, suíte e build foram executados, com débitos externos discriminados abaixo.

## Fases

- [x] Fase 0 — anexo, truncamento e dependência funcional auditados.
- [x] Fase 1 — página, domínio, modelos canônicos e integrações mapeados.
- [x] Fase 2 — story criada antes do redesign.
- [x] Fase 3 — especificação visual implementável consolidada.
- [x] Fase 4 — workspace e editores implementados.
- [x] Fase 5 — gate técnico.
- [x] Fase 6 — consumo real validado.
- [x] Fase 7 — autenticação e autorização auditadas.
- [x] Fase 8 — arquitetura e qualidade revisadas.
- [x] Fase 9 — bordas e regressões validadas.
- [x] Fase 10 — memória e documentação consolidadas.
- [x] Fase 11 — relatório e estado arquivados.

## File List

- [x] `docs/stories/story-rm-2026-20feeb-workspace-configuracao-pipeline.md`
- [x] `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/AdminPipelineClient.tsx`
- [x] `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/EtapaAvancadaSection.tsx`
- [x] `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/FormularioEtapaWorkspace.tsx`
- [x] `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/PipelineWorkspaceSections.tsx`
- [x] `src/actions/bpm/Pipelines.ts`
- [x] `src/actions/bpm/FormulariosEtapa.ts`
- [x] `src/actions/bpm/ConfiguracaoPipeline.ts`
- [x] `src/lib/bpm/pipeline-config-publicacao.ts`
- [x] `src/lib/bpm/pipeline-config-diagnostico.ts`
- [x] `scripts/diagnosticar-pipeline-bpm.ts`
- [x] `package.json`
- [x] `tests/bpm/pipeline-config-workspace.test.ts`
- [x] `tests/bpm/pipeline-config-publicacao.test.ts`
- [x] `tests/bpm/pipeline-config-diagnostico.test.ts`
- [x] `tests/bpm/configuracao-pipeline-confiavel.test.ts`
- [x] `.bibble/memory/{architecture,components,decisions,integration-points,journal}.md`
- [x] `prompt-phases/roadmap-alpha/rm-2026-20feeb/r0001/99-relatorio-conclusao.md`

## Verificação final

- Testes direcionados: **49/49 aprovados** em sete arquivos.
- Build de produção: aprovado, com 78 páginas geradas.
- ESLint direcionado e `git diff --check`: aprovados.
- Typecheck global: nenhum diagnóstico nos arquivos desta entrega; 28 erros externos no worktree compartilhado.
- Suíte global: **2.512/2.566 aprovados**; 54 falhas externas e concorrentes, concentradas em Alpha SEO, apresentações, cadências legadas, transições antigas, calendário, documentos e parceiros.
- Banco: nenhuma migration, seed, backfill ou escrita de dados necessária.
