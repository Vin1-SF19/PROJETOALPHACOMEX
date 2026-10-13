# Story: Cor do texto nas notas

## Status

Ready for Review

## História

Como usuário do Alpha Notas, quero mudar a cor de um trecho selecionado pela barra do editor ou pelo menu do botão direito, para destacar frases na nota.

## Critérios de aceitação

- [x] A barra do editor oferece paleta de cores para aplicar ao texto selecionado.
- [x] O botão direito sobre texto selecionado abre a paleta no ponto do clique.
- [x] A cor padrão pode ser restaurada.
- [x] A opção “Personalizada” abre o seletor nativo para escolher qualquer cor.
- [x] A formatação persiste pelo conteúdo JSON já utilizado pelas notas, sem mudança no banco.
- [x] A função aparece na Central e nas notas abertas pela barra de tarefas pelo editor compartilhado.

## Tarefas

- [x] Adicionar seletor de cor na barra e no menu de contexto do editor.
- [x] Ajustar a camada do popover para ficar acima da nota flutuante da barra de tarefas.
- [x] Atualizar File List e registrar validação.

## File List

- `src/components/Notas/NoteEditor/NoteEditorPrimitives.tsx`
- `docs/stories/story-notas-cor-texto-editor.md`

## Validação

- ESLint direcionado em `NoteEditorPrimitives.tsx`: aprovado.
- `npm run typecheck`: aprovado.
- Testes não executados.
