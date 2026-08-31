# RM-2026-2403E5 — Correção da saída de Novos Leads

## Objetivo

Permitir a movimentação de cards para fora de **Novos leads** quando os campos obrigatórios já foram persistidos, preservando o bloqueio para valores ausentes.

## Critérios de aceite

- [x] Saves de campos dinâmicos são executados em sequência.
- [x] Uma falha bloqueia o movimento atual, mas o resultado é consumido para permitir nova tentativa.
- [x] A versão-base do CAS é atualizada após cada save confirmado.
- [x] Falha de persistência impede a chamada de movimento.
- [x] Botões de etapa ficam desabilitados com indicador de carregamento durante save/movimento.
- [x] Valores preenchidos, nulos e parcialmente preenchidos possuem cobertura.
- [ ] Gates globais completos (bloqueados por baseline externo e concorrência de build).

## Validação executada

- Testes focados: 14/14 passando (execução local confirmada nesta fase).
- ESLint dos arquivos da fase: passando.
- `git diff --check`: passando.
- Suíte BPM: 298/319 passando; 21 falhas externas já presentes no baseline.
- Suíte completa: 1894/1936 passando; 42 falhas externas à fase.
- Typecheck global: bloqueado por erros externos em Exclusão Fiscal, Google Calendar, Gerador de Documentos e Radar.
- Lint global: bloqueado por 3766 ocorrências preexistentes/externas, principalmente em `.agents/skills` e `.aiox-core`.
- Build: geração Prisma e bundle do player concluídos; a compilação otimizada do Next permaneceu ativa sem erro por mais de três minutos e foi interrompida pelo limite operacional da fase (sem `.next/lock` concorrente).

## Caminho de entrega

`/PainelAlpha/AlphaCRM/pipeline/[pipelineId]` → card em **Novos leads** → aba **Formulário da Etapa** → preencher **Radar pretendido** e **Confirmar serviço** → selecionar a próxima etapa no painel direito.

## File List

- `src/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx`
- `tests/bpm/novos-leads.test.ts`
- `tests/bpm/card-save-flow.test.ts`
- `docs/stories/story-rm-2026-2403e5-correcao-saida-novos-leads.md`
