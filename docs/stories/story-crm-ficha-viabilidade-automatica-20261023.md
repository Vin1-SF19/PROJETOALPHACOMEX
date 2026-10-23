# Story — Ficha de análise de viabilidade automática no CRM

## Status

Ready for Review — QA APPROVED / GO para staging. Typecheck e build reais aprovados; testes e lint aprovados por composição explícita de fonte estável. Publicação e verificação remota ficam com DevOps; produção não autorizada.

## Executor Assignment

executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: ["revisão de contrato e diff", "testes de integração e concorrência", "npm run lint", "npm run typecheck", "npm test", "npm run build", "validação de staging"]

## Story e fonte

Como usuário do CRM no funil Revisão de Radar, quero que a entrada em Reunião Agendada gere automaticamente a mesma ficha PDF da Pré-Análise, para consultar e complementar a análise nos anexos da empresa sem repetir a geração manual.

Fonte: pedido direto de 23/10/2026. O agendamento em Agendar Reunião já encaminha o card para Reunião Agendada; o usuário solicita a ficha automática nesse destino, toast verde somente para quem gerou, clique no toast para acessar os anexos, botão “Complementar Ficha” acima da ficha, o mesmo modal da Pré-Análise com Salvar/Fechar e visualizador próprio ao abrir o PDF.

Não há novo epic solicitado. Esta story complementa o fluxo documentado em `story-alpha-crm-meet-avanco-automatico-reuniao-agendada.md` e o AC 8 de `story-alpha-crm-revisao-radar-reuniao-agendada-viabilidade.md`. A referência de paridade é `story-ialpha-ficha-reuniao-paridade-pre-analise.md`: reutilizar `FichaAlphaPDF` com `finalidade="pre-analise"`, preservando o conteúdo atual do modelo.

## Acceptance Criteria

1. Uma nova entrada do card na etapa Reunião Agendada do funil Revisão de Radar solicita a geração automática da ficha. O agendamento bem-sucedido em Agendar Reunião e o avanço existente continuam funcionando; entrar na etapa não depende de um clique adicional em Gerar Ficha. O gatilho deriva da transição confirmada e não de abrir/recarregar a tela.
2. O PDF usa o mesmo componente e a mesma variante atuais do botão Gerar Ficha em PDF da Pré-Análise, com dados persistidos da empresa/card e complementos confirmados da própria ficha. Lacunas permanecem sem dados fictícios; não há consulta ou associação de outra empresa nem um segundo template divergente.
3. Após o PDF ser gerado e persistido com sucesso, ele aparece na aba Anexos do card, associado à empresa correspondente. O arquivo usa a infraestrutura privada de anexos e suas permissões existentes; não é publicado como blob público nem fica disponível somente por download em base64.
4. Somente o usuário que originou a geração recebe o toast verde “Ficha de análise de viabilidade gerada para: [nome da empresa]”. Clicar no toast abre o card correto e sua aba Anexos. Outros usuários não recebem esse toast por um broadcast do card. Não emitir sucesso antes da persistência, por uma falha, por mero carregamento da tela ou por replay que apenas recupera um resultado já anunciado.
5. Na aba Anexos, imediatamente acima da ficha correspondente, aparece o botão “Complementar Ficha” para quem possui permissão de edição. O botão abre o mesmo `ModalPDF` utilizado pela Pré-Análise, preenchido com os dados da empresa e os complementos persistidos da ficha. A geração normal da Pré-Análise mantém seu comportamento atual.
6. No modo de complemento, o rodapé do modal oferece Salvar e Fechar. Salvar valida e persiste os complementos da ficha e atualiza o PDF anexado, com feedback de processamento e erro. Reabrir carrega os últimos valores confirmados. Fechar descarta o rascunho local sem substituir o conteúdo salvo. A chamada com erro mantém o modal aberto e não simula sucesso; cliques repetidos durante o salvamento não duplicam a operação.
7. Clicar na ficha abre o visualizador de PDF próprio do sistema, dentro da interface, reutilizando a infraestrutura de visualização dos anexos. Não exige abrir uma nova janela externa para visualizar o documento.
8. Retry, concorrência, reexecução do evento e reagendamento não produzem anexos ativos duplicados nem sobrescrevem silenciosamente os complementos mais recentes. Reentrada utiliza a ficha atual sem gerar outra versão; somente Salvar complemento cria uma nova versão quando a ficha já existe. A identidade da solicitação e a revisão esperada são verificadas no servidor. Salvar um rascunho baseado em revisão antiga é recusado como conflito; falha na geração/upload não elimina a última ficha válida, não desfaz uma reunião/transição já confirmada e permite retentativa segura.
9. As actions de leitura, geração, complemento e visualização verificam sessão, card/empresa e permissão apropriada no servidor. Os complementos pertencem ao snapshot da ficha; não sobrescrevem implicitamente o cadastro da empresa, os campos canônicos do card ou `ConsultaPreAnalise`.
10. A entrega reutiliza tabelas, armazenamento e processamento existentes. Não altera schema, não executa migration, seed/backfill, varredura retroativa de cards ou mutação em massa. Somente novas solicitações explícitas do fluxo são processadas. Qualquer necessidade estrutural descoberta deve voltar ao protocolo Vault do AGENTS antes de executar.
11. Testes meaningful cobrem geração a partir da transição, paridade do PDF, associação correta e privacidade, ator do toast e navegação, complemento/reabertura, conflitos, duplicação/retry e falhas. `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` são executados; checklist, File List e limitações reais da validação são atualizados. Commit/push e validação remota ocorrem primeiro no staging; produção exige pedido explícito posterior.

## Tasks / Subtasks

- [x] Reunir o pedido, precedentes e blueprint de backend/frontend (AC 1–11).
- [x] Conferir o contrato arquitetural final e aprovar a story antes do código (AC 1–11).
- [x] Reutilizar o modelo PDF da Pré-Análise e compor o snapshot com dados persistidos corretos (AC 2, 9).
- [x] Integrar solicitação idempotente à transição confirmada e processamento pós-commit/retry existente, sem backfill (AC 1, 8, 10).
- [x] Persistir o PDF como anexo privado e devolver estado/identidade/revisão para a UI (AC 3, 8–9).
- [x] Implementar leitura e salvamento autorizado dos complementos com controle de revisão, preservando o PDF anterior em erro (AC 6, 8–9).
- [x] Estender o mesmo ModalPDF com modo de complemento, valores iniciais e callback de salvar, preservando seu modo padrão (AC 5–6).
- [x] Integrar Complementar Ficha acima do anexo e visualizador interno (AC 5–7).
- [x] Exibir toast verde apenas para o ator após confirmação e conectar clique ao card/aba Anexos (AC 4).
- [x] Escrever/executar testes focados de integração, privacidade, concorrência, reabertura, navegação e falhas (AC 1–11).
- [x] Concluir revisão independente de segurança, UX e integração após os gates globais (AC 1–11).
- [x] Executar gates globais, atualizar checklist/File List e registrar limites de validação (AC 11).
- [ ] Publicar pelo DevOps no staging e verificar commit, deployment, alias e fluxo aplicável (AC 11).

## Dev Notes

### Contexto cruzado e fonte de arquitetura

O contrato de implementação foi preparado por `@architect` e conferido antes do código em `docs/architecture/crm-ficha-viabilidade-automatica-20261023.md`. O reconhecimento foi feito na base staging `296185df`, no worktree isolado `crm-ficha-viabilidade-automatica-20261023`.

A story anterior da etapa já exige a mesma Ficha Alpha usada pela Pré-Análise, preenchida a partir do card/empresa sem inventar dados. A story de paridade do iAlpha comprova a necessidade de selecionar explicitamente a variante `pre-analise` e preservar as perguntas atuais. [Source: docs/stories/story-alpha-crm-revisao-radar-reuniao-agendada-viabilidade.md#acceptance-criteria; docs/stories/story-ialpha-ficha-reuniao-paridade-pre-analise.md#contexto-e-decisão]

### Blueprint confirmado pelo reconhecimento

- Pré-Análise usa `src/components/ModalPdf.tsx`, que gera `FichaAlphaPDF` com `finalidade="pre-analise"`. O modo atual gera documento, chama `upsertConsulta` e abre uma janela; o modo de complemento deve receber callback próprio e preservar o modo padrão. O novo payload também omite `viabilidade`: esse campo acrescenta uma segunda página no renderer e impediria a paridade solicitada mesmo com a finalidade correta.
- A geração manual existente do CRM usa `src/actions/bpm/FichaViabilidade.ts` e `src/lib/bpm/ficha-viabilidade-server.ts`; hoje retorna base64 e não garante a variante da Pré-Análise. Não considerar esse download suficiente para AC 2–3. A API/download legado permanece compatível e independente da operação automática nova.
- O botão atual de geração no `PainelReuniao` passa a usar o novo serviço de geração persistida/retentativa, exibindo a mesma ficha da Pré-Análise nos anexos; não continua baixando o modelo antigo de duas páginas. Isso não remove a API legada de download para consumidores compatíveis.
- O executor genérico `GERAR_FICHA` usa um caminho com upload público e não deve ser reutilizado cegamente para o novo anexo privado.
- O modal de complemento receberá os nove valores manuais iniciais e callback assíncrono de salvar, segundo o contrato final. A action CRM com `success:false` deve produzir erro no callback; o modal fecha somente após confirmação.
- `PainelHistorico.tsx` contém a aba Anexos. Um painel específico da ficha nessa aba deve posicionar o botão acima do PDF e reaproveitar o visualizador de anexos existente.

Fontes e lista completa de integration points: [Source: docs/architecture/crm-ficha-viabilidade-automatica-20261023.md#paridade-com-pré-análise; docs/architecture/crm-ficha-viabilidade-automatica-20261023.md#contrato-backendfrontend; docs/architecture/crm-ficha-viabilidade-automatica-20261023.md#blueprint-de-integração-e-ownership].

Os DTOs ficam em módulo neutro `src/lib/bpm/ficha-viabilidade-documento.ts`; o serviço novo fica em `src/lib/bpm/ficha-viabilidade-automatica-server.ts`. O descriptor confirmado é `{anexoId, empresaId, empresaNome, dados, userLogado, revision}`. Leitura recomendada: `ObterFichaViabilidadeBpm({cardId})`; complemento: `SalvarComplementoFichaViabilidadeBpm({cardId, expectedRevision, extras})`. Não aceitar empresa/ator/anexo/URL arbitrários do cliente como autoridade. Os nove extras são `dataSituacao`, `horaSituacao`, `mesProtocolo`, `telefone`, `email`, `nomeResponsavel`, `observacoes`, `origemLead` e `origemLeadDetalhe`. [Source: docs/architecture/crm-ficha-viabilidade-automatica-20261023.md#contrato-backendfrontend]

O `ModalPDF` recebe props opcionais `modo: 'gerar' | 'complementar'`, `dadosManuaisIniciais` e `onSalvar(extras): Promise<void>`. O snapshot preenche o modal ao abrir por identidade/revisão, sem descartar rascunho sujo por realtime. A navegação transporta `abaInicial: anexos` pelo contrato de abertura, inclusive quando o card anterior já foi fechado; não depende de disparar evento DOM antes de montar o destino. [Source: docs/architecture/crm-ficha-viabilidade-automatica-20261023.md#contrato-backendfrontend]

### Dados, automação e limites

O reconhecimento recomenda reuso de `BpmCardHistorico` para solicitação/snapshot/revisão, `BpmCardAnexo` para o PDF privado e `BpmAutomacaoLease` para serialização por card. A solicitação deve nascer na transação canônica de entrada e ser processada depois do commit. O processamento periódico existente consome apenas solicitações explícitas do novo fluxo, sem varrer cards legados. O ator é o usuário que originou o agendamento/geração, não o criador de uma configuração nem automaticamente o closer. O salvamento recebe revisão esperada e preserva os dados canônicos de cadastro/Pré-Análise.

A entrada canônica está em `src/lib/bpm/transicao-command.ts`, cobrindo movimento manual/Admin sem ativar as demais automações suprimidas no movimento livre. O cron existente `src/app/api/bpm/jobs/automacoes/route.ts` recupera lote limitado de intenções específicas; `src/actions/bpm/GoogleMeet.ts` pode devolver a ficha/pendência ao ator sem reverter a reunião. O lease usa recurso próprio `ficha-viabilidade:<cardId>`, com fencing e CAS; não reutiliza o lease genérico do card. O anexo mantém ID estável e usa pathname privado imutável por versão com referência `bpm-blob:`, token `BLOBCRM_READ_WRITE_TOKEN` e troca transacional de URL/snapshot após revalidar empresa/revisão. Arquivos sem commit seguem a reconciliação existente. [Source: docs/architecture/crm-ficha-viabilidade-automatica-20261023.md#fluxo-e-escopo; docs/architecture/crm-ficha-viabilidade-automatica-20261023.md#persistência-sem-alteração-de-schema]

[AUTO-DECISION] Gerar retroativamente para todos os cards já em Reunião Agendada? → Não; o pedido é uma automação de entrada futura, sem autorização para backfill ou mutação em massa. A recuperação abrange somente solicitações explícitas criadas pelo novo fluxo.

[AUTO-DECISION] Criar novo template/modal ou nova janela de PDF? → Reutilizar o template, o modal e o visualizador existentes, conforme pedido expresso e blueprint.

[AUTO-DECISION] Editar também cadastro/Pré-Análise ao complementar? → Não; salvar os complementos do documento e regenerar sua ficha, pois o usuário pediu complementar a ficha, não alterar cadastros paralelos.

`accumulated-context.md` não foi localizado; coerência cruzada foi obtida das três stories relacionadas e dos scouts. `.Codex/commands/AIOX/agents/sm.md` e `.aiox/gotchas.json` estão ausentes; usado fallback `.aiox-core/development/agents/sm.md`. Os caminhos `docs/framework`/`docs/pt/framework` e a estrutura genérica de arquitetura sharded não estão disponíveis neste worktree; prevalecem AGENTS, regras locais e o contrato específico. Code intelligence consultada: indisponível (`isCodeIntelAvailable() === false`). Nenhum sync externo de ClickUp foi criado para esta solicitação local.

## Testing

Usar Vitest e os precedentes `tests/bpm/ficha-viabilidade.test.ts`, `tests/pre-analise/ficha-reuniao.test.ts`, `tests/bibble/gerar-ficha-server.test.ts`, os testes do agendamento/motor e os testes React de anexos. Casos necessários:

- Transição real confirmada solicita uma vez; falha de agendamento/rollback não gera ficha; abrir/recarregar card não produz nova solicitação.
- PDF usa a variante compartilhada da Pré-Análise, mesmo CNPJ/empresa e campos disponíveis, sem mistura de dados; renderização real cobre a paridade pertinente.
- Anexo privado com leitura autorizada; chamadas não autenticadas ou a outro card/empresa são recusadas; nenhuma URL pública exposta.
- Concorrência/retry/reagendamento não duplica ficha ativa e não restaura revisão antiga; persistência falha preserva a versão válida e não mostra toast de sucesso.
- Ator recebe toast com nome correto e navegação para Anexos; outro usuário e broadcast genérico não mostram esse aviso.
- Modal compartilhado recebe os valores persistidos, salva uma vez, reabre com o confirmado, mantém erro/rascunho em falha, trata conflito e descarta somente rascunho ao fechar; consumidor Pré-Análise padrão continua funcionando.
- Botão está acima da ficha, respeita edição e o clique abre o visualizador interno.

Rodar os gates obrigatórios sem banco de produção e sem servidor dev desnecessário. Credenciais não devem aparecer em logs, artefatos versionados ou fixtures. Diferenciar testes locais com dependências simuladas, integração com banco de teste e homologação autenticada efetivamente executada; não declarar E2E real a partir de revisão de fonte.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** Integration como tipo principal; API, Frontend, Security e Deployment staging como secundários. Complexidade alta pela interação de transação, geração PDF, anexos privados, edição e eventos.
- **Specialized Agent Assignment:** `@dev` executor/pre-commit; especialistas backend e frontend seguindo blueprint; `@architect` contrato e segurança; `@qa` testes/revisão independente; `@ux-expert` confere reuso/acessibilidade; `@github-devops` publica staging. Vault somente se surgir operação abrangida pela política, não para CRUD comum por card.
- **Quality Gate Tasks:** Pre-Commit por `@dev` com gates, diff, autorização/idempotência e revisão; Pre-PR por DevOps somente se houver PR; Pre-Deployment de produção não aplicável, produção não autorizada. Instalação CodeRabbit configurada em WSL; se não disponível, registrar o fallback previsto em `core-config.yaml` e a revisão manual sem alegar execução.
- **Self-Healing Configuration:** `@dev` light, até 2 iterações/15 minutos para CRITICAL, HIGH documentado; `@qa` full, até 3 iterações/30 minutos para CRITICAL/HIGH, MEDIUM como dívida; DevOps check/report only.
- **Focus Areas:** associação card/empresa, ACL de leitura/escrita, blob privado e ausência de dados em logs; pós-commit/retry/lease/fencing/revisão; preservação da última ficha válida; ator correto e toast sem broadcast; modal compartilhado sem regressão da Pré-Análise; acessibilidade, busy/erro e visualizador interno; preservação do agendamento e das regras atuais de avanço.

## Story Draft Checklist

Validação YOLO aplicada com `.aiox-core/product/checklists/story-draft-checklist.md`: **READY**, clareza 10/10. Todos os itens foram confrontados com pedido, precedentes e contrato específico antes de aprovar; nenhum resultado de implementação está presumido.

| Categoria | Resultado | Evidência |
| --- | --- | --- |
| 1. Objetivo e contexto | PASS | Gatilho, benefício, origem do pedido e precedentes explícitos. |
| 2. Orientação técnica | PASS | Contrato de DTOs, nove extras, transação/cron, snapshot/CAS e paths reais. |
| 3. Referências | PASS | Seções específicas do contrato e resumo dos precedentes incluídos. |
| 4. Autossuficiência | PASS | AC completos, identidade do ator, privacidade, erro, reentrada e limites definidos. |
| 5. Testes | PASS | Matriz meaningful de geração/ACL/concorrência/modal/toast e gates globais. |
| 6. CodeRabbit | PASS | Tipos, agentes, checkpoints, self-healing e fallback previstos na configuração. |

Não há lacuna de produto bloqueante. A implementação deve seguir o contrato aprovado e registrar evidências reais; produção, migration e backfill não fazem parte da aprovação.

## Dev Agent Record

### Completion Notes

- Backend estável confirmado pelo handoff privado: 7 arquivos/164 testes focados PASS, typecheck final PASS; sem alteração de schema, acesso ao banco remoto ou operação Git pelo implementador. Evidência: `/var/tmp/alpha-crm-ficha-viabilidade-automatica-20261023/backend/handoff.json` e logs ali referidos. Esses resultados não representam aprovação dos gates globais.
- Implementação registra intenção durável na entrada canônica e processa PDF privado após commit; mantém uma ficha/anexo atual por card/empresa, snapshot com revisão, lease/fencing, CAS e retry. Os testes SQLite focados cobrem rollback atômico de intenção/cabeçalho/anexo por falha induzida, preservação da versão confirmada, cleanup pela URL exata sem remover outros anexos e seleção justa das pendências via JSON. A reunião confirmada é preservada quando a ficha falha.
- Frontend conecta o mesmo ModalPDF no modo complementar, separa detalhes de empresa em componente reutilizado, mantém o visualizador existente e transporta a intenção de abertura em Anexos entre shell/board/card. Toast verde é deduplicado e restrito ao resultado/poll da solicitação do ator; o botão manual do painel usa o novo serviço persistido/retry.
- Suite focada de frontend: 9 arquivos/37 testes PASS, duração 3,09 s, em `/var/tmp/alpha-crm-ficha-viabilidade-automatica-20261023/frontend-final-tests.log`. A integração monta o ModalPDF real com I/O controlado e verifica complemento/reabertura e o modo padrão; não equivale a navegador autenticado remoto. Testes backend incluem SQLite efêmera e renderização PDF real, com Blob simulado.
- Integração preservatória: a base inicial de reconhecimento foi `296185df`; DevOps incorporou os avanços `f991a5d4` e `6abaaf9b`, chegando ao candidato local `62dfedc8`, pai `6abaaf9b`. As 35 fontes de runtime/testes próprias preservaram os hashes na segunda integração; os três conflitos de memória foram resolvidos mantendo o conteúdo remoto completo e o apêndice próprio byte a byte. Evidências: `release/integration-f991.json` e `release/integration-6aba.json` no diretório privado desta entrega. O commit final ainda pode ser ajustado pelo DevOps após os gates; nenhum push está presumido.
- Suite consolidada de fonte estável: **769 arquivos/6.399 testes PASS, zero falhas pendentes, quatro skipped e um todo**, por composição autorizada de execuções. A rodada global serial terminou exit 1: 768 arquivos/6.384 testes PASS e uma suite Portal com timeout de setup; a retentativa isolada dessa mesma suite, com fonte/configuração/timeouts inalterados, passou os 15 testes em 8,83 s. **Não houve uma única execução global exit 0.** Evidência normativa: `/var/tmp/alpha-crm-ficha-viabilidade-automatica-20261023/qa/tests-composition.json` e logs referidos.
- A primeira rodada com dois workers apresentou três timeouts de hooks legados e o cenário novo de backlog atingiu o limite de 5 s. Os legados foram isolados e passaram; no teste próprio, a criação de 37 fixtures passou a usar `createMany`, sem relaxar assertions ou timeouts e sem mudança de runtime. Focal final: 11 testes PASS, backlog em 209 ms; os legados passaram também na rodada global serial seguinte. Evidências: `backend/backlog-fixture-fix.json`, `backend/focused-backlog-batch.log` e `qa/legacy-timeout-suites-serial.json`.
- Typecheck integrado PASS em 19,54 s; após os dois últimos ajustes de copy/fixture, typecheck final PASS na mesma fonte, comprovado por `qa/gates-final.json` e `backend/typecheck-backlog-batch.log`. Lint aprovado por composição explícita: global próprio 45,86 s + global da entrega incorporada 46,42 s, fontes/configuração preservadas, mais lint dos dois caminhos finais em 0,82 s. Não se apresenta essa composição como nova execução integral de lint na árvore final.
- Copy de pendência não promete aviso indefinido: o toast depende da resposta confirmada ou da conclusão durante a janela do poll do ator; após seu limite, a ficha continua consultável no card, sem promessa de toast fora dessa janela. A recuperação durável do documento permanece no worker/cron, sem notificação geral para outros usuários.
- Build literal inicial falhou em 1,47 s no setup privado do Prisma (inferência de raiz fora do worktree e auto-instalação malsucedida), antes da compilação do aplicativo. A evidência foi preservada; DevOps corrigiu somente o harness privado, desativando auto-instalação. A retentativa literal `npm run build` passou em **118,80 s**, com fonte idêntica e sem alteração de dependência/configuração da aplicação. Os dois includes temporários gerados pelo Next foram restaurados byte a byte; 40 hashes de runtime/test/config permanecem iguais antes/depois.
- Candidatos Git locais foram criados para a integração; push/deployment staging, smoke autenticado e produção ainda não executados para esta entrega neste checkpoint. Não houve agendamento real no Google nem geração de novo PDF em sessão remota autenticada. Nenhuma migration, backfill, alteração de ambiente remoto ou mutação em massa foi executada. A File List abaixo descreve os caminhos próprios, preservando as entregas concorrentes.

- QA final **APPROVED / GO staging**: Probe, Anubis, Lens após Forge e Sage sem P0/P1 pendente. Gate versionado `docs/qa/gates/crm-ficha-viabilidade-automatica-20261023.yml`; relatório privado `qa/qa-final-private.json`. CodeRabbit indisponível, com fallback manual previsto na configuração. File List final **41 caminhos**. A aprovação é local para publicação staging e mantém os limites de testes compostos, ausência de E2E autenticado/convite Google real e fronteiras externas simuladas; deployment/alias ainda pendentes de DevOps.

### File List

- `.bibble/memory/codebase-map.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/journal.md`
- `docs/architecture/crm-ficha-viabilidade-automatica-20261023.md`
- `docs/qa/gates/crm-ficha-viabilidade-automatica-20261023.yml`
- `docs/stories/story-crm-ficha-viabilidade-automatica-20261023.md`
- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/FichaViabilidade.ts`
- `src/actions/bpm/GoogleMeet.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelReuniao.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/page.tsx`
- `src/app/api/bpm/jobs/automacoes/route.ts`
- `src/components/DetalhesEmpresaFicha.tsx`
- `src/components/ModalPdf.tsx`
- `src/components/bpm/anexos/AnexosComFichaCard.tsx`
- `src/components/bpm/anexos/ficha-viabilidade-toast.tsx`
- `src/components/layout/PainelLayoutClient.tsx`
- `src/hooks/useBpmCardNotificacaoNavigation.ts`
- `src/hooks/useBpmNotificacaoBoardNavigation.ts`
- `src/lib/bpm/ficha-viabilidade-automatica-server.ts`
- `src/lib/bpm/ficha-viabilidade-documento.ts`
- `src/lib/bpm/ficha-viabilidade-server.ts`
- `src/lib/bpm/historico-descricao.ts`
- `src/lib/bpm/notificacoes-navegacao.ts`
- `src/lib/bpm/notificacoes-tarefas.ts`
- `src/lib/bpm/timeline.ts`
- `src/lib/bpm/transicao-command.ts`
- `tests/bpm/ficha-anexos-complemento-react.test.tsx`
- `tests/bpm/ficha-complementar-modal-react.test.tsx`
- `tests/bpm/ficha-reuniao-integracao-react.test.tsx`
- `tests/bpm/ficha-viabilidade-automatica-sqlite.test.ts`
- `tests/bpm/ficha-viabilidade-toast-react.test.tsx`
- `tests/bpm/movimento-livre-command.test.ts`
- `tests/bpm/tarefas-alertas-foco-react.test.ts`
- `tests/bpm/tarefas-notificacoes-board-react.test.ts`
- `tests/bpm/tarefas-notificacoes-navegacao-react.test.ts`

## QA Results

Pendente de implementação e revisão independente.


### Revisão independente — 2026-10-23T18:51:45.984638+00:00 — Quinn / QA

**APPROVED / GO para staging.** Probe, Anubis, Lens (após Forge) e Sage concluídos na fonte final; nenhum P0/P1 pendente. QA não alterou código de aplicação nem executou commit/push.

- Typecheck combinado final: PASS, execução real do worker após os dois ajustes finais, com prova de hashes; typecheck independente anterior da mesma integração também PASS19,54s. Lint global próprio PASS45,86s + upstream CheckList PASS46,42s adotados por composição de arquivos/configuração idênticos; lint real dos dois últimos arquivos alterados PASS0,82s.
- Testes: **769 arquivos / 6.399 PASS, quatro skipped e um todo por composição explícita de fonte estável**. A suíte serial completa terminou exit1 por um único beforeAll30s do Portal (768 arquivos/6.384 PASS); o arquivo Portal, byte-idêntico, passou isolado com15/15 em8,83s. Não se declara um único full-run exit0. As falhas iniciais e as retentativas estão preservadas; nenhum assert, timeout ou configuração foi relaxado. A fixture nova foi otimizada para batch sem mudar o caso verificado.
- Build literal `npm run build` Webpack: **PASS118,80s**. A tentativa inicial falhou em1,47s na resolução privada do Prisma, antes do Next; DevOps corrigiu somente o layout de validação, com autoinstall desativado. Nenhuma dependência/configuração de aplicação foi modificada.
- Quarenta hashes runtime/test/config antes/depois do build iguais; somente os dois includes do diretório temporário gerados pelo Next foram restaurados byte a byte. Traces do job e da página incluem logo e WASM Prisma.
- Revisão verificou entrada canônica/Admin, ator causal e ausência de toast por broadcast, paridade real do PDF Pré-Análise sem segunda página, anexo privado/empresa correta, botão e visualizador, mesmo modal com Salvar/Fechar e nove extras, CAS/fencing, concorrência/replay, rollback atômico e limpeza da URL correta. Reentrada preserva a ficha atual; somente complemento cria versão.
- Limites: SQLite e PDF reais, UI React/happy-dom; fronteiras externas de autenticação/Blob/Pusher simuladas. Não houve convite Google real, upload remoto ou E2E autenticado por QA. CodeRabbit ausente, fallback manual conforme `core-config.yaml`. Publicação/alias e eventual homologação remota ficam com DevOps; produção não autorizada.

Gate: `docs/qa/gates/crm-ficha-viabilidade-automatica-20261023.yml`. Evidências privadas: `/var/tmp/alpha-crm-ficha-viabilidade-automatica-20261023/qa/qa-final-private.json`. Recomendação: Ready for Review e publicação somente no staging.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-23 | 1 | Rascunho da ficha automática, reuso do modal, anexo privado e critérios de segurança/retry. | River / SM |
| 2026-10-23 | 2 | Contrato conferido; DTOs, paridade sem segunda página, persistência/lease e checklist READY; Approved. | River / SM |
| 2026-10-23 | 3 | Implementação e testes focados consolidados; File List real; globals/QA/deploy pendentes. | River / SM |
| 2026-10-23 | 4 | Avanços remotos preservados; composição honesta dos testes/lint e TC final; build/QA final pendentes. | River / SM |
| 2026-10-23 | 5 | QA APPROVED/GO staging, build118,80s, File List41 e checklist local concluído; deploy pendente. | River / SM |
