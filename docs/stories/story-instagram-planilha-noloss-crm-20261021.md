# Story: Instagram — Planilha → NoLoss → CRM, atribuição somente no NoLoss

## Status e responsáveis

Ready for Review — implementação local e testes do fluxo concluídos; homologação operacional em staging pendente. Não executar carga histórica. `@sm` prepara story; `@architect` decide o contrato; `@dev` implementa em checkout isolado; `@qa` valida; `@devops` publica somente quando autorizado, staging primeiro no painel.

## Pedido e precedência

O usuário definiu o caminho obrigatório **planilha → NoLoss (`https://noloss.alpha-comex.com`) → CRM**. Manter o card Instagram personalizado e a assunção existentes. Retirar do CRM os dados de campanha, anúncio, conjunto/adset e formulário, preservando-os nas informações de UTM/atribuição do NoLoss. Não enviar o histórico agora, conforme pedido vigente.

Esta story complementa a implementação anterior, sem sobrescrever seu histórico. Substitui o envio direto Apps Script → CRM e a preservação de metadados de publicidade na inbox/anotação/modal do CRM. Mapeamento M → Radar, contatos, CNPJ opcional/válido se informado, perguntas de volume/prazo, origem Instagram e data de captação continuam presentes.

## Decisão de arquitetura

1. **Entrada NoLoss dedicada**, por exemplo `POST /integrations/instagram/leads`: recebe a linha original da planilha com identidade textual estável (`spreadsheetId:sheetId:lead.id`), autentica por Bearer exclusivo, valida origem/body/allowlist e persiste o evento de recebimento no NoLoss antes do encaminhamento.
2. **NoLoss mantém contato e atribuição em transação PostgreSQL explícita.** Obter um client de `PostgresDatabase.getPool().connect()`, executar BEGIN e advisory transaction lock da integração (tráfego baixo), e instanciar os stores PostgreSQL de contato/evento/valor customizado com um `Queryable` desse MESMO client. Consultar definições existentes na transação, resolver contato, fazer merge preservando campos alheios, gravar UTMs e evento imutável com `contactId` e original comercial/marketing. COMMIT antes do HTTP ao CRM; erro faz ROLLBACK e libera client. Um contato pode gerar vários leads, portanto conservar atribuição por lead no evento além do mapa atual no contato. Conflito de identificadores exige resolução explícita, sem mesclar pessoas por nome.
3. **Encaminhamento servidor NoLoss → CRM** com credencial própria do CRM, URL de destino confiável na configuração e allowlist positiva dos campos comerciais. Remover `campaign_*`, `ad_*`, `adset_*`, `form_*` e equivalentes do payload enviado, do envelope persistido no CRM e das projeções/anotações novas; não apenas ocultar na UI. Conservar ID externo e ID/aba da planilha para deduplicação, sem copiar metadados de publicidade em campos genéricos.
4. **Apps Script aponta somente ao NoLoss**, com segredo NoLoss em propriedades privadas; nunca recebe segredo do CRM. O NoLoss repassa ao CRM a mesma identidade comercial da integração anterior. A API CRM continua devolvendo o mesmo lead/resultado quando a identidade já existe, inclusive após assunção.
5. **Repetição segura de ponta a ponta.** Recebimento NoLoss e confirmação de encaminhamento são conceitos distintos. O evento canônico é imutável por chave externa; reenvios reaproveitam o PRIMEIRO payload persistido e `contactId`, sem misturar publicidade de uma tentativa com contato de outra. Responder `forwarded` e marcar processed somente depois de o CRM confirmar `success`, `externalId` correspondente e `leadId` válido; falhas/timeout/429/5xx deixam envio pendente e retornam sinal retryable. O remetente não marca integrado antes dessa confirmação. Janela de falha após commit CRM é coberta pela mesma identidade/deduplicação CRM. Não aceitar qualquer HTTP 2xx ou evento NoLoss já existente como prova de encaminhamento.
6. **Retomada síncrona, sem worker novo.** A transação local cobre contato, UTMs e evento; não abrange o HTTP externo. Não segurar advisory lock/client durante o envio CRM. Apps Script reenvia os pendentes em gatilho de cinco minutos; no retry a persistência local é reutilizada e só o forwarding é retomado. Não criar worker/fila autônoma nem depender de BullMQ/Noop. Credenciais/configuração inválidas produzem falha observável e não confirmação fictícia.

### UTM/atribuição no NoLoss

Mapeamento proposto a documentar no contrato, preservando valores originais e todos os IDs:

| Origem da planilha | Atribuição NoLoss |
| --- | --- |
| `platform=ig` | `utm_source=instagram` |
| `is_organic=true/false` | Meio derivado explicitamente de orgânico/pago; ausência não é inferida como pago |
| `campaign_name`, `campaign_id` | Campanha e ID da campanha |
| `ad_name`, `ad_id` | Conteúdo/anúncio e ID |
| `adset_name`, `adset_id` | Termo/conjunto e ID |
| `form_name`, `form_id` | Nome/ID de formulário em atribuição estendida, sem fingir que são uma UTM padrão |

DevOps confere as chaves/definições de custom fields em inventário somente leitura antes de mapear. A pesquisa de código confirma o serviço genérico, não confirma que todas as chaves UTM já estejam configuradas. Ausência/inatividade de definição gera erro de configuração explícito com rollback, sem criar definição silenciosamente na ingestão. Definições novas seriam CRUD de configuração revisável; avaliar Vault se virar seed/operação em massa. Não executar nesta análise. Não serializar todo o envelope em um identificador nem inventar nomes/valores comerciais.

## Acceptance Criteria

1. O caminho implementado é exclusivamente remetente → NoLoss → CRM para os novos envios. Documentação e exemplos usam a URL NoLoss; a credencial CRM permanece somente no servidor NoLoss.
2. Entrada NoLoss tem autenticação própria fail-closed, fonte/planilha/aba restritas, body/tamanhos/tipos validados e ID tratado como string. A isenção da sessão humana é somente para método/caminho exatos da integração, cujo handler exige Bearer. Não abrir prefixos amplos de rotas autenticadas.
3. Reenvios sequenciais e concorrentes da mesma identidade não criam eventos, contatos ou leads CRM duplicados. Transação local e advisory lock protegem persistência da integração; reler/reutilizar evento canônico e PRIMEIRO payload após append/conflito, sem sobrescrever dados aceitos silenciosamente. Um envio de identidade distinta para o mesmo contato conserva evento independente.
4. NoLoss conserva todos os metadados de campanha/anúncio/adset/formulário e seus IDs como atribuição/UTMs estendidas associadas ao contato e ao evento original. Atualizações por merge não apagam campos alheios nem substituem histórico de atribuições.
5. Payload NoLoss → CRM é produzido por allowlist comercial. Campanha/anúncio/adset/formulário e TODOS seus nomes/IDs ficam ausentes do body, envelope novo do CRM, card personalizado, modal, respostas das actions e anotação de assunção. O leitor defensivo do CRM também deixa de projetar esses campos caso encontre envelope antigo, sem apagar banco/histórico nem executar backfill nesta entrega.
6. Manter nome/contatos, CNPJ original e normalizado quando válido, data original, Radar de M e respostas volume/prazo. Empresa em constituição ou M desconhecido mantém Radar pendente para seleção; CNPJ continua opcional/válido se informado na assunção, sem mudar cadastro manual/NoLoss existente.
7. Card Instagram mantém identidade visual/pulsação com movimento reduzido, dados comerciais preenchidos e ação de assumir. Não criar card nativo ou atribuir responsável no simples recebimento. Promoção continua com ACL, responsável elegível, Radar válido e CAS/transação existentes.
8. NoLoss somente confirma encaminhamento depois de ACK CRM com `success`, `externalId` correspondente e `leadId` válido. Timeout após CRM persistir pode ser repetido sem duplicar; 401/403/configuração inválida, validação e falhas transientes são identificáveis. Estado pendente não é apresentado como integrado; status processed vem após ACK válido.
9. Remetente usa lock/limites, propriedades privadas e retry síncrono seguro a cada cinco minutos, sem worker novo. Destino é NoLoss e status/recibo separam host/fase de envio, sem interpretar status antigo do destino CRM como sucesso NoLoss. Reapontar configuração não dispara retroativamente a planilha: histórico continua sem envio até autorização posterior. Não executar importação histórica, escrita remota ou gatilho nesta análise/implementação local.
10. Endereços externos de destino não são aceitos no payload; segredos nunca entram em evento, contato, log, erro ou Git. Testes locais usam dados fictícios e stores isolados, sem produção.
11. Documentar contrato público do NoLoss, autenticação, payload de planilha, confirmação em duas etapas, IDs de correlação, retry, mapeamento UTM e responsabilidade de cada sistema. Entregar arquivo `.gs` e mapeamentos; informar URLs efetivas quando ativadas. O usuário não quer novo ZIP. Não divulgar a API interna CRM como destino do Apps Script/outro dev nem prometer endpoint ativo antes da publicação.
12. Testes cobrem autenticação/RBAC específico, allowlist sem vazamento em ingestão/projeção/actions/anotação, mapeamento/preservação da atribuição, contato/identidade em corrida, rollback de persistência local, client único/liberação de lock, falha entre persistência NoLoss e CRM, ACK incorreto, timeout após commit CRM, reenvio do primeiro payload e não envio histórico; regressão de assunção/card Instagram e integração NoLoss existente.
13. Painel executa lint/typecheck/test/build exigidos no AGENTS. NoLoss executa testes/typecheck dos workspaces afetados e build real onde existir; scripts raiz lint/build atuais são placeholders e não constituem validação real. Atualizar checklist e File List da story com resultados efetivos.

## Evidência somente leitura e riscos concretos

- `apps/api/src/app.ts`: Fastify e stores resolvidos pelo factory; `CustomFieldService` construído para definições/valores de contato. Não houve leitura de banco, contatos reais ou credenciais.
- `apps/api/src/contacts/postgresNativeContactStore.ts`: `native_contacts.fields` JSONB; `update({fields})` substitui o mapa inteiro, portanto o serviço deve carregar/mesclar. Create tem unicidade de identificadores de contato, distinta da identidade do lead; resolver conflitos sem associar pessoas incorretas. Usar identidade estável também para recuperação de contato sem identificadores utilizáveis, ou rejeitar esse caso explicitamente antes de criar contato.
- `apps/api/src/customFields/customFieldService.ts`: `setContactValues` valida chaves conhecidas/ativas e valores antes de upserts, mas os upserts são sequenciais, sem transação global. A implementação nova usará stores com client PostgreSQL transacional único e validação equivalente antes de escrever.
- `apps/api/src/db/postgres.ts`: `getPool()` permite obter client transacional; `PostgresDatabase.query` avulso usa o pool e não garante mesma sessão. BEGIN/lock/todas queries/COMMIT precisam do client obtido, com rollback/release garantidos.
- `apps/api/src/events/postgresEventStore.ts`: `append` faz `ON CONFLICT(idempotency_key) ... DO NOTHING` e retorna void; `findByIdempotencyKey` retorna o canônico. `updateStatus` é update simples, não CAS/distributed lock. Não usar como claim concorrente sem proteção adequada.
- `apps/api/src/events/eventIngestion.ts`: helper `ingestAndQueue` cria ID aleatório e enfileira o ID proposto após append; se append foi descartado por duplicata, esse ID pode não existir. Nesta integração usar ID determinístico e releitura do canônico ou adapter corrigido/testado no escopo necessário.
- `apps/api/src/auth/rbacMatrix.ts`: função efetiva é `isPublicRoute`, usada no auth middleware; POST exato da nova integração precisa passar pela sessão e aplicar Bearer próprio no handler, mantendo demais rotas protegidas.
- `apps/api/src/queue/queue.ts`: há fallback Noop quando Redis não responde; não confundir enqueue aceito com processamento durável.
- Painel `src/lib/bpm/instagram-leads.ts`: schema atual aceita publicidade, tipo tem `campanha` e `linha`, e `anotacaoLeadInstagram` inclui os quatro grupos. `InstagramLeadCard.tsx` exibe campanha e resumo desses grupos. São todos pontos a retirar/filtrar no novo contrato, além do forwarding NoLoss.
- O NoLoss está num checkout compartilhado dirty e produção Docker; implementar isoladamente e não iniciar processo/rebuild/restart do checkout vivo. Esta análise não mudou código, dados ou processos.

## Tasks / Subtasks

- [x] Registrar correção de fluxo e restrição de histórico.
- [x] Inspecionar somente leitura contatos/custom fields/event store/auth/queue do NoLoss e transporte Instagram CRM.
- [x] Definir desenho sem migration, limites de idempotência/retomada e retenção exclusiva de atribuição.
- [x] Implementar rota/serviço NoLoss e encaminhamento com testes em checkout isolado.
- [x] Ajustar remetente e contrato/projeção/anotação CRM, preservando card/assunção comerciais.
- [x] Documentar configuração/API para dev externo e testar retry completo local.
- [x] Validar gates de código e atualizar evidências/File List; homologação operacional staging em preparação.
- [ ] Histórico permanece não executado; produção permanece sem alteração por esta story.

## File List

- `/tmp/story-instagram-planilha-noloss-crm-20261021.md` — artefato de story/decisão para aplicar em checkout isolado; nenhum código modificado pelo agente de story.

## CodeRabbit Integration

Tipo: Integration/API + Business Logic + apresentação comercial. QA deve avaliar vazamento de atribuição, fonte de verdade por sistema, deduplicação em corrida, recuperação de execução parcial e proteção de sessão/Bearer. Nenhuma revisão automatizada ou teste de código executado nesta preparação documental.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-21 | 0.1 | Nova story complementar: NoLoss obrigatório no caminho e atribuição fora do CRM | `@sm` / `@architect` |

## Implementação e evidência de desenvolvimento

- Candidato NoLoss isolado criado por DevOps a partir do fonte exato da API Docker publicada, baseline local `2a05f77`; checkout original e seus arquivos dirty preservados. Rota dedicada com Bearer, allowlist, transação em client único/advisory lock/row lock, evento canônico e forwarding comercial sem metadados. Nenhuma migration ou novo worker.
- Usuário confirmou que o Apps Script ainda não foi ativado. Nova instalação registra IDs existentes como baseline ignorada, preserva histórico mesmo após ordenação/reinstalação e envia somente IDs novos. Nenhum Apps Script remoto ou gatilho foi instalado/executado.
- PostgreSQL real em staging novo e isolado `noloss_instagram_stage`, porta loopback 5434; schema existente inicializado sem dados/credenciais de produção. Seis definições UTM de teste, incluindo `utm_form`. Testes reais: 4 PASS (`/tmp/noloss-instagram-postgres-final.log`): seis recebimentos concorrentes do mesmo ID criam um contato/evento, rollback de falha SQL após contato, retomada após CRM indisponível e edição externa de identidade antes do lock. ACK CRM é simulado nesses testes; não foi enviado lead ao painel.
- Unitários NoLoss: 22 PASS. API typecheck PASS após adicionar ao helper de testes dois defaults CORS que faltavam no baseline publicado. Suite global API: 150 arquivos aprovados, 5 falhas e 1 ignorado; 2524 testes aprovados, 19 falhas e 4 ignorados. QA conferiu 18 falhas SQL idênticas na baseline publicada `2a05f77` (limitação pg-mem com ON CONFLICT de índice parcial); a falha adicional é ordenação de timestamps empatados por UUID na timeline, com código/teste idênticos ao baseline. Não alterar SQL/runtime publicado para acomodar emulador. Parecer QA: PASS do escopo da integração, com ressalva explícita para a suite global legada. Logs `/tmp/noloss-instagram-full-tests.log` e `/tmp/noloss-instagram-baseline-tests.log`.
- Três achados QA corrigidos e cobertos: calendário real antes de persistir, códigos permanentes CRM 400/422→422,409→409,413→413 para avançar cursor sem confirmar; revalidação de identidade/candidatos após row lock. Cabeçalho da anotação CRM permanece neutro para não afirmar passagem NoLoss de um envelope legado que veio diretamente.
- CRM: suite completa 704 arquivos e 5472 testes aprovados, 4 skipped e 1 todo (`/tmp/instagram-via-noloss-crm-tests.log`); lint zero erros e 1193 avisos legados. Typecheck, testes focados finais e build estão registrados em logs `/tmp/instagram-via-noloss-crm-*`.

## File List implementada

NoLoss: `apps/api/src/integrations/instagramSheets.ts`, `instagramRelayRepository.ts`, `instagramRelayService.ts`; `apps/api/src/routes/instagramSheets.ts`; `apps/api/src/app.ts`; `apps/api/src/auth/rbacMatrix.ts`; `apps/api/test/helpers.ts`; `apps/api/test/instagram-sheets.test.ts`; `apps/api/test/instagram-sheets-postgres.test.ts`; `docs/INSTAGRAM_SHEETS.md`; esta story.

CRM/remetente: `src/lib/bpm/instagram-leads.ts`; `src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/InstagramLeadCard.tsx`; `scripts/google-sheets-instagram.gs`; `scripts/instagram-leads-batch.mts`; `docs/integrations/instagram-leads.md`; `tests/bpm/instagram-leads.test.ts`; `tests/bpm/instagram-leads-assumir.test.ts`; `tests/bpm/instagram-sheets-sender.test.ts`; `tests/bpm/noloss-lead-modal-react.test.ts`; esta story.

- Fechamento dos gates CRM: typecheck exit0 (`/tmp/instagram-via-noloss-crm-typecheck-final.log`), cinco suites focadas finais/36 testes PASS, lint dos deltas zero problemas e build completo exit0 (`/tmp/instagram-via-noloss-crm-build.log`). Suite completa anterior de 704 arquivos/5472 testes continua aplicável, com diferença final apenas de cabeçalho neutro/fixture e tipagem explícita do CLI, rechecadas nos testes focados e typecheck. Não executar Prisma generate/build em paralelo às suites.
