# API de leads Instagram — Painel Alpha

Contrato v1. Integração da planilha `1vzyEobII90qd6txFhPBu5IwUZ9sISGs-6jYODaVmWsI`, aba de `gid=0`, com **Revisão de Radar → Novo Lead**.

## Endereço e credencial

Homologação: `POST https://staging.alpha-comex.com/api/integrations/instagram/leads`.

Produção: `POST https://painel.alpha-comex.com/api/integrations/instagram/leads`. Usa endpoint administrativo e token próprios de produção, separados de staging. A promoção foi solicitada em 2026-10-21; o resultado operacional deve ser conferido na story e no recibo de publicação, sem inferir ativação somente a partir deste contrato.

O recebimento só é habilitado quando o código estiver publicado e o endpoint administrativo configurado e ativo no ambiente escolhido. Esta documentação não comprova ativação/deploy; consulte a evidência de entrega na story `story-crm-google-sheets-leads.md`.

Headers obrigatórios:

```http
Authorization: Bearer <token exclusivo da integração>
Content-Type: application/json
```

Token base64url de pelo menos 32 caracteres, entregue por canal privado. Não colocar o token na URL, planilha, frontend ou Git. O servidor guarda somente o hash bcrypt. A rota genérica `/api/bpm/webhooks/...` não recebe leads Instagram.

## Payload

Envie **um lead por requisição**, com cabeçalhos originais como chaves dentro de `lead`. IDs são strings, mesmo que pareçam números. `spreadsheetId`, `sheetId`, `lead.id`, `lead.created_time` e `lead.full_name` são obrigatórios. `created_time` é uma data ISO 8601 com horário e timezone, como `2026-10-21T09:00:00-03:00`. Demais valores da planilha podem ser string vazia ou null. `is_organic` também aceita boolean. `platform` aceita `ig`, `instagram`, vazio ou null; outra plataforma é recusada.

Exemplo fictício:

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
    "campaign_id": "c:exemplo",
    "campaign_name": "Campanha exemplo",
    "ad_id": "ag:exemplo",
    "ad_name": "Anúncio exemplo",
    "adset_id": "as:exemplo",
    "adset_name": "Conjunto exemplo",
    "form_id": "f:exemplo",
    "form_name": "Formulário exemplo",
    "is_organic": "false",
    "lead_status": "CREATED"
  },
  "dryRun": true
}
```

`dryRun: true` valida autenticação, fonte, payload, entrada do pipeline e conversão, **sem gravar lead**. Após validar o exemplo, remova `dryRun` ou envie `false` para receber de fato.

```bash
curl --request POST \
  'https://staging.alpha-comex.com/api/integrations/instagram/leads' \
  --header "Authorization: Bearer ${ALPHA_INSTAGRAM_TOKEN}" \
  --header 'Content-Type: application/json' \
  --data-binary @lead-example.json
```

Limite de corpo: 32 KiB; strings opcionais: 2.000 caracteres; nome: 200; ID: 120. Campos desconhecidos dentro de `lead` são descartados antes de persistir. O envelope externo aceita somente `spreadsheetId`, `sheetId`, `lead` e `dryRun`. Nunca enviar responsável, etapa de destino ou dados de autenticação dentro do lead.

## De/para aprovado

**A coluna M alimenta Radar pretendido por decisão do usuário. A coluna N não determina Radar.**

| M — resposta original | Radar pretendido no CRM |
| --- | --- |
| `limitada_usd_50k_semestrais` | Habilitação de Radar 50k |
| `limitada_usd_150k_semestrais` | Revisão de Radar Limitado a USD150k |
| `ilimitado` | Revisão de Radar Ilimitado |
| Empresa em constituição, vazio ou outra resposta | Pendente de conferência ao assumir; resposta original preservada |

Rótulos exatos das três opções do CRM também são aceitos em M. Nomes, acentos e respostas originais ficam preservados; underscores/caracteres invisíveis são normalizados apenas para apresentação/comparação.

| Origem | Destino |
| --- | --- |
| `full_name`, `email`, WhatsApp | Nome e contato do lead; Pessoa/vínculo ao assumir |
| CNPJ | Preenchido no modal; documento válido é conferido ao assumir e pode vincular empresa existente |
| Coluna M | Radar pretendido, conforme tabela acima |
| N e O | Respostas de volume/prazo no card/modal; preservadas em anotação ao assumir |
| Plataforma | Canal de origem Instagram |
| Campanha, anúncio, conjunto, formulário e IDs | Dados de origem preservados e anexados como anotação ao assumir |
| `created_time` | Data original de captação, separada da data de recebimento/importação |
| `lead_status` | Status de origem preservado; não define Qualificação comercial |
| `status_crm` | Controle do remetente; descartado no recebimento |

E-mail/telefone/CNPJ inválidos não impedem a entrada virtual: a resposta original fica disponível para revisão. Para assumir Instagram, o operador deve conferir Radar válido e responsável elegível. CNPJ e Qualificação continuam opcionais; se o CNPJ estiver preenchido, deve ser válido, ou o operador pode deixar o campo vazio. Empresa em constituição pode permanecer sem CNPJ. Nome pessoal não confirma razão social cadastral. Dados de empresa/pessoa existente não são sobrescritos pela importação; contato reapresentado reativa seu vínculo com a empresa.

## Respostas e reenvio

Nova entrada persistida, HTTP 201:

```json
{"success":true,"externalId":"l:exemplo-001","leadId":"c...","duplicate":false,"status":"pending","cardId":null}
```

Reenvio, HTTP 200:

```json
{"success":true,"externalId":"l:exemplo-001","leadId":"c...","duplicate":true,"status":"pending","cardId":null}
```

Após alguém assumir, um reenvio continua HTTP 200 e retorna `status: "promoted"` com `cardId`. A identidade de deduplicação é planilha + gid + ID externo, dentro do endpoint; linha, nome, telefone e CNPJ não são chaves de lead. O primeiro payload aceito é preservado: reenviar o mesmo ID não atualiza dados, não reabre lead assumido e não cria outro card. Para corrigir dados já aceitos, use a conferência no painel ou combine uma operação administrativa específica.

Dry run retorna HTTP 200 com `dryRun:true`, Radar convertido e flags `review.radar`, `review.cnpj`, `review.telefone`; não retorna `leadId` e não confirma recebimento persistido.

Linhas dummy do Meta (`<test lead: ...>`/`dummy data for`) retornam HTTP 200 com `ignored:true`, `reason:"LEAD_DE_TESTE"` e o `externalId`, sem criar lead.

| HTTP | Significado | Conduta do remetente |
| --- | --- | --- |
| 200/201 | Recebido, duplicado, dry run ou teste ignorado | Conferir `externalId` e distinguir os casos acima |
| 400 | JSON inválido | Corrigir o corpo |
| 401 | Token ausente/incorreto | Conferir credencial; não insistir |
| 409 | ID encontrou entrada inconsistente | Solicitar revisão administrativa; não marcar entregue |
| 413 | Corpo maior que 32 KiB | Reduzir para um único lead dentro do limite |
| 422 | Campos/fonte/formato inválidos | Corrigir campos indicados em `fields` |
| 503 | Integração inativa/configuração indisponível | Aguardar ativação e tentar depois |
| 500 | Falha temporária | Reenviar o mesmo ID |

Timeout, 429 da infraestrutura e 5xx podem ser reenviados com o **mesmo ID**, usando backoff (ex.: 5s, 15s, 60s). Não substituir IDs em retries. Não considerar redirect, HTML, dry run ou sucesso com outro `externalId` como confirmação. Confirme entrega somente se HTTP 200/201, `success:true`, `externalId` igual e `leadId` presente; teste ignorado é um estado separado.

## Comportamento no CRM

Recebimento cria apenas a entrada virtual do Instagram, pulsante, sem responsável e visível conforme acesso ao pipeline/etapa, como os demais leads não assumidos. O card personalizado mostra contato, CNPJ, Radar, volume, prazo e campanha. A abertura apresenta os dados previamente preenchidos e respostas originais.

Ao assumir, o servidor revalida acesso e usa uma única transação para reservar a entrada, criar/vincular empresa e contato, criar card/membro, salvar campos/anotação, histórico, evento, automações, SLA e cadências aplicáveis. O responsável é escolhido nessa hora. A entrada passa a PROCESSADO e mantém o vínculo pelo evento CARD_CRIADO. Reenvio da assunção não duplica efeitos e só devolve o card se o usuário puder acessá-lo.

## Remetente Google Sheets

Código pronto em `scripts/google-sheets-instagram.gs`. O conector Google Drive desta sessão lê/edita células, mas não instala projetos Apps Script ou gatilhos. A instalação deve ser feita por um editor da planilha:

1. Abrir **Extensões → Apps Script** e colar o arquivo.
2. Em **Configurações do projeto → Propriedades do script**, configurar `ALPHA_API_URL` e `ALPHA_API_TOKEN`.
3. Confirmar o ambiente de destino e a autorização aplicável ao histórico antes da primeira sincronização.
4. Executar `sincronizarLeadsInstagram` e autorizar os acessos Google necessários.
5. Executar `instalarSincronizacaoInstagram` para instalar um gatilho a cada cinco minutos.

Para produção, usar `ALPHA_API_URL=https://painel.alpha-comex.com/api/integrations/instagram/leads` e o token exclusivo desse ambiente. O script envia para apenas um destino por execução. As marcações `status_crm` incluem o host: mudar o destino de staging para produção torna as linhas históricas novamente elegíveis. Antes da primeira execução em produção, definir e autorizar o escopo do histórico conforme o protocolo de importação do projeto; publicar a API não executa essa carga nem instala o gatilho.

Gatilho por tempo captura também linhas adicionadas por integrações/API, que não disparam `onEdit`. Referência: [gatilhos instaláveis do Google](https://developers.google.com/apps-script/guides/triggers/installable).

Cada execução usa lock, até 25 tentativas e limite de tempo; um cursor de varredura evita que erros antigos bloqueiem todos os novos leads. Somente a coluna existente `status_crm` é escrita. Não cria ou renomeia colunas e não altera respostas.

Sucesso confirmado gera `integrado@<host>:<externalId>`; teste ignorado recebe outra marcação. Isso distingue staging de produção e mantém o ID da linha. O `integrado` legado não é tratado como prova de recebimento por esta API. O script resolve o ID novamente antes de escrever para reduzir risco de apontar status à linha errada após ordenação. Evite ordenar a planilha durante uma sincronização em andamento.

Credencial nunca é escrita em células ou logs. As opções `muteHttpExceptions:true` e `followRedirects:false` permitem examinar respostas sem encaminhar credenciais a redirects: [UrlFetchApp](https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app).

## Configuração administrativa e operação

Nenhuma migration é necessária. O inbox usa os modelos já existentes `BpmWebhookEndpoint` e `BpmWebhookEntrada`. O endpoint é exclusivo, `automacaoId=null`, pipeline fixo e slug `instagram-leads-planilha`.

Prévia somente leitura:

```bash
node --import tsx scripts/instagram-leads.mts \
  --env-file=.env.staging.local --admin-id=<administrador-ativo> --preview
```

Configuração individual, após revisar a prévia:

```bash
node --import tsx scripts/instagram-leads.mts \
  --env-file=.env.staging.local --admin-id=<administrador-ativo> \
  --apply --secret-file=/tmp/alpha-instagram-staging.private.json
```

O `admin-id` é autoria administrativa da configuração e **não** responsável pelos leads. O segredo é gerado uma única vez em arquivo privado 0600. Registre `INSTAGRAM_LEADS_ENDPOINT_ID=<id retornado>` somente no ambiente customizado staging da Vercel e faça novo deploy para carregar a variável. Não usar ambiente production/preview genérico por suposição.

O configurador não rotaciona segredo, não cria leads e não recria endpoint existente. Não excluir o endpoint ou suas entradas: a relação tem cascade e a exclusão perde o histórico/deduplicação. Para pausar, usar o CRUD administrativo existente e definir `ativo=false`, preservando os registros. Alterações de schema, seeds e importações em massa continuam seguindo a política Vault do repositório; configuração individual não dispensa avaliar o escopo real.

Validação inicial: testes → deploy staging → dry run autenticado → entrada de teste controlada conforme autorização → conferir card e assunção → histórico autorizado. Produção fica para promoção explícita futura.

Para um snapshot privado `{spreadsheetId,sheetId,leads:[...]}`, o CLI `scripts/instagram-leads-batch.mts` valida o lote sequencialmente. Exemplo somente leitura no CRM:

```bash
node --import tsx scripts/instagram-leads-batch.mts \
  --snapshot=/tmp/alpha-instagram-historico.private.json \
  --credential=/tmp/alpha-instagram-staging.private.json
```

A saída contém contagens, pendências e SHA-256 do snapshot, sem nomes/contatos. Carga real exige também `--apply --snapshot-sha256=<hash revisado> --expected-leads=<total revisado> --receipt=<arquivo privado>` e a confirmação específica aplicável. O CLI não escreve na planilha e não instala gatilho; recibo novo é gravado com permissão 0600 sem sobrescrever arquivo existente.
