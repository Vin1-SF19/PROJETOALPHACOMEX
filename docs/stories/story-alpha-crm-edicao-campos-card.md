# Story: Alpha CRM — edição completa dos campos do card por etapa

## Status

Ready for Review

## Objetivo

Fazer o card editar a **definição de campos da sua etapa atual**, inclusive
campos ainda sem valor persistido. A definição (`camposEtapa`) prevalece sobre
`BpmCardCampoValor`: os valores somente complementam cada campo definido e a
ausência de um valor é representada por `null`, nunca pela ausência do campo na
interface.

## Contrato funcional

- `ObterCardBpm` carrega os campos aplicáveis à etapa atual; campos diretos e
  globais explicitamente associados são deduplicados, ordenados e recebem
  obrigatoriedade efetiva.
- Todo campo definido aparece em **Formulário da Etapa**, ainda que não exista
  `BpmCardCampoValor` para ele.
- A edição salva somente campos pertencentes à etapa atual. O backend valida a
  allowlist antes e dentro da transação, faz upsert de valores novos ou
  existentes, protege a alteração por CAS de `updatedAt`, registra histórico e
  publica realtime somente após o commit.
- Campos obrigatórios são identificados visualmente por `*`, recebem
  `required` e `aria-required`; a obrigatoriedade de avanço continua sendo
  aplicada pelos guards de transição.

## Acceptance Criteria

1. A leitura retorna todos os campos definidos da etapa, com `valor: null`
   para os ainda não preenchidos.
2. Campo direto e campo associado repetido aparecem uma única vez, obedecendo
   à ordem configurada (desempate pelo nome) e à obrigatoriedade efetiva.
3. Um usuário autorizado pode preencher posteriormente um campo nulo e editar
   um valor já existente dentro do card.
4. `AtualizarCardBpm` rejeita campo que não pertença à etapa atual, sem update,
   upsert, histórico ou realtime.
5. A edição de campos dinâmicos usa CAS; conflito não produz escrita parcial,
   histórico nem notificação realtime.
6. A interface mostra todos os campos atuais, inclusive nulos, e salva seu
   payload; cada campo obrigatório apresenta `*`, `required` e
   `aria-required`.
7. O editor continua exclusivamente no painel central **Formulário da Etapa**;
   não há alteração no painel direito, no modal de criação ou nos guards de
   outras etapas.
8. Nenhuma migration, schema, seed ou alteração de dados é necessária.

## Verificação realizada

- Testes do carregamento de definição/valor, deduplicação, ordenação e
  obrigatoriedade.
- Testes de action para upsert de campo inicialmente nulo, CAS, histórico,
  realtime e rejeição de campo fora da etapa.
- Teste estrutural do painel para marcador visual, controle requerido e envio
  de campos de valor nulo.
- Vitest BPM focado, ESLint focado e `git diff --check`.

## File List

- `src/lib/bpm/requisitos-etapa-server.ts`
- `src/actions/bpm/Cards.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx`
- `src/app/PainelAlpha/AlphaCRM/CampoBpmInput.tsx`
- `tests/bpm/requisitos-etapa-server.test.ts`
- `tests/bpm/edicao-campos-card.test.ts`

## Change Log

| Date | Description |
| --- | --- |
| 2026-08-13 | Story consolidada com contrato definição-da-etapa sobre valores persistidos e matriz de regressão. |
