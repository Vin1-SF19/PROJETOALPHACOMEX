# BIBBLE FLOWS — Tool Catalog e Fluxos do Assistente

> Mantido por: Cortex (AI engine) e Sync (UX da conversa)
> Define quais actions Bibble pode executar no painel.

---

## Tool Catalog

### buscar_cliente
- **Descrição:** Busca um cliente por nome, CPF ou ID
- **Parâmetros:** `query: string`
- **Output:** Lista de até 5 clientes (id, nome, cpf)
- **Ownership:** Filtra por `userId` obrigatoriamente

### abrir_relatorio
- **Descrição:** Navega para um relatório específico
- **Parâmetros:** `tipo: 'extratos' | 'comercial' | 'estoque'`, `periodo?: string`
- **Output:** `{ action: 'navigate', path: string }`

<!-- Adicionar novas tools aqui conforme o painel cresce -->

### Calendário Alpha (Google Calendar via Domain-Wide Delegation)
**Atualizado em:** 2026-07-23 por Scribe.

As definições públicas ficam em `src/lib/bibble/tools.ts`; `src/lib/bibble/tool-executor.ts` roteia a execução; e `src/lib/bibble/calendar-tools.ts` concentra schemas estritos, seleção de calendário, resolução de colega, allowlists, ownership e formatação segura das respostas. Todas exigem a permissão efetiva `calendarioAlpha`, recarregada do banco junto com role/status atuais a cada requisição.

1. **listar_calendarios_calendario** — lista calendários configurados do próprio usuário e indica visibilidade e capacidade de escrita.
2. **listar_eventos_calendario** — consulta eventos próprios por `data_inicio` + `data_fim` ou `dias_a_frente`; aceita `calendario_nome?` e devolve `google_event_id` + `etag` para operações posteriores.
3. **criar_evento_calendario** — cria compromisso/reunião própria; aceita título, período, all-day, descrição, local, participantes, Meet e nome do calendário.
4. **editar_evento_calendario** — aplica patch parcial em evento próprio usando `google_event_id` + `etag`; horário é um bloco atômico (`data_inicio`, `data_fim`, `dia_inteiro`).
5. **cancelar_evento_calendario** — cancela evento próprio somente com `google_event_id`, `etag` e `confirmado: true`, depois da confirmação explícita reconhecida pelo servidor.
6. **consultar_disponibilidade_calendario** — consulta FreeBusy em intervalo exato, sem expor título ou descrição dos compromissos.
7. **consultar_agenda_colega** — consulta agenda de colega por nome/e-mail. Usuário comum depende do compartilhamento já autorizado; Admin/CEO pode consultar qualquer colaborador ativo.
8. **criar_evento_calendario_colega** — Admin/CEO cria evento para colega resolvido por nome/e-mail.
9. **editar_evento_calendario_colega** — Admin/CEO aplica patch parcial com ETag na agenda do colega.
10. **cancelar_evento_calendario_colega** — Admin/CEO cancela evento de colega após a mesma confirmação em duas fases.

**Datas e limites:** horário exige ISO 8601 com offset; data civil usa `YYYY-MM-DD` em `America/Sao_Paulo`. Consultas têm janela máxima de 60 dias e resposta limitada a 200 eventos. O chat executa tools em sequência, com até 6 por turno, 12 por requisição e 3 mutações de calendário; mutação idêntica repetida na mesma requisição é bloqueada.

**Seleção e ambiguidades:** o nome do calendário é comparado somente com calendários pertencentes à conexão do usuário e compatíveis com a operação. Sem nome, a escrita prefere o primário; se ainda houver mais de uma opção válida, a tool devolve candidatos e o Bibble pergunta qual usar. Colega ambíguo também devolve candidatos, sem escolha silenciosa.

**Ownership:** nenhuma tool aceita `userId`, `colegaId`, `calendarId` ou e-mail de impersonation do modelo. O usuário vem de `ctx.userId`; o colega é resolvido no banco por texto; o calendário é resolvido por allowlist da conexão; e as Server Actions repetem as autorizações. Escrita de colega exige role Admin/CEO atual do banco.

**Concorrência e cancelamento:** edições são patches parciais com `If-Match` do ETag lido anteriormente; conflito exige nova leitura. Cancelamento exige duas condições: `confirmado: true` na tool e uma resposta afirmativa do usuário imediatamente após o Bibble pedir confirmação. Não há token persistente cross-request; essa proteção mais forte, rate limit cross-request e idempotência persistente permanecem dívidas conhecidas.

---

## Fluxos de Conversa

### Calendário Alpha
1. Bibble converte referências relativas usando a data/hora atual de `America/Sao_Paulo`.
2. Se título, data, horário, duração, calendário, colega, participante ou evento estiver ausente/ambíguo, pergunta antes de executar.
3. Para editar/cancelar, consulta primeiro e usa o `google_event_id` + `etag` retornados.
4. Para cancelar, pede confirmação explícita e só então executa com `confirmado: true`.
5. Tools múltiplas são executadas sequencialmente, preservando a ordem do pedido.

### Busca de cliente
1. Usuário menciona nome ou CPF
2. Bibble chama `buscar_cliente`
3. Apresenta resultados com cards clicáveis
4. Usuário seleciona → Bibble navega ou executa ação

### Abertura de relatório
1. Usuário pede "extrato de março"
2. Bibble interpreta período → chama `abrir_relatorio`
3. Frontend recebe `action: navigate` e executa

---

## Limites e Recusas

- Bibble NÃO acessa dados de outros usuários fora do compartilhamento autorizado; Admin/CEO é a exceção explícita para consulta e CRUD de agenda de colaborador ativo
- Bibble NÃO executa DELETE sem confirmação explícita
- Bibble NÃO revela dados sensíveis (senhas, tokens)
- Bibble NÃO responde sobre tópicos fora do painel sem avisar o escopo
