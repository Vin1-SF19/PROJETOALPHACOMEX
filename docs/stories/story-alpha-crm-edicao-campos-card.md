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
- `src/lib/bpm/usuarios-campos.ts`
- `src/lib/bpm/usuarios-campos-server.ts`
- `src/lib/bpm/resumo-contratacao-server.ts`
- `src/app/PainelAlpha/AlphaCRM/CardModal/PainelResumoEtapas.tsx`
- `tests/bpm/usuarios-campos.test.ts`
- `tests/bpm/resumo-contratacao-vendedor.test.ts`
- `tests/bpm/relacionamento-ui.test.ts`

## Change Log

| Date | Description |
| --- | --- |
| 2026-08-13 | Story consolidada com contrato definição-da-etapa sobre valores persistidos e matriz de regressão. |
| 2026-10-20 | Correção solicitada: campos “Vendedor responsável” devem apresentar o nome do usuário em vez do ID do closer. |

## Dev Agent Record — nome do vendedor responsável

Pedido do usuário em 20/10/2026: exibir o nome do usuário nos campos e formulários “Vendedor responsável”, que atualmente exibem o ID do closer.

- [x] Conferir as definições reais somente por leitura: campos local `alpha.vendedor.a` e global `alpha.radar.contrato.vendedor_a`, ambos do tipo `usuario`; o global usa `CARD.responsavelId`.
- [x] Resolver nomes em lote na leitura dos campos, mantendo IDs internos e o vendedor original copiado para outro setor.
- [x] Mostrar nomes no seletor editável e na apresentação somente leitura; preservar referência a usuário inativo e tratar referência inexistente.
- [x] Aplicar a resolução ao resumo da contratação sem substituir o vendedor pelo responsável atual do Financeiro/Operacional.
- [x] Executar testes de regressão, lint e typecheck.

O resumo das etapas anteriores e a confirmação de alterações do formulário também usam nomes para referências a usuários.

Sem migration, backfill ou alteração de dados existentes. IDs continuam armazenados e enviados ao servidor; nomes são usados na apresentação.

Validação em 20/10/2026:

- `npm run typecheck`: aprovado, exit 0 (`/tmp/alpha-vendedor-typecheck.log`).
- `npm run lint`: aprovado, zero erros e 1.193 warnings preexistentes (`/tmp/alpha-vendedor-lint.log`).
- `npm test`: 663 arquivos e 5.031 testes aprovados, 4 ignorados e 1 todo (`/tmp/alpha-vendedor-tests.log`).
- Regressão final focada: 15/15, incluindo resumo de etapas, campo global/local, usuário inativo, referência ausente e nome textual legado (`/tmp/alpha-vendedor-final-focused.log`).
- Verificação CLI somente leitura em dois registros reais: nomes resolvidos e valores internos preservados.
- Build e smoke manual no navegador não executados nesta correção. Sem commit/push naquele momento; solicitação posterior atendida pela entrega abaixo.


### Entrega isolada para staging — 20/10/2026

Correções preparadas sobre `80078d9e43530fd7d4babbd153dc695ea36688b2`, com commit/push solicitado pelo usuário. Alterações concorrentes mantidas fora deste patch.

- `npm run typecheck`: exit 0, `/tmp/alpha-vendedor-staging-typecheck.log`.
- `npm run lint`: exit 0, zero erros e 1.193 warnings, `/tmp/alpha-vendedor-staging-lint.log`.
- `npm test`: 641 arquivos aprovados, 4 com falha e 1 ignorado; 4.809 testes aprovados, 6 com falha, 7 ignorados e 1 todo. Falhas idênticas às já documentadas na base: Builder (3), scroll do modal (1), Próximo Contato (2) e importação da suíte de arquivamento. Nenhuma falha nova no delta. `/tmp/alpha-vendedor-staging-tests.log`.
- Build equivalente aprovado: Prisma/player oficiais, `next build --webpack`, heap de 4.096 MiB e uma CPU, sem alterar package/configuração versionada. Exit 0, 147,57 segundos; `/tmp/alpha-vendedor-staging-build-result.json` e `/tmp/alpha-vendedor-staging-build.log`.
- A suíte do workspace integrado registrada acima e esta validação isolada possuem conjuntos diferentes de alterações. As falhas preexistentes não são apresentadas como aprovação global.
- Nenhuma migration ou escrita no banco realizada nesta entrega.
