# Story â€” Notas isoladas, lixeira em lote e sincronizaÃ§Ã£o da Central

**Status:** Ready for Review  
**MÃ³dulo:** Bloco de notas ALpha  
**Origem:** solicitaÃ§Ã£o direta do usuÃ¡rio em 2026-08-11

## HistÃ³ria

Como usuÃ¡rio do Painel Alpha, quero ver apenas as minhas notas e as que foram compartilhadas comigo, ter minhas notas fixadas disponÃ­veis na barra global, administrar a lixeira em lote e acompanhar a ediÃ§Ã£o refletida nos cards, para trabalhar com privacidade e continuidade entre a Central e a barra de tarefas.

## CritÃ©rios de aceite

- [x] AC1 â€” UsuÃ¡rios comuns e administrativos visualizam somente notas prÃ³prias ou compartilhadas explicitamente com seu usuÃ¡rio/setor/role pelo sistema de compartilhamento.
- [x] AC2 â€” O perfil Admin nÃ£o concede acesso implÃ­cito a notas de terceiros; acesso de mÃ³dulo e acesso ao conteÃºdo da nota permanecem conceitos separados.
- [x] AC3 â€” Todas as consultas e aÃ§Ãµes por `noteId` aplicam autorizaÃ§Ã£o no servidor, sem depender apenas da UI.
- [x] AC4 â€” Fixar uma nota na Central cria/sincroniza imediatamente a aba fixada na barra global; desafixar mantÃ©m a aba aberta, mas fechÃ¡vel.
- [x] AC5 â€” Na seÃ§Ã£o Lixeira existe modo de seleÃ§Ã£o visual dos cards, com exclusÃ£o permanente apenas dos itens selecionados e pertencentes ao usuÃ¡rio autenticado.
- [x] AC6 â€” Na seÃ§Ã£o Lixeira existe â€œEsvaziar lixeiraâ€, com confirmaÃ§Ã£o explÃ­cita e exclusÃ£o permanente somente das notas do usuÃ¡rio autenticado que estejam na lixeira.
- [x] AC7 â€” ExclusÃµes permanentes em lote validam o input com Zod e usam filtros restritivos por `ownerId`, `status = LIXEIRA` e, quando aplicÃ¡vel, IDs selecionados.
- [x] AC8 â€” AlteraÃ§Ãµes de tÃ­tulo e conteÃºdo no editor da Central atualizam imediatamente a prÃ©via do card correspondente, sem aguardar uma nova busca.
- [x] AC9 â€” O fluxo oferece feedback de sucesso/erro, confirma aÃ§Ãµes irreversÃ­veis e preserva estados de loading/vazio.
- [x] AC10 â€” Testes cobrem filtro de visibilidade, tentativa de exclusÃ£o de nota alheia, seleÃ§Ã£o vazia/invÃ¡lida e sincronizaÃ§Ã£o local relevante.

## Tarefas

- [x] Mapear os pontos de autorizaÃ§Ã£o, busca, workspace, editor e lixeira.
- [x] Remover bypass administrativo do acesso a notas especÃ­ficas.
- [x] Centralizar o filtro Prisma de notas prÃ³prias/compartilhadas e reutilizÃ¡-lo nas listagens.
- [x] Implementar aÃ§Ãµes seguras para excluir selecionadas e esvaziar a lixeira.
- [x] Conectar fixaÃ§Ã£o da Central ao store da barra global.
- [x] Implementar modo de seleÃ§Ã£o e confirmaÃ§Ãµes na Lixeira.
- [x] Expor callback de prÃ©via em tempo real no editor e atualizar os cards localmente.
- [x] Adicionar testes de autorizaÃ§Ã£o, validaÃ§Ã£o e helpers puros.
- [x] Executar typecheck, lint, testes e build; separar falhas preexistentes.
- [x] Atualizar documentaÃ§Ã£o e File List.

## Blueprint de integraÃ§Ã£o (Scout)

### Criar

- [x] `src/lib/notas/acesso.ts` â€” filtro Prisma reutilizÃ¡vel de propriedade/compartilhamento.
- [x] `src/lib/notas/preview.ts` â€” atualizaÃ§Ã£o pura da prÃ©via do card, testÃ¡vel.
- [x] `tests/notas/acesso-e-lixeira.test.ts` â€” regras de visibilidade, validaÃ§Ã£o e preview.

### Editar

- [x] `src/lib/notas/permissoes.ts` â€” retirar bypass administrativo de nota especÃ­fica e exigir propriedade para exclusÃ£o definitiva.
- [x] `src/lib/validations/notas.ts` â€” schema Zod para exclusÃ£o selecionada.
- [x] `src/actions/Notas.ts` â€” listagem isolada e exclusÃµes permanentes restritivas.
- [x] `src/actions/NotasBusca.ts` â€” busca isolada e persistÃªncia de fixaÃ§Ã£o.
- [x] `src/actions/NotasWorkspace.ts` â€” impedir workspace de reter notas cujo acesso foi revogado.
- [x] `src/components/Notas/Central/CentralDeNotas.tsx` â€” estado da lixeira, sincronizaÃ§Ã£o da barra e preview do editor.
- [x] `src/components/Notas/Central/CentralNotasHeader.tsx` â€” cabeÃ§alho acessÃ­vel extraÃ­do da Central.
- [x] `src/components/Notas/Central/ListaNotas.tsx` â€” seleÃ§Ã£o acessÃ­vel dos cards e aÃ§Ãµes da lixeira.
- [x] `src/components/Notas/Central/BarraAcoesLixeira.tsx` â€” confirmaÃ§Ãµes e comandos visuais da lixeira.
- [x] `src/components/Notas/Central/useLixeiraNotas.ts` â€” estado e fluxo client-side das exclusÃµes permanentes.
- [x] `src/components/Notas/Central/PainelPropriedades.tsx` â€” sincronizaÃ§Ã£o imediata ao fixar/desafixar.
- [x] `src/components/Notas/NoteEditor/NoteEditor.tsx` â€” callback opcional de preview em tempo real.
- [x] `src/store/useNotasWorkspace.ts` â€” remoÃ§Ã£o segura de aba invÃ¡lida mesmo quando estava fixada.
- [x] `src/lib/notas-workspace-messages.ts` â€” ponte tipada e same-origin entre iframe e shell.
- [x] `src/components/Notas/NotesGlobalTaskbar.tsx` â€” recarregar workspace apÃ³s mensagem da Central.
- [x] `.bibble/memory/codebase-map.md` e `.bibble/memory/integration-points.md` â€” documentaÃ§Ã£o da integraÃ§Ã£o.

### Consultar

- `prisma/schema.prisma` â€” relaÃ§Ãµes e cascatas jÃ¡ existentes; nenhuma mudanÃ§a de schema.
- `src/components/ui/alert-dialog.tsx` â€” confirmaÃ§Ã£o reutilizada.
- `src/store/useNotasWorkspace.ts` â€” store existente da barra global.

## Riscos e controles

- ExclusÃ£o permanente Ã© irreversÃ­vel: confirmaÃ§Ã£o obrigatÃ³ria e filtro restritivo no servidor.
- Notas compartilhadas nÃ£o podem ser apagadas permanentemente por quem nÃ£o Ã© o dono.
- Nenhuma migration, backfill ou comando de mutaÃ§Ã£o serÃ¡ executado nesta story.
- A atualizaÃ§Ã£o visual do card Ã© otimista; o autosave existente continua sendo a fonte de persistÃªncia e exibe seu prÃ³prio estado de erro/conflito.

## Quality Gates

- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm test`
- [x] `npm run build`
- [x] Auditoria Anubis: auth, IDOR, filtros de exclusÃ£o e Zod.
- [x] VerificaÃ§Ã£o Probe: Central â†” barra â†” editor â†” lixeira.

## File List

- `docs/stories/story-notas-isolamento-lixeira-sincronizacao.md`
- `.bibble/memory/architecture.md`
- `.bibble/memory/codebase-map.md`
- `.bibble/memory/integration-points.md`
- `src/actions/Notas.ts`
- `src/actions/NotasBusca.ts`
- `src/actions/NotasColaboracao.ts`
- `src/actions/NotasWorkspace.ts`
- `src/components/Notas/Central/BarraAcoesLixeira.tsx`
- `src/components/Notas/Central/CentralDeNotas.tsx`
- `src/components/Notas/Central/CentralNotasHeader.tsx`
- `src/components/Notas/Central/ListaNotas.tsx`
- `src/components/Notas/Central/PainelPropriedades.tsx`
- `src/components/Notas/Central/useLixeiraNotas.ts`
- `src/components/Notas/NoteEditor/NoteEditor.tsx`
- `src/components/Notas/NotesGlobalTaskbar.tsx`
- `src/lib/notas/acesso.ts`
- `src/lib/notas/permissoes.ts`
- `src/lib/notas/preview.ts`
- `src/lib/notas-workspace-messages.ts`
- `src/lib/validations/notas.ts`
- `src/store/useNotasWorkspace.ts`
- `tests/notas/acesso-e-lixeira.test.ts`

## Resultado dos gates

- Testes novos: 7/7 passando.
- Suite completa: 1082/1083 passando; única falha preexistente em `tests/google-calendar/cli.test.ts` por timeout de 5 segundos.
- ESLint direcionado: todos os arquivos alterados passaram. O comando global alcança árvores auxiliares `.agents`, `.aiox-core` e `.claude/worktrees` e falha em milhares de ocorrências preexistentes de CommonJS/unused vars.
- Typecheck: nenhuma falha nova; permanecem 5 erros preexistentes em validadores da rota `ExclusaoFiscal`, `HabilitacaoRadarClient.tsx` e `tests/google-calendar/sync-queue.test.ts`.
- Build: `npm run build` bloqueado pelo `EPERM` conhecido no DLL do Prisma; `npx next build` compilou e gerou `/PainelAlpha/Notas` com sucesso.
- Anubis: aprovado sem crítico — ownership no servidor, Zod, filtros restritivos e mensagem same-origin verificados.
- Probe: aprovado por build/testes e inspeção do wiring Central → Server Action → postMessage → barra; teste visual autenticado não executado por ausência de credenciais nesta sessão.

