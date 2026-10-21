# Story: Instagram/Google Sheets — leads virtuais personalizados e API de integração

## Status

Ready for Review — implementação concluída e aprovada pelo QA local; configuração e validação do endpoint em staging em andamento. Histórico aguarda confirmação específica do lote. Produção não autorizada.

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

Esse pedido autoriza implementação local do fluxo completo, incluindo API e integração preparada. Não criar card nativo/empresa/responsável na ingestão. Responsável somente na assunção. Não publicar/configurar produção; staging primeiro. Instalação de gatilho, escrita na planilha e execução da carga histórica devem respeitar autorização efetiva e o protocolo de operações em massa do projeto.

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
14. Não publicar/configurar produção. Não executar migration, backfill/importação em massa ou escrita na planilha sem os passos aplicáveis de autorização/ambiente da sessão. Preparar código e documentação revisáveis antes de solicitar qualquer aprovação necessária.
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
- [ ] Registrar resultado de configuração/homologação de staging se autorizadas e executadas; manter produção pendente.

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
