# Story — Áudio por origem nas notificações de leads do CRM

## Status

Ready for Review — implementação, mídia, quatro gates globais e QA local aprovados sobre `37a7048d`. Primeira falha do harness privado Prisma preservada e corrigida fora do repositório. Publicação/READY e smoke remoto staging pendentes neste checkpoint pré-commit; fonte congelada, produção fora do escopo.

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["npm run lint", "npm run typecheck", "npm test", "npm run build", "ffprobe", "smoke staging"]

## Story

**Como** usuário autorizado que recebe notificações do CRM, **quero** ouvir os áudios fornecidos para Instagram e site, com duração de aproximadamente três segundos, **para** reconhecer a origem de uma nova chegada pelo som.

## Fonte e coerência

Pedido do usuário em 2026-10-22: usar os dois áudios colocados em `public/sounds`, escolhendo o arquivo Insta para leads cuja origem é Instagram e o arquivo Site para leads do site; encurtar os áudios para três segundos.

Depende da entrega de [notificações compartilhadas — Dev Notes](story-crm-notificacoes-leads-sem-responsavel-20261022.md#dev-notes), que já fornece toast, central, origem canônica, IDs vistos por usuário e transporte compartilhado. Preserva o AC19 dessa entrega: clicar abre o detalhe; assumir continua explícito. Esta story acrescenta somente a apresentação sonora, sem backend, permissões, configuração nova ou mutação de dados.

`accumulated-context.md` e `.aiox/gotchas.json` foram procurados, incluindo arquivos ocultos, e não existem nesta cópia. O contexto acumulado usado é a story acima, seu contrato de [arquitetura](../architecture/crm-notificacoes-leads-sem-responsavel-20261022.md) e `.bibble/memory/{codebase-map,integration-points,architecture}.md`. Os documentos gerais de framework configurados, inclusive os fallbacks de idioma, também estão ausentes; fontes reais e contrato abaixo fornecem o contexto desta alteração.

## Acceptance Criteria

1. Uma nova notificação de lead com `origem === "INSTAGRAM"` reproduz o derivado do áudio `AudioNotiInsta.mp4`; com `origem === "SITE"`, reproduz o derivado de `AudioNotiSite.mp4`. A seleção usa a origem canônica do DTO, inclusive quando a fonte é um encaminhamento, sem inferir a partir de nome, URL, fonte NoLoss ou pipeline.
2. Os derivados publicados são arquivos estáticos de áudio, com conteúdo de até três segundos e final suave. Os originais fornecidos pelo usuário permanecem intactos. Não depender de um temporizador de JavaScript para cortar um arquivo de seis segundos. Os nomes acordados são `public/sounds/notificacao-lead-insta.mp3` e `public/sounds/notificacao-lead-site.mp3`.
3. O primeiro snapshot completo e válido de cada lifecycle recupera a central e os toasts existentes sem reproduzir o estoque de pendências em áudio. Depois dessa base, somente IDs novos retornados pela deduplicação existente podem pedir som. Polling, foco, reconexão, resposta duplicada e remontagem não voltam a tocar os mesmos IDs reconhecidos. Falhas, snapshots incompletos/divergentes, respostas descartadas e pedidos abortados não disparam som nem estabelecem uma base válida.
4. Existe no máximo um áudio do CRM ativo por lifecycle. Uma nova reprodução elegível interrompe a anterior, sem sobreposição e sem fila de áudios antigos. Encerramento, logout, troca de usuário e revogação de acesso interrompem o áudio e liberam seus recursos; respostas ou promessas atrasadas não reiniciam a reprodução.
5. Bloqueio de autoplay, indisponibilidade da API de áudio, erro de carregamento ou rejeição de `play()` são tratados sem quebrar o toast, a central ou a navegação e sem rejeição não tratada. Não acumular áudios para reproduzir mais tarde após interação e não criar botão ou configuração adicional.
6. Outras origens mantêm o comportamento sonoro atual do CRM, que é silencioso. Áudios de tarefas, chamados, calendário, demais módulos e voz permanecem independentes. Toasts, audiência, central persistente, detalhes, cores e abertura/assunção mantêm suas regras atuais.
7. Testes verificam seleção de origem, primeira carga silenciosa, chegada nova posterior, deduplicação, snapshots inválidos/abortados, lifecycle e falhas de áudio. Os quatro gates obrigatórios e uma verificação real de duração/decodificação dos dois arquivos são executados; checklist e File List registram o delta e os resultados reais. Após aprovação, DevOps faz commit/push para `staging` e confere deploy/alias e smoke no ambiente correto. Produção, schema, ENV remoto e gravações de leads não são parte da entrega.

## Decisões de preparação

- **[AUTO-DECISION] Corte:** usar os primeiros três segundos dos áudios fornecidos, com fade-out curto no final, preservando a identificação sonora e evitando corte abrupto; pedido já autoriza encurtar e não exige editar os originais.
- **[AUTO-DECISION] Base inicial:** manter a apresentação visual já existente, mas não transformar o estoque recuperado ao abrir o painel em uma sequência de sons. Uma base válida é estabelecida somente depois da recuperação paginada completa e da validação de revisão.
- **[AUTO-DECISION] Concorrência sonora:** substituir a reprodução anterior, sem fila; isso evita sobreposição em lotes ou chegadas rápidas e mantém a implementação local ao lifecycle existente.
- **[AUTO-DECISION] Processo:** story local descritiva, conforme o padrão existente e pedido atual; não inventar epic, sincronização ClickUp ou pré-requisito de produto ausente.

## Dev Notes — contrato pequeno e blueprint de integração

### Fluxo existente verificado

`src/components/layout/PainelLayoutClient.tsx` chama `useBpmTarefasNotifications` para o usuário com acesso CRM. O hook executa apenas na janela superior, compartilha canal privado, intervalos de 30 segundos e reconciliação por foco/online/visibilidade. Realtime invalida a consulta, sem entregar um lead confiável diretamente. Não criar assinatura ou poller paralelo.

`src/hooks/bpm-leads-notificacoes-client.tsx` recupera `/api/bpm/leads/alertas`, valida o DTO e snapshot, percorre as páginas e rejeita revisões ultrapassadas. Somente depois chama `store.sincronizar`, que devolve os IDs novos e mantém a coleção da central. Esse retorno é o ponto único para solicitar reprodução; não colocar áudio no render de `LeadNotificacaoToast`, no clique, no board ou no handler Pusher.

`AlertaLeadBpm` em `src/lib/bpm/notificacoes-leads.ts` já separa `origem: INSTAGRAM | SITE | OUTRA` de `fonte: INSTAGRAM | NOLOSS | ENCAMINHAMENTO`. O seletor sonoro consome somente `origem`; nenhuma alteração de DTO ou servidor é necessária.

`src/store/useBpmLeadsNotificacoes.ts` persiste apenas IDs vistos por usuário e relê o armazenamento antes da sincronização. Isso oferece deduplicação já existente por memória/storage, mas não é um lock atômico entre abas simultâneas. Não alegar exclusão forte entre abas nem introduzir infraestrutura distribuída nesta entrega.

### Arquivos de implementação e responsabilidades

- Editar `src/hooks/bpm-leads-notificacoes-client.tsx`: controlador de áudio por lifecycle, base inicial silenciosa, reprodução vinculada às novas notificações aceitas e cleanup nos caminhos de encerramento/revogação.
- Criar `src/lib/bpm/notificacoes-leads-audio.ts`: mapeamento estático de origem e controlador sem efeitos na importação/SSR; encapsula `Audio`, `play`, pausa e liberação, sem transporte ou estado de leads.
- Criar os dois derivados MP3 listados no AC2 com ferramenta local `ffmpeg`, sem dependência nova de runtime ou pipeline de transcodificação no deploy.
- Editar `tests/bpm/leads-notificacoes-client-react.test.ts` e criar `tests/bpm/leads-notificacoes-audio.test.ts`, seguindo Vitest/happy-dom e os mocks de I/O existentes.
- Consultar, preservando: `useBpmTarefasNotifications.ts`, store/DTO acima, `LeadNotificacaoToast.tsx`, `tests/bpm/leads-notificacoes-{hook-react,store}.test.ts` e os testes de navegação.
- Controles verificados: shell/top-window guard, menu/registro de módulos, rotas, auth/ACL e configuração Next não precisam de novo registro ou mudança; esta entrega não adiciona UI, rota, permissão, provider ou dependência. Não alterar esses controles por conveniência.

### Assets e limpeza

Os originais locais são AAC, estéreo, 44,1 kHz, com durações verificadas por `ffprobe`: Insta 5,8 s e Site 5,9 s. A conversão é operação local de arquivo, não de banco. Usar fonte somente leitura e publicar apenas os derivados. Medir a duração decodificada considerando o padding de MP3, que pode acrescentar alguns milissegundos à duração de contêiner; não confundir esse padding com seis segundos de conteúdo.

O controlador deve tolerar construção de `Audio` e `play()` que lançam ou rejeitam, limpar referências/listeners de `ended`/`error`, pausar/resetar a reprodução interrompida e impedir callback antigo de afetar uma reprodução nova. Nada deve tocar após `limpar` ou abort. Eventos de rejeição não provocam retry automático.

### Testing

- Unitário: mapeamento Insta/Site/Outra e `ENCAMINHAMENTO` com origem comprovada; falha de API/constructor/play síncrona ou assíncrona; uma reprodução ativa, liberação e callback/promise tardio.
- Integração cliente: primeiro snapshot completo silencioso com toasts preservados, chegada nova posterior com som correto; revisões ultrapassadas e paginação inválida sem áudio; repetições, contas distintas, logout/abort e 401/403.
- Regressão dirigida: hook compartilhado, store e navegação permanecem funcionais; não usar evento fake como prova de ingestão real.
- Verificação de mídia: `ffprobe`/decodificação local e resposta estática dos arquivos no staging. Smoke de navegador distingue tentativa/decodificação de áudio de audição humana; declarar eventual bloqueio de autoplay honestamente. Não criar ou assumir leads reais para produzir a prova.
- Gates reais: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. Rerun proporcional somente se houver novo delta ou falha; nunca registrar PASS sem execução.

## Tasks / Subtasks

- [x] Preparar story, contexto anterior e Scout com contrato e pontos de integração (AC1–7).
- [x] Gerar e verificar os dois derivados de três segundos preservando originais (AC1–2).
- [x] Implementar controlador e integração no lifecycle existente (AC1, AC3–6).
- [x] Validar testes dirigidos e mídia; registrar evidências e limitações (AC2–7).
- [x] Executar quatro gates e revisão independente; atualizar checklist e File List (AC7).
- [ ] DevOps: commit/push staging, deploy/alias e smoke corretos, sem produção (AC7).

## 🤖 CodeRabbit Integration

**Story Type Analysis:** Frontend, com assets estáticos; complexidade baixa. Sem alteração de API, banco ou autorização.

**Specialized Agent Assignment:** @dev é executor/pre-commit; Nova implementa frontend, @ux-expert é referência de preservação de UX, @qa revisa lifecycle/testes; @github-devops publica staging. Architect é consultado se o contrato exigir ampliação.

**Quality Gate Tasks:** Pre-Commit obrigatório com os quatro comandos e revisão de lifecycle/mídia. Pre-PR somente se houver PR. Pre-Deployment de produção não se aplica; o deploy de staging deve ser acompanhado por DevOps.

**Self-Healing Configuration — Story 6.3.3:** @dev light, até duas iterações/15 minutos para CRITICAL; HIGH documentado. @qa full, até três iterações/30 minutos para CRITICAL/HIGH; MEDIUM dívida. DevOps check/report only. Se CLI indisponível, registrar indisponibilidade e usar revisão independente do delta, sem inventar relatório CodeRabbit.

**Focus Areas:** escolha canônica de origem, limite sonoro, ausência de fila/replay atrasado, cleanup/abort/troca de conta, autoplay resiliente, deduplicação existente e preservação de central/navegação.

## Story Draft Checklist — validação River

| Categoria | Resultado | Observação |
| --- | --- | --- |
| Objetivo e contexto | PASS | Pedido explícito e dependência da entrega atual do CRM resumidos. |
| Orientação técnica | PASS | Pontos reais, origem canônica, lifecycle e dois assets definidos. |
| Referências | PASS | Story/arquitetura existentes e trechos relevantes resumidos; ausências registradas. |
| Autossuficiência | PASS | Decisões, limites, cleanup e erros descritos sem exigir epic ausente. |
| Testes | PASS | Critérios mensuráveis, gates e limites de prova sonora explícitos. |
| CodeRabbit | PASS | Tipos, agentes, gates, self-healing e fallback documentados. |

**Resultado:** READY para implementação, clareza 9/10, sem pergunta pendente ao usuário. Isto aprova a preparação, não declara implementação ou testes executados.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-22 | 1 | Story e Scout preparados a partir do pedido atual e fontes verificadas. | River |
| 2026-10-22 | 2 | Checkpoint local de implementação, mídia e evidências do owner; gates globais/QA/deploy ainda pendentes. | Scribe/Kowalski |
| 2026-10-22 | 3 | Tipos/lint/build PASS; primeira suíte global falhou no wrapper privado Prisma, corrigido sem mudar fonte; rerun integral pendente. | Scribe/Kowalski |
| 2026-10-22 | 4 | Quatro gates e QA local aprovados; smoke compilado PASS. Entrega pronta para DevOps staging; prova remota posterior privada. | Scribe/Kowalski |

## Dev Agent Record

Nova implementou o controlador `criarAudioNotificacoesLeadsBpm` e a seleção `arquivoAudioLeadBpm`; o cliente existente solicita áudio apenas para IDs novos após a primeira base completa. Um áudio ativo por lifecycle, liberação em fim/erro, abort/cleanup e revogação 401/403, tratamento de autoplay sem retry. Toaster, DTO, store, transporte e navegação existentes preservados. Fonte congelada para revisão.

Evidência do owner: nove arquivos de testes dirigidos, 48 testes PASS, lint dirigido exit 0 e diff-check exit 0; não equivale aos gates globais ou à homologação remota. DevOps gerou somente os dois derivados: MP3 estéreo 44,1 kHz, 48.944 bytes cada, duração `3.000000` s e fade final de 150 ms. Originais na pasta raiz preservados; nenhuma cópia MP4 será versionada. Prova local: `/var/tmp/alpha-crm-audio-notificacoes-origem-20261022/preflight-assets.json`. Sem instalação de dependências, operação de banco ou alteração ENV remota.

## File List

Delta real desta entrega:

- `docs/stories/story-crm-notificacoes-audio-origem-20261022.md`
- `src/hooks/bpm-leads-notificacoes-client.tsx`
- `src/lib/bpm/notificacoes-leads-audio.ts`
- `public/sounds/notificacao-lead-insta.mp3`
- `public/sounds/notificacao-lead-site.mp3`
- `tests/bpm/leads-notificacoes-client-react.test.ts`
- `tests/bpm/leads-notificacoes-audio.test.ts`
- `.bibble/memory/codebase-map.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/journal.md`
- `.bibble/memory/known-errors.md`

## QA Results

Implementação e provas locais do owner recebidas. Forge executou `npm run typecheck` exit 0/56,26 s; `npm run lint` exit 0/76,50 s, zero erros e 1.183 warnings; build literal exit 0/111,62 s com heap versionado 4.096 MiB, pools nativos 1, afinidade 4 CPU e pico agregado de 7.304.445.952 bytes, abaixo do teto de 7 GiB. Nenhum ENV remoto carregado; client Prisma compartilhado intacto.

Primeiro `npm test`: 746 arquivos (745 passaram, um falhou), 6.113 testes passaram, um falhou, quatro skipped e um todo, em 242,55 s. Causa comprovada no harness privado: wrapper anexava `--schema` a todo comando Prisma; `schema.contract` usa `migrate diff`, que não aceita essa opção. Wrapper privado corrigido para anexar somente em `generate`/`format`, sem mudar aplicação, teste ou schema; foco afetado passou em 1,46 s. Logs e JSON originais permanecem em `/var/tmp/alpha-crm-audio-notificacoes-origem-20261022/forge/{forge-result-first.json,gate-tests-first.json,gate-tests-first.log}`.

Rerun integral `npm test` exit 0/194,07 s: 746 arquivos, 6.114 testes PASS, zero falhas, quatro skipped e um todo (6.119 testes ao todo). Forge confirmou os quatro gates PASS em `forge/forge-result.json`. Fingerprint de fonte `c07ee6023ead98a0cd3ebc4a2bcd1a71cc988f910284f8bb0f5ceda54eaf8f19` idêntico no início/fim; tipos/lint/build anteriores continuam válidos e não foram repetidos por alteração apenas do harness de teste.

**QA local: APROVADO / GO staging.** Probe/Sage/Lens após Forge revisaram integralmente os dois arquivos de fonte e dois de testes: zero bloqueantes/importantes. Cobertura direta de 26 testes (nove de áudio e 17 de cliente), além das regressões dirigidas que somam 48; não somar esses subconjuntos outra vez à suíte global. Prova: `/var/tmp/alpha-crm-audio-notificacoes-origem-20261022/qa-final-private.json`.

Smoke compilado local PASS: dois MP3 HTTP 200 com hashes correspondentes; raiz/sessão HTTP 200 e CRM protegido com 307. Servidor local encerrado. Isso comprova assets e proteção no build servido, sem equivaler a sessão real/ingestão remota ou audição humana.

Publicação/READY e smoke remoto staging permanecem pendentes neste checkpoint pré-commit. A story documenta a aprovação local antes da publicação; provas remotas posteriores serão mantidas fora do Git, sem outro deploy apenas para atualizar este documento.
