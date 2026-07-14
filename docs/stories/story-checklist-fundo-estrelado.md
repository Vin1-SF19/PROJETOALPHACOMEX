# Story: Fundo estrelado do Alpha CheckList

**ID:** STORY-CHECKLIST-003  
**Epic:** Alpha CheckList  
**Status:** In Progress  
**Prioridade:** Media  
**Data criacao:** 2026-07-14  

---

## Narrativa

**Como** usuario do Alpha CheckList,  
**quero** um fundo visual que acompanhe o tema ativo do painel,  
**para** ter uma interface mais refinada sem perder legibilidade dos dados e controles.

## Criterios de Aceitacao

- [x] O fundo do CheckList apresenta uma base escura e estrelas em camadas.
- [x] A grade anterior foi removida para dar destaque ao fundo estrelado.
- [x] As luzes ambiente usam a cor do tema de interface selecionado pelo usuario.
- [x] O fundo vale para todas as paginas dentro de `/PainelAlpha/CheckList` e nao intercepta cliques.
- [x] Animacoes sao reduzidas quando o navegador informa preferencia por menos movimento.
- [x] O fundo se desloca de forma sutil conforme o mouse se move em dispositivos com ponteiro fino.

## Arquivos Modificados

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/app/PainelAlpha/CheckList/ChecklistBackground.tsx` | modificado | Fundo estrelado em tres camadas, brilho do tema e contraste para conteudo. |

## Verificacao

- [x] `npm run lint` concluido com sucesso.
- [x] `git diff --check` concluido sem erros de espaco.
- [ ] `npm run typecheck` nao existe neste repositorio.
- [ ] `npm test` nao existe neste repositorio.
- [ ] `npx tsc --noEmit` bloqueado por erros preexistentes em ExclusaoFiscal, HabilitacaoRadar e ModalPerfilColaborador.
