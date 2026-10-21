# Story — Adicionar Lider Operacional com consistência no Painel Alpha

## Status

Ready for Review — QA/Anubis, gates completos e cadastro pontual de staging aprovados. Release staging e gates próprios de main/produção em acompanhamento.

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["inventário SELECT por ambiente", "npm run lint", "npm run typecheck", "npm test", "npm run build", "revisão ACL e release"]

## Story

Como gestor do Painel Alpha, quero adicionar/reconhecer o setor **Lider Operacional** nos catálogos, listas e configurações de permissão por setor aplicáveis, para administrar esse grupo pelos fluxos existentes.

Correção explícita do usuário: **“cara e lider operaciona, o lider comercial ja existe”**. O alvo confirmado é **Lider Operacional**. **Lider Comercial permanece existente e preservado**; não renomear nem remover esse setor ou seus acessos. A autorização para staging e depois main/produção persiste nesta entrega corrigida. O cadastro único solicitado pelo CRUD normal está autorizado conforme relatório Vault abaixo; migrations, seeds automáticos e operações em massa continuam sujeitos ao gate específico de banco.

## Acceptance Criteria

1. O inventário verifica por **SELECT direto**, separadamente em staging e produção, a existência, atividade e identidade equivalente do setor/papel `Lider Operacional`, sem gravar dados nem chamar leitores que fazem upsert. O resultado sanitizado diferencia setor inexistente, existente ou divergente; nenhuma dessas condições é presumida.
2. O código reconhece a identidade canônica **`Lider Operacional`** nos catálogos, cadastros, filtros, seletores e configurações de permissão por setor pertinentes em todo o painel, cobrindo os mesmos pontos transversais aplicáveis auditados no precedente comercial. Variações de caixa/acentos não criam identidades duplicadas; demais setores e rótulos/vínculos legados continuam preservados.
3. UI, validação e backend reconhecem a mesma identidade ao selecionar, carregar configuração e salvar por fluxos autorizados. A resolução de permissões segue as configurações efetivas/overrides existentes. Não se copiam ACLs comerciais nem se concede bypass Admin/CEO/TI, acesso global, supervisão CRM ou privilégios específicos de módulos apenas pelo nome do novo setor.
4. São preservados `Lider Comercial`, `OPERACIONAL` e os demais setores, usuários, associações, permissões e limites de quem pode gerir acessos. Não há reatribuição automática de usuários nem concessão em lote. Listas restritas por função não são convertidas em catálogos gerais indiscriminadamente.
5. Se o SELECT confirmar ausência, o **cadastro único de `Lider Operacional` e sua categoria padrão pelo mesmo serviço CRUD normal**, acionado explicitamente por CLI confiável idempotente, pode seguir a autorização do usuário: Vault o enquadrou na exceção expressa de CRUD do `AGENTS.md`, sem nova confirmação ou backup por operação. Reutilizar o corpo de `criarSetor` em serviço `server-only`, preservando `requireAdmin` na action autenticada. Verificar equivalência/alias antes de criar e, se já existir, não duplicar, renomear ou reativar. Não criar permissões, vínculos ou reatribuições. **Não adicionar o setor a `ensureSetorBase` nem criar seed automático.** Migration/schema, seed automático, backfill ou mutação em massa continuam aguardando Vault, explicação, backup completo verificado de até 48 horas e confirmação explícita específica.
6. Regressões cobrem identidade canônica do novo setor, presença nas listas aplicáveis, persistência pelo contrato autorizado em testes isolados, ausência de duplicata e negações de acesso/gestão; confirmam preservação do Comercial e demais setores. Lint, typecheck, suíte completa de testes e build são executados com resultados reais registrados; QA revisa consistência e ausência de privilégios inferidos.
7. Após os gates, QA e resolução de eventual dependência de banco, DevOps publica/verifica staging primeiro e promove somente o patch validado para main/produção, conforme autorização desta entrega. Preserva commits de main, alterações concorrentes e ambientes/bancos distintos, sem copiar dados/env/segredos. Registra READY, SHA, alias e smoke dos dois ambientes, com limitações reais.
8. Checklist, File List e inventário registram pontos auditados/alterados, existência por ambiente, eventual gate de banco, releases e resultados. Não se declara setor persistido ou permissão configurada apenas porque o código foi publicado. As stories Comercial e Maria permanecem independentes desta preparação.

## Dev Notes e referências

- `src/lib/setores-catalogo.ts`: precedente recém-entregue centraliza `SETOR_LIDER_COMERCIAL`, `SETORES_ALPHA_SKILLS` e `canonicalizarSetorLiderComercial`. Estender/reutilizar o padrão pertinente para o novo setor sem substituir o Comercial nem renomear outros rótulos.
- `src/actions/colaboradores.ts`: três caminhos de persistência já canonicalizam o setor comercial após validação. Auditar o tratamento do Operacional mantendo validações, autorização e controle de sessão existentes.
- `src/actions/gestaoSetores.ts`, `criarSetor`: CRUD administrativo existente cria setor e suas categorias iniciais em transação, verifica nome equivalente e exige `requireAdmin`. Extrair o mesmo corpo para serviço `server-only` compartilhado pela action autenticada e CLI confiável explícito, preservando a autorização na action. `ensureSetorBase` faz upserts em leitores; não incluir o novo setor nesse seed indireto. O inventário continua sendo SELECT sem escrita.
- `src/lib/roles.ts`, `normalizeRole`/`isSameRole`/`isAdminRole`: comparação normalizada existente e bypass global limitado a Admin/CEO/TI; exceção comercial de Parceiros não deve ser aplicada ao Operacional por analogia.
- `src/actions/PermissoesSetor.ts` e `src/lib/permissions/effective.ts`: contratos de gestão e leitura efetiva de permissões. Reconhecer o novo setor não equivale a lhe atribuir módulos.
- `docs/stories/story-setor-lider-comercial-consistencia.md`, Inventário/blueprint e File List: precedente dos consumidores em cadastro, AlphaVault, Alpha Skills, onboarding, POP/histórico, links externos, CRM e configurações dinâmicas. Usar como mapa de auditoria, preservando suas entregas e sem replicar privilégios comerciais específicos.
- `tests/gestao-equipe/lider-comercial-{permissoes,cursos,cursos-react}.test.ts`: referências de regressão de catálogo/curso/ACL; acrescentar cobertura do novo setor com fixtures e manter regressões do Comercial.
- `AGENTS.md`, Fluxo de ambientes/Quality Gates/Database Safety and Backup Policy e `.aiox-core/constitution.md`, artigos II–V: staging primeiro, autoridade DevOps, gates e consentimento específico para operações de banco abrangidas. `package.json`, scripts: quatro gates reais.

**[AUTO-DECISION] Correção de identidade:** a nova explicação do usuário define `Lider Operacional` como alvo; não desfazer a implementação Comercial existente. Aplicar código e cadastro único necessário primeiro em staging e depois main/produção conforme pedido já autorizado e enquadramento Vault de CRUD comum. Preservar gate independente para seed automático/schema/mutações em massa. Não inventar epic, privilégios, migration ou configuração de módulos. `accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados nas preparações anteriores; contexto cruzado no precedente e contratos citados.

## Tarefas / subtarefas

- [x] Registrar correção explícita, identidade canônica, autorização e limites.
- [x] Aplicar workflow/checklist real de preparação SM.
- [x] DevOps inventariar existência por SELECT nos dois ambientes, sem efeitos colaterais (AC 1).
- [x] Mapear consumidores e adaptar catálogos/validações pertinentes para Lider Operacional, preservando Comercial e outras regras (AC 2–4).
- [x] Registrar enquadramento Vault: cadastro único solicitado pelo CRUD comum é exceção expressa, sem seed automático (AC 5).
- [x] Extrair serviço CRUD compartilhado preservando `requireAdmin`; preparar CLI idempotente com SELECT/alias e sem renomear/reativar (AC 5).
- [ ] Se ausente, cadastrar somente o setor/categoria padrão explicitamente primeiro em staging e depois produção; registrar leitura de confirmação sem permissões/vínculos/reatribuições (AC 5, 7–8).
- [x] Acrescentar regressões de identidade, listas, ACL/negações e preservação dos demais setores (AC 6).
- [x] Executar quatro gates completos e revisão QA em staging (AC 6); main receberá gates próprios antes de produção.
- [ ] DevOps publicar/validar staging e depois somente o patch autorizado em main/produção, atendidas dependências de banco (AC 7).
- [ ] Atualizar inventário, File List, checklist, status, evidências e pendências (AC 8).

## Testing

Usar fixtures sintéticas para setor novo/existente/equivalente/inativo, canonicalização, catálogos e consumidores. Testar idempotência, alias sem duplicação, ausência de renomeação/reativação e criação restrita ao setor/categoria padrão, sem permissões/vínculos/reatribuições. Testar gestão autorizada, negação a usuário sem poder administrativo e permissões efetivas vazias/configuradas/override sem concessão implícita. Confirmar Comercial e OPERACIONAL intactos e ausência de upsert no diagnóstico. Validar staging antes de produção; smoke distingue disponibilidade/versão de teste visual autenticado e do cadastro CRUD solicitado. Não mutar dados reais para fabricar evidência de teste.

## CodeRabbit Integration

- **Story Type Analysis:** integração frontend/backend de setores e permissões; secundário Security; complexidade média pelo alcance transversal e possível dependência de configuração de banco.
- **Specialized Agents:** @dev implementação/Pre-Commit; @qa regressões; @architect se mudar contrato; @devops inventário SELECT, execução explícita do CRUD autorizado e releases. Vault já classificou o cadastro único; novo gate se surgir seed automático/schema/mutação em massa ou outra operação abrangida.
- **Quality Gates:** Pre-Commit: diff, inventário, quatro gates e CodeRabbit se disponível, documentando ausência/revisão alternativa. Pre-PR/Pre-Deployment por DevOps: escopo, efeitos indiretos no banco, ambiente, QA e rollback de código.
- **Self-Healing:** @dev light, 2 iterações/15 minutos para CRITICAL e HIGH documentado; @qa full, 3 iterações/30 minutos para CRITICAL/HIGH, MEDIUM como dívida; @devops check, somente reporte.
- **Focus Areas:** identidade correta, Comercial preservado, ACL não copiada, normalização sem duplicata, upserts indiretos, banco isolado e promoção restrita ao patch.

## Validação da preparação — @sm

Checklist `story-draft-checklist.md` aplicado: objetivo/contexto PASS; orientação técnica PASS; referências PASS; informação autocontida PASS; testes PASS; CodeRabbit PASS. **READY, clareza 9/10.** Existência nos bancos e necessidade de cadastro são tarefas explícitas, não resultados presumidos. Esta preparação não executou testes, escrita de banco ou publicação.

## Dev Agent Record e File List

### Inventário e implementação

- SELECT direto separado confirmou ausência de Lider Operacional/aliases nos dois ambientes. Prova: `/tmp/setor-lider-operacional-20261021-catalogos-readonly.json`.
- Vault classificou a criação explícita de um Setor + categoria padrão como CRUD normal autorizado, isento de protocolo de migration por operação. Não existe novo nome em `ensureSetorBase` nem provisionamento em leitura/build/deploy.
- `cadastrarSetor` extrai o corpo CRUD existente de `criarSetor`: action continua autenticada por `requireAdmin`; serviço server-only compartilhado com CLI administrativa confiável, transação serializável e deduplicação normalizada. Somente nomes conhecidos de liderança são canonicalizados, demais setores mantêm uppercase anterior. Nenhum registro existente é reativado ou renomeado.
- CLI fixa exclusivamente Lider Operacional, requer ambiente e arquivo de banco explícitos, preview sem escrita e hash do banco conferido para aplicar. A criação deixa os defaults existentes ativo=true/protegido=false/isBase=false e somente categoria `Outros do setor`; nenhum usuário, módulo, permissão ou pipeline é atribuído.
- Catálogo compartilhado Skills atende backend, criação individual/lote, módulos derivados e filtros. Opções adicionadas em EditionUser, AlphaVault2modais, onboarding e histórico POP; catálogo de links permite o nome canônico.
- Cadastro de usuários, edição RH, gestão de acessos por setor, CRM pipeline/equipe/etapas, POP/upload/matriz, notas/chamados/cargos consultam catálogo persistido e aceitam o novo setor após cadastro; contratos de autorização preservados.
- `lideranca-setor` já reconhecia a liderança genérica; não foi alterado runtime. Regressões mostram movimento somente no próprio setor, sem edição irrestrita ou acesso ao Comercial. Boas-vindas individual e privilégios comerciais/Admin/CEO/TI não foram ampliados.
- Lider Comercial e OPERACIONAL existentes preservados; sem concessão automática, reatribuição de usuário, migration, seed/backfill, alteração estrutural ou ambiente.

### File List

- `docs/stories/story-setor-lider-operacional-consistencia.md`
- `scripts/cadastrar-lider-operacional.mts`
- `src/lib/setores/cadastro.ts`
- `src/lib/setores-catalogo.ts`
- `src/actions/gestaoSetores.ts`
- `src/actions/colaboradores.ts`
- `src/components/EditionUser.tsx`
- `src/components/GestaoOnboarding/GestaoOnboardingClient.tsx`
- `src/app/PainelAlpha/HistoricoArquivos/page.tsx`
- `src/app/PainelAlpha/AlphaVault/AdicionarColaborador/ModalAdicionarColaborador.tsx`
- `src/app/PainelAlpha/AlphaVault/EditarColaborador/ModalEditarAgente.tsx`
- `src/lib/validations/link-externo.ts`
- `tests/auth/admin-user-actions.test.ts`
- `tests/gestao-equipe/lider-comercial-cursos.test.ts`
- `tests/gestao-equipe/lider-comercial-cursos-react.test.ts`
- `tests/gestao-equipe/lider-operacional-cadastro.test.ts`
- `tests/bpm/lideranca-setor.test.ts`

### Testes e evidências

- Focados: **10 arquivos / 94 testes PASS**. Incluem cadastro deduplicado/atomicidade/negação, catálogo sem seedOperacional, ACL/overrides/links, persistência canônica nas3gravaçõesVault, seleção de cursos no componente real → action real com IO mockado (individual/lote) e liderançaCRM restrita ao setor.
- Toda implementação foi exercitada com fixtures sintéticas; nenhum banco/card/tarefa/usuário/permissão real foi escrito nesta etapa. Cadastro real e releases ainda pendentes de revisão/gates.
- Incidente de Maria é separado em story própria; nenhum código desse incidente pertence a este manifesto.
- CodeRabbit indisponível na sessão; QA/Anubis independente PASS / APPROVED. Gates completos de staging aprovados e deploy pendente nesta revisão; não há prova de UI autenticada.

## QA Results

**PASS / APPROVED** — QA/Anubis dos 17 caminhos e integração dos dois candidatos; mesmo patch, nenhuma transferência de Instagram para main, sem alteração de schema/config/env/deps ou grants. Smoke CLI SQLite real aprovou preview sem escrita, cadastro de um setor/categoria e repetição idempotente. Gates de staging reais aprovados; gates de main e releases serão verificados por DevOps.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-21 | 0.1 | Preparação do alvo corrigido Lider Operacional e checklist de draft | River (@sm) |
| 2026-10-21 | 0.2 | Parecer Vault distingue cadastro único CRUD autorizado de seed automático/schema/bulk; plano idempotente compartilhado | River (@sm) |

## Evidências DevOps — staging

- Staging avançou por outra sessão para `50e53866335255ff3ed560f3c46b75e35083e315` (Instagram/Sheets, 29 caminhos sem sobreposição). Essa base foi preservada; o delta desta entrega é exatamente os 17 caminhos da File List. Main permanece baseado em `3031da04`, sem transportar Instagram.
- Gates serializados de staging PASS: lint zero erros/1.193 avisos preexistentes; **build padrão exit 0**, sem retry; typecheck após build exit 0; suíte completa **698 arquivos/5.359 testes PASS**, 4 ignorados e 1 todo. Como os runtimes divergem por Instagram, main terá seus quatro gates próprios.
- CLI real em SQLite efêmero com DDL derivado do Prisma: preview sem escrita → aplicar com hash cria somente 1 setor/1 categoria padrão → repetir não altera registros. Prova: `/tmp/setor-lider-operacional-20261021-local-smoke.json`.
- Após QA e gates PASS, aplicado somente CRUD normal autorizado em staging, conforme classificação Vault: setor `Lider Operacional` ID15 ativo, não base/não protegido; categoria `Outros do setor` ID54 ativa. Repetição idempotente sem mudanças. Hash do preview vinculado ao host e catálogo explícitos de staging, banco distinto de produção. Comercial ID6 preservado.
- Zero módulos, pipelines, cursos ou usuários atribuídos ao setor; nenhum trigger nas duas tabelas, ensureSetorBase, grant, UPDATE/DELETE/ALTER, migration ou seed automático executado. Prova: `/tmp/setor-lider-operacional-staging-20261021-crud-applied.json`.
- Gates/comandos reais: `/tmp/setor-lider-operacional-staging-20261021-gates-progress.json`. Produção ainda não recebeu o cadastro Operacional nesta revisão; aguardará seus gates e staging READY antes da promoção.
- Nenhum arquivo de ambiente/credencial foi versionado. Diagnóstico Maria está separado e não integra os 17 caminhos. Limite: sem UI autenticada nem alteração de cards/tarefas/permissões reais.
