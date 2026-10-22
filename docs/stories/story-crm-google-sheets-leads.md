# Story: Instagram/Google Sheets — leads virtuais personalizados e API de integração

## Status

Ready for Review — implementação aprovada pelo QA; API homologada em staging e 27 leads históricos importados após consentimento específico. Promoção e configuração unitária de produção autorizadas em 2026-10-21; candidato isolado com gates locais aprovados. Publicação final e smoke de produção serão registrados pelo executor. Remetente Google Sheets ainda não instalado.

## Executor Assignment

- Story: `@sm`; arquitetura da integração: `@architect`.
- executor: `@dev`.
- quality_gate: `@qa`.
- quality_gate_tools: `lint`, `typecheck`, `test`, `build` e revisão de idempotência, promoção e proveniência.
- Publicação/configuração: `@devops`, primeiro staging, dentro da autorização efetiva.

## Story

**Como** responsável pelos leads comerciais, **quero** receber os leads do Instagram da planilha como cards virtuais personalizados e pulsantes em Novos leads da Revisão de Radar, com os dados preenchidos e Radar pretendido mapeado da coluna M, **para que** alguém possa assumi-los pelo fluxo comercial.

**Quero também** o contrato da API documentado para disponibilizá-la a outro desenvolvedor.

## Fonte e precedência

Fonte: planilha Google Sheets `1vzyEobII90qd6txFhPBu5IwUZ9sISGs-6jYODaVmWsI`, aba `Página1`, `gid=0`.

O usuário confirmou **Revisão de Radar / Novos leads**, histórico e novos leads, e corrigiu a entrada para **lead virtual pulsante para alguém assumir**, como a função existente. Depois da comparação solicitada, autorizou: “O M vai para Radar pretendido - crie o card personalizado para os leads no isnta (planilha) faça o integração e depois me fale sobre a api para eu disponibilizar ela para outro dev”.

Esse pedido autorizou implementação local do fluxo completo, incluindo API e integração preparada. Não criar card nativo/empresa/responsável na ingestão. Responsável somente na assunção. Staging primeiro; em 2026-10-21 o usuário também autorizou expressamente promover estas modificações e gerar URL/token próprios de produção. Instalação de gatilho, escrita na planilha e execução da carga histórica em cada ambiente devem respeitar autorização efetiva e o protocolo de operações em massa do projeto.

## Inventário e de/para

Inventário somente leitura de staging informado pelo agente principal: pipeline ativo **Revisão de Radar**, entrada **Novo Lead**. Campos visíveis na entrada: **Radar pretendido**, **Canal de origem**, **Qualificação**. Radar tem as três opções abaixo; Qualificação tem **Qualificado** e **Sem qualificação**. Não equiparar `lead_status=CREATED` a nenhuma qualificação.

| Origem | Destino/uso |
| --- | --- |
| `id` | Identidade externa imutável, como string |
| `created_time` | Data original exibida/preservada, distinta de recebimento e criação do card |
| `full_name` | Nome do contato/lead; não afirmar que é razão social verificada |
| `email`, `whatsapp` | Contato preenchido no virtual e preservado após assumir |
| `cnpj` | Opcional na assunção externa; preservar valor original e normalizar/validar se informado, sem inventar documento |
| `platform` | Instagram quando o valor recebido for `ig`; proveniência própria da integração |
| `campaign_id/name`, `adset_id/name`, `ad_id/name`, `form_id/name`, `is_organic` | Contexto de campanha/formulário no resumo e anotação, sem inventar UTMs |
| M / `modalidade_atual_radar` | Radar pretendido conforme decisão explícita do usuário e tabela abaixo |
| `valor_pretendido_importacoes_12_meses` | Resposta de qualificação preservada/exibida; não determina Radar |
| `prazo_novo_limite` | Prazo desejado preservado/exibido; não confundir com Mês para protocolar |
| `lead_status` | Estado original, separado da qualificação do CRM |
| `status_crm` | Confirmação técnica do remetente; não confiar no valor anterior como prova de entrega |

Não existem campos próprios no CRM atual para as três perguntas de qualificação nem para todos os metadados de anúncio. Preservar no payload filtrado, resumo virtual e `ANOTACAO` após assumir, sem criar campos de banco ou pipeline por conveniência.

### Coluna M → Radar pretendido

Normalizar underscores, espaços e caracteres invisíveis para comparação, preservando a resposta original:

| Valor recebido de M | Radar sugerido/preenchido |
| --- | --- |
| `ilimitado` | Revisão de Radar Ilimitado |
| `limitada_usd_50k_semestrais` | Habilitação de Radar 50k |
| `limitada_usd_150k_semestrais` | Revisão de Radar Limitado a USD150k |
| `não_tenho_empresa,_estou_em_fase_de_constituição` | Sem opção preenchida; resposta original visível para revisão ao assumir |
| Ausente/desconhecido | Não escolher opção automaticamente; manter pendência para seleção ao assumir |

O usuário autorizou usar a coluna M; as respostas continuam sendo modalidade atual na origem. Empresa em constituição e valores desconhecidos não recebem inferência adicional. O modal deve permitir conferir/corrigir o Radar antes de promover; o servidor valida a opção efetivamente escolhida contra a configuração ativa.

## Decisão arquitetural — inbox de webhook existente, sem migration

Usar `BpmWebhookEndpoint` + `BpmWebhookEntrada` como inbox durável dedicada à integração Instagram, separada de NoLoss e RD. Os modelos existentes já representam endpoint administrativo, autenticação, payload filtrado, estado de recebimento e deduplicação por `@@unique([endpointId, idempotencyKey])`.

- Endpoint exclusivo com `pipelineId` obrigatório, `automacaoId=null` e identidade estável. Não compartilhar inbox com o webhook genérico de automações. A rota atual `/api/bpm/webhooks/[slug]` exige `cardId`; a nova rota dedicada `/api/integrations/instagram/leads` não chama nem enfraquece esse contrato.
- Na ingestão, validar/sanitizar uma allowlist explícita de campos do lead, guardar envelope versionado em `payloadSanitizadoJson` e `statusRecebimento=AUTENTICADO`. Esse estado significa recebido e pendente de assunção para esta integração; `eventoId=null`.
- Chave determinística de deduplicação: origem + ID fixo da planilha + ID da aba + ID textual do lead. Derivar no servidor; não aceitar chave arbitrária nem número de linha como identidade. Um endpoint não pode ser recriado a cada chamada, pois isso trocaria o namespace e perderia a deduplicação.
- A projeção do board busca somente entradas desse endpoint/tipo de envelope, autenticadas e ainda pendentes. Origem explícita `instagram` no transporte; não escrever `NolossLead` nem forjar vínculo NoLoss.
- Na assunção autenticada, validar acesso ao pipeline/etapas e responsável elegível, e fazer CAS `AUTENTICADO → PROCESSADO` na mesma transação de empresa/contato/card/campos/anotação/histórico/outbox/automação/SLA/cadência. `eventoId` aponta para o evento `CARD_CRIADO` dessa promoção; o evento fornece `cardId` para localizar o resultado em repetição. Não reaproveitar esse campo para IDs de objetos estranhos à relação.
- CNPJ é opcional nesse contrato externo, válido se informado. Sem documento, a promoção pode criar `Cliente.cnpj=null`, inclusive para empresa em constituição; o schema já admite essa situação. Preservar nome do lead como identificação provisória, sem apresentar razão social como verificada. Não transportar a obrigatoriedade do cadastro manual para essa origem nem forjar NoLoss. Complementação futura usa a edição canônica existente de cliente/card; `PreencherCnpjCardNoloss` continua restrita ao NoLoss.
- Uma entrada `PROCESSADO` nunca volta a pendente por reenvio, mesmo se alguém mover/editar o card. Repetição de promoção retorna o card vinculado quando acessível ou erro seguro de integridade, sem gerar substituto.
- Não limpar ou deletar endpoint/entradas automaticamente. A relação de endpoint tem delete cascade: desativar o endpoint preserva inbox, deduplicação e auditoria; recriar/deletar perderia essas propriedades.

### Configuração e autenticação

API usa `Authorization: Bearer` com segredo forte e exclusivo, mínimo de 32 caracteres. `BpmWebhookEndpoint.segredoHash` é a fonte única de autenticação, com ID do endpoint na configuração servidor `INSTAGRAM_LEADS_ENDPOINT_ID`. Não usar `ALPHA_BRIDGE_TOKEN` de leitura nem manter token duplicado em env.

Preparar configurador CLI de endpoint com `--admin-id`: validar admin ativo e pipeline correto, separar autoria administrativa da configuração e responsabilidade comercial. A operação é configuração individual baseada no CRUD já existente, sem schema/migration. Não escolher usuário arbitrário nem criar endpoint silenciosamente por requisição. O lead não exige responsável até alguém assumir. O CRUD administrativo existente (`CriarWebhookAutomacaoCentralBpm`) é referência para gerar segredo/hash e autoria.

Credencial, configuração ausente/ambígua, endpoint inativo ou pipeline incompatível falham fechados; não escrever lead nesses casos. Nenhum segredo em querystring, payload persistido, log, UI pública, planilha ou Git.

### Alternativas rejeitadas

- `BpmCardOrigemExterna` exige card existente e não atende à fase virtual isoladamente.
- JSON completo em `NolossSubmissionId`/identificador equivalente é sobrecarga indevida de identidade e não deve ser implementado.
- Forjar origem NoLoss para obter sua UI/validações mistura contratos e compromete proveniência.
- Nova coluna/tabela é alternativa de domínio possível se a inbox existente se mostrar insuficiente, mas exige desenho explícito, Vault, backup verificado e aprovação específica antes da migration; não é o caminho escolhido nesta story.

## Acceptance Criteria

1. Endpoint dedicado recebe um lead por `POST` autenticado, valida fonte permitida/planilha/aba, JSON, limite de corpo e tamanhos/tipos. ID da origem é string estável; não permitir destino, endpoint ou responsável arbitrários pelo payload. Autenticação/configuração inválidas falham antes de persistir payload pessoal.
2. Persistir inbox e confirmar sucesso apenas após commit. Duplicatas sequenciais/concorrentes retornam o mesmo ID de entrada, sem nova entrada, empresa, contato ou card. A constraint existente arbitra concorrência; não tratar qualquer erro como duplicata. Reenvio não substitui payload aceito/alterações humanas; documentar se divergência retorna conflito.
3. Histórico e novos leads usam o mesmo contrato idempotente. Não confiar em `status_crm=integrado` preexistente para concluir que uma entrada já chegou a esta integração.
4. Lead aparece na entrada canônica de Revisão de Radar como virtual personalizado Instagram, com pulsação identificável e suporte a movimento reduzido. Não há responsável, empresa ou card nativo criado antes da assunção. Não aplicar visibilidade/autorizações mais amplas que o fluxo virtual existente.
5. Card/modal mostra nome, contato, CNPJ recebido, Radar de M, campanha, data original e respostas de volume/prazo sem perder dados. Não chamar nome pessoal de razão social confirmada. Proveniência Instagram é distinta de NoLoss/RD.
6. M é mapeado conforme a tabela; valores desconhecidos e empresa em constituição deixam Radar nulo, com resposta original visível para revisão ao assumir. Modal inicia com os dados recebidos, permite conferência/correção e não transforma volume anual em limite semestral ou qualificação.
7. Assunção exige sessão e permissões vigentes, responsável elegível e Radar válido. CNPJ é opcional; ausência não bloqueia e permite `Cliente.cnpj=null`, inclusive para empresa em constituição. Se informado, CNPJ inválido é recusado com mensagem acionável antes de criar registros; o valor bruto da origem permanece preservado na proveniência. Não inventar documento nem forjar NoLoss. A regra pertence à action própria Instagram; manter cadastro manual e `PreencherCnpjCardNoloss` intactos. Complementação posterior usa a edição canônica existente de cliente/card.
8. Promoção é atômica e concorrente: apenas uma requisição consome o estado pendente e cria o agregado. Rollback deixa entrada pendente e nenhum registro órfão; sucesso muda para PROCESSADO e mantém vínculo pelo evento de criação. Repetição não cria card/contato/automação adicionais.
9. Contato da planilha é preservado em Pessoa/vínculo ao assumir conforme contrato vigente, sem sobrescrever cadastro humano ou mesclar empresas apenas pelo nome. Telefone inválido não vira telefone fictício; utilizar mecanismo interno existente de telefone pendente somente quando necessário e sem exibi-lo como contato real.
10. Criar campos de Radar/canal/qualificação efetivamente escolhidos, anotação com respostas/metadados, membro responsável, histórico, evento/outbox, automações, SLA e cadências aplicáveis. Notificar board após commit; falha de realtime não invalida uma promoção persistida.
11. O fluxo NoLoss existente e cadastro manual continuam operando sem alteração de seus contratos. Criar action própria Instagram. Despacho da origem virtual, abertura, drag/modal e assunção diferenciam IDs Instagram de IDs NoLoss; ID adulterado não promove outra origem nem acessa outra pipeline.
12. Preparar remetente/script de Google Sheets com cabeçalhos reais, IDs como string e propriedades privadas para URL/segredo. Confirmação técnica só após resposta de sucesso correspondente ao ID enviado. Timeout/429/5xx podem ser reenviados; erros permanentes ficam identificáveis. Lock e limite por execução evitam sobreposição; preservar dados/fórmulas originais.
13. Documentação para outro dev inclui URL de staging, método, autenticação, contrato de campos, de/para M, exemplos fictícios de curl/payload/retorno, duplicatas, validação, retry e diferença entre recebimento virtual e card assumido. Credencial real é fornecida por canal privado no momento autorizado; não prometer endpoint ativo antes do deploy.
14. Publicar/configurar produção somente após homologação staging e pedido explícito de promoção, recebido em 2026-10-21. Não executar migration, backfill/importação em massa ou escrita na planilha sem os passos aplicáveis de autorização/ambiente da sessão. Preparar código e documentação revisáveis antes de solicitar qualquer aprovação necessária.
15. Testes cobrem autenticação/configuração, allowlist/ID string, mapeamentos M, inbox idempotente, projeção personalizada, promoção concorrente/rollback, preservação dos contatos/Qs, permissões, retry do remetente e regressão NoLoss. Para CNPJ, cobrir assunção sem documento, normalização/aceitação do válido e recusa do inválido informado, mantendo obrigatoriedade manual intacta. Rodar `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`; atualizar checklist, File List e resultados sem inventar evidência de teste/QA.

## Tasks / Subtasks

- [x] Ler AGENTS/Constitution; registrar staging primeiro e limites de autorização.
- [x] Inventariar cabeçalhos e campos reais de staging; comparar com fluxo virtual.
- [x] Registrar definição do usuário: M alimenta Radar pretendido e integração deve ser implementada.
- [x] Inspecionar BpmWebhookEndpoint/Entrada, rota genérica e promotion NoLoss; decidir inbox dedicada sem migration.
- [x] Implementar contrato/env e endpoint de ingestão com fonte restrita/allowlist/idempotência.
- [x] Implementar leitura/projeção de entradas Instagram e card/modal personalizado preenchido/pulsante.
- [x] Implementar assunção transacional, contatos, anotação, campos e efeitos de domínio.
- [x] Preparar script remetente de histórico/novos e documentação para outro desenvolvedor.
- [x] Cobrir testes significativos, executar quality gates e obter revisão `@qa`.
- [x] Registrar resultado de configuração/homologação de staging se autorizadas e executadas; manter produção pendente.

## Dev Notes e evidências

- `prisma/schema.prisma`, modelos `BpmWebhookEndpoint` e `BpmWebhookEntrada`: endpoint com criador/admin, segredoHash, ativo, pipeline opcional; entrada com payload JSON, status, recebidoEm, eventoId opcional e unicidade endpoint/chave.
- `src/actions/bpm/AutomacoesCentrais.ts`: criação autenticada do endpoint gera segredo forte e atribui autor admin; ação de desativação conserva dados.
- `src/app/api/bpm/webhooks/[slug]/route.ts`: webhook genérico exige card já existente; manter esse contrato separado.
- `src/lib/bpm/automacoes/eventos.ts`: outbox existente e sanitizador genérico; sanitização da integração deve usar allowlist para não persistir campos arbitrários.
- `src/actions/bpm/Cards.ts`: referência dos efeitos de criação canônica (membro, histórico, evento, automações, SLA e cadência).
- `src/actions/bpm/NolossLeads.ts`, `src/lib/bpm/noloss-leads.ts`, projeções de quadro e `PipelineBoardClient.tsx`: referência da experiência virtual; não copiar suas suposições de origem para Instagram.
- NoLoss atual guarda nome/contato/UTMs, mas não CNPJ/Qs nem todo contexto Meta; promoção atual também não persiste todo contato da origem. Conservar esses dados faz parte desta entrega.
- Inventário de leitura do agente principal confirmou 27 respostas reais + uma linha de teste; não versionar linhas reais nem tomar status da linha de teste como evidência de integração.

## File List

- `.env.example`
- `src/lib/bpm/instagram-leads.ts`
- `src/lib/bpm/instagram-leads-server.ts`
- `src/app/api/integrations/instagram/leads/route.ts`
- `src/app/api/bpm/webhooks/[slug]/route.ts`
- `src/actions/bpm/InstagramLeads.ts`
- `src/actions/bpm/Cards.ts`
- `src/actions/bpm/Quadro.ts`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/InstagramLeadCard.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/NolossLeadModal.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx`
- `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/AtribuirResponsavelPromocaoModal.tsx`
- `scripts/instagram-leads.mts`
- `scripts/instagram-leads-batch.mts`
- `scripts/google-sheets-instagram.gs`
- `docs/integrations/instagram-leads.md`
- `docs/stories/story-crm-google-sheets-leads.md`
- `tests/bpm/instagram-leads.test.ts`
- `tests/bpm/instagram-leads-server.test.ts`
- `tests/bpm/instagram-leads-ingest-route.test.ts`
- `tests/bpm/instagram-leads-assumir.test.ts`
- `tests/bpm/instagram-sheets-sender.test.ts`
- `tests/bpm/instagram-webhook-isolamento.test.ts`
- `tests/bpm/noloss-lead-modal-react.test.ts`
- `tests/bpm/board-polling-react.test.ts`
- `tests/bpm/board-visao-equipe-react.test.ts`
- `tests/bpm/movimento-livre-react.test.ts`
- `tests/bpm/movimentacao-importados-rd-react.test.ts`
- `tests/bpm/tarefas-notificacoes-board-react.test.ts`

## CodeRabbit Integration

**Primary Type:** API/Business Logic. **Secondary Types:** Integration, Frontend, Security. **Complexity:** alta pela ingestão virtual, assunção concorrente e efeitos de domínio.

`@qa` deve revisar fronteira ingestão/assunção, retenção de inbox, chave estável, CAS, configuração/autorização, proveniência, mapeamento e preenchimento sem perda. `@devops` publica/configura apenas dentro da autorização efetiva, primeiro staging. Nenhum quality gate de código ou revisão automática foi executado pelo agente de story.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-21 | 0.2 | Correção para lead virtual e comparação conjunta antes de implementar | `@sm` / `@architect` |
| 2026-10-21 | 0.3 | Implementação autorizada; M → Radar, inbox de webhook dedicada e assunção transacional sem migration | `@sm` / `@architect` |
| 2026-10-21 | 0.4 | Corrigir contrato de assunção externa: CNPJ opcional, válido se informado; preservar fluxo manual/NoLoss e schema existente | `@sm` / `@architect` |

## QA Results

Revisão `@qa` em 2026-10-21: **PASS para a implementação revisada e seus gates locais; homologação operacional em staging pendente**. Sem bloqueadores de código abertos após correções de isolamento por ID do pipeline, repetição da assunção com ACL, reativação do contato, proteção da inbox contra a rota genérica e exibição do e-mail original. Conferidos autenticação, allowlist, proveniência, de/para M, preservação das respostas, contatos, despacho de origens e regressão NoLoss/manual.

- Evidência: `npm run lint` com 0 erros e 1.193 avisos legados; `npm run typecheck` aprovado; `npm test` com 694 arquivos e 5.324 testes aprovados, 4 ignorados e 1 todo; `git diff --check` limpo. `npm run build` concluiu compilação, geração de páginas e traces, incluindo `/api/integrations/instagram/leads`. Logs: `/tmp/instagram-full-lint.log`, `/tmp/instagram-typecheck-final.log`, `/tmp/instagram-full-test.log` e `/tmp/instagram-build-final.log`.
- Os testes de CAS, falha transacional, permissões e repetição usam mocks. A atomicidade foi conferida estruturalmente: reserva e agregado/efeitos de domínio usam a mesma transação; notificações e cadências imediatas ocorrem após commit. Não houve teste real de concorrência/rollback no banco, instalação/execução na planilha, importação histórica ou validação publicada nesta revisão. Não constitui aprovação de deploy ou produção.

## Validação final e preparação operacional

- Suite completa: 694 arquivos, 5.324 testes aprovados, 4 skipped e 1 todo.
- Delta final (header ausente sem DB e envelope incompatível): 7 arquivos/46 testes aprovados em 2026-10-21, log /tmp/instagram-last-delta-test.log.
- Lint completo: 0 erros e 1.193 avisos preexistentes; lint do delta e novo CLI de lote: 0 problemas. Typecheck completo e build final da versão prontos sem erro.
- Configuração CRUD unitária de staging feita pelo DevOps: endpoint cmvih1b4z0000sdihxike3y0d, pipeline cmuih48la000009gmzw3wwuzf, autor administrativo id1; sem leads e sem atribuição comercial. Variável limitada ao custom environment staging da Vercel.
- Script do lote é dryRun por padrão e exige hash/contagem/recibo em modo apply; snapshot real, credencial e backups ficam privados e fora do Git.
- Sem migration/schema change. Backup staging em preparação para eventual lote; carga histórica e instalação/ativação do gatilho ainda não executadas.

## Publicação e homologação final — 2026-10-21

- Versão final: `b71f2cb9f3c830ed415237ac75555543783aa100`, contendo CNPJ opcional na assunção Instagram e preservando os avanços concorrentes de setores `87c2e78f` e `2f4d788b`. Push fast-forward somente para `staging`, sem force.
- Vercel: deployment `dpl_9hz7HVdNx5X4bQeLY7Js1KAinLpS` **READY**, ambiente customizado `staging` (`env_sKT0JOh0HB03g20jmcqN5pTHMjqT`), `target` diferente de produção. Alias `https://staging.alpha-comex.com` confirmado no deployment e SHA exatos. URL imutável: `https://painel-alpha-projeto-38hiiyza7-alpha-comexs-projects.vercel.app`.
- Gates da árvore integrada final: `npm run typecheck` exit 0 (`/tmp/instagram-cnpj-rebase-typecheck.log`); `npm run lint` exit 0, zero erros e 1.193 avisos legados (`/tmp/instagram-cnpj-integrated-final-lint.log`); `npm test` exit 0, 698 arquivos e 5.360 testes aprovados, 4 skipped e 1 todo (`/tmp/instagram-cnpj-integrated-final-tests.log`). Suites focadas: 18 arquivos/136 testes aprovados. Build final local do delta aprovado (`/tmp/instagram-cnpj-build.log`) e build da árvore integrada aprovado na Vercel.
- Smokes publicados: token ausente 401; token incorreto 401; slug Instagram na rota genérica 404; JSON inválido autenticado 400; exemplo fictício autenticado com `dryRun=true` 200 e coluna M convertida para Habilitação de Radar 50k. Evidência: `/tmp/alpha-instagram-smoke.json`.
- Dry run do snapshot privado: 28 linhas enviadas, 27 leads reais validados, 1 teste ignorado, zero falhas e zero duplicatas. Uma resposta de Radar exige conferência ao assumir; um CNPJ exige revisão, permanecendo opcional. Recibo privado 0600: `/tmp/alpha-instagram-dryrun-final.private.json`. Nenhum dado pessoal ou segredo foi versionado.
- Consulta após todos os smokes e dry runs confirmou **zero entradas** na inbox do endpoint. Os 200 metadados de variáveis Vercel permanecem iguais à baseline pré-deploy; `INSTAGRAM_LEADS_ENDPOINT_ID` continua restrita ao ambiente customizado staging.
- Rollback imediatamente anterior: deployment READY `dpl_FR2Q148wsAkoke2aMATURNWJKeus`, SHA `2f4d788bd6276dd0e092e6e5c1595151ac0f1bbb`. Preservar endpoint e suas entradas; pausar por `ativo=false`, sem exclusão.
- Sem importação histórica, lead real de teste, assunção real, validação visual autenticada, escrita na planilha, instalação de gatilho ou configuração/publicação em produção. Próximo passo de histórico continua sujeito ao relatório Vault, backup verificado e confirmação específica do lote.
- Evidência operacional consolidada, sem segredos: `/tmp/alpha-instagram-staging-release-final-evidence.json`. Este registro final de homologação é mantido localmente após o deploy para evitar uma nova publicação motivada somente pela documentação.

## Importação histórica autorizada — 2026-10-21

- Após a pergunta específica sobre importar os 27 leads reais no staging, pendentes e sem responsável, o usuário respondeu **“sim, confirmo”**. Vault registrou o consentimento e liberou exclusivamente o lote descrito em `/tmp/alpha-instagram-vault-report.md`.
- Antes da execução, rechecados SHA do snapshot e dump, backup completo com menos de 48 horas (aproximadamente 22 minutos), vínculo ao banco staging distinto de produção, arquivos privados 0600, recibos inexistentes, endpoint ativo no pipeline correto e inbox inicialmente vazia. Restauração isolada do backup novamente aprovada: integridade, chaves estrangeiras, 337 tabelas e 295.327 linhas. Evidências: `/tmp/alpha-instagram-preimport-checks.json`, `/tmp/instagram-backup-preimport-verify.log` e `/tmp/alpha-instagram-preimport-inbox.json`.
- DevOps confirmou novamente o alias staging no deployment READY e SHA exatos publicados, sem mutações: `/tmp/alpha-instagram-preimport-runtime-check.json`.
- Comando `instagram-leads-batch.mts --apply` executado com hash e contagem aprovados. Resultado: 28 linhas enviadas, **27 leads reais criados**, 1 teste ignorado, zero duplicatas iniciais e zero falhas. Recibo privado: `/tmp/alpha-instagram-import-receipt.private.json`.
- Consulta posterior confirmou 27 entradas `AUTENTICADO`, todas sem `eventoId`/card vinculado, e payloads exatamente iguais à preparação do snapshot aprovado. Radar pela coluna M: 21 de 50k, 2 de 150k, 3 ilimitados e 1 para conferência; 1 CNPJ exige conferência, permanecendo opcional ao assumir. Nenhum responsável foi atribuído. Evidência agregada: `/tmp/alpha-instagram-import-first-verification.json`.
- Reenvio integral dos mesmos IDs, conforme plano aprovado: 27 duplicados reconhecidos, 1 teste ignorado e zero falhas. Consulta posterior manteve exatamente 27 entradas e o mesmo SHA agregado dos IDs/estados/payloads, comprovando ausência de inclusões ou alterações no reenvio. Recibo privado `/tmp/alpha-instagram-import-retry.private.json`; verificação `/tmp/alpha-instagram-import-final-verification.json`; evidência operacional consolidada sem dados pessoais `/tmp/alpha-instagram-import-evidence.json`.
- A execução não escreveu na planilha, instalou gatilho, assumiu leads ou alterou produção. O envio automático de novos leads depende da instalação/configuração pelo desenvolvedor do Apps Script entregue em `/home/ialpha/projetos/entregas/api-instagram-alpha-staging.zip`.

## Promoção da integração para produção — 2026-10-21

- Pedido explícito do usuário: “consegue gerar a url e token para mandar para o painel em produção tambem? - pode commitar essas modificaçoes para produção tambem”. Autoriza promoção e configuração individual; não é execução de carga histórica em produção nem instalação de Apps Script.
- A produção já contém os commits iniciais `a3ae721c` e `50e53866`. Candidato isolado parte da `origin/main` `3e8800f8` e aplica somente o ajuste homologado `b71f2cb9`, além desta documentação. Não promover integralmente staging, que contém outras entregas concorrentes.
- Sem alteração de schema ou migrations. Parecer `/tmp/alpha-instagram-vault-production-report.md`: endpoint individual é CRUD normal, dispensado de backup por operação; credencial exclusiva, banco efetivo distinto de staging, pipeline/admin verificados, testes publicados somente dry run e rollback preservando endpoint/história.
- Baseline DevOps: `painel.alpha-comex.com` e `painel-alpha-projeto.vercel.app` no deployment `dpl_DLbfSMy2f4WUb9PYmnqyvMaM7QDc`, READY, SHA `3e8800f8`, target `production`, sem custom environment. Banco de produção possui pipeline/entrada corretos e nenhum endpoint Instagram antes da configuração. Evidência sem segredos `/tmp/alpha-instagram-production-readonly-baseline.json`.
- Pasta de entregas movida a pedido do usuário para `/home/ialpha/projetos/entregas`; credenciais seguem privadas e fora dos pacotes/Git.
- Configuração unitária de produção concluída por DevOps: endpoint `cmviikplh0000r7ihy9ubup21`, ativo, pipeline correto, autor administrativo id1, sem automação nem responsável, inbox vazia. Credencial própria em arquivo privado 0600, distinta de staging. Comparação privada de hashes confirmou URL e token do banco local de produção iguais aos valores efetivos da Vercel e diferentes de staging. Evidência sem segredos: `/tmp/alpha-instagram-production-endpoint-configuration.json`.
- `INSTAGRAM_LEADS_ENDPOINT_ID` configurada somente no target Vercel `production`; os 200 registros anteriores foram preservados, total 201. Evidência: `/tmp/alpha-instagram-production-env-configuration.json`. Staging preservado.
- Gates do candidato de produção: lint exit 0, zero erros e 1.193 avisos legados (`/tmp/instagram-production-lint.log`); typecheck exit 0 após geração do player requerido no checkout novo (`/tmp/instagram-production-typecheck-final.log`); suíte completa exit 0, 698 arquivos, 5.360 testes aprovados, 4 skipped e 1 todo (`/tmp/instagram-production-tests-serial.log`); build completo exit 0 (`/tmp/instagram-production-build.log`). A primeira rodada concorrente teve três timeouts de 5s em testes de SQLite/CLI; a suíte integral repetida com dois workers passou sem alterações de código. Não houve falha funcional reproduzida.
- Revisão QA do delta de produção: PASS de código, restrito ao CNPJ opcional já homologado e documentação, sem regressão identificada de NoLoss/manual e sem mudança estrutural. A evidência de CAS/rollback continua baseada em mocks/revisão estrutural; não se afirma teste transacional real em produção.
- Pacote do desenvolvedor para produção: `/home/ialpha/projetos/entregas/api-instagram-alpha-producao.zip`, com contrato, exemplo fictício dry run e Apps Script; sem token ou dados pessoais. A troca de host no script torna o histórico novamente elegível e requer definir/autorizar o escopo antes de executá-lo. Esta promoção não importa histórico ou instala gatilho em produção.
- Durante os gates, `main` recebeu a correção concorrente `eb2901a9` de tarefas/documentais. Candidato reaplicado sobre essa revisão sem conflitos e sem perda de arquivos, mantendo o delta exclusivo de seis arquivos da integração/documentação. QA confirmou runtime/testes Instagram idênticos ao candidato anterior e preservação da correção concorrente.
- Gates repetidos na árvore integrada: lint exit 0, zero erros e 1.193 avisos legados (`/tmp/instagram-production-integrated-lint.log`); typecheck exit 0 (`/tmp/instagram-production-integrated-typecheck.log`); suíte completa com dois workers exit 0, 698 arquivos, **5.376 testes aprovados**, 4 skipped e 1 todo (`/tmp/instagram-production-integrated-tests.log`); build completo exit 0 (`/tmp/instagram-production-integrated-build.log`). Nenhuma alteração de runtime após esses gates; apenas este fechamento documental.
