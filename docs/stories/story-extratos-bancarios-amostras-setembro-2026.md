# Story: Corrigir importação dos extratos bancários de teste

## Status

Ready for Review

## Origem

Pedido do usuário de 25/09/2026: verificar os arquivos de `teste extratos/` e os prints de `teste extratos/prints erro/`, corrigindo o fluxo de Extratos Bancários.

## Critérios de aceite

- [x] Os PDFs de teste com texto extraível são processados localmente sem depender da resposta do agente Onyx.
- [x] Cada layout reconhecido retorna as movimentações com data, descrição, valor e sinal corretos, excluindo saldos, totais e cabeçalhos.
- [x] O upload autodetecta os layouts pela assinatura do conteúdo, mesmo que o usuário selecione outro banco.
- [x] Os casos de regressão usam fixtures sanitizadas e cobrem ao menos uma amostra de cada layout corrigido.
- [x] O relatório Itaú consolidado não omite nem troca lançamentos de entrada e saída identificados nos prints.
- [x] Não há mudança de schema, migration, seed ou mutação em massa de dados.
- [x] `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` executados e resultados documentados.

## Checklist

- [x] Inspecionar os prints e reproduzir o caminho de parsing dos PDFs.
- [x] Corrigir parsers e autodetecção por layout.
- [x] Corrigir divergências da planilha Itaú consolidado.
- [x] Validar todos os PDFs de teste e testes automatizados.
- [x] Executar quality gates.

## Evidência inicial

O caminho de upload só autodetecta Itaú, Santander, CAIXA e Mercado Pago. Os prints de Banco do Brasil, Bradesco, C6, CredCrea, Inter, Nubank, PagBank, Sicoob e Sicredi mostram página não processada e tabela vazia. Os PDFs têm camada de texto nativa; portanto OCR não é o bloqueio principal. Os parsers genéricos retornam zero para C6, CredCrea, Inter, Sicoob e Nubank. O parser Bradesco inclui linhas de saldo de investimento. Os demais exigem reconciliação.

## Validação

- 14/14 PDFs têm texto nativo e assinatura detectada; todas as amostras retornam transações sem páginas com erro no caminho determinístico.
- Reconciliação com o próprio extrato: C6 80 lançamentos; CredCrea 160; Sicoob 61; Sicredi 132; Bradesco 9; PagBank 29; Nubank 183 em três meses; Itaú simplificado 47. Banco do Brasil 6 lançamentos com líquido zero.
- Itaú consolidado: 312 lançamentos após recuperar quatro débitos de 03/08 e o crédito de 17/08 mostrados nos prints. O relatório Excel fornecido continha 307 lançamentos produzidos pelo parser anterior e por isso não servia como oráculo para as linhas faltantes.
- Santander: 257 lançamentos nos três meses contidos no PDF único.
- `npm run lint`: passou, 0 erros e 1192 warnings preexistentes.
- `npm run typecheck`: passou.
- `npm test`: 509 arquivos passaram; 3836 testes passaram, 4 ignorados, 1 pendente.
- `npm run build`: passou.
- `npx vitest run tests/extratos`: 7 arquivos e 38 testes passaram.
- Sem alteração de banco de dados ou dados persistidos. CodeRabbit CLI indisponível no ambiente.

## File List

- `docs/stories/story-extratos-bancarios-amostras-setembro-2026.md`
- `src/components/Extratos/ModalVincularBanco.tsx`
- `src/lib/extrato/parsers/bancoBrasil.ts`
- `src/lib/extrato/parsers/bradesco.ts`
- `src/lib/extrato/parsers/c6.ts`
- `src/lib/extrato/parsers/credcrea.ts`
- `src/lib/extrato/parsers/index.ts`
- `src/lib/extrato/parsers/inter.ts`
- `src/lib/extrato/parsers/itau.ts`
- `src/lib/extrato/parsers/nubank.ts`
- `src/lib/extrato/parsers/pagBank.ts`
- `src/lib/extrato/parsers/santander.ts`
- `src/lib/extrato/parsers/sicoob.ts`
- `src/lib/extrato/parsers/sicredi.ts`
- `tests/extratos/parsers-amostras-setembro-2026.test.ts`
