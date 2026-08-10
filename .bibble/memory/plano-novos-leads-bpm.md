# PLANO — Automações e regras por etapa do pipeline "Revisão de Radar"

> Status: **PLANEJADO, NÃO INICIADO**. Blueprint de referência (Scout, 2026-08-10) + decisões do usuário. Nenhum código foi escrito ainda.

**Origem:** pedido do usuário em 2026-08-10, logo após renomear o pipeline "Comercial" para "Revisão de Radar" (ver sessão anterior). Especificação está sendo entregue coluna por coluna do Kanban — este documento cresce a cada nova coluna detalhada. **Colunas 1-4 (Novos leads, Agendar Reunião, Reunião Agendada, Em Tratativa)** já especificadas.

---

## Decisões já confirmadas com o usuário

1. **Scheduler real via Vercel Cron** (projeto roda na Vercel) — não é cálculo ao vivo na tela. `vercel.json` com `crons[]` chamando uma Route Handler protegida, que dispara a lógica das 2 automações diariamente.
2. **"IA que responde ao lead" não existe hoje** (confirmado por Scout — Bibble/Onyx são assistentes internos, não bot de qualificação externa) — tratado como fora de escopo. Todo lead novo é considerado "sem resposta" desde a criação do card; se uma IA de qualificação for construída no futuro, ela só precisa marcar o card como "respondido" para pausar a cobrança de ligações.

## Achados-chave do reconhecimento (Scout)

- **Obrigatoriedade de campo por etapa já existe e já bloqueia avanço** — `MoverCardBpm` (`src/actions/bpm/Cards.ts`, linhas ~344-364) já valida `BpmCampo.obrigatorio` no destino antes de mover. Sub-feature 3 é majoritariamente configuração, não código novo.
- **Não existe máquina de estado (transições permitidas)** — `MoverCardBpm` aceita qualquer etapa de destino dentro do mesmo pipeline. Sub-feature 4 exige schema novo.
- **`BpmInteracaoCard`** já modela "ligação registrada" (`tipo: "LIGACAO"`), mas não achei uso real disso na UI hoje — precisa confirmar se há tela de registro de ligação já funcionando ou se é só schema reservado.
- **Nenhum job agendado roda em produção hoje.** O único precedente (worker da Agenda Alpha) está implementado com **flags desligadas**, bloqueado explicitamente por falta de scheduler supervisionado (ver `architecture.md`, "Runbook flags-off"). Vercel Cron resolve isso de forma mais simples que replicar o padrão da Agenda Alpha.
- **`BpmCampo`** já é o mecanismo certo para "canal de origem" (tipo seleção) e para os 4 campos obrigatórios pedidos — sem migration de schema para esses 2 itens.

---

## Coluna 1 — "Novos leads": desenho técnico por sub-feature

### 1. Indicador visual "nunca acessado"

**Schema (migration pequena, aditiva 🟢):**
```prisma
model BpmCard {
  // ...existente
  primeiraVisualizacaoEm DateTime?
}
```
Ao abrir o card (`ObterCardBpm` ou equivalente), se `primeiraVisualizacaoEm` for `null`, seta para `now()` na mesma chamada (primeiro acesso por QUALQUER usuário apaga o indicador, conforme pedido). Componente do board (`PipelineBoardClient.tsx`) renderiza cor diferente quando `primeiraVisualizacaoEm === null`.

### 2. Badge de canal de origem

**Sem migration.** Cadastrar `BpmCampo` novo: `nome: "Canal de origem"`, `tipo: "selecao"`, `opcoesJson: ["Instagram", "Indicação", ...]`, vinculado à etapa "Novos leads" (ou ao pipeline inteiro, a decidir). Componente do card no board precisa ganhar um badge que busca esse valor em `BpmCardCampoValor` e exibe sem precisar abrir o card — hoje o card fechado provavelmente não renderiza nenhum `BpmCampo`, então isso é ajuste real de UI, não só dado.

### 3. Campos obrigatórios (Nome do responsável, CNPJ, Radar pretendido, Confirmar serviço)

**Sem migration, sem código novo de validação** (já existe). Só cadastrar os 4 como `BpmCampo` com `obrigatorio: true` na etapa "Novos leads", via tela de admin já existente (`AdminPipelineClient.tsx`) ou script de seed. **Decisão a confirmar na Fase de execução:** "CNPJ" e "Nome do responsável" podem colidir conceitualmente com o cadastro de `Cliente`/`Pessoa` do plano de unificação em andamento (`plano-cliente-master.md`) — avaliar se vale a pena esperar essa migração ou seguir com `BpmCampo` solto por ora (recomendação: seguir com `BpmCampo` agora, sem bloquear por uma migração maior que ainda está em fase de planejamento).

### 4. Regra de avanço restrita (Novos leads → só Agendar reunião ou Standby)

**Schema novo (migration pequena, aditiva 🟢):**
```prisma
model BpmEtapaTransicaoPermitida {
  id             String   @id @default(cuid())
  etapaOrigemId  String
  etapaDestinoId String
  etapaOrigem    BpmEtapa @relation("TransicaoOrigem", fields: [etapaOrigemId], references: [id], onDelete: Cascade)
  etapaDestino   BpmEtapa @relation("TransicaoDestino", fields: [etapaDestinoId], references: [id], onDelete: Cascade)

  @@unique([etapaOrigemId, etapaDestinoId])
  @@index([etapaOrigemId])
}
```
**Regra de fallback obrigatória:** se uma etapa NÃO tem nenhuma linha em `BpmEtapaTransicaoPermitida` como origem, `MoverCardBpm` continua permitindo qualquer destino (comportamento atual preservado) — só etapas com transições explicitamente configuradas ficam restritas. Isso evita quebrar os pipelines "Financeiro" e "Radar", que nunca pediram essa restrição. `MoverCardBpm` ganha a checagem antes da checagem de campos obrigatórios já existente.

### 5. Automação de ligações (5 tentativas/dia) para leads "sem resposta"

**Schema novo (migration 🟢):**
```prisma
model BpmCardTentativaLigacao {
  id        String   @id @default(cuid())
  cardId    String
  card      BpmCard  @relation(fields: [cardId], references: [id], onDelete: Cascade)
  dia       DateTime // data civil (só a data, sem hora) — 1 contador por dia
  tentativas Int     @default(0)
  usuarioId Int
  usuario   usuarios @relation(fields: [usuarioId], references: [id])

  @@unique([cardId, dia, usuarioId])
}
```
Reaproveita `BpmInteracaoCard` (`tipo: "LIGACAO"`) como o registro individual de cada ligação — `BpmCardTentativaLigacao` seria redundante se `BpmInteracaoCard` já for suficiente para contar "quantas ligações hoje" via `COUNT(*) WHERE cardId=X AND tipo='LIGACAO' AND DATE(createdAt)=hoje`. **Decisão a confirmar na Fase de execução:** usar `BpmInteracaoCard` existente (sem tabela nova) ou criar tabela de contador dedicada (mais simples de consultar, mas duplica o que já existe). Recomendação do Bibble: reaproveitar `BpmInteracaoCard`, sem tabela nova.

"Travar"/"cobrar" o responsável: precisa de UI que mostre "faltam N de 5 ligações hoje" no card/detalhe — sem bloquear ações do sistema (travar de verdade, ex: impedir mover o card, é uma escolha de produto a confirmar).

### 6. Automação de 8 dias (mover para Standby se "Próximo Contato" não preenchido)

**Schema novo (migration 🟢):**
```prisma
model BpmCard {
  // ...existente
  proximoContatoEm DateTime?  // preenchido manualmente pelo responsável — presença interrompe a automação
}
```
**Job diário via Vercel Cron:**
```json
// vercel.json
{
  "crons": [{ "path": "/api/bpm/jobs/cobranca-novos-leads", "schedule": "0 12 * * *" }]
}
```
Route Handler protegida (header secreto `CRON_SECRET`, comparado antes de processar — nunca pública sem proteção) roda 1x/dia:
1. Para cada `BpmCard` na etapa "Novos leads" com `proximoContatoEm IS NULL`: calcular dias desde `createdAt`. Se >= 8 dias, mover automaticamente para "Standby - Follow Up" (reaproveitando a mesma lógica de `MoverCardBpm`, ou uma versão interna sem checagem de `auth()` de sessão, já que é processo de sistema).
2. Registrar em `BpmCardHistorico` com `automacaoOrigem` preenchido (campo já existe no schema!) para diferenciar de movimentação manual.

---

---

## Coluna 2 — "Agendar Reunião": desenho técnico por sub-feature

**Achado-chave (Scout, investigação pontual 2026-08-10): a integração com Google Meet JÁ EXISTE, completa e em produção — não é construção do zero.** A Agenda Alpha (`src/lib/google-calendar/`, `src/actions/google-calendar-eventos.ts`) já tem `criarEventoNoCalendario` com `criarMeet: boolean` (Google Calendar API `conferenceDataVersion: 1`), rodando sobre a mesma infraestrutura de Domain-Wide Delegation (Service Account impersona `usuarios.email` — sem OAuth por usuário). Isso reduz drasticamente o esforço desta coluna: é **reaproveitamento**, não integração nova.

### Campos: Data, Hora

**Sem migration necessariamente nova — reaproveita `BpmCampo`** (mesmo mecanismo da Coluna 1), tipo `data` para "Data" e um tipo `texto`/`selecao` para "Hora" (o catálogo de tipos hoje é `texto|numero|data|selecao|booleano` — não existe tipo `hora` dedicado; ver decisão abaixo). Alternativa: colunas dedicadas em `BpmCard` (`dataReuniao DateTime?`) se a integração com Google Meet precisar ler esses valores de forma mais direta/tipada do que via `BpmCardCampoValor` (que guarda tudo como `String?`). **Recomendação do Bibble: colunas dedicadas em `BpmCard`**, não `BpmCampo` — porque o botão "Agendar pelo Google Meet" precisa montar um payload de evento (`inicio`/`fim` como `Date` reais) e ler `BpmCardCampoValor.valor` (sempre string) exigiria parse/validação redundante toda vez. `BpmCampo` fica melhor para campos "de exibição/preenchimento livre"; Data/Hora aqui alimentam uma integração de sistema, pedem tipo forte.

```prisma
model BpmCard {
  // ...existente
  dataReuniao       DateTime? // data+hora combinadas, timezone America/Sao_Paulo (mesmo contrato já usado pela Agenda Alpha — ver integration-points.md)
  googleEventId      String?   // preenchido quando a reunião é criada via botão Meet — permite reabrir/editar o mesmo evento depois
  googleMeetLink     String?   // cache do hangoutLink retornado pela API, para exibir sem nova chamada
}
```

### Integração com Google Meet — botão "Agendar pelo Google Meet"

**Reaproveita `criarEventoNoCalendario` (`src/actions/google-calendar-eventos.ts`) quase como está.** Fluxo: usuário preenche Data/Hora no card → clica "Agendar pelo Google Meet" → Server Action nova no BPM (`AgendarReuniaoGoogleMeetBpm`, `src/actions/bpm/Cards.ts` ou arquivo dedicado) que:
1. Resolve o calendário do **responsável do card** (`BpmCard.responsavelId`, não necessariamente quem clicou o botão — decisão a confirmar, ver abaixo).
2. Chama `criarEventoGoogleApi`/`criarEventoNoCalendario` com `criarMeet: true`, `inicio`/`fim` calculados a partir de `dataReuniao` (+ duração padrão, ex: 30min — a especificação não definiu duração, ver decisão abaixo), `titulo` derivado do nome da empresa do card.
3. Salva `googleEventId`/`googleMeetLink` de volta no `BpmCard`.

**Dependência real e bloqueante:** `criarEventoNoCalendario` exige que o usuário (`obterUsuarioGoogleAtivo`) tenha `GoogleCalendarConexao` **ativa** e pelo menos 1 calendário **gravável** selecionado (`GoogleCalendarSelecionado.gravavel`). Se o responsável do card nunca conectou a Agenda Alpha, o botão precisa de um estado de erro claro ("Conecte sua Agenda Alpha primeiro em Perfil → Agenda") — não pode falhar silenciosamente. **Decisões a confirmar antes de codar:**
- A reunião é criada na agenda de **quem clicou o botão** (mais simples, mas pode não ser o responsável do card) ou **do responsável do card** (mais correto semanticamente, mas exige que o responsável tenha conectado a própria agenda, e quem clica não necessariamente é ele)?
- Duração padrão do evento (30min? 1h?) — a especificação só pede "Data"/"Hora", não duração.
- Participantes do evento: só o responsável, ou também um e-mail do lead/empresa (se `Cliente`/contato tiver e-mail capturado)?

### Validação para avanço (Data e Hora obrigatórias)

**Sem código novo** — mesmo mecanismo já confirmado na Coluna 1 (`MoverCardBpm` já bloqueia avanço por campo obrigatório). Se Data/Hora virarem colunas dedicadas em `BpmCard` (recomendação acima) em vez de `BpmCampo`, a validação de obrigatoriedade PRECISA ser estendida — hoje o mecanismo só olha `BpmCampo.obrigatorio`/`BpmCardCampoValor`, não colunas nativas do `BpmCard`. **Isto é uma decisão de arquitetura com efeito cascata**: se Data/Hora não forem `BpmCampo`, `MoverCardBpm` precisa de um segundo caminho de validação (checagem hardcoded "se etapa é X, exigir `dataReuniao != null`"), o que é menos genérico que o mecanismo atual mas mais correto tipagem-wise. Confirmar esta troca explicitamente antes de implementar.

### Regra de avanço restrita (Agendar Reunião → só Reunião Agendada ou Standby)

**Mesmo mecanismo já desenhado na Coluna 1** (`BpmEtapaTransicaoPermitida`) — só adicionar 2 linhas novas (`Agendar reunião → Reunião Agendada`, `Agendar reunião → Standby - Follow Up`). Nenhuma peça técnica nova, é dado de configuração sobre a estrutura já desenhada.

### Automação de 8 dias

**Idêntica à automação de 8 dias já desenhada para a Coluna 1** — mesmo campo `BpmCard.proximoContatoEm`, mesmo job diário via Vercel Cron. A Route Handler da Fase D (`/api/bpm/jobs/cobranca-novos-leads`) precisa generalizar para processar **qualquer etapa com essa automação configurada**, não só "Novos leads" — recomendação: renomear o endpoint para algo mais genérico (`/api/bpm/jobs/automacao-follow-up`) e o job varrer todas as etapas que tiverem a automação habilitada (campo novo `BpmEtapa.automacao8DiasAtiva Boolean @default(false)`, ou simplesmente hardcoded para as etapas "Novos leads" e "Agendar reunião" por enquanto, generalizando só se uma 3ª etapa pedir o mesmo).

**Nota importante:** a especificação da Coluna 1 mencionava também "Automação de ligações (5/dia)" — a Coluna 2 **não pediu isso**, só a automação de 8 dias. Confirma que "Agendar Reunião" não tem cobrança de ligação diária, só a automação de Próximo Contato/8-dias — se for engano e você quiser as duas na Coluna 2 também, avisa antes da implementação.

---

---

## Coluna 3 — "Reunião Agendada": desenho técnico por sub-feature

### Reagendamento

**Reaproveita infraestrutura já existente.** `atualizarEventoNoCalendario`/`atualizarEventoParcialNoCalendario` (`src/actions/google-calendar-eventos.ts`) já fazem exatamente isso — atualizam um evento Google existente por `googleEventId` (campo que a Coluna 2 já grava em `BpmCard`). Botão "Reagendar" no card chama uma Server Action nova do BPM (`ReagendarReuniaoBpm`) que: valida nova Data/Hora → chama `atualizarEventoParcialNoCalendario({ googleEventId: card.googleEventId, inicio, fim })` → atualiza `BpmCard.dataReuniao` local. Mesma dependência da Coluna 2 (usuário precisa ter Agenda Alpha conectada). Sem migration nova — usa exatamente as colunas já desenhadas na Coluna 2 (`dataReuniao`, `googleEventId`).

**Nota de auditoria:** cada reagendamento deveria gerar 1 linha em `BpmCardHistorico` (`acao: "REUNIAO_REAGENDADA"`) para rastrear quantas vezes uma reunião foi remarcada — sinal de qualidade do lead que hoje se perderia silenciosamente.

### Integração com Google Meet — transcrição

**⚠️ NÃO DECIDIDO — documentado para decisão futura, não implementado nesta rodada** (conforme pedido explícito do usuário, 2026-08-10: "documentar para fazer as decisões" em vez de escolher agora).

Achado técnico do Scout: a transcrição do Google Meet **não é parte do Google Calendar API** (já integrado neste projeto) — é um recurso separado da **Google Meet REST API** (`meet.googleapis.com`), com:
- **Escopos próprios**, não configurados hoje no Admin Console do Workspace (só `calendar.calendarlist.readonly`/`calendar.events.owned`/`calendar.events.readonly`/`calendar.freebusy` estão autorizados — ver `src/lib/google-calendar/scopes.ts`). Precisaria de algo como `meetings.space.readonly` ou `meetings.space.created`, dependendo do fluxo exato.
- **Pré-condição fora do código**: a reunião precisa ter sido gravada com transcrição ativada no Google Meet (configuração do Workspace ou ação manual de quem inicia a chamada) — se ninguém ativar, não existe transcrição para buscar, independente do código.
- **Não é instantâneo**: a transcrição fica disponível na API só depois que o Google termina de processá-la pós-reunião (minutos a horas, não segundos) — qualquer integração precisa lidar com "ainda não disponível", não é um `fetch` síncrono no momento em que o card abre.
- **Decisões que precisam do usuário/Super Admin do Workspace antes de qualquer código:**
  1. Autorizar o(s) escopo(s) da Google Meet API no Admin Console (mesmo processo já documentado para o Calendar API em `codebase-map.md`/`architecture.md` — Security → API Controls → Domain-wide Delegation, novo Client ID ou escopo adicional no mesmo Client ID da Service Account).
  2. Confirmar que a gravação/transcrição do Meet está habilitada por padrão nas contas do Workspace usadas para essas reuniões (é uma configuração de admin do Workspace, não do código).
  3. Decidir o mecanismo de busca: polling periódico (outro job, parecido com o Cron já desenhado) checando se a transcrição de uma reunião passada ficou pronta, ou busca sob demanda quando alguém abre o card (com estado "processando..." enquanto não chega)?

**Alternativa mais simples, sugerida mas não escolhida ainda** (ver decisão de fallback abaixo): campo de texto livre preenchido manualmente por quem participou, sem integração automática — cumpre a regra de negócio "obrigatório para avançar" sem depender de nenhuma infraestrutura nova. Fica registrado aqui como caminho B disponível, a escolher quando o usuário decidir.

### Validação para avanço (Transcrição obrigatória)

**Mesmo mecanismo de obrigatoriedade já usado nas colunas anteriores** — campo "Transcrição da Reunião" (`BpmCampo` tipo texto, `obrigatorio: true` na etapa "Reunião Agendada", OU coluna dedicada `BpmCard.transcricaoReuniao String?` se a integração automática avançar, para não misturar texto longo de transcrição com o padrão `BpmCardCampoValor.valor` — texto de transcrição pode ser grande, e `BpmCardCampoValor` não tem tratamento especial de tamanho hoje). **Decisão a confirmar junto com a escolha manual-vs-automática acima.**

### Regra de avanço restrita (Reunião Agendada → Em Tratativa, Standby ou Sem viabilidade)

**Mesmo mecanismo `BpmEtapaTransicaoPermitida`** já desenhado — 3 linhas novas de configuração, nenhuma peça técnica nova.

### Automação de 8 dias

**Idêntica às automações já desenhadas** — mesma generalização do job de Cron (Fase F) cobrindo mais uma etapa.

### Campos do card (12 campos customizados novos)

**Todos via `BpmCampo`** (mecanismo já existente, sem migration de schema — é dado de configuração, não estrutura nova), vinculados à etapa "Reunião Agendada":

| Campo | Tipo | Opções |
|---|---|---|
| Mês para protocolar | `data` | — |
| Radar pretendido | `selecao` | (não especificado — confirmar catálogo com o usuário) |
| Faturamento nos últimos 5 anos | `selecao` | Menos de 5M / De 5 a 16M / Acima de 16M |
| Armazenamento | `selecao` | 8 opções (Na sede - alugado/próprio/sócio, Local separado - galpão alugado/próprio, Operador logístico, Sem local definido, Local cedido) |
| Faturas sob titularidade da empresa | `selecao` | Internet / Energia / Internet e energia / Despesas inclusas no coworking / Despesas inclusas no comodato / À regularizar |
| Atuação da empresa | `selecao` | Varejo/e-commerce / Atacado/distribuidor / Indústria / Prestação de serviços |
| Tributos pagos no último semestre | `selecao` | Suficiente para Radar 150k / Suficiente para Radar Ilimitado |
| Valor acordado no contrato | `numero` | (nota: considerar valor com desconto já aplicado — regra de preenchimento, não de schema) |
| Forma de pagamento | `selecao` | (não especificado — confirmar catálogo) |
| Exportador | `selecao` | (não especificado — confirmar catálogo: Sim/Não? Ou outras opções?) |
| Nível de complexidade para a revisão | `selecao` | 4 níveis (Nível 1 a 4, com descrições longas — checar se `opcoesJson` comporta texto longo como label de opção ou se precisa de campo auxiliar de descrição) |
| Histórico de tentativas anteriores de revisão | `booleano` (Sim/Não) | — |
| Embasamento do processo | `selecao` | Disponibilidade financeira / Início ou retomada - Tributos semestrais / Receita Bruta (DAS) / Receita Bruta (CPRB) / Desoneração tributária |

**3 campos de `selecao` ficaram sem opções especificadas** ("Radar pretendido", "Forma de pagamento", "Exportador") — preciso do catálogo exato antes de cadastrar esses `BpmCampo` (campo `opcoesJson` exige a lista completa).

**Nota de reaproveitamento a confirmar:** "Radar pretendido" também apareceu como campo obrigatório da Coluna 1 ("Novos leads") — confirmar se é o MESMO campo (então só 1 `BpmCampo` compartilhado entre as 2 etapas, `etapaId: null` no schema já suporta campo em nível de pipeline) ou 2 campos independentes com o mesmo nome por coincidência.

---

## Coluna 4 — "Em Tratativa": desenho técnico por sub-feature

### Validação de entrada (Próximo Contato obrigatório para ENTRAR na etapa)

**Peça nova, diferente do que já existe.** Todo o mecanismo de obrigatoriedade construído até aqui (`MoverCardBpm`) valida campos obrigatórios da etapa de **destino** — isso já cobre exatamente este caso (`proximoContatoEm` como campo obrigatório configurado na etapa "Em Tratativa"), **desde que `proximoContatoEm` seja tratado como campo validável pelo mesmo mecanismo** — reforça a decisão em aberto da Coluna 1/2 sobre `BpmCard.proximoContatoEm` ser coluna nativa (precisa de validação hardcoded extra) vs `BpmCampo` (mecanismo genérico já funciona sem código novo). **Recomendação revista: dado que `proximoContatoEm` agora precisa ser validável como obrigatório em MÚLTIPLAS etapas (Em Tratativa exige no destino; Novos Leads/Agendar Reunião/Reunião Agendada usam para desligar a automação de 8 dias), vale a pena `MoverCardBpm` ganhar um segundo caminho de validação genérico para colunas nativas de `BpmCard` designadas como "obrigatórias por etapa" — não só via `BpmCampo`.** Isso é uma peça de arquitetura nova pequena, não gigante, mas needs decisão explícita antes da Fase C.

### Follow-up — checklist obrigatório que trava saída do card

**Confirmado pelo usuário: bloqueio real de UI.** Isto é a sub-feature mais nova tecnicamente de toda a especificação até agora — **não existe nenhum precedente de "tela que trava fechamento até completar formulário" em nenhum módulo do painel** (confirmado por grep, zero ocorrências de padrão de bloqueio de fechamento).

**Schema novo:**
```prisma
model BpmChecklistFollowUp {
  id           String   @id @default(cuid())
  cardId       String
  card         BpmCard  @relation(fields: [cardId], references: [id], onDelete: Cascade)
  perguntasJson String  // snapshot das perguntas do checklist NO MOMENTO do follow-up (perguntas podem mudar no catálogo depois, sem afetar registros passados)
  respostasJson String  // respostas dadas
  completo     Boolean  @default(false)
  criadoPorId  Int
  criadoEm     DateTime @default(now())

  usuario usuarios @relation(fields: [criadoPorId], references: [id])

  @@index([cardId])
}

model BpmChecklistFollowUpPergunta {
  id         String  @id @default(cuid())
  pipelineId String
  pergunta   String
  tipo       String  // "texto" | "selecao" | "booleano" — mesmo catálogo de BpmCampo
  opcoesJson String?
  obrigatoria Boolean @default(true)
  ordem      Int     @default(0)
  ativo      Boolean @default(true)

  pipeline BpmPipeline @relation(fields: [pipelineId], references: [id], onDelete: Cascade)
}
```

**Mecanismo de "trava":** o componente de detalhe do card (modal/painel — precisa de Scout dedicado para achar o componente exato, ex: `CardFullViewModal.tsx` já visto no levantamento anterior) precisa interceptar o fechamento (`onOpenChange` do Dialog, botão X, tecla Esc) e, se existir um follow-up "em andamento" não completo, bloquear ou pedir confirmação em vez de fechar direto. **Isto é uma mudança de comportamento de UI sem precedente no projeto — risco de UX real** (usuário pode se sentir "preso"). Sugestão de mitigação: sempre ter uma saída de emergência clara (ex: "Salvar como rascunho e sair" que marca `completo: false` mas permite fechar, versus um verdadeiro bloqueio sem saída) — **decisão de produto a confirmar antes de implementar**, já que "travar de verdade sem saída nenhuma" é uma escolha de UX incomum que vale confirmar que é isso mesmo que você quer, não só "avisar forte".

**Catálogo de perguntas do checklist não foi especificado** — a especificação diz "funciona através de um checklist de perguntas" mas não lista as perguntas. Preciso desse catálogo antes de qualquer implementação real (`BpmChecklistFollowUpPergunta` fica vazio sem ele).

### Campos (Valor acordado no contrato, Forma de pagamento)

**Mesmos campos já vistos na Coluna 3** — via `BpmCampo`, mesma observação sobre desconto já aplicado. Reforça a pergunta de reaproveitamento: são os MESMOS campos entre etapas (1 `BpmCampo` de nível pipeline, visível/editável em várias etapas) ou duplicados por etapa? Recomendação do Bibble: campo de nível pipeline (`etapaId: null`), reaproveitado — evita que o usuário preencha "Valor acordado" de novo em cada etapa.

### Regra de avanço restrita (Em Tratativa → Fechado, Lost, Standby, Monitoramento ou Sem viabilidade)

**Mesmo mecanismo `BpmEtapaTransicaoPermitida`** — 5 linhas novas de configuração. Nota: esta é a primeira etapa com **mais de 2 destinos permitidos** nas especificações até agora — confirma que o mecanismo de fallback (schema por linha, não por regra fixa de "no máximo 2") já suporta isso sem ajuste, só volume de configuração maior.

---

## Coluna 5 — "Fechado": desenho técnico por sub-feature

### Validação de entrada (Valor acordado + Forma de pagamento obrigatórios)

**Mesmo mecanismo já usado nas colunas anteriores** — os 2 campos (já cadastrados como `BpmCampo` de nível pipeline, se a recomendação de reaproveitamento das Colunas 3/4 for aceita) só precisam ganhar `obrigatorio: true` também na etapa "Fechado" — `BpmCampo.etapaId` hoje é por etapa única (`String?`), então "obrigatório em múltiplas etapas específicas" com o mesmo campo pipeline-level exige checagem um pouco diferente do que existe hoje (`MoverCardBpm` filtra `where: { etapaId: etapaDestinoId, obrigatorio: true }`, o que não pega campos com `etapaId: null` mesmo que "deveriam" ser obrigatórios ali). **Isto é um ajuste real necessário em `MoverCardBpm`, não é peça nova de schema** — decisão de design a confirmar: campo pipeline-level pode ser "obrigatório só em certas etapas" via uma tabela de junção nova, ou mantemos campo por-etapa duplicado nas 3 etapas que o pedem (Reunião Agendada, Em Tratativa, Fechado) mesmo que single-source-of-truth sofra um pouco? Recomendação do Bibble: tabela de junção pequena (`BpmCampoObrigatorioEtapa { campoId, etapaId }`) — resolve de forma limpa sem duplicar o campo.

### Status pós-fechamento (Select com 5 opções + preparação para integração financeira futura)

**Schema novo, pequeno:**
```prisma
model BpmCard {
  // ...existente
  statusPosFechamento String? // "AGUARDANDO_CONTRATO"|"CONTRATO_A_ENVIAR"|"CONTRATO_ENVIADO"|"PAGAMENTO_CONFIRMADO"|"CONTRATO_ASSINADO"
}
```
Coluna dedicada (não `BpmCampo`) — é o único campo desta especificação inteira com requisito explícito de "cor visual diferente por valor" e "aparência do card muda" (ver próxima sub-feature), o que pede um enum conhecido de antemão pelo componente de renderização do board, não um catálogo dinâmico de `BpmCampo`/`opcoesJson` genérico. **Nota importante registrada pelo próprio usuário: "Futuramente, o Status será integrado/conectado ao pipeline financeiro"** — isto é uma âncora para quando o módulo de Comissões (`CommissionEvent`) ou um pipeline financeiro dedicado do BPM precisar consumir este campo; não implementar a integração agora, só deixar a coluna pronta para ser lida por um adapter futuro (mesmo padrão já usado em `src/lib/commissions/adapters/`).

### Design do card no pipeline (badge colorido por status)

Componente do board (`PipelineBoardClient.tsx` / componente de card individual) precisa de um mapa `STATUS_POS_FECHAMENTO_CONFIG: Record<string, {label, corHex ou classe Tailwind}>` — mesmo padrão de "mapa de configuração visual por valor de enum" já usado em outros lugares do projeto (ex: `CONFIG_TEMAS` em `src/lib/temas.ts`). Badge só aparece quando `BpmCard.etapaId` = "Fechado" E `statusPosFechamento` preenchido.

---

## Coluna 6 — "Lost": desenho técnico por sub-feature

### Validação de entrada (Motivo de Lost obrigatório)

Mesmo mecanismo de campo obrigatório por etapa. **Catálogo de motivos não especificado** — o próprio usuário marcou como pendente ("Criar critérios padronizados... Pendente: definir a lista"). Fica registrado como bloqueante de implementação, não escolhido por mim.

---

## Coluna 7 — "Sem Viabilidade": desenho técnico por sub-feature

### Validação de entrada (Próximo Contato obrigatório)

Idêntica à validação de entrada já desenhada para "Em Tratativa" (Coluna 4) — mesmo campo `proximoContatoEm`, mesmo mecanismo de validação de entrada (não de campo-obrigatório-para-sair, e sim campo-obrigatório-para-entrar — reforça que `MoverCardBpm` precisa validar tanto campos obrigatórios quanto esta condição de entrada específica, possivelmente pelo mesmo caminho de código já que o padrão se repete 2x).

---

## Coluna 8 — "Standby - Follow Up": desenho técnico por sub-feature

**Marcada como pendência explícita pelo próprio usuário** — "A automação de follow-up será desenvolvida posteriormente [...] documentar detalhadamente [...] incluindo regras, canais, agendamento, interrupção e comportamento do NoLoss." Nenhum schema/código proposto aqui — só a intenção registrada:
- Cadência: 1 follow-up por semana (diferente da automação de 5×/dia das colunas anteriores — cadência mais espaçada).
- "NoLoss": continua indefinidamente, sem encerramento automático por tentativas esgotadas (diferente da automação de 8 dias que EMPURRA pra Standby — aqui, uma vez QUE JÁ ESTÁ em Standby, não sai sozinho por tempo).
- Interrupção manual: "lead solicitou não ser mais contatado" — precisa de um campo/flag (`BpmCard.contatoInterrompido Boolean?` ou similar) que pause a automação sem mover o card, quando essa automação for desenhada.
- **Não implementar nada agora** — só é mencionada aqui para não perder o contexto de que esta coluna eventualmente ganhará uma automação, e ela é estruturalmente diferente das automações de 8 dias já desenhadas (recorrente sem prazo final vs finita com prazo de 8 dias).

---

## Coluna 9 — "Monitoramento": desenho técnico por sub-feature

**Marcada como pendência explícita pelo próprio usuário** — "A etapa terá uma automação de monitoramento automático [...] será especificada posteriormente." **Zero detalhe técnico a registrar ainda** — nem schema, nem mecanismo. Fica só como lembrete de que esta etapa tem uma automação pendente de especificação, sem suposição de formato.

---

## Ordem de execução proposta (fases seriais, atualizada com as 9 colunas)

1. **Fase A — Schema completo** (Vault + DataEngineer): todas as migrations aditivas juntas — `BpmCard.primeiraVisualizacaoEm`, `BpmCard.proximoContatoEm`, `BpmCard.dataReuniao`/`googleEventId`/`googleMeetLink` (Coluna 2), `BpmCard.statusPosFechamento` (Coluna 5), `BpmCard.transcricaoReuniao` (Coluna 3, se caminho manual), `BpmEtapaTransicaoPermitida`, `BpmChecklistFollowUp`/`BpmChecklistFollowUpPergunta` (Coluna 4), `BpmCampoObrigatorioEtapa` (Coluna 5), e decisão sobre `BpmCardTentativaLigacao` vs reaproveitar `BpmInteracaoCard`. Todas 🟢, mas ainda passam por Vault com backup, por tocar produção.
2. **Fase B — Indicador de "nunca acessado" + Badge de canal + Badge de Status pós-fechamento** (Echo + Nova): as mais simples, sem dependência de scheduler, Google ou trava de UI.
3. **Fase C — Campos obrigatórios (todas as etapas) + Regra de avanço restrita (todas as etapas) + validação de entrada (Em Tratativa/Sem Viabilidade)** (Echo): configuração de `BpmCampo` em massa (12+ campos da Coluna 3, + os das Colunas 1/2/4/5/6) + implementação de `BpmEtapaTransicaoPermitida` em `MoverCardBpm` para as 8 etapas com regra + a lógica de "campo obrigatório para ENTRAR" (distinta de "obrigatório para mover", ver Coluna 4/7).
4. **Fase D — Integração Google Meet: criar + reagendar** (Echo): `AgendarReuniaoGoogleMeetBpm` + `ReagendarReuniaoBpm`, reaproveitando `criarEventoNoCalendario`/`atualizarEventoParcialNoCalendario`, botão no card/detalhe, tratamento do caso "responsável sem Agenda Alpha conectada". Testável isoladamente, sem depender do Cron.
5. **Fase E — Vercel Cron + Route Handler protegida** (Echo + DevOps para o `vercel.json`/env `CRON_SECRET`): infraestrutura do scheduler, testável isoladamente antes de plugar a lógica de negócio.
6. **Fase F — Automação de ligações (5/dia, só Coluna 1) + Automação de 8 dias (Colunas 1, 2, 3, 4)** (Echo): lógica de negócio dentro do job, usando a infra da Fase E, generalizada para varrer as 4 etapas com essa automação.
7. **Fase G — Checklist de follow-up com trava de UI (Coluna 4)** (Echo + Nova): a peça de maior risco de UX de todo o plano — feita por último, depois de validar o restante do fluxo, e só depois do catálogo de perguntas ser definido.
8. **Fase H (bloqueada, sem data) — Transcrição automática do Google Meet (Coluna 3)**: só começa depois de (1) usuário decidir entre integração automática vs campo manual, e (2) se automática, Super Admin do Workspace autorizar os escopos da Google Meet API.
9. **Fase I (bloqueada, sem data) — Automações de Standby (Coluna 8) e Monitoramento (Coluna 9)**: aguardando especificação detalhada do usuário, conforme ele mesmo marcou como pendência.

Cada fase passa por Forge → Probe → (Anubis se tocar auth/rota pública ou dado do Google/PII) → Sage, antes da próxima começar.

---

## DECISÕES PENDENTES — consolidado para resposta do usuário

Organizado por bloco temático (não por coluna) para facilitar responder de uma vez. Nenhuma delas bloqueia entender o pedido — todas bloqueiam começar a codar a peça correspondente.

### Bloco 1 — Automações recorrentes (Colunas 1, 2, 3, 4)
1. `BpmCardTentativaLigacao` (tabela nova) vs reaproveitar `BpmInteracaoCard` já existente para contar as 5 ligações/dia — recomendação: reaproveitar.
2. "Travar" o responsável nas 5 ligações/dia (Coluna 1) — só indicador visual de pendência, ou bloqueia alguma ação real (ex: não deixa mover o card sem completar as 5)?
3. Horário exato do cron diário (proposto 12h UTC = 9h Brasília, ajustável).
4. O que conta como "dia" na contagem de 8 dias — corridos (incluindo fim de semana) ou úteis?
5. Confirma que só a Coluna 1 tem a automação de ligações (5/dia) — Colunas 2, 3 e 4 têm só a automação de 8 dias (Próximo Contato)?

### Bloco 2 — Google Meet: criação e reagendamento (Coluna 2 e 3)
6. Data/Hora (Coluna 2) viram colunas dedicadas em `BpmCard` (recomendação do Bibble) ou `BpmCampo` como o resto?
7. A reunião é criada na agenda de quem clica o botão, ou do responsável do card?
8. Duração padrão do evento (não especificada) — 30min? 1h?
9. Participantes do evento: só o responsável, ou também um e-mail do lead/empresa (se existir)?

### Bloco 3 — Transcrição do Google Meet (Coluna 3) — o maior bloqueio técnico do plano inteiro
10. Integração automática via Google Meet REST API (exige autorizar escopo novo no Admin Console do Workspace + confirmar gravação/transcrição habilitada + mecanismo de busca pós-reunião) **ou** campo de texto livre preenchido manualmente por quem participou (disponível imediatamente, sem infra nova)? Você pediu para eu documentar em vez de decidir — está documentado na seção da Coluna 3 acima; preciso da sua escolha para prosseguir com qualquer implementação desta peça.
11. Se manual: `BpmCampo` tipo texto (mecanismo já existente) ou coluna dedicada `BpmCard.transcricaoReuniao` (texto potencialmente longo, `BpmCardCampoValor.valor` não tem tratamento especial de tamanho hoje)?

### Bloco 4 — Reaproveitamento de campos entre etapas (Colunas 3, 4, 5)
12. "Radar pretendido" aparece na Coluna 1 (Novos leads) e na Coluna 3 (Reunião Agendada) — é o MESMO campo (1 `BpmCampo` de nível pipeline) ou 2 campos independentes por coincidência de nome?
13. "Valor acordado no contrato" e "Forma de pagamento" aparecem nas Colunas 3, 4 e 5 — mesma pergunta: campo único reaproveitado entre etapas, ou duplicado por etapa?
14. Se reaproveitado: aceita a tabela de junção nova `BpmCampoObrigatorioEtapa` (permite "campo X é obrigatório nas etapas A, B e C, mas não em D") como solução, ou prefere outra abordagem?

### Bloco 5 — Catálogos de opções não especificados (Coluna 3)
15. "Radar pretendido" (Colunas 1 e 3) — lista de opções do Select.
16. "Forma de pagamento" — lista de opções do Select.
17. "Exportador" — lista de opções do Select (Sim/Não? outras?).

### Bloco 6 — Catálogo de motivos de Lost (Coluna 6)
18. Lista de "critérios padronizados" para o Motivo de Lost — você mesmo marcou como pendente, precisa ser definida antes desta coluna ser implementável.

### Bloco 7 — Checklist de follow-up (Coluna 4) — segunda maior peça de risco do plano
19. Catálogo de perguntas do checklist de follow-up — não especificado, bloqueia `BpmChecklistFollowUpPergunta`.
20. A trava de UI (confirmada como "bloqueio real") tem alguma saída de emergência (ex: "salvar como rascunho e sair" sem completar) ou é bloqueio absoluto sem exceção nenhuma?

### Bloco 8 — Status pós-fechamento (Coluna 5)
21. Cores específicas para cada um dos 5 status (Aguardando contrato / Contrato a enviar / Contrato enviado / Pagamento confirmado / Contrato assinado) — posso propor uma paleta seguindo os tokens de design já usados no projeto (`temas.ts`), ou você tem preferência de cores específica?

### Bloco 9 — Automações ainda não especificadas (Colunas 8 e 9)
22. Standby - Follow Up: você mesmo marcou como "documentar detalhadamente [...] posteriormente" — este plano só registrou a intenção (semanal, NoLoss, interrupção manual). Aguardando especificação completa quando você tiver pronta.
23. Monitoramento: idem, zero detalhe registrado, aguardando especificação.
