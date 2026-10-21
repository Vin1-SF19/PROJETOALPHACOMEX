# Story — Corrigir falha ao salvar dados e atualizar PDF do documento

## Status

Ready for Review — causa reproduzida, patch mínimo e regressões aprovados por QA; quatro gates reais PASS. Publicação e READY/SHA/alias/smoke de staging pendentes.

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["reprodução e diagnóstico sanitizado", "regressão causal", "npm run lint", "npm run typecheck", "npm test", "npm run build"]

## Story

Como usuário autorizado do Gerador de Documentos, quero abrir um documento já gerado, alterar seus campos editáveis e salvar os dados com PDF atualizado, preservando as regras existentes de edição e conferência.

Relato recebido após a entrega de extenso automático em staging: **“Não foi possível atualizar o PDF. Os dados do contrato não foram salvos; tente novamente.”** Assumir staging para iniciar a investigação, enquanto o executor confirma o ambiente/release real; não afirmar causa nem atribuir a falha ao extenso antes do diagnóstico. Esta correção publica **somente em staging**; produção não autorizada. Nenhum teste altera documentos reais ou o banco real.

## Acceptance Criteria

1. O diagnóstico confirma ambiente/release e caminho efetivo do relato: abertura do documento, alteração de campos e salvamento. Identifica a exceção original e a etapa que falha, com evidência sanitizada de logs e reprodução isolada; a mensagem genérica não comprova causa. Se faltar evidência ou reprodução, registrar a lacuna sem declarar causa confirmada.
2. A reprodução usa documento/variáveis/cláusulas sintéticos com condições relevantes equivalentes ao caso, sem editar, gerar uploads públicos ou salvar documentos reais. IO externo e banco são simulados; usar o renderer real quando essencial para reproduzir ou distinguir a causa de uma falha mascarada por mock de PDF.
3. A implementação mínima corrige a causa comprovada no fluxo real. Uma alteração válida e autorizada salva dados/cláusulas aplicáveis e disponibiliza o PDF atualizado de forma coerente, com o resultado exibido pela conferência. Falhas técnicas continuam retornando erro seguro e não são convertidas em falso sucesso.
4. Preservam-se ACL, CAS/concorrência, status somente leitura/finalizado/arquivado, atomicidade entre dados e referências de arquivos e regras de sincronização de cláusulas editadas manualmente/IA. Se PDF/upload/persistência falhar, não ocorre salvamento parcial indevido nem se declara que os novos dados foram salvos. A correção não relaxa essas proteções para contornar o sintoma.
5. O extenso automático já entregue dos valores total, inicial, final e desconto permanece funcionando no formulário, atualização de variáveis e documento final. A correção não modifica documentos anteriores em lote, não acrescenta campos/schema/migration nem muda permissões ou o escopo de documentos editáveis.
6. A regressão causal falha antes e passa após a correção, cobrindo salvamento válido e falhas/negações pertinentes ao diagnóstico; verifica também preservação de cláusulas e rejeição de conflito. Lint, typecheck, suíte completa de testes e build são executados, com resultados reais registrados; QA revisa causa, correção e limites da evidência.
7. Após aprovação, DevOps publica/verifica somente staging, preservando mudanças concorrentes e configurações/banco de produção. Registra commit/release, READY/SHA/alias e smoke, distinguindo disponibilidade/proteção de acesso de teste funcional autenticado. Nenhum documento real é alterado para fabricar evidência.
8. Checklist e File List são atualizados com causa confirmada, caminhos alterados, logs sanitizados, testes/releases e limitações. Não alegar reprodução, sucesso autenticado ou publicação apenas com base em código local ou resultado de testes que simulam o componente causador.

## Dev Notes e referências

- `src/actions/gerador-documentos.ts`, `AtualizarVariaveisContratoPadrao`: fronteira do sintoma; o catch registra `[GeradorDocumentos] Falha ao atualizar dados do contrato e PDF:` e traduz erro genérico para a mensagem recebida. Inspecionar o erro original e as etapas de renderização/upload/transação antes de escolher a solução.
- `src/components/GeradorDocumentos/ConferenciaClient.tsx`, ação de salvar variáveis: chama a action e apresenta `resultado.error`; confirmar o payload e a condição de edição sem expor conteúdo real nos registros de diagnóstico.
- `src/lib/gerador-documentos/contrato-conferencia.ts`, `pdf.tsx`, `pdf-renderer.tsx`, `render.ts` e `html-render.ts`: contratos existentes para sincronização/renderização; seguir apenas os caminhos que a reprodução demonstrar relevantes.
- `tests/gerador-documentos/variaveis-conferencia-pdf.test.ts`: cobertura atual da action simula `gerarPdfDocumento`, Blob e banco; não comprova funcionamento do renderer com o payload real do fluxo. `pdf-renderer.test.ts`, `contrato-conferencia.test.ts` e demais testes pertinentes são bases de regressão.
- `docs/stories/story-gerador-documentos-valores-extenso-automaticos.md`, implementação/publicação: registra a entrega staging `86858e7e` e o helper compartilhado de extenso. Confirmar o snapshot remoto atual antes de reproduzir; o checkout compartilhado não é prova da versão que apresentou a falha. Não remover o comportamento já aprovado por suposição causal.
- `AGENTS.md`, Quality Gates/Fluxo de ambientes/Database Safety and Backup Policy: staging primeiro, produção requer novo pedido explícito e operações de banco abrangidas mantêm gate Vault. `package.json`, scripts: quatro gates reais. Não há mudança de banco prevista nesta correção.

**[AUTO-DECISION] Escopo:** usar o relato direto como origem, sem inventar causa, solução, epic ou nova operação de banco. Investigar staging enquanto o ambiente é confirmado; qualquer diferença de versão deve constar na evidência. `accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados nas preparações anteriores; contexto cruzado na story de extenso e contratos citados.

## Tarefas / subtarefas

- [x] Registrar mensagem exata, hipótese de ambiente, limites e aplicar checklist de draft.
- [x] Coletar erro original e ambiente/release dos registros encontrados; documentar a ambiguidade do endereço relatado, sem atribuir registro real arbitrariamente (AC 1).
- [x] Reproduzir com fixtures, SQLite isolado e renderer real; documentar causa e limites de correlação com o relato (AC 1–2).
- [x] Implementar correção mínima comprovada preservando ACL/CAS/readonly/cláusulas/extenso (AC 3–5).
- [x] Acrescentar regressão causal e testar sucesso, falha técnica, negações e concorrência pertinentes (AC 6).
- [x] Executar quatro gates completos e revisão QA (AC 6).
- [ ] DevOps publicar/verificar somente staging; registrar versão/smoke/limitações (AC 7).
- [ ] Atualizar causa, File List, checklist, status e evidências reais (AC 8).

## Testing

Priorizar o cenário que explica a falha, incluindo o renderer real se um mock esconder a causa. Usar conteúdo sintético, armazenamento e banco simulados, sem publicar dados ou arquivos reais. Verificar retorno, dados/referências consistentes, PDF atualizado válido, falha sem salvamento parcial, ACL, conflito CAS e documentos somente leitura. Preservar extensos automáticos e cláusulas manual/IA. Smoke remoto não substitui reprodução funcional e não autoriza mutação de documento real.

## CodeRabbit Integration

- **Story Type/Agents:** diagnóstico/correção com integração backend/frontend; complexidade a confirmar; @dev Pre-Commit, @qa causalidade/regressões, @devops release staging.
- **Quality Gates/Focus:** revisar diff, reprodução, quatro gates e CodeRabbit se disponível, registrando ausência/revisão alternativa; Pre-PR se aplicável e conferência de ambiente antes do deploy. Foco em causa demonstrada, renderer/IO, atomicidade, ACL/CAS, readonly, cláusulas e extenso preservados.
- **Self-Healing:** @dev light, 2 iterações/15 minutos para CRITICAL, HIGH documentado; @qa full, 3 iterações/30 minutos para CRITICAL/HIGH, MEDIUM como dívida; @devops check, somente reporte.

## Validação da preparação — @sm

`story-draft-checklist.md` aplicado: objetivo/contexto PASS; orientação técnica PASS; referências PASS; informação autocontida PASS; testes PASS; CodeRabbit PASS. **READY, clareza 9/10.** Diagnóstico é tarefa explícita; esta preparação não comprova causa, teste ou publicação.

## Dev Agent Record e File List

### Diagnóstico e limites

- Usuário identificou o nome genérico do modelo `CONTRATO DE PRESTAÇÃO DE SERVIÇOS` e disse “painel alpha”, sem confirmar domínio/identificador único. O executor informou inicialmente a interpretação de produção; buscas foram feitas separadamente em ambos os ambientes. Nenhum documento foi selecionado por nome, alterado ou gerado para teste em ambiente real.
- Duas falhas da action foram encontradas no **staging**, deployment `dpl_BpoNgEB6EYbysR5kxMkamiZXbV4L` / commit `86858e7e`, às **20:51:37.740 e 20:51:46.509 UTC**, com Prisma **P2010 / SQLITE_UNKNOWN: no such column: htmlUrl**. Não há correlação suficiente para atribuir essas tentativas a um usuário/documento específico. Busca separada de produção não retornou erro equivalente na janela consultada; isso não comprova ausência fora da janela.
- A consulta opcional `SELECT "htmlUrl"` sem qualificação pode ser interpretada como literal quando a coluna está ausente e SQLite usa DQS. O probe concluía indevidamente que a coluna existia, e a atualização posterior dentro da transação falhava, revertendo o salvamento dos dados/referências. O mesmo padrão aparece em seis consultas opcionais do arquivo da action. [Comportamento documentado pelo SQLite](https://www.sqlite.org/quirks.html#double_quoted_string_literals_are_accepted).
- Reprodução isolada com SQLite in-memory **DQS ligado**, action, DOCX e renderer PDF reais: **12 testes, 1 falha / 11 aprovados antes da correção**. A falha única sem coluna reproduziu a mensagem exata do usuário e erro de coluna inexistente. Com DQS desligado ou coluna presente, o fluxo funcionou. Evidência `/tmp/documentos-pdf-save-regressao-antes-20261021.log`.
- Causa demonstrada é a verificação de compatibilidade com coluna opcional; não há evidência de falha de fonte, conversão por extenso ou credencial como causa destes registros. Proteções de acesso, CAS e regras de cláusulas não são removidas. Não é necessária alteração estrutural de banco.
- Evidências sanitizadas fora do Git: `/tmp/documentos-pdf-save-20261021-runtime-sanitizado.json`, `/tmp/documentos-pdf-save-20261021-production-sanitizado.json` e `/tmp/documentos-pdf-save-20261021-diagnostico-readonly.json`. Logs brutos privados; sem identificadores de documentos/usuários ou credenciais nesta story.

### Integração e implementação

- Worktree isolada `/home/ialpha/projetos/alpha-comex/painel-alpha-worktrees/documentos-pdf-save-20261021`, base `aa8b6a6a`; runtime igual à entrega `86858e7e`, com cinco mudanças documentais/memória adicionais preservadas. Dependências e cache independentes, ambiente sintético para gates; root/envs reais preservados.
- Qualificados os seis identificadores opcionais como coluna da respectiva tabela (`DocumentoGerado` ou `DocumentoTemplate`), preservando bindings, fallback, transações e comandos de atualização. Corrige o mesmo mecanismo no salvamento/conferência, edição e leitura existentes. Nenhum campo novo, migration ou mutação de dados reais.

### File List

- `docs/stories/story-gerador-documentos-erro-salvar-pdf.md`
- `src/actions/gerador-documentos.ts`
- `tests/gerador-documentos/salvar-variaveis-pdf-sqlite.test.ts`

## QA Results

**APPROVED — código e regressões**, por QA/Anubis independente. Seis SELECTs qualificados e 24 casos novos revisados, incluindo SQLite DQS, PDF real, rollback, cláusulas manuais/IA, extensos e negações. Ajuste posterior restrito à tipagem de spies ratificado, com produto inalterado. Gates locais concluídos abaixo; publicação e validação remota de staging ainda pendentes.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-21 | 0.1 | Preparação do diagnóstico da falha ao salvar dados/PDF | River (@sm) |

### Verificação após a correção

- Patch de produto restrito a **seis qualificações de SELECT** em um arquivo; comandos de atualização, binds, fallbacks e proteções permanecem. Não há novo helper, dependência, configuração ou alteração estrutural de banco.
- **Módulo completo: 26 arquivos / 252 testes PASS**, incluindo 24 casos novos, em `/tmp/documentos-pdf-save-modulo-depois-20261021.log`. ESLint dos dois arquivos TypeScript e diffcheck aprovados; `/tmp/documentos-pdf-save-eslint-20261021.log`. CodeRabbit indisponível; revisão independente QA solicitada.
- A regressão usa SQLite in-memory com transações reais e SQL parametrizado da action, DQS ligado/desligado e coluna ausente/presente, DOCX/fontes/renderer PDF reais. Confere dados/referências, extensos e preservação de cláusulas, com armazenamento Blob simulado. Há matriz SQL das duas tabelas com coluna ausente/nula/preenchida, e cobertura de erro de PDF/upload, CAS de documento/cláusula, ownership e status finalizado/arquivado. Requisições externas bloqueadas no teste; apenas data URI local do WASM do renderer é permitida.
- Relatório e decisões: `/tmp/documentos-pdf-save-dev-report-20261021.md`; quatro gates completos e publicação ainda em andamento, sem sucesso remoto autenticado alegado.

## Gates finais do candidato

- Base final preservada `aa8b6a6ab814f5840c1a05ca68c41face83ed1b7`; escopo de três caminhos, sem alteração em dependências, configuração ou schema.
- **`npm run lint`: PASS**, zero erros / 1.193 avisos preexistentes.
- **`npm run build`: PASS**, pipeline padrão completo com heap versionado de 3 GB; nenhum retry de 6 GB ou alteração de configuração necessário.
- **`npm run typecheck`: PASS**, após build. A execução inicial identificou dois erros apenas nos tipos dos spies do novo teste (TS2344/TS7006); corrigidos com `MockInstance` tipado. QA conferiu que essa mudança apaga-se em runtime, mantendo válido o build/lint anteriores e o código de produto idêntico. Teste focado de 24 casos e ESLint novamente PASS. A falha inicial está preservada como substituída pelo reteste, não como aprovação.
- **`npm test`: PASS**, **710 arquivos / 5.638 testes**, 4 ignorados / 1 todo.
- Evidências completas `/tmp/documentos-pdf-save-20261021-gates.json`, `gates-progress.json`, `lint.log`, `build.log`, `typecheck-initial.log`, `typecheck.log` e `tests.log`, todos sob o mesmo prefixo `/tmp/documentos-pdf-save-20261021-`. Snapshot SHA256 `cfdaad22477c4e22e81b109af987f2be6240f1d2dbb1a8748ca468ccadfce1d3`; fontes e teste finais preservados.
- Checklist/File List atualizados antes do commit. Após ratificação dos gates por QA, DevOps publicará **somente staging**, exigindo READY/SHA/alias e smoke antes de concluir. Nenhum documento real é editado para teste, e produção não está autorizada.
