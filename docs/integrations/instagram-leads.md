# Instagram — Planilha → NoLoss → CRM

## Origem explícita na entrada NoLoss/site do CRM

A entrada separada `POST /api/bpm/noloss-leads/ingest`, autenticada pelo header existente
`x-noloss-webhook-secret`, continua aceitando `id`, `email`, `firstName`, `lastName` e
`phone`. Também aceita `utmSource` e `utmMedium` opcionais de até 200 caracteres e
`utmCampaign` de até 300 caracteres, usando as colunas já existentes.
Exemplo sem credenciais: `{"id":"contato-sintetico","firstName":"Contato","utmSource":"site"}`.

Somente `utmSource` explícito igual a `site` ou `website`, ignorando caixa e espaços
externos, identifica origem Site nas notificações. Origem ausente ou diferente usa
aparência normal; ser um lead NoLoss não comprova Site. A entrada Instagram acima
continua identificada exclusivamente pelo seu adapter autenticado. Retry com campos
UTM omitidos preserva os valores anteriores e não reabre lead já promovido.

Essa extensão descreve o contrato aceito pelo CRM; não altera configuração externa,
variáveis de ambiente ou dados anteriores. O consumidor precisa enviar a proveniência
para novos recebimentos em que deseje comprovar origem Site.

Contrato v2. A planilha `1vzyEobII90qd6txFhPBu5IwUZ9sISGs-6jYODaVmWsI`, aba `gid=0`, envia ao NoLoss. O servidor NoLoss grava contato/atribuição e encaminha somente os dados comerciais ao Painel Alpha, em **Revisão de Radar → Novo Lead**, como card Instagram pulsante sem responsável.

## Endereços e credenciais

Entrada da planilha em produção: `POST https://noloss.alpha-comex.com/rocket-api/integrations/instagram/leads`.

Headers: `Content-Type: application/json` e `Authorization: Bearer <token exclusivo NoLoss>`.

Esse token é diferente da credencial NoLoss → CRM. Não colocar credenciais em células, código público ou Git. O Apps Script conhece somente a URL e o token NoLoss; o servidor NoLoss guarda o token do CRM. O endpoint do CRM `/api/integrations/instagram/leads` permanece como destino do servidor, não do remetente da planilha.

Staging isolado do NoLoss: `http://127.0.0.1:4101/integrations/instagram/leads`, acessível apenas no servidor, com banco/token próprios e encaminhamento exclusivamente ao CRM staging. Documentar um endereço não comprova ativação; o recibo operacional e a story registram o que foi publicado e validado.

## Payload

Um lead por requisição; cabeçalhos originais da planilha como chaves de `lead`. IDs são strings. Campos obrigatórios: `spreadsheetId`, `sheetId`, `lead.id`, `lead.created_time` (ISO 8601 com timezone), `lead.full_name`. Fonte fixa no ID/aba acima; plataforma `ig`, `instagram`, vazio ou null. Texto opcional: até 2.000 caracteres; nome: 200; ID: 120; corpo: 32 KiB. Envelope aceita somente `spreadsheetId`, `sheetId`, `lead`, `dryRun`; campos desconhecidos do lead são descartados, inclusive `status_crm` e quaisquer credenciais/atribuição de responsável.

Exemplo fictício, sem gravação:

```json
{
  "spreadsheetId": "1vzyEobII90qd6txFhPBu5IwUZ9sISGs-6jYODaVmWsI",
  "sheetId": 0,
  "lead": {
    "id": "l:exemplo-001",
    "created_time": "2026-10-21T09:00:00-03:00",
    "full_name": "Contato Exemplo",
    "email": "contato@example.com",
    "platform": "ig",
    "qual_a_modalidade_atual_da_sua_empresa_no_radar_siscomex?_": "limitada_usd_50k_semestrais",
    "qual_o_valor_pretendido_de_importações_pelos_próximos_12_meses?": "acima_de_150_mil_dólares",
    "em_quanto_tempo_você_precisa_do_novo_limite_de_radar?": "preciso_para_ontem",
    "por_qual_número_de__whastapp_podemos_entrar_em_contato_com_você?_exemplo:__(ddd)_9_xxxx-xxxx": "11999990000",
    "para_fazermos_a_pré-análise_do_radar_da_sua_empresa,_preencha_o_campo_abaixo_com_o_seu_cnpj:": "11222333000181",
    "campaign_name": "Campanha exemplo", "campaign_id": "c:exemplo",
    "ad_name": "Anúncio exemplo", "ad_id": "a:exemplo",
    "adset_name": "Conjunto exemplo", "adset_id": "s:exemplo",
    "form_name": "Formulário exemplo", "form_id": "f:exemplo",
    "is_organic": "false", "lead_status": "CREATED"
  },
  "dryRun": true
}
```

`dryRun:true` valida a entrada NoLoss, as definições de atribuição e a API/etapa do CRM sem gravar contatos, UTMs, eventos ou leads. Para receber de fato, omitir `dryRun` ou enviar `false`. Exemplo de chamada:

```bash
curl --request POST 'https://noloss.alpha-comex.com/rocket-api/integrations/instagram/leads' \
  --header "Authorization: Bearer ${ALPHA_NOLOSS_TOKEN}" \
  --header 'Content-Type: application/json' --data-binary @lead-example.json
```

## Atribuição guardada somente no NoLoss

| Origem | NoLoss |
| --- | --- |
| Instagram | `utm_source=instagram` |
| `is_organic=true` / `false` | `utm_medium=organic_social` / `paid_social`; vazio não presume pago |
| `campaign_name` | `utm_campaign` |
| `ad_name` | `utm_content` |
| `adset_name` | `utm_term` |
| `form_name` | `utm_form`, extensão de atribuição, não uma UTM padrão |
| IDs de campanha, anúncio, conjunto e formulário | `fields.instagram_attribution`, com os valores originais e correlação ao lead |

As seis definições UTM devem existir, estar ativas e ter tipo texto; a ingestão não cria definições silenciosamente. `utm_form` é configuração administrativa de um campo personalizado na tabela existente, sem migration. O contato mantém os valores conhecidos atuais; cada lead conserva sua própria atribuição completa no evento imutável `instagram.sheet.received`, mesmo quando o contato recebe outro lead depois.

Contato é identificado por e-mail/telefone, sem mesclar pessoas por nome; conflito entre identificadores de contatos distintos retorna 409. Dados comerciais existentes não são sobrescritos; outros campos JSON são preservados por merge sob bloqueio da linha. Os metadados de publicidade não são enviados ao CRM, persistidos em novas entradas CRM, projetados ao cliente ou usados em novas anotações. O leitor CRM também filtra envelopes antigos, sem apagar registros ou executar backfill.

## Dados comerciais mantidos no CRM

Nome/e-mail/WhatsApp, CNPJ original e válido quando disponível, data original de captação, coluna M → Radar pretendido, volume e prazo permanecem preenchidos. Canal Instagram, aparência do card, pulsação, permissões e assunção continuam os mesmos; responsável somente ao assumir. CNPJ é opcional e deve ser válido se preenchido, sem alterar o cadastro manual/NoLoss do site.

| M — resposta | Radar pretendido |
| --- | --- |
| `limitada_usd_50k_semestrais` | Habilitação de Radar 50k |
| `limitada_usd_150k_semestrais` | Revisão de Radar Limitado a USD150k |
| `ilimitado` | Revisão de Radar Ilimitado |
| Outra resposta/empresa em constituição | Conferir ao assumir; original preservado |

A coluna N é volume e não determina Radar. Campanha, anúncio, conjunto e formulário não aparecem no card/modal/anotação CRM.

## Confirmação, persistência e retry

A transação PostgreSQL NoLoss usa um único client e advisory transaction lock para resolver contato, gravar valores UTM e evento com chave `instagram:<spreadsheetId>:0:<lead.id>`. COMMIT ocorre antes do HTTP ao CRM. Não há transação distribuída: falha no envio deixa o recebimento durável no NoLoss e retorna erro, para o Apps Script repetir. Não há worker autônomo novo.

Só confirmar entrega se HTTP 2xx, `success:true`, `externalId` igual e `leadId` presente. Resposta normal:

```json
{"success":true,"via":"noloss","externalId":"l:exemplo-001","leadId":"c...","duplicate":false,"status":"pending","cardId":null}
```

Reenvio usa o PRIMEIRO payload aceito por NoLoss e a mesma identidade no CRM. Não atualiza silenciosamente um lead já aceito nem reabre um card assumido. Janela de falha após CRM persistir é resolvida pela deduplicação existente. O evento NoLoss só passa a `processed` depois de um ACK válido; resposta 2xx sem identidade correta, redirect, HTML e dry run não são entrega real.

Dummy Meta retorna `ignored:true`, `reason:LEAD_DE_TESTE`, sem persistir/encaminhar. Credencial ausente/incorreta retorna 401; corpo/fonte/tipo inválido 400/422; limite excedido 413; contato inconsistente/ambíguo 409; atribuição não configurada, falha de persistência ou CRM temporariamente indisponível/credencial CRM inválida 503; ACK incorreto 502. Erros permanentes CRM 400/422 retornam 422, conflito 409 e limite 413, sem confirmação e permitindo ao cursor avançar para os próximos leads; o evento continua pendente para revisão. Falha nunca marca a linha integrada. Repetir o mesmo ID após timeout/429/5xx; não trocar IDs nem endpoints para forçar reenvio.

## Apps Script — somente novos IDs por padrão

Arquivo `scripts/google-sheets-instagram.gs`:

1. Colar em **Extensões → Apps Script** da planilha.
2. Em **Configurações do projeto → Propriedades do script**, definir `ALPHA_API_URL` com a URL NoLoss e `ALPHA_API_TOKEN` com o token exclusivo NoLoss.
3. Executar **`instalarSincronizacaoInstagram` primeiro**, concedendo os acessos Google. Essa ativação registra os IDs já existentes como histórico ignorado e instala o gatilho de cinco minutos. Não escreve nas respostas ou nos status históricos.
4. Aguardar novos leads; opcionalmente executar `sincronizarLeadsInstagram` após a instalação. Antes da ativação, essa função recusa o envio. Reinstalar não redefine a baseline nem faz os novos leads virarem histórico.

A baseline usa IDs, permanece válida após ordenação e não depende de números de linha/data. A implementação protege o armazenamento de propriedades e recusa ativação automática se o histórico ultrapassar sua margem. Uma carga histórica exige operação separada, revisada e autorizada; não apagar a baseline para improvisar backfill.

Cada execução usa lock, cursor, até 25 tentativas e limite de tempo. Após confirmação das duas etapas, escreve `integrado@<host-NoLoss>:<externalId>` somente na coluna `status_crm`; resolve a linha novamente pelo ID antes da escrita. Timeout/falha deixa pendente; o próximo gatilho repete. O conector disponível nesta sessão não instala projetos/gatilhos Apps Script: a instalação é feita pelo editor da planilha. Nenhum ZIP novo é necessário.

## Configuração operacional do servidor NoLoss

Variáveis apenas na API NoLoss: `INSTAGRAM_SHEETS_TOKEN` (nova credencial planilha → NoLoss), `ALPHA_CRM_INSTAGRAM_URL` (destino exato staging/produção) e `ALPHA_CRM_INSTAGRAM_TOKEN` (credencial CRM desse ambiente). Não reutilizar o mesmo segredo nas duas pontas, não aceitar destino arbitrário no payload e não copiar banco/credenciais de produção para staging.

Somente `POST /integrations/instagram/leads` dispensa sessão de usuário e exige seu próprio Bearer; demais rotas mantêm autenticação/RBAC. Persistência requer PostgreSQL. Nenhuma alteração de schema é necessária. Publicar primeiro no staging, executar validação sem dados reais e só então promover conforme autorização efetiva. O rollout NoLoss pode substituir somente a API com `--no-deps --no-build`, preservando PG/Redis/web/workers e sem executar o serviço `migrate` do compose. Rollback de imagem/configuração preserva os registros.

O CLI de lote `scripts/instagram-leads-batch.mts` aceita somente a URL loopback do NoLoss staging, retém os cabeçalhos originais para esse servidor e continua dryRun por padrão. `--apply` permanece condicionado a hash, contagem, recibo e autorização própria; não foi executado nesta entrega.
