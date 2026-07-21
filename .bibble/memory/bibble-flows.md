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
Definidas em `src/lib/bibble/tools.ts`, executadas em `src/lib/bibble/tool-executor.ts`. Todas exigem `temPermissao(ctx, "calendarioAlpha")`.

- **listar_eventos_calendario** — `dias_a_frente?: number` (padrão 7, máx 60). Lista eventos dos calendários visíveis do próprio usuário. Delega para `listarCalendariosSelecionados`/`listarEventosDoCalendario` (`src/actions/google-calendar-eventos.ts`).
- **criar_evento_calendario** — `titulo, data_inicio, data_fim?, dia_inteiro?, descricao?, local?, participantes?, criar_meet?`. Usa sempre o primeiro calendário gravável do usuário (resolvido via `db.googleCalendarSelecionado.findFirst({conexao:{userId}, gravavel:true})`); delega para `criarEventoNoCalendario`.
- **cancelar_evento_calendario** — `google_event_id: string`. Resolve o calendário do evento via cache scoped por `userId` (`GoogleCalendarEventoCache.calendario.conexao.userId`) antes de chamar `cancelarEventoNoCalendario` — não aceita `calendarId` do modelo.
- **consultar_disponibilidade_calendario** — `data_inicio, data_fim`. Delega para `consultarDisponibilidade` (FreeBusy, não revela título do evento).
- **consultar_agenda_colega** — `nome_ou_email: string`, `dias_a_frente?`. Resolve o colega por nome/e-mail no banco (nunca recebe `colegaId` bruto do modelo — IDOR estruturalmente impossível pelo parâmetro da tool) e delega para `listarEventosDeColega` (`src/actions/google-calendar-colegas.ts`), que já valida server-side se o colega está na lista de compartilhamento do usuário OU se o usuário é Admin/CEO (Admin enxerga qualquer colaborador).

**Ownership:** nenhuma dessas tools aceita `userId` do modelo — vem sempre de `ctx.userId` (injetado pela sessão autenticada) ou é revalidado dentro da própria Server Action via `auth()`.

---

## Fluxos de Conversa

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

- Bibble NÃO acessa dados de outros usuários
- Bibble NÃO executa DELETE sem confirmação explícita
- Bibble NÃO revela dados sensíveis (senhas, tokens)
- Bibble NÃO responde sobre tópicos fora do painel sem avisar o escopo
