# Story: Contorno dos cards e renomeação do módulo de notas

## Status

Ready for Review

## Story

**Como** usuário do módulo de notas,
**quero** reconhecer nos cards a cor escolhida para cada aba e ver o novo nome do módulo,
**para** identificar minhas notas visualmente com mais rapidez.

## Tipo e complexidade

- Tipo: Frontend
- Complexidade: Baixa
- Banco de dados: nenhuma alteração estrutural, migration ou mutação de dados

## Critérios de aceitação

1. Cada card da listagem de notas usa a cor definida em “Cor da aba” como cor de seu contorno.
2. Se a nota não tiver cor definida, o contorno e os estados visuais existentes permanecem inalterados.
3. O estado selecionado continua perceptível e não substitui o contorno configurado quando a nota tem cor.
4. Os textos visíveis que identificam o módulo passam de “Central de Notas” para “Bloco de notas ALpha”.
5. Rota, permissão e persistência de cor permanecem inalteradas.
6. O botão “Central” da barra de notas abre ou ativa o Bloco de notas ALpha no mesmo gerenciador de abas/iframes usado pela sidebar, sem navegar o shell externo com `router.push`.
7. O atalho `Ctrl+Alt+N` usa o mesmo fluxo funcional do botão “Central”.
8. O botão com seta no final da barra de notas é removido; a abertura e o fechamento da barra continuam controlados pelo lançador da sidebar.

## Blueprint de Integração

### Criar

- [x] Nenhum arquivo de aplicação novo.

### Editar

- [x] `src/components/Notas/Central/ListaNotas.tsx` — aplicar `nota.color` ao contorno somente quando houver cor definida.
- [x] `src/components/Notas/Central/CentralDeNotas.tsx` — atualizar o título visível do módulo.
- [x] `src/components/Notas/NotesGlobalTaskbar.tsx` — atualizar os textos visíveis que citam o nome antigo.
- [x] `src/lib/modulos-registry.ts` — atualizar o rótulo consumido por menu, abas e catálogo de módulos.
- [x] `src/components/Notas/NotesGlobalTaskbar.tsx` — usar callback do shell para abrir a Central e remover o controle final com seta.
- [x] `src/components/layout/PainelLayoutClient.tsx` — fornecer à barra o mesmo `openTab` utilizado pela sidebar.

### Consultar

- [x] `src/components/Notas/NoteColorPicker.tsx` — fonte das cores hexadecimais disponíveis.
- [x] `src/components/Notas/NoteTab.tsx` — precedente visual da cor aplicada à aba.
- [x] `src/actions/NotasBusca.ts` — confirma que `color` já faz parte do contrato da listagem.
- [x] `src/components/layout/GlobalSidebar.tsx` — precedente do fluxo `onOpenTab(mod.href, mod.label)`.
- [x] `src/components/layout/PainelLayoutClient.tsx` — proprietário do estado das abas e dos iframes.

### Pontos de integração verificados

- [x] Menu/nav: `src/lib/modulos-registry.ts`.
- [x] Atalhos: `src/hooks/useNotasAtalhos.ts`; nenhuma alteração necessária.
- [x] Permissões: chave `notas` preservada; nenhuma alteração necessária.
- [x] Rota: `/PainelAlpha/Notas` preservada; nenhuma alteração necessária.
- [x] Gerenciador de abas/iframes: `openTab` em `PainelLayoutClient.tsx`, compartilhado com a sidebar.

## Tarefas

- [x] Aplicar o contorno baseado na cor da aba sem mudar cards sem cor.
- [x] Renomear os textos visíveis do módulo.
- [x] Executar lint, typecheck e testes do projeto.
- [x] Atualizar checklist, notas de conclusão e File List.
- [x] Fazer o botão “Central” e o atalho abrirem o módulo pelo gerenciador de abas do painel.
- [x] Remover o botão final com seta da barra de notas.
- [x] Reexecutar os gates proporcionais e atualizar esta story.

## Notas técnicas

- `BuscarNotas` já seleciona `Note.color`; não é necessário alterar Server Actions ou banco.
- `ListaNotas` já recebe `nota.color` e mostra uma faixa lateral; o contorno pode reutilizar o mesmo valor sem criar estado adicional.
- O estilo inline deve existir apenas quando `nota.color` for verdadeiro, preservando integralmente o fallback visual atual.
- A renomeação é visual; IDs, permissões, caminhos e nomes de componentes continuam estáveis.
- A sidebar não navega o shell: ela chama `openTab` em `PainelLayoutClient`, que cria ou ativa a aba correspondente e mantém um iframe por módulo.
- `NotesGlobalTaskbar` vive no mesmo shell externo e deve receber esse callback diretamente; `router.push` não representa o contrato de navegação do painel com abas.

## CodeRabbit Integration

- Tipo primário: Frontend
- Complexidade: baixa
- Foco: regressão visual dos estados com/sem cor e consistência dos rótulos.
- Self-healing: @dev light, até 2 iterações para achados CRITICAL.

## Change Log

- 2026-08-11: Story criada a partir da solicitação direta do usuário e do reconhecimento do módulo existente.
- 2026-08-11: Escopo ampliado pelo usuário para corrigir a navegação do botão Central no shell com iframes e remover a seta final da barra.

## Dev Agent Record

### Completion Notes

- Cards com cor definida agora aplicam `nota.color` ao contorno inteiro.
- O card selecionado mantém fundo e sombra de seleção, mas preserva no contorno a cor escolhida pelo usuário.
- Cards sem cor continuam usando exatamente os estilos anteriores, tanto selecionados quanto não selecionados.
- Cabeçalho, registro do módulo, tooltip da barra global e mensagem visível de duplicação usam “Bloco de notas ALpha”.
- Nenhum componente novo, rota, permissão, combinação de teclas, Server Action ou estrutura de banco foi criado ou alterado.
- O botão “Central” e o atalho `Ctrl+Alt+N` deixaram de usar `router.push` e agora chamam o mesmo `openTab` da sidebar, criando ou ativando o iframe correto no shell.
- O botão final com setas `ChevronUp`/`ChevronDown` foi removido integralmente da barra, inclusive seus imports e tooltip.
- Nenhum componente novo foi criado; o contrato foi conectado por uma prop tipada `onOpenCentral`.

### Validações

- ESLint direcionado aos quatro arquivos de aplicação alterados: aprovado sem erros ou avisos.
- `npm run lint`: não concluiu em 180 segundos e não emitiu diagnósticos antes do timeout.
- `npm run typecheck`: nenhum erro nos arquivos desta story; permaneceu bloqueado por 5 diagnósticos preexistentes em `ExclusaoFiscal`, `HabilitacaoRadarClient` e testes do Google Calendar.
- `npm test`: 1.075/1.076 testes passaram; o teste preexistente `tests/google-calendar/cli.test.ts` excedeu 5 segundos, inclusive quando repetido isoladamente.
- `npm run build`: bloqueado antes da compilação pelo `EPERM` conhecido do Prisma ao substituir `query_engine-windows.dll.node`, mantido aberto por outro processo Node.
- `npx next build`: aprovado; compilação de produção concluída e rota `/PainelAlpha/Notas` gerada.
- Nova rodada: ESLint direcionado de `NotesGlobalTaskbar.tsx` e `PainelLayoutClient.tsx` aprovado sem erros ou avisos; lint global novamente excedeu 180 segundos sem diagnóstico.
- Nova rodada: typecheck preservou exatamente os 5 erros preexistentes fora desta story; nenhum erro nos arquivos alterados.
- Nova rodada: 1.075/1.076 testes passaram; apenas o mesmo timeout preexistente de `tests/google-calendar/cli.test.ts` permaneceu.
- Nova rodada: `npm run build` foi bloqueado pelo `EPERM` conhecido do Prisma; `npx next build` compilou com sucesso em 109 segundos e gerou `/PainelAlpha/Notas`.
- Runtime no navegador local: a página respondeu, mas a sessão disponível redirecionou para o login; nenhuma credencial foi inserida e o clique autenticado não pôde ser exercitado nessa sessão.
- CodeRabbit não executado porque o WSL não está instalado nesta máquina; nenhuma revisão remota ou instalação foi iniciada.

### File List

- `docs/stories/story-bloco-notas-alpha-contorno-cor-aba.md`
- `.bibble/memory/codebase-map.md`
- `.bibble/memory/integration-points.md`
- `src/components/Notas/Central/CentralDeNotas.tsx`
- `src/components/Notas/Central/ListaNotas.tsx`
- `src/components/Notas/NotesGlobalTaskbar.tsx`
- `src/components/layout/PainelLayoutClient.tsx`
- `src/hooks/useNotasAtalhos.ts`
- `src/lib/modulos-registry.ts`
