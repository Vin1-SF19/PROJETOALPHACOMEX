# Story — Contratos pendentes no Comercial e retorno do Financeiro

## Status

Done — staging READY e reteste Admin manual autenticado aprovados, com documentos, atualização ao vivo, anexo readonly e aviso real sem duplicação ao reabrir. Gerador/finalização e assinado positivo permanecem cobertura local; produção fora do escopo.

## Executor Assignment

- **Executor:** `@dev`, com backend/documentos e interface em responsabilidades delimitadas.
- **Quality gate:** `@qa`; `@architect` revisa vínculo, prontidão e idempotência.
- **Ferramentas:** testes focais de serviços/actions/React, lint, typecheck, suíte completa, build e navegador autenticado em staging.
- **Publicação:** exclusivamente `@devops`, somente em staging nesta entrega.
- **Preparação:** `@sm`, somente esta story; nenhum código, teste, Git ou banco pelo Scrum Master.

## Story

**Como** closer responsável pelo card no funil Revisão de Radar, **quero** acompanhar separadamente as pendências de Contrato para envio e Contrato assinado e ser notificado quando o Financeiro finalizar e disponibilizar um contrato apto ao envio, **para** agir no momento correto sem procurar documentos em outro funil nem confundir geração com assinatura.

## Fonte, contexto e limites

Pedido atual do usuário: **“Agora no funil de revisoa radar na etapa Contrato fechado, os campos Contrato para envio e Contrato assinado, eles devem ficarem num estilo de pendente, pulsando levemente, ai quando no funil do financeiro o contrato for gerado (tem a automação), ele atualiza ali, alem de aparecer nos anexos tambem, quando o contrato estiver ali, ele muda para verde e manda uma notificação para o closer responsavel, dizendo que o contrato esta pronto para envio”.**

A melhoria complementa o retorno existente Comercial ↔ Financeiro; não instala outro fluxo de geração ou encaminhamento. A [story de alinhamento](story-alpha-crm-alinhamento-cards-fluxo-contrato.md#acceptance-criteria), AC 7–12, determina que rascunho `CONFERENCIA` não equivale a documento validado/pronto, que a disponibilização respeita a mesma contratação e que acesso pelo Comercial não concede acesso global ao Financeiro. A [Elaboração ativa](story-financeiro-ativo-elaboracao-contrato.md#acceptance-criteria), AC 7, usa o gerador já existente e preserva geração idempotente. **Decisão explícita do usuário:** “Após finalizar no Financeiro, mantendo a conferência atual”. Assim, o pedido preserva a conferência vigente: a minuta gerada pela automação pode existir antes, mas o verde e a notificação dependem da finalização válida no Financeiro. Assinatura, pagamento e conclusão financeira continuam estados independentes.

- Trabalhar na worktree isolada `crm-contratos-pendentes-20261021`, sobre staging confirmado por DevOps, base inicial `87c2e78f`. Não incorporar arquivos sujos de outras entregas.
- Staging e commit/push automáticos estão autorizados pelo usuário. Esta funcionalidade nova **não tem autorização de produção**; promoção anterior não a cobre.
- Priorizar código/contratos existentes, sem novo schema, migration, backfill ou configuração em massa. Se surgir necessidade real de operação coberta pela política Vault, preparar relatório/backup completo verificado e pedir consentimento específico antes de executar esse passo. Operação CRUD normal de cenário fictício não implica aprovação de migração.
- Não enviar contrato externamente, acionar assinador, fabricar assinatura/pagamento/NF, marcar conclusão financeira ou remover validação para demonstrar a melhoria. A notificação solicitada é interna, no mecanismo existente do painel.

## Critérios de aceite

1. **Pendências distintas e acessíveis:** no card Comercial em Contrato fechado, os dois campos exibem estado textual de pendência e pulsação discreta enquanto seu próprio documento não estiver disponível. A apresentação respeita o tema e `prefers-reduced-motion`, mantém leitura/contraste/foco e não depende apenas de cor. Estados anteriores válidos não são resetados por reabrir/refetch.
2. **Documento correto e mesma negociação:** reutilizar geração automática/retorno financeiro existentes e vínculo autorizado da contratação para refletir o documento correspondente no Comercial e na aba Anexos. Não selecionar apenas por empresa, estágio, PDF mais recente ou primeiro card financeiro: duas contratações da mesma empresa e vínculo de outra empresa não podem misturar documentos.
3. **Prontidão após conferência:** conforme resposta explícita do usuário, Contrato para envio fica verde/disponível somente **após finalizar no Financeiro, mantendo a conferência atual**, com PDF/documento correspondente válido e acessível e os requisitos de elaboração já exigidos pelo helper vigente. A geração automática de rascunho em `CONFERENCIA` não satisfaz essa condição. Documento ausente, blob inacessível, transação não confirmada ou falha de geração/finalização não permitem verde/notificação. Preservar o caminho manual válido já suportado, sem tornar a mera presença de um PDF prova de prontidão. Essa disponibilização não afirma envio ou assinatura.
4. **Assinado independente:** gerar/finalizar minuta ou marcar envio não torna Contrato assinado verde. Esse campo só indica documento assinado disponível conforme evidência/estado válido do fluxo atual. Assinatura real/documento assinado, substituição, ausência e falha não podem ser confundidos com o contrato para envio. Não criar provedor nem fluxo novo de assinatura.
5. **Notificação interna útil e única:** no primeiro evento confirmado de prontidão após a finalização válida descrita no AC 3, criar/reutilizar notificação para o closer responsável correto com mensagem clara de contrato pronto para envio, identificação suficiente da empresa/card e navegação autorizada ao contexto comercial. Repetir automação, callback, finalização, salvar/refetch, abrir card ou tentar novamente não duplica a notificação do mesmo evento/documento. Não notificar outro colaborador por fallback arbitrário, rascunho em conferência ou estado não confirmado. Definir e testar o comportamento quando não houver responsável elegível e em eventual substituição legítima de documento.
6. **Atualização confiável:** card comercial aberto e lista de anexos atualizam após commit, sem exigir fechamento/reabertura e sem apagar rascunhos locais, furar CAS, produzir avisos falsos ou alterar indevidamente o status pós-fechamento. Não mostrar sucesso antes de gravação/documento confirmados; falhas apresentam estado honesto e recuperação pelos mecanismos atuais.
7. **Permissões e privacidade preservadas:** consultas, download/preview, anexos e navegação da notificação revalidam autorização no servidor e vínculo/documento. O closer autorizado consegue consultar pelo card comercial sem acesso global ao pipeline Financeiro. Documento privado não se torna URL pública nem é copiado a outro cliente; sessão/papel não são fabricados para teste.
8. **Regressões e fechamento verificáveis:** cobrir pendente→conferência→finalizado/pronto, assinado independente, anexos sem duplicação, duas contratações/empresas, usuário negado, responsável ausente, replays/concorrência/falhas e preservação de rascunhos. Executar quatro gates e revisões Sage/Probe/Anubis/Lens, publicar primeiro no staging e retestar com dados fictícios e ambiente/revisão confirmados. Atualizar checklist/File List e registrar alcance real, limitações e evidência sanitizada; não declarar conclusão apenas por inspeção estática ou toast.

## Tasks / Subtasks

- [x] Registrar decisão do usuário: disponibilizar/notificar após finalizar no Financeiro, preservando conferência (AC 3, 5).
- [x] Confirmar blueprint Scout: componentes dos dois campos, consulta contratual, geração/finalização/upload, anexos, notificações e eventos; decidir fronteiras técnicas e elegibilidade preservando regras vigentes (AC 1–7).
- [x] Implementar projeção/retorno do documento correto e listagem autorizada nos anexos, sem duplicar armazenamento nem vazar outra negociação (AC 2–4, 7).
- [x] Reutilizar notificação interna no evento confirmado de prontidão, com destinatário e deduplicação consistentes; proteger replay/falha/ausência de closer (AC 5–7).
- [x] Aplicar pendência/verde independentes, pulsação acessível e atualização sem reabrir ou perder rascunho (AC 1, 3–4, 6).
- [x] Acrescentar regressões significativas e revisar integração/segurança; executar lint, typecheck, suíte completa e build (AC 8).
- [x] Publicar por DevOps no staging; demonstrar cenário fictício com documentos/estado financeiro legítimos, anexos e notificação do closer; concluir relatório/story e File List sem publicar produção (AC 8).

## Dev Notes

### Contexto acumulado

`accumulated-context.md`, `.aiox/gotchas.json` e o caminho legado `.Codex/commands/AIOX/agents/sm.md` não foram localizados na preparação; persona canônica `.aiox-core/development/agents/sm.md`. A coerência usa as stories atuais e seu código, não conteúdo presumido de documentos ausentes.

- [Alinhamento Comercial/Financeiro](story-alpha-crm-alinhamento-cards-fluxo-contrato.md#dev-notes): consulta estreita pelo Comercial, comportamento histórico de prontidão condicionada a documento válido, retorno sem regredir enviado/assinado, tarefa única por contratação, CAS e realtime após commit.
- [Elaboração ativa](story-financeiro-ativo-elaboracao-contrato.md#dev-notes): a automação `GERAR_CONTRATO` pode criar rascunho `CONFERENCIA`; disponibilidade de rascunho não prova validação nem assinatura. Confirmar o estado/configuração atual em staging antes do reteste, sem extrapolar inventário histórico.
- [Autosave](story-rm-2026-b88712-autosave-card-crm.md): preservar upload privado, recibo, associação de campo, concorrência e rascunhos. Um simples valor textual ou URL estrangeira não substitui associação autorizada do documento.
- Não são solicitadas dependências ou variáveis novas. Sem orientação arquitetural adicional encontrada nos caminhos de framework/arquitetura esperados; a implementação deve reutilizar contratos verificados pelo Scout/arquitetura, não inventar novos provedores ou tabelas.

### Blueprint de integração

Blueprint Scout recebido pela coordenação; caminhos existentes confirmados na base. São pontos de integração, não lista de arquivos obrigatoriamente alterados:

| Responsabilidade | Arquivos existentes |
| --- | --- |
| Elegibilidade e retorno Comercial/Financeiro | `src/lib/bpm/contratacao-comercial-server.ts` |
| Projeção do card e registro de anexo assinado | `src/actions/bpm/Cards.ts` (`ObterCard`), `src/actions/bpm/Anexos.ts` |
| Finalização do documento e retorno após commit | `src/actions/gerador-documentos.ts` (`FinalizarDocumento`) |
| Geração e atualização por automações | `src/lib/bpm/automacoes/executor.ts`, `src/lib/bpm/automacoes/central-runtime.ts` |
| Acesso autenticado ao contrato pelo Comercial | `src/app/api/bpm/cards/[cardId]/contrato/route.ts` |
| Consulta e ações estreitas de acompanhamento | `src/actions/bpm/AcompanhamentoContratacao.ts` |
| Input reutilizado e campos do card | `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx`, `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx` |
| Histórico/anexos e atualização do detalhe | `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`, `CardFullViewModal.tsx` |
| Estado pós-fechamento e acompanhamento | `src/app/PainelAlpha/AlphaCRM/CardModal/PainelStatusPosFechamento.tsx`, `PainelAcompanhamentoContratacao.tsx` |

A arquitetura aprovada em `docs/architecture/crm-contratos-pendentes-comercial-20261021.md` define projeção versus referência, identidade documental e ciclo de vida do arquivo. A implementação preserva compatibilidade sem schema, sem duplicação física nem registros materializados por leitura. [Fonte: blueprint Scout, arquitetura e revisões locais desta entrega.]

## Testing

Testes existentes: `tests/bpm/contratacao-comercial.test.ts`, `contratacao-comercial-download.test.ts`, `acompanhamento-contratacao-actions.test.ts`, `anexos-idempotencia.test.ts`, `anexos-aba-card-react.test.ts`, `anexo-selecao-manual-react.test.ts`, `anexo-handoff-access.test.ts` e `tests/gerador-documentos/finalizar-documento.test.ts`. Reutilizar padrões do repositório: serviços/actions com identidade e DB controlados, testes React de estados/realtime e regressões de anexos/gerador/notificações. Usar fixture SQLite privada para integração local, sem token remoto ou dados reais.

Cenários mínimos: ambos pendentes; rascunho em conferência ainda pendente; PDF final apto; arquivo ausente/inacessível; somente minuta disponível com assinatura pendente; assinatura real válida; replay/concorrência da geração e finalização; substituição legítima sem spam; closer atual/ausente/inativo; dois contratos da mesma empresa; vínculo entre empresas; card comercial sem permissão; UI aberta com rascunho local; falha antes/após commit; redução de movimento e navegação da notificação. Demonstrar que reabrir/refetch não cria notificação por efeito de leitura.

Gates: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Executar Sage/Probe/Anubis/Lens e revisão de diff nos papéis apropriados, sem substituir execução por leitura de código. Reteste remoto usa staging e cenário fictício autorizado; pode exigir geração/conferência legítimas pelos mecanismos atuais. Registrar o que foi ou não exercitado, sem alegar assinatura ou envio externo não realizados.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** Integration; secundárias Frontend, API e Security; complexidade alta pelo fluxo de documentos privados entre cards e notificação idempotente.
- **Specialized Agents:** `@dev` implementação/pré-commit, `@architect` contratos de vínculo/prontidão, `@ux-design-expert` acessibilidade dos estados, `@qa` testes/parecer, `@devops` publicação. Sage/Probe/Anubis/Lens nas etapas correspondentes; Vault apenas se surgir operação coberta pela política.
- **Quality Gates:** pré-commit com testes/diff; pré-PR se aplicável; pré-deployment staging com gates, ambiente, rollback de código e revisão. CodeRabbit habilitado; registrar indisponibilidade e fallback independente se necessário.
- **Self-Healing:** Dev light, até 2 iterações/15 min CRITICAL, HIGH documentado; QA full, até 3 iterações/30 min CRITICAL/HIGH; DevOps check/report-only. Nenhuma revisão automática dispensa política Vault ou autoriza produção.
- **Focus Areas:** identidade da negociação, documento privado, rascunho versus pronto versus assinado, destinatário/deduplicação, atualizações pós-commit, rascunhos/CAS, acessibilidade e regressão financeira.

## Validação do draft — River

Checklist `.aiox-core/product/checklists/story-draft-checklist.md` aplicado integralmente em modo YOLO após blueprint e resposta do usuário.

| Categoria | Resultado | Evidência |
| --- | --- | --- |
| Objetivo/contexto | PASS | Pedido, benefício, comportamento anterior e decisão explícita resumidos. |
| Orientação técnica | PASS | Caminhos Scout, integração existente e fronteira arquitetural definidos. |
| Referências | PASS | Stories relacionadas com trechos relevantes e inventário atual. |
| Autossuficiência | PASS | Prontidão, assinatura, autorização, escopo e exceções claros. |
| Testes | PASS | Regressões, quatro gates e reteste honesto no staging. |
| CodeRabbit | PASS | Papéis, gates, self-healing e fallback documentados. |

**READY para implementação, clareza 9/10; sem bloqueio documental.** O desenho técnico segue com o arquiteto antes de implementar os contratos afetados; isso não exige renovar autorização genérica. Este checklist valida a preparação, não aprova código, banco ou publicação.

[AUTO-DECISION] Novo epic/ClickUp → story local descritiva no caminho solicitado; não criar comunicação externa nem inventar escopo. [USER-DECISION] Geração versus finalização → “Após finalizar no Financeiro, mantendo a conferência atual”; nenhum verde/notificação de pronto apenas por criar a minuta, nem assinatura presumida.

## Dev Agent Record

### Execução / evidências

Implementação concluída pelos owners de backend/frontend conforme blueprint e arquitetura: projeção read-only dos dois documentos da mesma contratação, prontidão após finalização válida no Financeiro, assinatura independente, notificação interna única ao closer elegível, preview/download autenticados, pendência/verde acessíveis e atualização sem perder rascunhos. Anexos projetados não duplicam arquivo nem dão acesso global ao Financeiro. Nenhuma mudança de schema, migration, dependência ou variável de ambiente foi necessária.

Worktree autoritativa `crm-contratos-pendentes-integrado-20261021`, HEAD/base atual `b71f2cb9f3c830ed415237ac75555543783aa100`. Instagram `50e53866`, Líder Operacional `2f4d788b` e correção Instagram sem CNPJ `b71f2cb9` preservados. Os 31 paths originais de contratos sobre `87c2e78f` foram transferidos por patch binário/merge de três vias, com três sobreposições resolvidas automaticamente e verificadas por hash. A correção do mock em `tests/bpm/excluir-card-action.test.ts` acrescenta o 32º path: faltava exportar `bpmCardIdSchema` no mock; a primeira falha de suíte sobre 87 e seus logs foram preservados, sem inventar um defeito novo da aplicação.

Forge integrado sobre 2f: `npm run typecheck` exit 0 (42,85 s), `npm run lint` exit 0 (51,71 s; 1.193 avisos preexistentes), suíte completa exit 0 com 704 arquivos/5.451 testes aprovados, quatro skipped e um todo (82,15 s). Build integral exit 0 em 180,47 s: Prisma generate, build:player e Next webpack com heap 4.096 MiB/CPU controlada/diretório exclusivo, equivalente às fases do script oficial sem mudar fonte/config. Fixture SQLite privada e segredo efêmero, sem ENV ou banco remoto carregados. Custódia antes/depois idêntica `26ab10d49d825fb87e558fe000cc3a3468c2ef270f2ba3c73f99c517992e1ddf`; smoke local aprovado com proteção CRM e dos dois slots contratuais anônimos.

FF disjunto para b71 preservou os hashes dos 32 paths da feature. Conforme parecer QA, os quatro gates integrados permanecem aplicáveis ao escopo de contratos; o delta concorrente recebeu novo typecheck combinado exit 0 (52,30 s), sete arquivos/104 testes aprovados em SQLite local isolado, e lint dos dois fontes b71 exit 0. Fingerprint final antes/depois `134e5a068c5c360fe3c2a88f62cb4a4f312f6f4df13c6974dae321dcb5791a0f`, inalterado. Não se apresentam os gates completos de 2f como nova execução depois do FF. Lens/Flux/Sage/Probe/Anubis locais e QA pré-push aprovados; CodeRabbit indisponível, com revisão independente como fallback.

Preflight operacional confirma custom environment staging e bancos separados por fingerprints privados; produção permanece fora de escopo. Nenhuma variável, script cadastral, worker global, migration ou escrita de banco foi executada pelo DevOps. Reteste remoto será limitado à empresa fictícia 3066 e à conta Admin real autorizada. Geração automática/finalização e assinatura remota só serão declaradas se efetivamente demonstradas sem fabricar assinatura, pagamento, NF ou conclusão financeira; o cenário assinado pode permanecer limitação com evidência local. A inspeção SELECT-only de configuração não executa automações e não prova fila histórica vazia.

Evidência privada: `/var/tmp/alpha-crm-contratos-pendentes-20261021/integrado/forge-result.json`, logs `gate-*`, `delta-b71-result.json`, `delta-b71-tests.json`, `disjoint-integration-b71.json` e `finance-automation-inventory.json`; transferência em `integration/integration-result.json`. No checkpoint pré-push descrito acima, publicação, SHA/READY, smoke público e reteste autenticado estavam pendentes; foram concluídos no fechamento remoto registrado abaixo. Nenhuma implementação, mutação ou publicação foi executada pelo SM.

### Fechamento remoto confirmado

Publicação staging por push normal: feature `48ebc3c95a4b916d4f93c866f3fac0c34ef0d92f` e merge preservador `5e3d629c822a78a8e3ec413e6d99f5e87bb420d7`, com pais feature e `861e43d7`. Deployment Git próprio `dpl_H4JDX3syGmX8mZ3rq2pxn1ZzFwYs` READY e alias `https://staging.alpha-comex.com` conferidos no custom environment staging. Produção não recebeu esta feature. Smoke anônimo: raiz/providers/sessão/broadcast/chunks 200, CRM 307 protegido e slots contratuais 401; retry dirigido após um URLError transitório do primeiro GET para envio aprovou em 0,23 s. Metadados críticos de ambiente inalterados e bancos separados confirmados privadamente.

Reteste Admin real no card da empresa fictícia 3066, responsável id1: dois campos pendentes pulsando discretamente (2 s), reduced motion sem animação. PDF fictício manual no Financeiro sozinho manteve pendência; após Elaborado=Sim no fluxo vigente, Contrato para envio ficou verde no Comercial ainda aberto, sem reabrir. PDF autenticado 200/application-pdf/1.173 bytes/%PDF-, private-no-store e nosniff, com preview UI. Badge/lista de anexos iguais a um, somente leitura e sem delete. Assinado permaneceu PENDENTE e ausência retornou 404.

O sino real do responsável mostrou um alerta Enviar contrato com empresa, documento, mensagem de pronto para envio e horário 16:40 Brasília. Reabrir/refetch preservou o mesmo ID de alerta/tarefa/alertaEm e contagem um, comprovado por `remote-result.json` e `remote-dedup-proof.json` privados. Nenhum novo erro da feature; dois 503 de voz preexistentes separados. QA final APPROVED no escopo manual demonstrado.

Limites preservados: gerador/finalização automática e signed positivo possuem cobertura local, não foram exercitados remotamente. Nenhuma assinatura, pagamento, NF, conclusão financeira ou envio externo foi fabricado. CRUD normal financeiro pode acionar o orquestrador/housekeeping existente; não se afirma zero efeito indireto. Nenhum worker/global foi invocado manualmente por CLI; sem migration/schema/ENV ou cópia entre bancos. Fechamento exclusivamente documental (story, relatório e três memórias), mantendo o runtime 5e3 validado; última publicação documental será conferida privadamente, sem novo ciclo de commit para registrar o próprio commit.

Relatório sanitizado: `docs/reports/validacao-contratos-pendentes-staging-2026-10-21.md`. Evidências brutas, recibos, credenciais e PDF permanecem fora do Git. Rollback de código preparado no staging saudável anterior `861e43d7` / `dpl_3L7JtADnbhgqrfFyAf9SBQk8K7WN`, sem rollback de dados do reteste normal.

### File List

36 arquivos únicos desta entrega: 32 da implementação/arquitetura/story e quatro acréscimos documentais de fechamento (relatório e três memórias). O último commit altera somente cinco documentos, incluindo esta story já existente; caminhos concorrentes preservados mantêm seu histórico próprio.

- `.bibble/memory/codebase-map.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/journal.md`
- `docs/architecture/crm-contratos-pendentes-comercial-20261021.md`
- `docs/reports/validacao-contratos-pendentes-staging-2026-10-21.md`
- `docs/stories/story-crm-contratos-pendentes-comercial-20261021.md`
- `src/actions/bpm/AcompanhamentoContratacao.ts`
- `src/actions/bpm/Anexos.ts`
- `src/actions/bpm/Cards.ts`
- `src/actions/gerador-documentos.ts`
- `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/EstadoDocumentoContratacao.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelStatusPosFechamento.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `src/app/api/bpm/cards/[cardId]/contrato/route.ts`
- `src/components/bpm/anexos/VisualizadorAnexoCard.tsx`
- `src/components/bpm/anexos/VisualizadorContratoComercial.tsx`
- `src/lib/bpm/automacoes/central-runtime.ts`
- `src/lib/bpm/automacoes/executor.ts`
- `src/lib/bpm/contratacao-comercial-server.ts`
- `src/lib/bpm/contratos-comerciais.ts`
- `tests/bpm/anexos-aba-card-react.test.ts`
- `tests/bpm/anexos-idempotencia.test.ts`
- `tests/bpm/board-polling-react.test.ts`
- `tests/bpm/contratacao-comercial-download.test.ts`
- `tests/bpm/contratacao-comercial-poscommit.test.ts`
- `tests/bpm/contratacao-comercial-sqlite.test.ts`
- `tests/bpm/contratacao-comercial.test.ts`
- `tests/bpm/contratacao-geracao-bpm.test.ts`
- `tests/bpm/contratos-pendentes-campos-react.test.ts`
- `tests/bpm/contratos-projetados-preview-react.test.ts`
- `tests/bpm/contratos-projetados-seguranca.test.ts`
- `tests/bpm/excluir-card-action.test.ts`
- `tests/gerador-documentos/finalizar-documento.test.ts`

## QA Results

Pendente de implementação e revisão independente.

### 2026-10-21 — Quinn / Sage, Probe, Anubis, Lens e Flux — revisão local integrada

**Parecer da implementação e da árvore integrada testada: APPROVED.** Lens/Flux foram executados somente após `FORGE_PASS` dos quatro gates da worktree `crm-contratos-pendentes-integrado-20261021`, base `2f4d788b`. Sem bloqueantes críticos/importantes novos identificados. `forge-result.json` integrado registra typecheck exit 0 (42,85 s), lint exit 0 (51,71 s; zero erros/1.193 avisos existentes), build completo exit 0 (180,47 s), e suíte completa exit 0: **704 arquivos e 5.451 testes aprovados**, quatro skipped, um todo, zero falhas. O fingerprint `26ab10d49d825fb87e558fe000cc3a3468c2ef270f2ba3c73f99c517992e1ddf` permaneceu idêntico antes/depois; a custódia inclui os arquivos novos. Smoke local do build PASS: raiz, providers, sessão e JavaScript disponíveis; CRM sem sessão redireciona ao login. Esses resultados são locais, sem acesso a banco remoto.

**Histórico honesto:** a primeira árvore sobre `87c2e78f` passou tipos/lint/build, mas a suíte teve uma falha de importação num mock antigo de exclusão, embora suas 5.377 assertions executadas passassem. O mock foi corrigido com importação parcial dos schemas/constantes reais, preservando as 17 assertions. Os logs iniciais permanecem separados; a aprovação utiliza os quatro gates novos completos da integração, não a execução com importação falhada.

**Sage/Anubis:** `tests/bpm/contratos-projetados-seguranca.test.ts` acrescenta **61 testes independentes**, aprovados isoladamente e na suíte integrada, com ESLint sem avisos. A cadeia real de rota, ownership e resolvedor foi mantida; apenas autenticação de entrada, Prisma, armazenamento e efeitos externos são simulados. Cobertura: closer autorizado no Comercial sem acesso global Financeiro; sessão antiga não supera conta inativa/CRM revogado; ACL revalidada a cada GET; vínculo único/inverso e mesma empresa; arquivo atual de seu card/campo; CONFERENCIA versus FINALIZADO; origem e cliente do documento gerado; assinatura independente; rejeição de URLs/tipos/IDs forjados, armazenamento estrangeiro, credenciais/query/hash e MIME físico divergente; cancelamento de stream, nome seguro, no-store/nosniff, download de Office e ausência de referências financeiras/tokens no DTO. Leituras/refetch não criam tarefa, alerta, histórico ou gravação.

**Probe/Lens:** o blueprint arquitetural foi confrontado com o fluxo efetivo. `ObterCardBpm` entrega DTO aditivo; campos canônicos exibem projeções sem gravar IDs financeiros, preservando upload local como tal. A aba Anexos conta e lista a mesma coleção, deduplica apresentação e oferece exclusão somente dos anexos físicos. Preview usa exclusivamente a rota comercial e os dois tipos enumerados, com erro/retentativa. O card aberto recebe revisão quando seu manifesto muda no polling; sinal idêntico não o remonta nem dispara atualização infinita. A integração Instagram preserva seus handlers/mocks; os três overlaps foram comparados com merge independente sem conflitos. Sem novo menu ou concessão de permissão financeira.

| AC | Evidência local conferida |
| --- | --- |
| 1 | React de pendência/verde, texto, foco, motion-reduce, estados independentes e upload comercial preservado. |
| 2 / 7 | 61 adversários de acesso/proveniência; DTO somente leitura, vínculo/empresa/card/campo e stream autenticado. |
| 3 / 4 | Testes do gerador/finalização e domínio recusam CONFERENCIA, exigem documento apto e mantêm assinado independente. Geração não equivale a assinatura. |
| 5 | Domínio, pós-commit e SQLite real verificam tarefa canônica, replay sem renovar alerta, revisão nova, responsável inelegível, rollback de outbox e concorrência convergindo. Pusher falho não desfaz documento confirmado. |
| 6 | Fingerprint/CAS e histórico, assinatura posterior com tarefa existente, remoção, revisão do selecionado e testes React de rascunho/preview/anexos. |
| 8 | Quatro gates e revisões locais aprovados; publicação e reteste remoto permanecem pendentes. |

**Flux:** nenhuma dependência nova, schema ou configuração de build foi necessária. A projeção consulta somente o detalhe comercial aplicável e até dois slots; não introduz chamadas ao armazenamento/documentos por card do Kanban. Stream no servidor, fetch com cancelamento/no-store, React Query e limpeza de object URLs no cliente. Rota privada não é página pública de SEO. Não há baseline equivalente de bundle/CWV ou latência remota para afirmar ganho percentual. Observação informativa: o preview usa `response.blob()` em `VisualizadorContratoComercial.tsx:43`; arquivos grandes consomem memória no navegador, sem benchmark que permita quantificar impacto nesta entrega.

**Delta concorrente posterior:** staging avançou para `b71f2cb9` com seis caminhos da correção CNPJ opcional do Instagram; nenhum sobrepõe os 32 caminhos desta feature. Diff integral revisado: dois arquivos de aplicação, dois de teste e dois de documentação; sem mudança no boundary de contratos/ownership/armazenamento. `disjoint-integration-b71.json` confirma os 32 hashes da feature preservados e zero conflitos; a worktree atual já incorpora b71. A base concorrente tem seus próprios gates aprovados (698 arquivos/5.360 testes e build Vercel READY), que não são confundidos com a suíte de 5.451 da feature. Antes do push normal, conferir typecheck do conjunto e testes direcionados de Instagram, modal NoLoss, polling e contratos; não repetir cegamente quatro gates sem mudança que o justifique.

**Limites de homologação:** esta decisão aprova implementação/revisão locais e libera o percurso de publicação exclusiva em staging após os checks incrementais. Não declara E2E remoto, automação de geração remota, assinatura real, envio externo ou produção. O reteste usa somente o cenário fictício autorizado, com conta real e metadados conferidos; upload no campo assinado pode executar regras centrais existentes do card e deve respeitar esse limite. Arquivo físico posteriormente indisponível retorna erro seguro; referência documental elegível não garante eternamente a existência do objeto. Não encerrar a story como concluída antes de READY/SHA/alias e reteste efetivo.

Evidências privadas: `/var/tmp/alpha-crm-contratos-pendentes-20261021/qa-seguranca.{log,json}`, `integration/integration-result.json`, `integrado/forge-result.json`, `integrado/source-custody-{1,2}.json`, `integrado/gate-tests.log`, `integrado/gate-runtime-result.json` e `integrado/disjoint-integration-b71.json`. CodeRabbit indisponível no caminho configurado; revisão independente foi o fallback. QA não alterou runtime, dados remotos, configuração ou Git; esta escrita modifica apenas QA Results.

### 2026-10-21 — Quinn: ratificação da integração b71 / GO pré-push staging

**GO pré-push para staging: APPROVED.** `delta-b71-result.json` foi conferido: typecheck exit 0 em 52,30 s; sete arquivos direcionados e **104 testes aprovados**, zero falhas, em 5,62 s; lint dos dois arquivos de aplicação do delta exit 0, sem mensagens. O conjunto inclui assunção Instagram, modal NoLoss, polling, campos/preview dos contratos, os 61 adversários de segurança e os testes reais SQLite. As verificações usaram sentinela SQLite privada, sem carregar ambiente remoto. Fonte permaneceu igual no início/fim (`134e5a068c5c360fe3c2a88f62cb4a4f312f6f4df13c6974dae321dcb5791a0f`).

`disjoint-integration-b71.json` registra base `b71f2cb9f3c830ed415237ac75555543783aa100`, seis caminhos concorrentes disjuntos e os 32 hashes desta feature preservados, sem conflito, gravação de banco ou alteração de ambiente. A aprovação combina os quatro gates completos da feature integrada em 2f com o inventário/revisão e os checks afetados do delta; não relata a suíte completa de 5.451 testes como nova execução sobre b71. Ref local e origin/staging foram conferidos em b71 nesta revisão. Não há bloqueante novo que justifique repetir os quatro gates completos.

DevOps pode preparar commit/push normal exclusivamente para staging, preservando novas referências concorrentes, configurar o build no ambiente próprio de staging e conferir READY/SHA/alias. Publicação e reteste autenticado com documentos fictícios, atualização dos dois slots, anexos e notificação real do responsável permanecem **pendentes**; nenhuma conclusão sobre E2E remoto, assinatura, envio externo ou produção é inferida. Nenhuma fonte, teste, configuração, banco remoto ou operação Git foi alterada nesta ratificação; QA atualizou somente esta seção e encerra a escrita para liberar o fechamento pelo executor.

### 2026-10-21 — Quinn: QA FINAL / APPROVED — staging e reteste delimitado

**Parecer final: APPROVED. Recomendação ao owner: Done, com os limites abaixo registrados.** Publicação efetiva em `5e3d629c822a78a8e3ec413e6d99f5e87bb420d7`, deployment `dpl_H4JDX3syGmX8mZ3rq2pxn1ZzFwYs` READY, ambiente customizado staging e alias `https://staging.alpha-comex.com` conferidos. O merge preserva a feature `48ebc3c9` e a correção concorrente `861e43d7`. A prova independente de três vias confirmou `Cards.ts` e os 31 demais arquivos da feature preservados; o delta861 passou typecheck, lint afetado e oito arquivos/**187 testes**, com fonte inalterada (`763dba63ceb3a303dff3ee1be6ea2da397aae9cf54950ed4c4f438c4e55f5ef9`). Somam-se os quatro gates completos e os checks b71 já registrados, sem descrevê-los como uma suíte completa repetida sobre cada merge.

**Reteste autenticado real de staging:** conta Admin ID 1, responsável pelo cenário fictício da empresa 3066; Comercial `cmvi5ztja000007l8livtiw1o`, Financeiro `cmvi9qcjb000608jpdywhf639`. Evidência consolidada em `remote-result.json` às 19:44:31 UTC. Os dois campos inicialmente pendentes exibiram pulsação de 2 s; reduced motion resultou em animação `none`. O upload isolado no Financeiro permaneceu pendente. Após a confirmação manual vigente de Elaborado=Sim, o contrato para envio ficou disponível/verde no Comercial ainda aberto, sem exigir reabrir; o assinado continuou pendente. A captura final foi inspecionada e mostra nome do PDF e identificação “Disponível pelo Financeiro”.

A aba Anexos apresentou **uma única entrada projetada, somente leitura**. Preview autenticado abriu PDF HTTP 200, MIME application/pdf, 1.173 bytes e assinatura `%PDF-`, com nosniff/cache privado no-store; o slot assinado sem documento retornou 404. O sino real exibiu uma notificação para ADM: “Contrato pronto para envio”, empresa fictícia, nome do documento e horário de Brasília. Ao reabrir/refazer a consulta, a mesma tarefa/identidade e `alertaEm` permaneceram iguais: `remote-dedup-proof.json` compara os dois snapshots, com um alerta e um anexo, sem duplicação por leitura. Isso comprova esse percurso de reabertura; replays de finalização/concorrência são sustentados pelos testes locais, não apresentados como operações remotas que não ocorreram.

**Limites que permanecem explícitos:** o percurso remoto usou PDF fictício enviado manualmente e confirmação manual válida no Financeiro. Geração automática e `FinalizarDocumento` foram exercitados por testes automatizados locais, incluindo integração SQLite, e não constituem E2E remoto nesta entrega. Assinado positivo não foi enviado remotamente; sua independência, UI e acesso foram cobertos localmente, e a ausência foi conferida no staging. Não se fabricaram assinatura real, pagamento, NF, conclusão negocial ou envio externo. A conta remota foi Admin; closer comum sem ACL financeira foi comprovado pela cadeia real de autorização dos testes, não por uma sessão remota adicional.

CRUD normal da aplicação pode executar o orquestrador por card e a manutenção de lease já existentes; não se relata “nenhum worker executado” de modo absoluto. Nenhum CLI/worker global foi invocado manualmente para demonstrar o resultado. Não houve erro de runtime da nova feature nas evidências; duas respostas 503 da voz são limitação conhecida separada, sem aceite de recuperação desse serviço. Nenhuma publicação em produção integra este parecer.

Evidências finais conferidas: `remote-result.json`, `remote-dedup-proof.json`, `comercial-envio-pendente.png`, `comercial-envio-disponivel.png`, `comercial-anexos-projetados.png` e, em `integrado/`, `publication.json`, `aliases-contracts-ready.json`, `smoke-contracts-ready.json`, `smoke-contract-slot-retry.json`, `delta-861-result.json` e `merge-861-proof.json`. O smoke anônimo inicial teve um URLError transitório no slot de envio, cuja repetição direcionada confirmou 401; o preview autenticado posterior confirmou o PDF. Evidências privadas não devem ser versionadas como dumps brutos. QA atualizou exclusivamente esta seção; status/checklist/File List e fechamento documental ficam com o executor. Arquivo liberado para DevOps.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-21 | 0.1 | Requisitos de pendência/prontidão/assinatura independentes, anexos vinculados e notificação interna idempotente, somente staging. | River (@sm) |


## Integração concorrente — baseline de staging atualizada

A worktree autoritativa desta entrega passa a ser `crm-contratos-pendentes-integrado-20261021`, baseada em `2f4d788bd6276dd0e092e6e5c1595151ac0f1bbb`. Foram preservadas a integração Instagram `50e53866` e a consistência de Líder Operacional `2f4d788b`; nenhuma alteração de ambiente, execução de script cadastral, configuração de banco ou publicação de produção foi realizada. Os 31 caminhos da feature desenvolvida sobre `87c2e78f` foram transferidos por patch binário com merge de três vias e cópia apenas dos arquivos novos. Cards, PipelineBoardClient e o teste de polling foram mesclados automaticamente preservando ambos os deltas. O delta adicional de `2f4d788b` não tem sobreposição com estes 31 caminhos.

A worktree original, logs e evidência dos gates sobre `87c2e78f` permanecem preservados. A suíte original apresentou mock incompleto de validações no teste de exclusão; o owner corrigiu somente o mock na worktree integrada. Os quatro gates sobre 2f passaram; depois houve FF disjunto b71 com checagens afetadas e ratificação QA, conforme Dev Agent Record. Esse checkpoint de integração precedeu a publicação; READY e reteste manual foram posteriormente concluídos conforme fechamento remoto.

Baseline final de publicação: `b71f2cb9`; FF disjunto autorizado e verificado preservou todos os 32 hashes da feature, sem alteração do seu runtime. Fonte/custódia e validações estão discriminadas no Dev Agent Record.


### Integração final de tarefas — pré-push 861

O commit local de contratos `48ebc3c95a4b916d4f93c866f3fac0c34ef0d92f` congelou os 32 arquivos aprovados sobre b71. Novo avanço de staging `861e43d7` foi integrado por merge normal, preservando a correção concorrente de IDs documentais e retry de gravações ocupadas. Os 31 arquivos não sobrepostos da feature ficaram byte a byte idênticos; Cards corresponde exatamente a um merge independente de três vias, sem marcadores ou edição manual, mantendo o retorno comercial pós-commit fora do retry transacional. Nenhum arquivo foi escolhido integralmente como ours/theirs.

QA ratificou GO pré-push final: quatro gates integrados 2f (704 arquivos/5.451 testes), checagens b71 (sete arquivos/104 testes) e novo typecheck combinado, lint Cards/validations e oito focos de edição/tarefas/CAS/contratação/SQLite/pós-commit/documentos/exclusão aprovados sobre o merge 861. Os gates completos anteriores não são descritos como nova execução após cada integração. Provas `merge-861-proof.json` e `delta-861-result.json` no diretório privado integrado. No checkpoint pré-push 861, publicação/READY e reteste autenticado ainda estavam pendentes; o fechamento remoto abaixo registra sua conclusão. Somente staging autorizado. Os cinco caminhos concorrentes 861 permanecem no histórico próprio, sem serem apresentados como implementação nova desta feature.
