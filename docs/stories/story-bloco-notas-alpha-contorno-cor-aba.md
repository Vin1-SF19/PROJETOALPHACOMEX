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
5. Rota, permissão, atalho, comportamento da barra global e persistência de cor permanecem inalterados.

## Blueprint de Integração

### Criar

- [x] Nenhum arquivo de aplicação novo.

### Editar

- [x] `src/components/Notas/Central/ListaNotas.tsx` — aplicar `nota.color` ao contorno somente quando houver cor definida.
- [x] `src/components/Notas/Central/CentralDeNotas.tsx` — atualizar o título visível do módulo.
- [x] `src/components/Notas/NotesGlobalTaskbar.tsx` — atualizar os textos visíveis que citam o nome antigo.
- [x] `src/lib/modulos-registry.ts` — atualizar o rótulo consumido por menu, abas e catálogo de módulos.

### Consultar

- [x] `src/components/Notas/NoteColorPicker.tsx` — fonte das cores hexadecimais disponíveis.
- [x] `src/components/Notas/NoteTab.tsx` — precedente visual da cor aplicada à aba.
- [x] `src/actions/NotasBusca.ts` — confirma que `color` já faz parte do contrato da listagem.

### Pontos de integração verificados

- [x] Menu/nav: `src/lib/modulos-registry.ts`.
- [x] Atalhos: `src/hooks/useNotasAtalhos.ts`; nenhuma alteração necessária.
- [x] Permissões: chave `notas` preservada; nenhuma alteração necessária.
- [x] Rota: `/PainelAlpha/Notas` preservada; nenhuma alteração necessária.

## Tarefas

- [x] Aplicar o contorno baseado na cor da aba sem mudar cards sem cor.
- [x] Renomear os textos visíveis do módulo.
- [x] Executar lint, typecheck e testes do projeto.
- [x] Atualizar checklist, notas de conclusão e File List.

## Notas técnicas

- `BuscarNotas` já seleciona `Note.color`; não é necessário alterar Server Actions ou banco.
- `ListaNotas` já recebe `nota.color` e mostra uma faixa lateral; o contorno pode reutilizar o mesmo valor sem criar estado adicional.
- O estilo inline deve existir apenas quando `nota.color` for verdadeiro, preservando integralmente o fallback visual atual.
- A renomeação é visual; IDs, permissões, caminhos e nomes de componentes continuam estáveis.

## CodeRabbit Integration

- Tipo primário: Frontend
- Complexidade: baixa
- Foco: regressão visual dos estados com/sem cor e consistência dos rótulos.
- Self-healing: @dev light, até 2 iterações para achados CRITICAL.

## Change Log

- 2026-08-11: Story criada a partir da solicitação direta do usuário e do reconhecimento do módulo existente.

## Dev Agent Record

### Completion Notes

- Cards com cor definida agora aplicam `nota.color` ao contorno inteiro.
- O card selecionado mantém fundo e sombra de seleção, mas preserva no contorno a cor escolhida pelo usuário.
- Cards sem cor continuam usando exatamente os estilos anteriores, tanto selecionados quanto não selecionados.
- Cabeçalho, registro do módulo, tooltip da barra global e mensagem visível de duplicação usam “Bloco de notas ALpha”.
- Nenhum componente, rota, permissão, atalho, Server Action ou estrutura de banco foi criado ou alterado.

### Validações

- ESLint direcionado aos quatro arquivos de aplicação alterados: aprovado sem erros ou avisos.
- `npm run lint`: não concluiu em 180 segundos e não emitiu diagnósticos antes do timeout.
- `npm run typecheck`: nenhum erro nos arquivos desta story; permaneceu bloqueado por 5 diagnósticos preexistentes em `ExclusaoFiscal`, `HabilitacaoRadarClient` e testes do Google Calendar.
- `npm test`: 1.075/1.076 testes passaram; o teste preexistente `tests/google-calendar/cli.test.ts` excedeu 5 segundos, inclusive quando repetido isoladamente.
- `npm run build`: bloqueado antes da compilação pelo `EPERM` conhecido do Prisma ao substituir `query_engine-windows.dll.node`, mantido aberto por outro processo Node.
- `npx next build`: aprovado; compilação de produção concluída e rota `/PainelAlpha/Notas` gerada.

### File List

- `docs/stories/story-bloco-notas-alpha-contorno-cor-aba.md`
- `src/components/Notas/Central/CentralDeNotas.tsx`
- `src/components/Notas/Central/ListaNotas.tsx`
- `src/components/Notas/NotesGlobalTaskbar.tsx`
- `src/lib/modulos-registry.ts`
