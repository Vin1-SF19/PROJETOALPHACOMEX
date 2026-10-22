# iAlpha — Ficha de reunião igual ao Pré Análise

Status: Ready for Review

executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: [revisao-do-diff, vitest, lint, typecheck]

## Story

Como usuário do iAlpha na página inicial, quero receber a mesma ficha de reunião atualizada do módulo Pré Análise ao informar um CNPJ, para usar um único modelo de reunião nos dois fluxos.

## Contexto e decisão

Pedido de referência: “preciso de uma ficha de reunião para esse CNPJ: 42.591.651/0001-43”. A story `story-rm-2026-e04b53-modificacao-ficha-reuniao.md`, seção “Objetivo e critérios de aceite”, introduziu as perguntas no Pré Análise e preservou deliberadamente o modelo anterior no Bibble. O pedido atual substitui essa decisão para a ficha solicitada ao iAlpha.

[AUTO-DECISION] Reutilizar a variante existente `finalidade="pre-analise"` em vez de duplicar o documento (motivo: ambos os fluxos já usam `FichaAlphaPDF`). Sem mudança de banco, migration ou operação em massa. `accumulated-context.md` e `.aiox/gotchas.json` não encontrados; contexto cruzado obtido da story anterior.

## Critérios de aceite

1. A ferramenta `gerar_ficha_pre_analise`, acionada pelo iAlpha inicial, gera o mesmo modelo atualizado utilizado pelo módulo Pré Análise, reutilizando `FichaAlphaPDF` com a finalidade correspondente.
2. A ficha inclui as perguntas atuais do template compartilhado, com espaço manuscrito e `A CONFIRMAR (  )` abaixo de cada pergunta. Preservar a alteração preexistente de “R$ 100,00” para “R$ 100.000,00” na pergunta sobre valor líquido; a comparação deve seguir o conteúdo atual do Pré Análise, sem restaurar o texto histórico da story anterior.
3. O PDF preserva formato A4, dados da empresa e mecanismo atual de download. Os blocos de pergunta, resposta e confirmação mantêm o comportamento de paginação do Pré Análise.
4. Autenticação, validação de CNPJ, consulta dos dados e tratamento de falhas permanecem funcionais; consumidores que solicitam o modelo padrão continuam com seu comportamento existente.
5. Teste de regressão cobre a seleção do modelo na geração pelo iAlpha; os testes existentes do PDF continuam aprovados. Lint, typecheck e suíte global são executados e seus resultados registrados.

## Dev Notes

- `src/lib/bibble/gerar-ficha-server.ts` monta o PDF do iAlpha sem informar a finalidade, selecionando o modelo antigo por padrão.
- `src/components/ModalPdf.tsx` é a referência de consumo no Pré Análise: passa `finalidade="pre-analise"`.
- `src/components/GerarFicha.tsx` contém o modelo compartilhado e os blocos atualizados. Não duplicar as perguntas no gerador do iAlpha.
- Há alteração preexistente nesse template para “R$ 100.000,00”; preservá-la e alinhar expectativas dos testes ao conteúdo atual.
- `tests/pre-analise/ficha-reuniao.test.ts` já verifica a variante atualizada, o modelo padrão e a renderização real do documento.
- Publicação e validação devem ocorrer primeiro em staging, conforme `AGENTS.md`. Produção depende de pedido explícito posterior.

## Checklist / tarefas

- [x] Story criada e contexto da alteração anterior revisado.
- [x] Selecionar a variante do Pré Análise no gerador do iAlpha (AC 1–3).
- [x] Adicionar regressão no fluxo do gerador e verificar download/dados e falhas existentes (AC 4–5).
- [x] Executar testes direcionados, `npm run lint`, `npm run typecheck` e `npm test`; registrar resultados (AC 5).
- [x] Atualizar checklist e file list com os arquivos efetivamente alterados.
- [ ] Validar o fluxo em staging e registrar evidência ou limitação da validação.

## Testing

Usar Vitest e os padrões existentes. Verificar a propriedade enviada ao componente pelo gerador; conservar a cobertura de conteúdo e A4 em `tests/pre-analise/ficha-reuniao.test.ts`. Testar um sucesso com dados controlados, bem como a preservação das respostas de erro pertinentes ao gerador. Não consultar nem modificar banco de produção para validar esta correção.

## 🤖 CodeRabbit Integration

- Story Type Analysis: integração/backend; complexidade baixa, ajuste de variante PDF existente.
- Specialized Agents: @dev executor; @architect revisão; @qa verificação de regressão. @devops apenas para eventual publicação em staging.
- Quality Gates: revisão Pre-Commit por @dev; Pre-PR por @devops se houver PR. Produção fora deste pedido.
- Self-Healing: @dev light, até duas iterações/15 minutos para CRITICAL; HIGH documentado. @qa full, até três iterações/30 minutos para CRITICAL/HIGH. Se CLI indisponível, registrar a limitação e revisar o diff.
- Focus Areas: mesma variante nos dois pontos de entrada; contrato de download e dados preservado; ausência de duplicação de template e alteração de autenticação.

## File list

- `docs/stories/story-ialpha-ficha-reuniao-paridade-pre-analise.md` — nova story.
- `src/lib/bibble/gerar-ficha-server.ts` — seleção da variante atualizada.
- `tests/bibble/gerar-ficha-server.test.ts` — renderização real do gerador, comparação com referência, contrato de download e CNPJ inválido.
- `tests/pre-analise/ficha-reuniao.test.ts` — expectativa alinhada ao conteúdo atual e nome do teste do consumidor padrão corrigido.
- `src/components/GerarFicha.tsx` — alteração preexistente de R$ 100.000,00 preservada; faz parte da paridade com o modelo atual.

## Validação story-draft-checklist

READY. Objetivo/contexto: PASS; orientação técnica: PASS; referências: PASS; autossuficiência: PASS; orientação de testes: PASS; integração CodeRabbit: PASS. Correção pequena e delimitada, sem dependência de novo requisito de produto ou alteração de banco. Esta avaliação valida a preparação da story, não a implementação nem os gates.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-22 | 1.0 | Story preparada para corrigir a paridade solicitada pelo usuário | River (SM) |

## Dev Agent Record / QA Results

- Causa: o módulo usa `finalidade="pre-analise"`; o gerador do iAlpha omitia a propriedade e imprimia a variante padrão. Ambos agora selecionam a mesma variante do mesmo componente.
- Regressão reproduzida antes da correção: PDF do gerador continha OBSERVAÇÕES enquanto a referência continha as perguntas (`/tmp/ialpha-ficha-red.log`).
- Após a correção, `npx vitest run tests/bibble/gerar-ficha-server.test.ts tests/pre-analise/ficha-reuniao.test.ts`: 2 arquivos, 4 testes PASS (`/tmp/ialpha-ficha-focused.log`). Renderização real, comparação integral de texto e dimensões A4, dados controlados com o CNPJ do exemplo, duas confirmações e contrato de download preservado; dados/banco/upload simulados, sem consulta ou escrita real.
- ESLint dos três arquivos de servidor/testes: PASS, sem avisos. `git diff --check` do escopo: PASS.
- CodeRabbit indisponível em `~/.local/bin/coderabbit`; revisão independente por QA, sem defeito funcional identificado até aqui. Não se declara revisão CodeRabbit executada.
- Isolamento: branch local `staging`, banco de `.env.staging.local` conferido diferente de `.env.local`, sem expor credenciais. Nenhuma alteração de schema/migration ou mutação em massa.
- Staging ativo identificado por DevOps em `04cc69c0b716dc340ad0a3f63670406bbe631f98`, deployment `dpl_HjFuQU8XuyW414YbVMyA2qasuNb9`. Workspace contém outras entregas e diverge dessa base; pacote isolado em `/tmp/ialpha-ficha-staging-release`, com somente os cinco arquivos desta File List.
- QA independente: APPROVED no escopo funcional, sem defeito bloqueante; autenticação/permissão da ferramenta, consulta e retorno `pdfUrl` preservados. Modos dos arquivos no snapshot normalizados para 0644.
- Gates da árvore isolada: `npm run lint` PASS (0 erros, 1.193 avisos existentes), log `/tmp/ialpha-ficha-release-lint.log`; `npm run typecheck` PASS, log `/tmp/ialpha-ficha-release-typecheck-final.log`. Preparação necessária: gerar o bundle do player e disponibilizar `extenso@3.0.0` conforme SHA-512 do lockfile; manifests e dependências do workspace não foram alterados.
- Primeira suíte impedida pelo cache temporário do Vitest no sandbox. A execução seguinte sofreu concorrência de validações, timeouts e esgotamento de `/tmp` (tmpfs de 16 GiB confirmado 100% cheio): 690 arquivos e 5.748 testes passaram, 32 arquivos falharam e houve oito erros de workers. Isso não é aprovação global; causas ambientais registradas sem modificar fontes alheias para contorná-las.
- Artefatos exclusivos desta validação (`node_modules` independente e `.next` parcial) movidos para `.cache/ialpha-ficha-validation/`, ignorado no Git, liberando cerca de 5 GiB em `/tmp`.
- Suíte global final `npm test -- --maxWorkers=2`: PASS, exit 0; 730 arquivos, 5.911 testes aprovados, quatro skipped e um todo. Banco de teste de arquivo isolado; log `/tmp/ialpha-ficha-release-test-serial.log`. A redução de paralelismo resolveu a contenção sem mudar fontes, testes ou configuração versionada. Cobertura: statements 69,58%, branches 62,79%, functions 77,22%, lines 73,11%.
- Build integrado sobre `37a7048d`: PASS, exit 0, 144,576 s, 86 páginas; log `/tmp/ialpha-ficha-release-build.log`. Avisos existentes do `pdfjs-polyfill` preservados; `npm run typecheck` separado PASS, pois o build ignora tipos. Publicação/validação remota ainda pendentes neste registro anterior ao commit.
- Concorrência de publicação: `origin/staging` avançou de `04cc69c0` para `37a7048dc7eb2129f0a48e1868231b11d8482487` durante os gates. DevOps verificou ausência de overlap com os cinco arquivos desta entrega. Preservar integralmente o avanço remoto por fast-forward/rebase, sem force. A entrega remota CheckList registra seus próprios gates (745 arquivos/6.093 testes, typecheck/lint/build e Lens); adotar essas evidências junto à suíte de 730 arquivos desta correção e executar testes dos PDFs, typecheck e build na árvore integrada. Nenhuma migration é executada por esta entrega; eventual `prisma generate` altera somente o cliente de validação independente.

- Integração final: base remota `37a7048dc7eb2129f0a48e1868231b11d8482487` preservada sem conflito; nenhum overlap com os cinco arquivos. `prisma generate` somente no cliente independente PASS; testes PDF 2 arquivos/4 testes PASS; typecheck integrado PASS em 55,39 s. Suíte geral anterior desta correção e gates independentes da entrega CheckList adotados pela integridade dos respectivos escopos. Nenhuma operação de banco executada.

- Última preservação concorrente antes do commit: remoto avançou para `72cd49d8d4f5936469b0711b2cfe9c85cda31ada`, somente dois componentes visuais CRM e sua story, sem overlap com esta File List. Avanço incorporado por checkout fast-forward mantendo nosso patch. Gates próprios combinados de build/lint/typecheck e suíte com retentativa limitada estão documentados na story CRM; não repetir a suíte ampla sem risco novo. O build e typecheck desta ficha foram executados sobre `37a7048d`; as fontes da ficha permaneceram idênticas após preservar72cd.
