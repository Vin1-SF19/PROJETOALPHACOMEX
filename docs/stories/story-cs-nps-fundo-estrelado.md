# Story: Fundo estrelado do CS & NPS

**ID:** STORY-CSNPS-002  
**Epic:** CS & NPS  
**Status:** Ready for Review  
**Prioridade:** Media  
**Data criacao:** 2026-07-15  

---

## Narrativa

**Como** usuario do modulo CS & NPS,  
**quero** um fundo visual inspirado no Alpha CheckList,  
**para** manter consistencia entre os modulos sem deixar as telas identicas.

## Criterios de Aceitacao

- [x] O modulo CS & NPS usa um fundo escuro estrelado em camadas, inspirado no CheckList.
- [x] O fundo possui detalhes proprios de CS & NPS para nao ficar 100% identico.
- [x] As luzes ambiente usam a cor do tema de interface selecionado pelo usuario.
- [x] O fundo nao intercepta cliques e preserva a legibilidade da tabela e dos controles.
- [x] Animacoes sao reduzidas quando o navegador informa preferencia por menos movimento.
- [x] O fundo vale para todas as paginas dentro de `/PainelAlpha/CadastroClientes`.
- [x] O card principal/listagem e os modais do CS & NPS receberam profundidade 3D sutil via Framer Motion.

## Arquivos Modificados

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/app/PainelAlpha/CadastroClientes/CsNpsBackground.tsx` | criado | Fundo estrelado do CS & NPS com luzes do tema, parallax e detalhes orbitais/pulsos. |
| `src/app/PainelAlpha/CadastroClientes/layout.tsx` | criado | Layout do modulo para aplicar o fundo em todas as telas de CS & NPS. |
| `src/app/PainelAlpha/CadastroClientes/page.tsx` | modificado | Ajusta superficies principais para deixar o fundo aparecer mantendo contraste. |
| `src/app/PainelAlpha/CadastroClientes/CsNpsMotion.tsx` | criado | Wrappers 3D para card principal, tabela e modais. |
| `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modal.tsx` | modificado | Aplica entrada/tilt 3D ao modal de cadastro e aviso de duplicidade. |
| `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx` | modificado | Aplica entrada/tilt 3D ao modal de gestao e popups internos. |
| `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalFiltros.tsx` | modificado | Aplica entrada/tilt 3D ao modal de filtros. |
| `src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalLogAuditoria.tsx` | modificado | Aplica entrada/tilt 3D ao modal de auditoria. |
| `src/app/PainelAlpha/CadastroClientes/ModalCadastro/ModalSelecionarUsuario.tsx` | modificado | Aplica entrada/tilt 3D ao seletor de usuario. |
| `.bibble/memory/components.md` | modificado | Registra o novo wrapper visual `CsNpsMotion`. |

## Verificacao

- [ ] `npm run lint` bloqueado por erros preexistentes fora do escopo (`.agents/`, `.aiox-core/`, componentes legados e regras React Compiler).
- [x] `npx eslint src/app/PainelAlpha/CadastroClientes/CsNpsBackground.tsx src/app/PainelAlpha/CadastroClientes/layout.tsx` concluido sem erros.
- [x] `npx eslint src/app/PainelAlpha/CadastroClientes/CsNpsMotion.tsx src/app/PainelAlpha/CadastroClientes/CsNpsBackground.tsx src/app/PainelAlpha/CadastroClientes/layout.tsx` concluido sem erros.
- [ ] `npm run typecheck` nao existe neste repositorio.
- [ ] `npm test` nao existe neste repositorio.
- [ ] `npx tsc --noEmit --pretty false` bloqueado por erros preexistentes em `api/ExclusaoFiscal`, `HabilitacaoRadar` e `ModalPerfilColaborador`.
- [x] `git diff --check` concluido sem erros.
