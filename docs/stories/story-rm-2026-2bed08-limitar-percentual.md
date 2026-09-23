# RM-2026-2BED08 — Limitar Percentual entre 0 e 100

## Status

Pronta para testes — objetivo 8/10 implementado no terminal em 2026-09-22.

## Critérios e implementação

- [x] Campo Percentual expõe `min=0`, `max=100` e `step=0.01`.
- [x] UI ignora valores numéricos fora do intervalo e preserva vazio.
- [x] Servidor rejeita percentual menor que 0 ou maior que 100.
- [x] Número, moeda e demais tipos permanecem sem esse limite.
- [x] Sem schema, migration ou alteração de dados.

## File list

- `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx`
- `src/lib/bpm/campos-dinamicos.ts` (validação já estava no HEAD e foi revalidada)
- `tests/bpm/percentual-limite-react.test.ts`
- `docs/stories/story-rm-2026-2bed08-limitar-percentual.md`

## Validação

26/26 testes em quatro suítes focadas, ESLint do componente/teste e typecheck
aprovados. O teste React cobre limites visuais e bloqueio de -1/100.01; os
testes de domínio cobrem a rejeição no servidor. Resultado: **PASS no escopo**,
encaminhado para **Em testes**.
