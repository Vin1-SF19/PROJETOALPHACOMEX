# Story — Valores por extenso automáticos no Gerador de Documentos

## Status

Ready for Review — implementação e integração aprovadas por QA; lint, typecheck e suíte completa PASS, compilação equivalente com 6 GB PASS. Build local padrão de 3 GB falhou por heap; publicação e build padrão remoto do staging aguardam verificação.

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["npm run lint", "npm run typecheck", "npm test", "npm run build"]

## Story

Como usuário do Gerador de Documentos, quero que os campos por extenso de valor total, inicial, final e desconto sejam preenchidos automaticamente conforme o respectivo valor digitado, para gerar documentos com valores numéricos e textuais coerentes sem redigitar os textos.

Origem: pedido direto do usuário. Cobrir o fluxo existente a partir de criação/edição de template, formulário de geração e documento gerado/conferência. O cadastro de template é baseado em upload; não existe ali formulário de valores monetários a ampliar. **Staging primeiro; produção não autorizada.** Nenhuma alteração de banco/schema ou backfill é esperada.

## Acceptance Criteria

1. As correspondências existentes são reconhecidas nos templates: `valor_total` → `valor_total_extenso`, `valor_inicial` → `valor_inicial_extenso`, `valor_final` → `valor_final_extenso` e `desconto_valor` → `desconto_extenso`. O fluxo a partir de criar/editar um template mantém essas variáveis/associações e aplica o comportamento automático onde os valores já são preenchidos, sem adicionar formulário monetário ao upload ou exigir configuração adicional do usuário.
2. No formulário de geração, preencher ou alterar um desses valores atualiza automaticamente somente seu campo por extenso correspondente. Valores iniciais válidos também são refletidos corretamente, sem depender de o usuário redigitar. Os demais campos e templates sem essas variáveis continuam funcionando.
3. O texto monetário é escrito em português brasileiro, coerente com reais e centavos, incluindo singular/plural e zero. Entradas monetárias aceitas pelo fluxo existente são interpretadas sem trocar separadores ou multiplicar o valor. Entrada vazia/inválida não gera texto monetário inventado nem deixa extenso obsoleto como se fosse o valor atual; preservam-se as validações/indicações de preenchimento pendente existentes.
4. A geração e a conferência usam os mesmos valores/extensos coerentes exibidos no formulário, inclusive após editar um valor na conferência dos rascunhos que já disponibilizam essa edição. O documento renderizado e seu download existente refletem o texto correspondente. A correção preserva ACL, CAS, documentos somente leitura e regras atuais de sincronização; não sobrescreve documentos anteriores nem cláusulas editadas manualmente ou reescritas por IA fora dessas regras.
5. A solução reutiliza contratos existentes de template/variáveis/renderização, sem introduzir novos campos de banco, migration, backfill, nova tela ou alteração de permissões. Não recalcula valores numéricos de parcelas/desconto: cada extenso deriva do seu próprio valor informado.
6. Testes pertinentes e os quatro gates completos são executados com resultados reais registrados; QA revisa conversão e integração. Após validação, DevOps publica/verifica somente staging, registrando commit/release, READY/SHA/alias e smoke. Checklist e File List refletem os arquivos realmente alterados; nenhuma publicação em produção é incluída.

## Dev Notes e referências

- `src/lib/gerador-documentos/contrato-padrao.ts`, `VARIAVEIS_CONTRATO_PADRAO` e `VALORES_INICIAIS_CONTRATO_PADRAO`: os quatro pares já existem; o desconto é opcional e usa placeholders no modelo padrão. Preservar nomes/contratos e não tratar placeholders como número válido.
- `src/components/GeradorDocumentos/NovoTemplateDialog.tsx` é somente upload, sem valores monetários; `TemplateDetalheClient.tsx` administra definições de variáveis. O template padrão encaminha para geração; preservar esses fluxos sem inventar controles novos.
- `src/components/GeradorDocumentos/GerarDocumentoForm.tsx`: estado `valores`, pré-preenchimento e mudanças de inputs alimentam a geração; manter valores iniciais e mudanças posteriores coerentes.
- `src/actions/gerador-documentos.ts`, `GerarDocumento` e `AtualizarVariaveisContratoPadrao`: atualmente usam as variáveis recebidas sem derivar extenso. `src/app/api/gerador-documentos/gerar/route.ts` e `src/lib/gerador-documentos/render.ts` compõem os caminhos de geração/renderização; UI sozinha não comprova o documento final.
- `src/lib/gerador-documentos/contrato-conferencia.ts` e `src/components/GeradorDocumentos/ConferenciaClient.tsx`: preservar a regra que evita reescrever cláusulas alteradas/IA. O executor confirmou que a edição de variáveis usa `variaveisDefinicoes` nos rascunhos automáticos `__bpmCardId`; não ampliar essa edição para documentos somente leitura.
- `tests/gerador-documentos/contrato-padrao.test.ts`, `contrato-conferencia.test.ts`, `render.test.ts` e `variaveis-conferencia-pdf.test.ts`: bases de regressão. `AGENTS.md` e `package.json`: staging primeiro e comandos dos quatro gates.

**[AUTO-DECISION] Escopo:** usar o pedido direto e os quatro pares já existentes, sem inventar cálculo de parcelas, percentuais ou configuração de fórmulas. O executor define a implementação mínima após o mapeamento. `accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados nas preparações anteriores; contexto nos contratos citados.

## Tarefas / subtarefas

- [x] Registrar requisitos, contratos existentes e aplicar checklist de draft.
- [x] Mapear criação/edição de template, formulário, geração e conferência (AC 1–4).
- [x] Implementar conversão compartilhada e atualização automática dos quatro pares no fluxo real (AC 1–5).
- [x] Testar reais/centavos, zero, singular/plural, alteração/preenchimento inicial, vazio/inválido e documento/conferência (AC 2–5).
- [x] Executar lint, typecheck, suíte completa, build e revisão QA (AC 6; resultados e limitação local documentados, fechamento condicionado ao build remoto padrão).
- [ ] DevOps publicar/validar somente staging; atualizar evidências, checklist, File List e status (AC 6).

## Testing

Usar fixtures dos quatro pares com valores inteiros e centavos, exemplos de singular/plural, zero, formatos aceitos e placeholders vazios/inválidos. Validar mudanças sucessivas sem extenso obsoleto, isolamento dos pares, geração/renderização e conferência com cláusula original versus manual/IA. Não alterar documentos reais para fabricar evidência.

## CodeRabbit Integration

- **Story Type/Agents:** lógica e integração frontend/backend, complexidade média; @dev Pre-Commit, @qa regressões, @devops publicação staging.
- **Gates/Focus:** revisão do diff, quatro gates e CodeRabbit se disponível, registrando ausência/revisão alternativa; Pre-PR se aplicável e conferência de ambiente/release. Foco em parsing monetário, coerência dos pares e preservação de cláusulas/documentos existentes.
- **Self-Healing:** @dev light, 2 iterações/15 minutos para CRITICAL, HIGH documentado; @qa full, 3 iterações/30 minutos para CRITICAL/HIGH, MEDIUM como dívida; @devops check, somente reporte.

## Validação da preparação — @sm

`story-draft-checklist.md` aplicado: objetivo/contexto PASS; orientação técnica PASS; referências PASS; informação autocontida PASS; testes PASS; CodeRabbit PASS. **READY, clareza 9/10.** Nenhuma implementação, teste ou publicação foi executada nesta preparação.

## Dev Agent Record e File List

### Implementação

- Worktree isolada `/home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/documentos-extenso-20261021`, base staging `daf88fb7ab269e78381207e144143a67d604c96b`. Alterações locais alheias e ambientes reais preservados.
- `extenso` fixado em `3.0.0`, sem dependências transitivas; Node local 24.11 e Vercel 24.x compatíveis. Helper puro compartilhado converte moeda BRL, aceita decimal canônico e pt-BR com vírgula, sem arredondar silenciosamente. Distingue zero de vazio/placeholder/inválido; rejeita percentual, notação científica, mais de duas casas, agrupamento ambíguo `1.234` e valores sem apresentação monetária exata no renderer atual.
- Sincroniza somente os quatro pares declarados no template, preservando fontes, flags e demais variáveis. Não calcula parcelas ou desconto. Formulário deriva valores iniciais e atualiza o par junto à digitação; campos por extenso automáticos são somente leitura com indicação do preenchimento automático.
- Geração deriva os extensos antes de validar obrigatórios e alimentar persistência, cláusulas, HTML/PDF. Conferência de rascunhos mantém diferença em relação ao que foi salvo, atualiza pela fonte e sincroniza valores salvos com o retorno do servidor. Documentos finalizados/arquivados permanecem sem modificação.
- Atualização de contrato preserva os valores anteriores brutos usados para detectar cláusulas editadas; ACL, CAS, edição manual/IA e limites atuais de acesso permanecem. Nenhum banco, registro real, permissão, migration ou backfill foi alterado.

### File List

- `docs/stories/story-gerador-documentos-valores-extenso-automaticos.md`
- `package.json`
- `package-lock.json`
- `src/lib/gerador-documentos/valores-extenso.ts`
- `src/components/GeradorDocumentos/GerarDocumentoForm.tsx`
- `src/components/GeradorDocumentos/ConferenciaClient.tsx`
- `src/actions/gerador-documentos.ts`
- `tests/gerador-documentos/valores-extenso.test.ts`
- `tests/gerador-documentos/valores-extenso-react.test.ts`
- `tests/gerador-documentos/gerar-valores-extenso.test.ts`
- `tests/gerador-documentos/variaveis-conferencia-pdf.test.ts`

### Verificação inicial

- `npx vitest run tests/gerador-documentos`: **25 arquivos / 228 testes PASS**, evidência `/tmp/documentos-extenso-modulo-20261021.log`.
- Interações React: **4 testes PASS**, evidência `/tmp/documentos-extenso-react-20261021.log`. Conversão, atualização dos campos, payload de geração, conferência/dirty, somente leitura, cláusulas e PDF exercitados com fixtures; sem mutação de dados reais.
- ESLint dos oito caminhos TypeScript e `git diff --check` aprovados. CodeRabbit ausente; revisão independente QA/Anubis do código e integração aprovadas. Smoke CLI puro aprovado (`node --import tsx`, require do helper): `1500.50`, `0`, `1.234,56` e vazio produziram os textos correspondentes. Quatro gates globais e publicação ainda não concluídos nesta etapa. A execução inicial de typecheck pré-build apontou o bundle de player ainda não gerado e um literal BigInt incompatível com o target; o literal foi corrigido para `BigInt(100)`, com 40 testes do helper e ESLint novamente aprovados. DevOps executa os quatro gates sobre esse snapshot final.

## QA Results

**APPROVED — código, integração e publicação somente staging condicionada ao build remoto padrão**, por QA/Anubis independente. Snapshot final dos 11 caminhos revisado, incluindo compatibilidade TypeScript com `BigInt(100)`. Parsing, quatro pares, estado/dirty, geração e atualização até HTML/PDF aprovados; ownership/ACL/CAS e cláusulas manuais/IA preservados. Resultados dos gates e ratificação incremental registrados abaixo; fechamento permanece condicionado ao build remoto padrão READY e smoke. Sem autorização de produção.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-21 | 0.1 | Preparação da automação dos quatro valores por extenso | River (@sm) |

### Blueprint de integração — Scout

- [x] Consultados cadastro de template por upload, editor de variáveis, formulário de geração, conferência e actions de persistência/renderização.
- [x] Consultados registry/menu/permissão existente `geradorDocumentos`, rotas App Router e controles de ownership. Nenhuma nova entrada ou mudança de autorização necessária.
- [x] Precedente: helpers puros `render.ts` e `contrato-conferencia.ts`, consumidores de estado e testes existentes do módulo.
- [x] Criar helper puro `src/lib/gerador-documentos/valores-extenso.ts`, utilizável também via CLI/testes, e integrar consumidores/actions existentes.
- [x] Adicionar dependência `extenso` fixada em versão validada e regressões de conversão/interação/persistência. Node local 24.11 e Vercel 24.x compatíveis com extenso 3.0.0 (requer >=22.20).
- [x] Nenhuma migration, rotina de backfill ou mutação de registros reais necessária.

## Gates e integração do candidato de staging

- Staging avançou de `daf88fb7` para `bfff9d3674156f12ae8d90ec8cd3ea6d5de8bbc4` durante o desenvolvimento. DevOps integrou por FF sem sobreposição; dez caminhos concorrentes Instagram/Sheets foram preservados byte a byte. QA ratificou independentemente os dez hashes de fontes/dependências/testes da entrega e o escopo exato de 11 caminhos, sem alteração lógica.
- **Lint completo integrado:** `npm run lint` PASS, zero erros e 1.193 avisos preexistentes.
- **Build local padrão:** `npm run build` com limite versionado de 3 GB **falhou** por heap/OOM e SIGABRT, sem erro de fonte apontado. Log `/tmp/documentos-extenso-20261021-build.log`. Este resultado não é declarado como PASS.
- **Compilação equivalente:** executadas novamente as mesmas etapas `prisma generate`, `npm run build:player` e `next build --webpack`, com única diferença `NODE_OPTIONS=--max-old-space-size=6144` para Next: **PASS**. Nenhum script/configuração/dependência foi alterado para contornar o limite. Comandos completos e log em `/tmp/documentos-extenso-20261021-gates.json` e `/tmp/documentos-extenso-20261021-build-6144.log`.
- **Typecheck pós-build:** `npm run typecheck` PASS.
- **Suíte completa:** `npm test` PASS, **707 arquivos / 5.525 testes**, 4 ignorados e 1 todo. Logs `/tmp/documentos-extenso-20261021-typecheck.log` e `/tmp/documentos-extenso-20261021-tests.log`.
- Fontes permaneceram congeladas: snapshot SHA256 `6ea7d3fc6f7ab2373da537318be93461a0e4fa982e43f8b5536589eabd6768b8`; evidências `/tmp/documentos-extenso-20261021-gates.json`, `gates-progress.json` e `upstream-integration.json` com o mesmo prefixo. Auditoria incremental não adicionou advisories; achados herdados registrados em `audit-comparison.json` com o mesmo prefixo.
- QA aprovou código, integração e publicação somente em staging após ratificação dos resultados locais e do limite de heap. **Fechamento da entrega exige build padrão remoto Vercel READY, SHA/alias corretos e smoke**, mantendo documentada a falha local de 3 GB. Produção não autorizada.

### Integração final e liberação para publicação

- Novo avanço concorrente preservado: base final `71e3f06fed6890ef346ead946711ea37bcdc4fd3`. Os 11 caminhos alheios foram mantidos integralmente, sem sobreposição com os 11 desta story. As dez fontes/dependências/testes próprios permanecem byte a byte iguais ao snapshot aprovado.
- QA conferiu os gates próprios de `71e3f06f` e sua integração com `bfff9d36`, além dos hashes de ambas as entregas. Ratificou herança de lint para mudanças disjuntas e dispensou repetição sem motivo concreto de lint completo/build local de 6 GB. Evidências: `/var/tmp/alpha-crm-contrato-elaboracao-20261021/forge/forge-result.json` e `release/delta-bfff-result.json` sob a mesma pasta.
- **Verificações do candidato final integrado:** `npm run typecheck` PASS e `npm test` PASS, **709 arquivos / 5.614 testes**, 4 ignorados/1 todo. `/tmp/documentos-extenso-final-20261021-gates.json`, `/tmp/documentos-extenso-final-20261021-typecheck.log` e `/tmp/documentos-extenso-final-20261021-tests.log`.
- Não foi executado novo build local sobre `71e3f06f`; o build equivalente de 6 GB sobre `bfff9d36` permanece evidência histórica. A validação da compilação do commit final será o **build padrão remoto Vercel**, que deve atingir READY antes do fechamento. A falha local padrão de 3 GB não é apresentada como aprovação.
- **Liberação:** QA aprovou a etapa de commit/push e publicação somente staging com essa condição; checklist/File List e evidências locais atualizados. Sem produção autorizada, alteração de configuração ou mutação de dados reais.
