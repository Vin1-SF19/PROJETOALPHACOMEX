# Story — Restaurar nota da lixeira

**Status:** In Progress  
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
- [ ] Conectar a ação `RestaurarNota` ao hook client-side da Lixeira.
- [ ] Adicionar ação individual de restauração aos cards sem criar botões aninhados.
- [ ] Atualizar o wiring da Central e cobrir a integração com teste automatizado.
- [ ] Executar typecheck, lint, testes e build; registrar falhas preexistentes separadamente.
- [ ] Atualizar checklist, status e File List.

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

## Resultado dos gates

- Pendente.
