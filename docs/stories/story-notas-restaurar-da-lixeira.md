# Story — Restaurar nota da lixeira

**Status:** InReview
**Módulo:** Bloco de notas ALpha  
**Origem:** solicitação direta do usuário em 2026-08-24

## História

Como usuário do Bloco de notas ALpha, quero restaurar uma nota que movi para a lixeira, para recuperar seu conteúdo sem precisar recriá-lo.

## Critérios de aceite

- [ ] AC1 — Cada card exibido na seção Lixeira oferece um botão visível e acessível para restaurar aquela nota.
- [ ] AC2 — O botão restaura somente a nota do card acionado e fica bloqueado enquanto a operação está em andamento.
- [ ] AC3 — Após a restauração, a nota sai da listagem da Lixeira, a Central recarrega os dados e informa sucesso ou erro ao usuário.
- [ ] AC4 — A restauração continua protegida por autenticação e autorização no servidor.
- [ ] AC5 — Seleção e exclusão permanente existentes continuam funcionando sem alteração.

## Tarefas

- [x] Mapear a ação existente, as permissões, o hook e os componentes da Lixeira.
- [x] Conectar a ação `RestaurarNota` ao hook client-side da Lixeira.
- [x] Adicionar ação individual de restauração aos cards sem criar botões aninhados.
- [x] Atualizar o wiring da Central e cobrir a integração com teste automatizado.
- [x] Executar typecheck, lint, testes e build; registrar falhas preexistentes separadamente.
- [x] Atualizar checklist, status e File List.

## Blueprint de integração (Scout)

### Criar

- [x] `docs/stories/story-notas-restaurar-da-lixeira.md` — requisitos, rastreabilidade e resultado dos gates.

### Editar

- [ ] `src/components/Notas/Central/useLixeiraNotas.ts` — fluxo individual, feedback e recarga após restauração.
- [ ] `src/components/Notas/Central/ListaNotas.tsx` — botão acessível em cada card da Lixeira.
- [ ] `src/components/Notas/Central/CentralDeNotas.tsx` — ligação entre lista e hook.
- [ ] `tests/notas/acesso-e-lixeira.test.ts` — cobertura do wiring da restauração.

### Consultar

- [x] `src/actions/Notas.ts` — action `RestaurarNota` já existente.
- [x] `src/lib/notas/permissoes.ts` — autorização `podeRestaurarNota` já existente.
- [x] `src/components/Notas/Central/BarraAcoesLixeira.tsx` — seleção e exclusão permanente preservadas.

## Notas técnicas

- A action existente atualiza a nota para `ATIVA`, limpa `archivedAt` e `deletedAt` e registra `updatedById`.
- A permissão é validada no servidor antes da atualização; a UI não é usada como barreira de segurança.
- A restauração será individual, conforme o pedido, sem schema, migration, backfill ou mutação em massa.
- Os documentos de arquitetura configurados em `.aiox-core/core-config.yaml` não existem neste checkout; o contexto foi derivado da story anterior do módulo e do código vigente.
- A sincronização da Central reutiliza `notificarWorkspaceNotasAtualizado`, padrão já adotado pelo módulo.

## Quality Gates

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Verificação de acessibilidade: sem elementos interativos aninhados, foco visível e rótulo claro.

## CodeRabbit Integration

- **Tipo primário:** Frontend
- **Tipo secundário:** API existente
- **Complexidade:** Baixa
- **Foco:** acessibilidade do card, preservação da autorização server-side e regressão da exclusão existente.
- [ ] Pre-Commit: `coderabbit --prompt-only -t uncommitted` quando disponível.

## File List

- `docs/stories/story-notas-restaurar-da-lixeira.md`
- `src/components/Notas/Central/CentralDeNotas.tsx`
- `src/components/Notas/Central/ListaNotas.tsx`
- `src/components/Notas/Central/useLixeiraNotas.ts`
- `tests/notas/acesso-e-lixeira.test.ts`

## Resultado dos gates

- Pendente.

## Change Log

| Data | Versão | Alteração | Agente |
|---|---:|---|---|
| 2026-08-24 | 0.1.0 | Desenvolvimento iniciado — Status: Ready → InProgress | @dev |
| 2026-08-24 | 0.2.0 | Restauração individual implementada e validada — Status: InProgress → InReview | @dev |

## Dev Agent Record

### Agent Model Used

- Codex (GPT-5)

### Debug Log References

- `npx tsc --noEmit`: sem erro nos arquivos desta story; permanecem erros preexistentes em `ExclusaoFiscal`, `HabilitacaoRadarClient` e `tests/google-calendar/sync-queue.test.ts`.
- ESLint direcionado aos quatro arquivos alterados: aprovado sem erros ou avisos.
- `npm run lint`: varredura global interrompida após aproximadamente quatro minutos sem saída ou conclusão.
- Teste direcionado de Notas: 8/8 passando.
- `npm test`: 1.710/1.718 passando; oito falhas fora do módulo de Notas em Alpha SEO, Apresentações, Bibble, BPM e Google Calendar.
- `npm run build`: aprovado; rota `/PainelAlpha/Notas` incluída no build de produção.
- CodeRabbit: indisponível porque não há distribuição WSL instalada neste ambiente.

### Completion Notes List

- O botão `Restaurar` aparece individualmente em cada card da Lixeira e possui rótulo acessível, foco visível, loading e bloqueio durante processamento.
- O card foi estruturado com controles irmãos para evitar elementos `button` aninhados.
- O hook reutiliza a action server-side existente, exibe feedback, volta à primeira página e sincroniza a Central após sucesso.
- Nenhuma dependência, configuração, rota, schema ou migration foi adicionada.
- DoD aplicável concluído; pendências globais registradas são preexistentes e não pertencem a esta story.
