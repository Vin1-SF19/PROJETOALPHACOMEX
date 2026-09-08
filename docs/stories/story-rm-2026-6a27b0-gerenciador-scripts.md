# RM-2026-6A27B0 — Base de Conhecimento como gerenciador de scripts

## Status

Concluída — aguardando testes de homologação.

## Objetivo

Simplificar a tela **Base de Conhecimento** do Alpha CRM para que o administrador selecione um pipeline, selecione uma etapa e edite o texto exibido na aba **Scripts** dos cards daquela etapa.

## Estado auditado

- A rota administrativa já existe em `/PainelAlpha/AlphaCRM/admin/conhecimento` e exige perfil administrativo.
- A tela atual gerencia links por pipeline, comportamento incompatível com este objetivo.
- `BpmEtapa.script` já persiste o roteiro por pipeline/etapa e `AtualizarEtapaBpm` já protege, valida, audita e notifica sua atualização.
- `PainelRegistrar` já possui a aba de script e recebe a etapa atual pelo fluxo autorizado do card.
- O Bloco de Notas usa Tiptap, autosave e a superfície visual definida em `NoteEditor`/`note-editor.css`.

## Escopo

- Substituir a UI de links por três elementos: pipeline, etapa e editor de texto.
- Extrair e reutilizar a configuração, barra e superfície do editor do Bloco de Notas.
- Salvar automaticamente o conteúdo no campo `BpmEtapa.script` existente.
- Renderizar o mesmo conteúdo, somente leitura, na aba **Scripts** do card.
- Preservar textos simples previamente gravados em `BpmEtapa.script`.
- Remover do card a exibição residual de “Documentos relacionados”.

## Fora de escopo

- Migration, alteração estrutural ou remoção física da tabela legada de links.
- Edição de scripts por usuários comuns dentro do card.
- Alterações no módulo Bloco de Notas além da extração de primitivas reutilizáveis.

## Banco de dados

`DATABASE_CHANGE_NOT_REQUIRED`: `BpmEtapa.script` já representa exatamente a associação pipeline + etapa + texto. A tabela legada de links permanecerá intacta para evitar perda de dados sem autorização de migração destrutiva.

## Critérios de aceite

1. A tela administrativa apresenta seleção de pipeline, seleção dependente de etapa e um único editor de texto.
2. O editor reutiliza as primitivas visuais e a configuração Tiptap do Bloco de Notas.
3. Alterações são salvas automaticamente com indicação de estado pendente, salvando, salvo ou erro.
4. A escrita exige sessão, permissão `configurarEtapas`, validação Zod e confirma que a etapa pertence ao pipeline informado.
5. O texto é persistido em `BpmEtapa.script`, auditado e propagado pelo realtime existente do pipeline.
6. A aba **Scripts** do card mostra o conteúdo da etapa atual somente para leitura e possui estado vazio.
7. Textos simples legados continuam legíveis.
8. A antiga UI de links e o painel “Documentos relacionados” deixam de ser consumidos.
9. Testes cobrem serialização legada/estruturada, autorização, vínculo pipeline-etapa, persistência e integração visual.

## Plano por fase

- [x] Fase 0 — Auditoria de entregabilidade e estado atual.
- [x] Fase 1 — Blueprint e decisão de integração.
- [x] Fase 2 — Implementação do gerenciador e da aba Scripts.
- [x] Fase 3 — Gate técnico real.
- [x] Fase 4 — Verificação dos oito pontos de integração.
- [x] Fase 5 — Auditoria de segurança.
- [x] Fase 6 — Revisão de código e aceite.
- [x] Fase 7 — Atualização da memória do projeto.
- [x] Fase 8 — Journal e fechamento.

## Evidências dos gates

- Testes direcionados: 49/49 aprovados.
- Regressão do Bloco de Notas: 20/20 aprovados.
- Suíte BPM: 750/779; as 29 falhas restantes pertencem a baselines externos e nenhum teste desta RM falhou.
- Suíte global com coverage: 2.412/2.462; 50 falhas externas reproduzidas.
- ESLint escopado e `git diff --check`: aprovados.
- ESLint global: baseline de 2.484 erros e 1.257 avisos, sem ocorrência nos arquivos da RM.
- Typecheck global: nenhum diagnóstico nos arquivos da RM; débitos restantes em Exclusão Fiscal, Gerador de Documentos, Calendário, Radar e testes legados.
- Build real: aprovado; Turbopack compilou em 14,1 s e gerou 78 páginas.

## Revisões finais

- Integração: 8/8 pontos aprovados — menu/rota, seletores, autosave, persistência, realtime, aba Scripts, vazio e retrocompatibilidade.
- Segurança: aprovado — auth e permissão antes da leitura, vínculo pipeline/etapa, Zod, limites, allowlist de nós/marcas e protocolos seguros.
- Qualidade: aprovado — editor realmente compartilhado com Notas, sem cópia da toolbar/configuração e sem schema paralelo.

## File list

- `docs/stories/story-rm-2026-6a27b0-gerenciador-scripts.md`
- `.bibble/memory/architecture.md`
- `.bibble/memory/components.md`
- `.bibble/memory/decisions.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/journal.md`
- `src/actions/bpm/Conhecimento.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/ConteudoScriptEtapa.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelRegistrar.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/conhecimento/page.tsx`
- `src/components/Notas/NoteEditor/NoteEditor.tsx`
- `src/components/Notas/NoteEditor/NoteEditorPrimitives.tsx`
- `src/components/bpm/conhecimento/ConhecimentoWorkspace.tsx`
- `src/components/bpm/conhecimento/PainelConhecimentoRelacionado.tsx` (removido)
- `src/components/bpm/conhecimento/ScriptEtapaEditor.tsx`
- `src/lib/bpm/script-etapa.ts`
- `tests/bpm/conhecimento-actions.test.ts`
- `tests/bpm/conhecimento-scripts-ui.test.ts`
- `tests/bpm/script-etapa.test.ts`
