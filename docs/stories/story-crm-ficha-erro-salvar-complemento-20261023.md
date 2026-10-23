# Story — Corrigir erro ao salvar complemento da ficha

## Status

Ready for Review — QA LOCAL APPROVED / GO para staging. Typecheck, lint, 29 suites afetadas e build literal aprovados. **Validação LIVE do Root após a publicação ainda pendente**; não é aprovação final do caso remoto. Produção não autorizada.

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["reprodução e diagnóstico sanitizado", "regressão SQLite/PDF/React", "npm run lint", "npm run typecheck", "npm test", "npm run build", "caso controlado no staging"]

## Story e contexto

Como usuário do CRM, quero salvar um e-mail válido ao complementar a ficha de análise de viabilidade, para manter o documento e seus dados atualizados sem perder o preenchimento.

Relato: no modal Complementar Ficha da empresa de teste **TESTE INSTAGRAM - Fluxo NoLoss CRM (STAGING)**, alterar o e-mail e clicar em Salvar apresenta **“Não foi possível atualizar a ficha de análise de viabilidade.”** A funcionalidade foi entregue na story `story-crm-ficha-viabilidade-automatica-20261023.md`; este bug corrige o salvamento, preservando seu contrato.

Base inicial: `origin/staging` em `8df868a2`, worktree isolado `crm-ficha-salvar-erro-20261023`. O caso foi reproduzido pelo Root em navegador Admin: Salvar devolveu a mensagem genérica em cerca de 1.182 ms, com rascunho preservado. **Causa comprovada:** o salvamento tentava criar novamente um lease persistido antes de recuperar o recurso expirado por CAS. A unicidade de `BpmAutomacaoLease.recurso` é reportada pelo adapter Turso HTTP como `DriverAdapterError`, sem `P2002`; o tratamento anterior abortava antes do CAS. A primeira geração podia funcionar e o complemento seguinte falhava. A reprodução do lease manteve o registro antes/depois idêntico, sem mutação confirmada. As hipóteses iniciais de timeout/latência não foram adotadas como causa nem motivaram relaxamento de limites ou permissões. Evidências privadas: `backend/repro-lease.json` e `browser/save-before-fix.private.json`, em `/var/tmp/alpha-crm-ficha-salvar-erro-20261023/`.

## Acceptance Criteria

1. Reproduzir o erro e identificar a causa com evidência verificável do caminho de salvamento. Registrar diagnóstico sanitizado suficiente para distinguir validação, permissão, conflito, geração/upload e persistência; não expor e-mail, conteúdo da ficha, credenciais, tokens ou stack interno ao usuário.
2. Um usuário autorizado consegue alterar o e-mail para um valor válido e salvar. O snapshot confirmado persiste, reabrir Complementar Ficha mostra o valor salvo e o PDF atualizado corresponde aos dados confirmados, mantendo o mesmo anexo vinculado ao card/empresa. Não cria anexos atuais duplicados nem exige atualizar cadastros paralelos.
3. Durante processamento, impedir submissão repetida; em erro ou conflito, manter modal e rascunho, mostrar feedback adequado e preservar a última ficha válida. Não apresentar sucesso antes do commit nem substituir silenciosamente uma revisão mais recente.
4. Preservar sessão, validação de entrada, autorização canônica de leitura/edição, mesma empresa, revisão esperada, lease/fencing e confirmação atômica de snapshot/anexo/intenção. A correção não resolve a falha removendo guardas ou permitindo gravação parcial.
5. Adicionar regressão que cubra a causa confirmada e o salvamento com e-mail válido, persistência/reabertura e PDF correspondente. Executar testes relevantes com SQLite/PDF reais e fronteiras externas controladas; registrar limites e resultados dos gates do projeto. Após publicar a correção no staging, validar o caso controlado no card de teste, diferenciando essa evidência dos testes locais. Nenhum dado real ou segredo entra nas fixtures/logs versionados.
6. Publicar automaticamente somente no staging, pelo DevOps após os gates. Não alterar schema, executar migration/backfill/mutação em massa, modificar env remoto ou publicar em produção. Preservar entregas concorrentes e o restante da ficha automática, dos anexos e da Pré-Análise.

## Tasks / Subtasks

- [x] Registrar relato, escopo, precedentes e critérios testáveis antes da correção (AC 1–6).
- [x] Reproduzir e correlacionar action/serviço/log sanitizado; confirmar causa (AC 1).
- [x] Implementar a correção mínima preservando validações, rascunho e invariantes transacionais (AC 2–4).
- [x] Acrescentar regressão meaningful do erro confirmado e verificar salvamento/persistência/PDF (AC 2–5).
- [x] Executar gates, revisão independente e atualizar File List/checklist/evidências reais (AC 5–6).
- [ ] Commit/push staging pelo DevOps e verificar a versão publicada (AC 6).
- [ ] Root validar LIVE após publicar: salvar o e-mail de teste, reabrir modal, conferir texto do PDF e anexo único, salvar/restaurar o valor original e conferir novamente (AC 2, 5).

## Dev Notes

- Referência normativa: `docs/architecture/crm-ficha-viabilidade-automatica-20261023.md`, seções **Persistência sem alteração de schema** e **Contrato backend/frontend**. O complemento usa `SalvarComplementoFichaViabilidadeBpm({cardId, expectedRevision, extras})`; identidade/empresa/autor são conferidos no servidor, arquivo privado por versão e troca transacional do mesmo anexo/snapshot com CAS.
- Caminhos existentes a investigar, sem presumir que todos precisarão de edição: `src/actions/bpm/FichaViabilidade.ts`, `src/lib/bpm/ficha-viabilidade-automatica-server.ts`, `src/lib/bpm/ficha-viabilidade-documento.ts`, `src/components/bpm/anexos/AnexosComFichaCard.tsx` e `src/components/ModalPdf.tsx`. A mensagem genérica não prova por si só a origem da exceção.
- A ficha usa o mesmo modelo/modal da Pré-Análise. Complementar não deve chamar `upsertConsulta` nem sobrescrever campos canônicos da empresa/card. Reentrada permanece ensure estrito, sem gerar outra versão sobre o complemento confirmado. [Source: docs/architecture/crm-ficha-viabilidade-automatica-20261023.md#contrato-backendfrontend]
- Testes precedentes: `tests/bpm/ficha-viabilidade-automatica-sqlite.test.ts`, `tests/bpm/ficha-complementar-modal-react.test.tsx` e `tests/bpm/ficha-anexos-complemento-react.test.tsx`. Cobrir a causa real; não adicionar teste que apenas espelhe uma linha ou relaxar assertions/timeouts para esconder a falha.
- `accumulated-context.md`, `.Codex/commands/AIOX/agents/sm.md` e `.aiox/gotchas.json` não estão disponíveis neste checkout; contexto cruzado obtido da story/contrato anteriores e usado fallback `.aiox-core/development/agents/sm.md`. Projeto mantém Next.js/TypeScript/Prisma e regras AGENTS; não há requisito de nova dependência ou infraestrutura.

[AUTO-DECISION] Ampliar o escopo ou pedir nova confirmação para corrigir o bug? → Corrigir dentro do fluxo já solicitado e autorizado, sem nova feature ou promoção de produção. Causa deve ser comprovada antes de escolher a alteração.

## Testing

Reproduzir o caso controlado antes/depois e conservar diagnóstico privado. Validar e-mail válido salvo no snapshot, reabertura e PDF; sessão/permissão recusada, revisão obsoleta, falha de persistência/upload e preservação da versão anterior continuam cobertos. Rodar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` conforme AGENTS/Constitution e documentar precisamente qualquer composição autorizada ou limitação; não declarar E2E remoto a partir de mocks. O ensaio live fica restrito ao staging e ao card de teste, sem enviar e-mails/convites ou criar dados em massa como parte da correção.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** API/Integration, secundário Frontend; complexidade média pelo salvamento de documento privado com transação e revisão.
- **Specialized Agents:** `@dev` executor/pre-commit; backend diagnostica e corrige, frontend somente se necessário; `@qa` valida regressão e integridade; DevOps consulta logs e publica staging.
- **Quality Gates:** Pre-Commit obrigatório com testes/gates, diff e revisão de autorização/atomicidade; Pre-PR somente se houver PR; produção fora do escopo. Se CodeRabbit não estiver instalado, usar fallback configurado em `core-config.yaml`, registrar indisponibilidade e revisão manual sem presumir execução.
- **Self-Healing:** `@dev` light até 2 iterações/15 min para CRITICAL, HIGH documentado; `@qa` full até 3 iterações/30 min para CRITICAL/HIGH, MEDIUM como dívida; DevOps check/report only.
- **Focus Areas:** causa comprovada, diagnóstico sem PII/segredos, persistência e PDF coerentes, mesmo anexo, ACL/CAS/fencing/atomicidade, erro sem perda de rascunho e nenhuma regressão da Pré-Análise.

## Story Draft Checklist

**READY** — validação YOLO com `.aiox-core/product/checklists/story-draft-checklist.md`: objetivo/contexto PASS; orientação técnica PASS; referências PASS; autossuficiência PASS; testes PASS; CodeRabbit PASS. O rascunho não presumiu a causa; ela foi comprovada posteriormente e o diagnóstico está registrado acima. Aprovação da story não equivale ao veredito QA ou à validação live pós-publicação.

## Dev Agent Record / File List

### Completion Notes

- Correção: recuperar primeiro por CAS o lease expirado; criar quando o recurso ainda não existe e classificar somente a disputa de unicidade do recurso esperado. Outras falhas de adapter/SQL continuam propagadas. Lease ativo não é tomado por outra execução; revisão/fencing e confirmação atômica permanecem.
- A action passa a registrar metadados diagnósticos sanitizados, preservando erro seguro ao cliente. Não registra e-mail/snapshot/segredos e não muda contrato de autorização.
- Handoff `backend/handoff.json`: quatro caminhos de código/testes estáveis; 3 arquivos/25 testes focados PASS em 4,84 s. Regressões SQLite cobrem duas rodadas de salvamento com e-mail válido, recurso ocupado e falha de infraestrutura; o teste novo Hrana exercita o cliente/decoder HTTP real em respostas controladas, incluindo colisão específica sem P2002 e negativas que devem propagar.
- Não houve mudança de timeout, ACL, revisão, schema ou ambiente remoto. As demais fontes permanecem iguais à base `8df868a2`. QA LOCAL APPROVED: typecheck global PASS57,83s; lint global PASS51,61s; **29 arquivos afetados/349 testes PASS20,50s**; build literal `npm run build` PASS114,84s. Não se apresenta a rodada direcionada como execução da suíte global inteira. Os 3.083 hashes de fonte permaneceram inalterados; os dois includes temporários criados pelo Next foram restaurados. Gate: `docs/qa/gates/crm-ficha-erro-salvar-complemento-20261023.yml`.
- **LIVE após a correção ainda pendente.** A reprodução em navegador acima é do erro antes do fix. Root deve testar depois do deploy no card controlado: salvar, reabrir, verificar conteúdo do PDF/anexo único e restaurar/conferir o valor original. Testes locais e Blob/HTTP simulados não substituem essa comprovação remota. Publicação staging e produção não são declaradas concluídas neste checkpoint.

### File List

- `.bibble/memory/codebase-map.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/journal.md`
- `docs/qa/gates/crm-ficha-erro-salvar-complemento-20261023.yml`
- `docs/stories/story-crm-ficha-erro-salvar-complemento-20261023.md`
- `src/actions/bpm/FichaViabilidade.ts`
- `src/lib/bpm/ficha-viabilidade-automatica-server.ts`
- `tests/bpm/ficha-viabilidade-automatica-sqlite.test.ts`
- `tests/bpm/ficha-viabilidade-lease-http.test.ts`

## QA Results

### Revisão Quinn — 2026-10-23 — APPROVED local para staging

- **Causa confirmada:** reprodução autenticada Admin antes do fix e chamada controlada no staging demonstraram `DriverAdapterError` sem `P2002` na UNIQUE de `BpmAutomacaoLease.recurso`. O recurso liberado permanecia inalterado; não há evidência de timeout como causa deste erro.
- **Correção revisada:** reutilização CAS do recurso expirado antes de CREATE, incremento e conferência de fencing/titular; somente a disputa exata do recurso é reconhecida como concorrência. Constraints diferentes/falhas de conexão propagam erro. Action registra operação/tipo/código sem mensagem, stack ou dados da ficha.
- **Forge executado nesta árvore:** `npm run typecheck` global PASS; `npm run lint` global PASS; `npm test -- --coverage.enabled=false --maxWorkers=1` com **29 suites afetadas / 349 testes PASS / zero falhas**; `npm run build` literal webpack PASS em **114.84s**. Escopo proporcional autorizado pelo root: ficha/HTTP/SQLite/PDF/modal/anexos/navegação/entrada/movimento/Pré-Análise. Não foi repetida a suíte inteira; os 6.399 testes históricos da entrega anterior não são apresentados como rerun deste bug. Dois avisos preexistentes de require dinâmico em `bibble/pdfjs-polyfill.ts`, sem erro de build.
- **Sage/Probe/Anubis/Lens:** APPROVED após Forge. Decoder HTTP instalado recebe Hrana real sem rede; duas alterações de e-mail via action salvam e reabrem com revision 2/3 e fencing 2/3 sem novo CREATE, PDF real contém o último e-mail e existe um único anexo. Lease ocupado permanece BUSY, erros diferentes não são absorvidos, logger sanitizado e regressões de conflito/rollback/rascunho permanecem PASS. Sessão/Zod/ACL, mesma empresa, CAS e transação atômica de documento preservados.
- **Integridade:** 3083 arquivos de runtime/testes/schema/config sob hash, todos idênticos antes/depois dos gates após restauração guardada de eventuais includes gerados pelo Next. Sem mudança de schema, pacote, env remoto ou produção. CodeRabbit/WSL/CLI local indisponíveis; fallback manual configurado realizado.
- **Gate:** `docs/qa/gates/crm-ficha-erro-salvar-complemento-20261023.yml`; evidência privada `/var/tmp/alpha-crm-ficha-salvar-erro-20261023/qa/qa-local-final.json`.
- **Aceite remoto ainda pendente:** aprovação local permite publicação somente no staging. Após deployment READY, root deve executar Save real no Admin do caso controlado, reabrir e conferir e-mail/PDF, confirmar anexo único e restaurar o e-mail original por Save. Não declarar AC 5/bug remoto concluído a partir de mocks; QA não realizou operações remotas nem commit/push.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-23 | 1 | Bug de salvamento registrado; critérios/limites e checklist READY; causa não presumida. | River / SM |
| 2026-10-23 | 2 | Causa lease/adapter comprovada; CAS-first e regressões focadas; QA local e live pós-deploy pendentes. | River / SM |
| 2026-10-23 | 3 | QA LOCAL APPROVED, tipos/lint/349 testes/build PASS; File List9; LIVE Root após publicar permanece pendente. | River / SM |
