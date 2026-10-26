# API de criação de cards em Novos Leads

Esta documentação também cobre o avanço de cards por ID nas etapas de reunião.

Para consultar os IDs dos campos, abra **Configurações do Alpha CRM → Automações → Motor Central → Webhooks**
e clique em **Ver campos obrigatórios** no webhook desejado. A consulta usa a configuração atual do pipeline
vinculado ao endpoint, separando os dois avanços de etapa. Ela exibe nome, ID copiável, tipo, opções e se a
obrigatoriedade é condicional. Campos que não aceitam edição nesse movimento são sinalizados.
Também são indicados os parâmetros nativos `empresa.cnpj`, `empresa.razaoSocial` e `dataReuniao`,
que não são enviados por ID em `camposValores`. A consulta exige a permissão administrativa de configurar etapas
e não revela o segredo do webhook. A lista é uma referência de configuração; as pendências efetivas continuam
sendo avaliadas pela API para cada card.

## Endpoint

`POST /api/bpm/webhooks/{slug}/cards`

O `slug` e o segredo são gerados na área administrativa de automações do Alpha CRM. O endpoint precisa estar ativo, vinculado ao pipeline **Revisão de Radar**, e a distribuição automática de closers precisa estar ativa nesse pipeline.

## Headers

| Header | Obrigatório | Descrição |
| --- | --- | --- |
| `x-bpm-webhook-secret` | Sim | Segredo do endpoint gerado pelo Alpha CRM. |
| `Idempotency-Key` | Sim | Identificador único da tentativa, entre 1 e 200 caracteres (`A-Z`, `a-z`, números, `.`, `_`, `:`, `-`). Reutilize a mesma chave ao repetir uma requisição. |
| `Content-Type` | Sim | `application/json`. |

## Corpo

```json
{
  "empresa": {
    "cnpj": "11.222.333/0001-81",
    "razaoSocial": "Empresa Exemplo Ltda",
    "nomeFantasia": "Empresa Exemplo",
    "uf": "SP",
    "municipio": "São Paulo"
  },
  "radarPretendido": "Revisão de Radar Ilimitado",
  "canalOrigem": "Integração ERP",
  "qualificacao": "Qualificado"
}
```

Obrigatório: `empresa.cnpj` e `empresa.razaoSocial`. O CNPJ é validado e normalizado. Uma empresa existente com o mesmo CNPJ será reutilizada; caso contrário, será criada junto com o card. `nomeFantasia`, `uf`, `municipio`, `radarPretendido`, `canalOrigem` e `qualificacao` são opcionais. Quando o campo Canal de origem estiver configurado, seu valor padrão é `API`.

O corpo não aceita `pipelineId`, `etapaId` ou `responsavelId`: o endpoint define o pipeline e a etapa inicial; o servidor escolhe o closer pelo rodízio configurado. Os campos de `Radar pretendido` são validados contra as opções ativas do pipeline.

## Exemplo

```bash
curl -X POST "https://SEU_HOST/api/bpm/webhooks/SLUG_GERADO/cards" \
  -H "Content-Type: application/json" \
  -H "x-bpm-webhook-secret: SEGREDO_GERADO_NO_ALPHA_CRM" \
  -H "Idempotency-Key: erp-lead-2026-00042" \
  --data '{"empresa":{"cnpj":"11.222.333/0001-81","razaoSocial":"Empresa Exemplo Ltda"},"canalOrigem":"Integração ERP"}'
```

## Respostas

- `201`: card criado; `data` inclui `cardId`, `closerEmail`, `empresaId`, pipeline, etapa, `responsavelId` e `duplicate: false`.
- `200`: a mesma chave já criou um card; retorna o `cardId` e o `closerEmail` atribuídos originalmente, com `duplicate: true`, sem consumir outro turno.
- `400`: JSON, campos, CNPJ ou chave de idempotência inválidos.
- `401`: segredo inválido.
- `404`: endpoint indisponível ou não associado a Revisão de Radar.
- `409`: distribuição inativa ou configuração incompatível.
- `429`: limite de 60 chamadas por minuto para o endpoint e IP.
- `503`: etapa de entrada não configurada, nenhum closer elegível ou closer atribuído indisponível.

A criação do card, o vínculo do closer, o histórico, o evento, o registro de idempotência e as automações iniciais são gravados na mesma transação. A funcionalidade de atribuição depende da aplicação prévia da migration `20261026180000_bpm_closer_atribuicoes`.

Exemplo de resposta de sucesso:

```json
{
  "success": true,
  "data": {
    "cardId": "cm...",
    "closerEmail": "closer@empresa.com",
    "empresaId": 91,
    "pipelineId": "pipeline-id",
    "etapaId": "etapa-id",
    "responsavelId": 17,
    "duplicate": false
  }
}
```

## Avançar um card para as etapas de reunião

`POST /api/bpm/webhooks/{slug}/cards/{cardId}/etapa`

Use os mesmos headers `x-bpm-webhook-secret`, `Idempotency-Key` e `Content-Type: application/json`.
O card deve pertencer ao pipeline do webhook ativo. A integração segue as transições já configuradas:
as duas arestas precisam estar permitidas para `AUTOMACAO` ou `AMBOS`; a API não altera essa configuração.

Para avançar **Novo Lead → Agendar reunião**:

```json
{
  "etapaDestino": "AGENDAR_REUNIAO",
  "camposValores": {
    "ID_DO_CAMPO_OBRIGATORIO": "valor"
  }
}
```

Para avançar **Agendar reunião → Reunião Agendada**:

```json
{
  "etapaDestino": "REUNIAO_AGENDADA",
  "dataReuniao": "2026-11-10T14:30:00-03:00",
  "camposValores": {
    "ID_DO_CAMPO_OBRIGATORIO": "valor"
  }
}
```

`camposValores` é obrigatório e usa os IDs reais dos campos publicados nos formulários da origem/destino,
com valores em texto. Os IDs e opções são os mesmos da configuração de campos/formulários do CRM.
Os exemplos usam placeholders; substitua-os pelos IDs configurados no pipeline.
Pode ser `{}` quando os campos obrigatórios já estão preenchidos no card. O motor valida os dados
salvos junto com os enviados e cobra os requisitos de saída da origem e de entrada do destino,
incluindo regras condicionais e checklists. Requisitos não podem ser dispensados pelo webhook.

`dataReuniao` é obrigatória em `REUNIAO_AGENDADA`, em ISO 8601 com fuso (`-03:00` ou `Z`).
Ela é salva no CRM junto com o movimento e os campos, atomicamente. Este endpoint não cria um evento no Google Calendar.
`versaoEsperada` é um inteiro opcional para recusar alterações concorrentes desde a última leitura do integrador.
O payload não permite trocar o responsável, escolher outro pipeline nem saltar a etapa intermediária.

Uma resposta `200` contém `success: true` e `data` com `cardId`, `etapaOrigemId`, `etapaDestinoId`,
`versao`, `historicoId`, `eventoId` e `idempotente`, além dos demais metadados da transição.
Use uma chave de idempotência nova para cada movimento e mantenha a mesma chave e o mesmo payload ao repetir
a chamada. Reenvios devolvem o resultado original sem salvar novamente campos ou data.

Erros específicos:

- `400`: payload inválido, data/hora ausente ou sem fuso, ou chave de idempotência inválida.
- `401`: segredo ausente ou incorreto.
- `403`: a transição não permite o solicitante de integração.
- `404`: webhook indisponível ou card fora do pipeline do webhook.
- `409`: etapa de origem incorreta, versão desatualizada, configuração ambígua ou transição indisponível.
- `413`: payload acima de 256 KiB.
- `422`: campos ou requisitos pendentes; a resposta inclui `code`, `error` e, quando disponível, `pendencias`.
- `429`: limite de 60 requisições por minuto por endpoint neste processo.
- `500`/`503`: falha interna ou banco ocupado; nenhum movimento parcial é confirmado.

Exemplo de pendência:

```json
{
  "success": false,
  "code": "REQUIREMENTS_PENDING",
  "error": "Campos/requisitos obrigatórios pendentes (Radar pretendido).",
  "pendencias": ["Radar pretendido"]
}
```
