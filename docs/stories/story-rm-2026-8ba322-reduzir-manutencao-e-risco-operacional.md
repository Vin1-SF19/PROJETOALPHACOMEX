# RM-2026-8BA322 — Reduzir manutenção e risco operacional

**Projeto:** Painel Alpha / Alpha CRM  
**Grupo de mesclagem:** 3 de 3, após RM-2026-1FFBAA e RM-2026-B2F97B  
**Estado:** implementação validada e pronta para Testes após conferência da release de staging  
**Fonte:** objetivo versão 1, itens 11–16

## Escopo autorizado

11. Incluir CRM na medição de cobertura e garantir um gate efetivo de tipos independente do build.
12. Definir ciclo de vida para objetos Blob após remoção de metadados.
13. Completar compensação e reconciliação do **agendamento Google**.
14. Avaliar paginação ou carregamento progressivo do Kanban com métricas reais.
15. Dividir `Cards.ts` por comandos e consultas, preservando transações e guards.
16. Atualizar documentação para os contratos realmente utilizados.

Nenhuma migration, alteração estrutural do banco, seed ou backfill faz parte deste objetivo. Uma mudança estrutural futura exige o procedimento Vault e confirmação específica.

## Evidência inicial corrigida

- `vitest.config.ts` mede apenas três arquivos de CS/NPS. `npm run typecheck` já existe, mas `scripts/deploy-staging-release.sh` chama build sem executar esse gate; Next informa que pula a validação de tipos.
- O upload do CRM usa `@vercel/blob` em `src/app/api/bpm/upload/route.ts`. `ExcluirAnexoBpm` em `src/actions/bpm/Anexos.ts` apaga metadados e histórico, mas não remove o objeto Blob nem registra uma tentativa durável de limpeza. A exclusão de card é arquivamento lógico e não apaga seus anexos.
- `AgendarReuniaoGoogleMeetBpm` cria um evento Google antes de persistir o vínculo no card. A ausência do link do Meet já tem compensação; falha ou conflito **após** a criação pode deixar evento sem vínculo. `ReagendarReuniaoBpm` altera o evento externo antes da transação local; falha local pode deixar as datas divergentes. Esses são os caminhos de compensação e reconciliação a completar. Arquivar um card não implica cancelar seu evento existente neste escopo.
- Medição read-only no banco conectado em 2026-09-23: 1 pipeline com 7 cards ativos. A query atual carrega todos os cards desse pipeline. Essa cardinalidade não justifica adicionar paginação agora; a decisão deve registrar limiar e métricas para reavaliar sem quebrar drag and drop e realtime.
- `src/actions/bpm/Cards.ts` tem 2.489 linhas e mistura consultas e comandos. Os imports públicos existentes devem continuar válidos, e o refactor precisa manter os mesmos guards e limites transacionais.

## Critérios de aceite

### 11. Cobertura e tipos

- [x] Incluir arquivos CRM/BPM relevantes em `coverage.include` e comprovar relatório com esses arquivos.
- [x] Fazer `npm run typecheck` atuar como gate explícito antes do deploy de staging, independente do build.
- [x] Registrar resultado dos testes e do gate de tipos; corrigir regressões do escopo.

### 12. Ciclo de vida Blob

- [x] Definir a referência privada do Blob como origem do caminho para limpeza.
- [x] Após a remoção transacional de metadados, tentar apagar o Blob sem deixar metadados apontando para objeto ausente em caso de falha local.
- [x] Registrar falhas de remoção para reconciliação durável e idempotente, sem migration; testar sucesso, falha e retry.
- [x] Considerar uploads sem registro de metadados e documentar prazo/limpeza.

### 13. Agendamento Google

- [x] Compensar evento recém-criado se a gravação do card falhar ou sofrer conflito, incluindo falha da compensação.
- [x] Detectar e reconciliar divergência após reagendamento externo confirmado e persistência local falha.
- [x] Testar falha externa, conflito de versão, falha de banco e repetição sem apagar evento de outro card.

### 14. Kanban

- [x] Medir cardinalidade real: 7 cards ativos em 1 pipeline no banco conectado em 2026-09-23.
- [x] Registrar decisão baseada na cardinalidade e um limiar de reavaliação; documentar impacto sobre drag and drop, filtros e realtime.
- [x] Se a medição justificar paginação, implementar e testar sem perder cards ou operações do board. A medição atual não exige mudança de carregamento.

### 15. Separar comandos e consultas

- [x] Extrair ao menos um domínio de consultas e um de comandos de `Cards.ts`, com imports públicos compatíveis.
- [x] Confirmar que autenticação, autorização, validação, transações e auditoria permanecem nos mesmos caminhos de execução.
- [x] Rodar testes do CRM, typecheck, lint direcionado e build.

### 16. Documentação

- [x] Atualizar `src/app/PainelAlpha/AlphaCRM/README.md` e esta story com contratos finais, evidência, arquivos alterados e limites.

## Verificações finais

- [x] Testes direcionados e suíte BPM sem regressão atribuível.
- [x] Typecheck, lint direcionado, build e smoke HTTP de staging.
- [x] Release isolada de staging conferida por hashes antes de mover o card para Testes.
- [x] Fluxos autenticados de navegador ficam para a etapa Testes quando dependerem de sessão real.

## Evidência de implementação (2026-09-23)

- Cobertura BPM completa: 146 arquivos de teste, 1.137 testes aprovados; cobertura agregada no conjunto configurado: 50,71% de instruções, 42,89% de branches, 59,20% de funções e 53,88% de linhas. O relatório inclui actions e bibliotecas CRM/BPM, mas esses percentuais agregados ainda não são meta mínima por arquivo.
- `npm run typecheck` e ESLint direcionado passaram na cópia isolada de staging. O script de deploy executa o typecheck antes do build.
- Exclusão de anexo: `src/lib/bpm/anexos-lifecycle.ts` apaga o Blob privado a partir do pathname validado; a pendência nasce na mesma transação que remove metadados. Falhas permanecem com status pendente. Uploads sem registro têm janela de 24 horas e são reconciliados pelo cron existente. Testes cobrem sucesso, falha, retry e referência posteriormente vinculada.
- Google: `src/lib/bpm/google-meet-compensacao.ts` confere vínculo antes de cancelar criação órfã; no reagendamento, compara card e evento remoto antes de restaurar horário e participantes com ETag. Pendências transitórias são repetidas pelo cron e divergências externas são marcadas para revisão. Testes cobrem cancelamento, vínculo concorrente, rollback, alteração externa e retry. Se banco e Google ficarem indisponíveis simultaneamente antes de registrar uma pendência, a falha fica apenas no log do servidor e requer investigação operacional.
- Kanban: 7 cards ativos em 1 pipeline medidos no banco conectado. Decisão registrada no README: manter carregamento atual e reavaliar com 200 cards ativos por pipeline ou p95 autenticado >500 ms.
- `Cards.ts` reexporta `BuscarEmpresasBpm`, `ListarUsuariosResponsavelBpm` e `ExcluirCardBpm`; implementações extraídas para `CardsConsultas.ts` e `CardsExcluir.ts`, preservando guards e transação. Nenhuma migration ou mudança de schema.

## Arquivos da entrega

- Gate e deploy: `vitest.config.ts`, `scripts/deploy-staging-release.sh`.
- Anexos: `src/actions/bpm/Anexos.ts`, `src/app/api/bpm/upload/route.ts`, `src/lib/bpm/anexos-lifecycle.ts`.
- Google e reconciliação: `src/actions/bpm/GoogleMeet.ts`, `src/lib/bpm/google-meet-compensacao.ts`, `src/app/api/bpm/jobs/automacoes/route.ts`.
- Cards: `src/actions/bpm/Cards.ts`, `src/actions/bpm/CardsConsultas.ts`, `src/actions/bpm/CardsExcluir.ts`.
- Documentação: `src/app/PainelAlpha/AlphaCRM/README.md`, `docs/stories/story-rm-2026-8ba322-reduzir-manutencao-e-risco-operacional.md`, `.bibble/memory/decisions.md`.
- Testes: `tests/bpm/anexos-lifecycle.test.ts`, `tests/bpm/google-meet-compensacao.test.ts`, `tests/bpm/excluir-card.test.ts`, `tests/bpm/card-modal-integration.test.ts`, `tests/bpm/cnpj-mascara.test.ts`, `tests/bpm/upload-validacao.test.ts`, `tests/bpm/google-meet-etapa-guard.test.ts`, `tests/bpm/board-exclusao-local.test.ts`.
