# Story — Hook de Erros para Debug

## Status

InProgress

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["vitest", "eslint", "tsc", "next-build"]

## Story

**Como** desenvolvedor ou operador do Painel Alpha,
**quero** um hook de erros que capture erros, warnings e eventos problemáticos e exiba um painel discreto no canto da tela,
**para que** eu possa depurar e resolver problemas sem depender apenas de notificações genéricas.

## Acceptance Criteria

1. [ ] Erros globais, promises rejeitadas, `console.error` e `console.warn` são capturados quando a aplicação roda no navegador.
2. [ ] O overlay de debug aparece no canto inferior direito, pode ser aberto/fechado e lista eventos capturados.
3. [ ] O usuário consegue filtrar por nível e fonte, limpar eventos e ver detalhes com mensagem, stack e metadados.
4. [ ] A implementação não expõe tokens, senhas, segredos ou cabeçalhos sensíveis nos metadados capturados.
5. [ ] A implementação usa TypeScript estrito, componentes client-side, Tailwind e utilitário `cn()` quando aplicável.
6. [ ] Testes Vitest cobrem sanitização, eventos, store e filtros básicos.
7. [ ] `npm run lint`, `npm run typecheck` e `npm test` são executados; regressões desta story são corrigidas.

## Tasks / Subtasks

- [x] Criar tipos e helpers de captura/sanitização em `src/lib/debug`.
- [x] Criar store Zustand com ring buffer e filtros em `src/store/useDebugStore.ts`.
- [x] Criar provider de captura global em `src/components/debug/DebugCaptureProvider.tsx`.
- [x] Criar overlay de exibição em `src/components/debug/DebugErrorOverlay.tsx`.
- [x] Integrar no layout root em `src/app/layout.tsx`.
- [x] Criar testes Vitest para bus e store.
- [ ] Executar lint, typecheck e testes.

## Dev Notes

- O overlay é intencionalmente diferente do `Toaster` do sonner: ele é um painel de debug persistente, não uma notificação efêmera.
- A captura evita `iframes` aninhados para não duplicar eventos quando o painel está embutido.
- Metadados sensíveis são sanitizados por nome de chave, com substituição por `[oculto]`.

## File List

- `docs/stories/story-debug-error-hook.md`
- `src/lib/debug/error-types.ts`
- `src/lib/debug/error-bus.ts`
- `src/store/useDebugStore.ts`
- `src/components/debug/DebugCaptureProvider.tsx`
- `src/components/debug/DebugErrorOverlay.tsx`
- `src/app/layout.tsx`
- `tests/debug/error-bus.test.ts`
- `tests/debug/use-debug-store.test.ts`
