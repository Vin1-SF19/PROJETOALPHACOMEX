# Story — Consistência do setor Lider Comercial no Painel Alpha

## Status

Ready for Review — staging publicado e verificado; autorização posterior do usuário cobre a promoção dos mesmos 16 caminhos para main/produção. QA/Anubis e gates aprovados; produção READY pendente.

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["inventário de setores e permissões", "npm run lint", "npm run typecheck", "npm test", "npm run build"]

## Story

Como gestor do Painel Alpha, quero que o setor **Lider comercial** esteja disponível de forma consistente nas listas de setores e nos pontos que configuram permissões por setor, para administrar esse grupo pelos fluxos existentes em todo o painel.

Origem: pedido direto do usuário. Reutilizar o papel/setor canônico existente **`Lider Comercial`**, sem criar outra identidade por diferença de caixa ou acento. A autorização inicial cobriu staging; depois da validação, o usuário pediu explicitamente **“mande para a main tambem”**, autorizando a promoção deste mesmo patch de 16 caminhos para main/produção, preservando a base existente. Não implica conceder acesso administrativo global nem copiar privilégios de outro setor.

## Acceptance Criteria

1. Um inventário dos cadastros, filtros, seletores e configurações de permissão por setor no Painel Alpha identifica os pontos que já reconhecem `Lider Comercial`, os que o omitem indevidamente e os que possuem restrição funcional existente. A correção cobre as omissões pertinentes em todo o painel e registra o tratamento de cada ponto, sem alterar listas restritas por suposição.
2. O setor existente `Lider Comercial` aparece nos catálogos e seletores de setores aplicáveis, inclusive nos fluxos de cadastro/gestão de colaboradores e configuração de acesso por setor. Selecionar, carregar configuração, salvar pelo fluxo já autorizado e reabrir mantém a identidade canônica; não surgem setores duplicados nem desaparecem opções existentes.
3. As configurações de permissão por setor aceitam e representam `Lider Comercial` de forma coerente entre UI, validação, consulta e autorização backend. O usuário recebe somente as permissões efetivas já configuradas, overrides e exceções específicas existentes. O papel não vira Admin/CEO/TI nem obtém bypass global, supervisão CRM irrestrita ou privilégios novos por seu nome.
4. Cadastros e filtros por setor identificam corretamente usuários já vinculados a `Lider Comercial`, respeitando as regras de acesso de cada módulo. Preservam-se os demais setores, associações, permissões existentes e limites de gestão de quem pode configurar acessos; não há reatribuição automática de usuários nem concessão em lote.
5. A entrega prioriza correções de código sobre o modelo existente, sem migration, alteração estrutural, seed/backfill ou mutação em massa por padrão. Se o inventário revelar necessidade de operação abrangida pela política de banco, a execução aguarda Vault, explicação do impacto/rollback, backup completo verificado de até 48 horas e confirmação explícita específica. Não se criam duplicatas para contornar inconsistências de catálogo.
6. São executados lint, typecheck, suíte completa de testes e build, com resultados reais registrados; QA revisa consistência e ausência de ampliação indevida de permissões. Após validação, DevOps publica e verifica staging; atendendo à autorização posterior explícita, promove somente o mesmo patch para main/produção, registrando commit/release, READY/SHA/alias e smoke pertinente. Nenhum pacote alheio ao patch é promovido por esta operação.
7. Checklist, File List e inventário são atualizados com os pontos efetivamente auditados/alterados e as limitações reais. Alterações concorrentes locais são preservadas; arquivos de ambiente, credenciais, dumps e artefatos não integram o pacote.

## Dev Notes e referências

- `src/actions/gestaoSetores.ts`, `SETORES_PROTEGIDOS`: já contém `Lider Comercial`, não protegido e não base. `getSetoresParaSelect` e `getSetoresComContagem` usam setores ativos do cadastro; ambos chamam `ensureSetorBase`, que faz upserts. Não executar essas funções como se fossem inventário somente leitura sem considerar esse efeito.
- `src/lib/roles.ts`, `normalizeRole`/`isSameRole`: comparação tolera caixa/acentos/pontuação sem alterar valor persistido. `isAdminRole` limita o bypass global a Admin/CEO/TI; `isParceirosAdminRole` contém exceção específica de Parceiros. Preservar essa separação.
- `src/actions/PermissoesSetor.ts`, `getPermissoesEfetivas`/`atribuirModulosAoSetor`: permissões derivam do contrato efetivo existente e atribuição exige sessão administrativa. `src/lib/permissions/effective.ts` é a fonte de leitura efetiva; não conceder módulos automaticamente.
- `src/app/PainelAlpha/cadastro/page.tsx`: já reconhece `Lider Comercial` entre os papéis de gestão; `src/components/cadastro/AbaGestaoEquipe.tsx` deriva filtros dos usuários; `ModalGerenciarSetor.tsx` usa o catálogo de setores e fluxo de módulos. Auditar consumo sem substituir os limites específicos de gestão.
- `src/components/GestaoSetores/GestaoSetoresClient.tsx` e `src/lib/gestao-setores-sync.ts`: fluxos existentes de gestão e atualização de catálogo. Reutilizar os contratos pertinentes em vez de introduzir catálogo paralelo divergente.
- `docs/stories/story-alpha-crm-visao-equipe-pipeline.md`, critérios 16–17: Líder Comercial não concede supervisão global do CRM; corrigir omissões de configuração sem inferir novos acessos. `docs/stories/story-parceiros-lider-comercial-acesso-total.md`: privilégios desse papel são específicos de Parceiros, não globais.
- `AGENTS.md`, Quality Gates, Fluxo de ambientes e Database Safety and Backup Policy: staging primeiro, produção somente por pedido explícito e gate Vault quando aplicável. `package.json`, scripts: comandos reais dos quatro gates.

Não há orientação genérica específica disponível em `docs/architecture/index.md` neste checkout. `accumulated-context.md` e `.aiox/gotchas.json` não foram encontrados nas preparações anteriores; contexto cruzado consultado nos contratos e stories citados. Não há nova dependência ou variável de ambiente prevista.

**[AUTO-DECISION] Identidade e escopo:** usar `Lider Comercial`, já existente, como identidade do setor/papel solicitado. O inventário completo é tarefa do executor principal; não prescrever novos privilégios nem incluir o papel em toda allowlist indiscriminadamente. Usar o pedido direto e nome de arquivo da missão, sem inventar epic ou tracking externo. Status Ready solicitado pelo executor após validação da preparação; não comprova QA da implementação.

## Tarefas / subtarefas

- [x] Registrar pedido, identidade existente, limites e referências.
- [x] Aplicar workflow real `create-next-story.md` e `story-draft-checklist.md` à preparação.
- [x] Completar inventário de catálogos/seletores/filtros/configurações e ACL backend; registrar omissões e restrições pertinentes (AC 1–4).
- [x] Corrigir pontos omissos usando identidade/contratos existentes, preservando outras opções e privilégios específicos (AC 2–4).
- [x] Conferir necessidade real de dados/schema e aplicar gate Vault somente se necessário antes de executar (AC 5).
- [x] Testar presença do setor, seleção/persistência autorizada, filtros e permissões efetivas; cobrir negações e regressão dos demais setores (AC 2–4).
- [x] Executar quatro gates completos e revisão QA, registrando resultados reais (AC 6).
- [x] DevOps publicar/validar staging, com release/alias/SHA e smoke (AC 6); promoção posterior autorizada para main/produção em acompanhamento.
- [ ] Atualizar inventário, checklist, File List, status e limitações (AC 7).

## Testing

Reutilizar testes pertinentes de setores, permissões e componentes com fixtures sintéticas. Cobrir `Lider Comercial` já existente, comparação de nome equivalente sem duplicação, catálogo de setores ativos, seleção/carregamento e salvamento por gestor autorizado e negação a usuário sem poder de gestão. Confirmar permissões efetivas/overrides do papel sem bypass global, preservação dos demais setores e filtros retornando somente usuários autorizados. Smoke staging deve distinguir teste de UI/autenticado de simples disponibilidade; não alterar dados reais para fabricar evidência.

## CodeRabbit Integration

- **Story Type Analysis:** integração frontend/backend de catálogos e permissões; secundário Security; complexidade média pelo alcance entre módulos.
- **Specialized Agent Assignment:** @dev implementação/Pre-Commit; @qa regressões; @architect se surgir mudança de contrato de autorização; @devops publicação staging e promoção posterior explicitamente autorizada; Vault quando aplicável à política de banco.
- **Quality Gate Tasks:** Pre-Commit: inventário, diff, quatro gates e CodeRabbit se disponível; registrar ausência/revisão alternativa. Pre-PR por DevOps se houver PR. Conferir ambiente, escopo e rollback de código antes dos deploys; produção depende do pedido explícito posterior registrado nesta revisão.
- **Self-Healing Configuration:** @dev light, 2 iterações/15 minutos para CRITICAL e HIGH documentado; @qa full, 3 iterações/30 minutos para CRITICAL/HIGH, MEDIUM como dívida; @devops check, somente reporte.
- **Focus Areas:** identidade canônica, omissões de catálogo, consistência UI/backend, ACL e overrides, preservação de setores/permissões e efeitos colaterais de leituras que fazem upsert.

## Validação da preparação — @sm

Checklist `.aiox-core/product/checklists/story-draft-checklist.md` aplicado em modo autônomo.

| Categoria | Resultado |
| --- | --- |
| Objetivo/contexto | PASS — alcance e limites explícitos |
| Orientação técnica | PASS — contratos e inventário a completar identificados |
| Referências | PASS — arquivos/funções relevantes localizados |
| Informação autocontida | PASS — identidade e preservação de privilégios definidas |
| Testes | PASS — cenários positivos, negações e regressões |
| CodeRabbit | PASS — agentes, gates, self-healing e foco definidos |

**READY, clareza 9/10.** O executor pode implementar após concluir o inventário descrito. Não há dependência presumida de migration nem aprovação de novos privilégios. Esta preparação não executou testes, mutações de banco ou publicação.

## Dev Agent Record e File List

### Inventário / blueprint de integração

| Ponto auditado | Tratamento |
| --- | --- |
| Catálogo Setor / gestaoSetores.ts | Já registra `Lider Comercial`; literal referenciado por constante compartilhada. SQL direto somente leitura em staging confirmou único setor ID 6 ativo; não executar seeds/upserts para diagnóstico. |
| Cadastro/FormCadastro, perfil RH/ModalPerfilColaborador, gestão de módulos por setor/ModalGerenciarSetor | Catálogo dinâmico `getSetoresParaSelect` já inclui o setor; contratos preservados e cobertos por regressões. |
| Edição EditionUser | Lista legada sem importadores atuais localizada; opção adicionada para consistência sem inventar nova rota. |
| AlphaVault adição/edição | Opção adicionada nos dois modais. Três persistências no servidor canonicalizam somente Lider Comercial após validação; demais setores mantêm uppercase existente. `requireAdmin`, Zod e incremento de sessão preservados. |
| Alpha Skills | Catálogo de cursos compartilhado entre backend, criação individual/em lote e filtro de gerenciamento; rótulos anteriores preservados. Upload/edição de módulos derivam setores dos cursos; filtro público deriva dos cursos recebidos. |
| Gestão de onboarding | Opção adicionada mantendo valor canônico no template. |
| POP upload, leitura e matriz de acessos | Catálogos dinâmicos já contemplam o setor e comparação normalizada preservada. |
| POP histórico/edição | Lista legada de destinos complementada; valor uppercase de documentos preservado, sem renomear registros. |
| CRM configuração de pipeline/equipe/etapas, notas, chamados e cargos | Consultam Setor ativo ou usuários e resolvem associação/normalização pelo contrato existente; setor já elegível para configuração, sem nova supervisão global. |
| Links externos | `ROLES_CONHECIDOS` já inclui literal canônico; validação/filtro backend preservados. |
| ACL de módulos / permissões efetivas | `SetorPermissao` e overrides permanecem autoridade; nenhum módulo foi concedido automaticamente. Regressões comprovam consulta por identidade exata e negações. |
| Metas, leads, contratos, cadastro clientes e Parceiros | Lider Comercial já reconhecido nas regras específicas; preservar acessos existentes. |
| Comissões, RH/holerites, operação/checklist e áreas administrativas | Listas restritas de função não representam catálogo geral de setores; manter limites atuais, sem inferir elegibilidade financeira ou privilégio administrativo novo. |
| Menu, atalhos, rotas, auth, index de tipos e configuração Next | Não há nova página/módulo/papel de sessão; reutiliza setor existente. Sem novo registro de navegação nem alteração de contrato. |

### File List

- `docs/stories/story-setor-lider-comercial-consistencia.md`
- `src/lib/setores-catalogo.ts`
- `src/actions/gestaoSetores.ts`
- `src/actions/Cursos.ts`
- `src/actions/colaboradores.ts`
- `src/components/EditionUser.tsx`
- `src/components/GestaoOnboarding/GestaoOnboardingClient.tsx`
- `src/app/PainelAlpha/HistoricoArquivos/page.tsx`
- `src/app/PainelAlpha/AlphaSkills/Gerenciamento/CriarCurso.tsx`
- `src/app/PainelAlpha/AlphaSkills/Gerenciamento/page.tsx`
- `src/app/PainelAlpha/AlphaVault/AdicionarColaborador/ModalAdicionarColaborador.tsx`
- `src/app/PainelAlpha/AlphaVault/EditarColaborador/ModalEditarAgente.tsx`
- `tests/auth/admin-user-actions.test.ts`
- `tests/gestao-equipe/lider-comercial-permissoes.test.ts`
- `tests/gestao-equipe/lider-comercial-cursos.test.ts`
- `tests/gestao-equipe/lider-comercial-cursos-react.test.ts`

### Validação e limitações

- Regressão focada: **8 arquivos / 72 testes PASS**, incluindo componente real de cursos → action real com IO mockado (individual e lote), persistência canônica no Vault (usuário/Core), ACL/overrides, liderança CRM e POP/Parceiros existentes.
- Primeira execução do teste React de lote falhou por procurar o rótulo incorreto “Em Lote”; seletor do teste corrigido para o rótulo real “Lote”, sem alteração do produto para adequar teste.
- Nenhum banco/schema/card/usuário/permissão real foi alterado. Consulta de existência: `/tmp/setor-lider-comercial-20261021-catalogo-readonly.json`. Sem migration, seed, backfill ou necessidade de gate Vault.
- Staging publicado e verificado. Autorização posterior direta do usuário cobre main/produção para este mesmo patch, sem ampliação de privilégios ou escopo. Sem novas dependências/configurações/variáveis de ambiente. CodeRabbit indisponível nesta sessão; revisão independente QA/Anubis como alternativa.
- Checklist de draft já aplicado por SM. Gates completos e revisão final aprovados; evidências do deploy staging confirmadas; verificação de produção pendente nesta revisão.

## QA Results

**PASS / APPROVED** — QA/Anubis ratificou os 16 caminhos, incluindo integração React e 72 regressões focadas. Identidade canônica, ACL, overrides e limites de gestão preservados; nenhuma ampliação indevida de privilégios ou pendência de implementação identificada. Quatro gates reais do isolamento aprovados por DevOps, em sequência e sem concorrência entre build/typecheck/suíte completa.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-21 | 0.1 | Preparação da consistência do setor, critérios e checklist de draft | River (@sm) |
| 2026-10-21 | 0.2 | Inventário transversal, catálogos corrigidos e 72 regressões focadas PASS | Dex / Codex |

## Evidências DevOps antes da publicação

- Base staging congelada: `347c61a4f54365715f50bc3a5a82375d938ebd3d`. Escopo seletivo: exatamente os 16 caminhos da File List, sem alterações locais alheias. Na autorização inicial, produção/main ficaram fora; o pedido posterior explícito está documentado abaixo.
- Gates serializados, sem alteração de fonte/configuração: lint exit 0 (zero erros e 1.193 avisos preexistentes); **build padrão exit 0**, sem OOM/retry; typecheck após build exit 0; `npm test` exit 0, **691 arquivos e 5.302 testes aprovados**, 4 ignorados e 1 todo.
- Logs e comandos reais: `/tmp/setor-lider-comercial-20261021-gates-progress.json` e `/tmp/setor-lider-comercial-20261021-{lint,build,typecheck,tests}.log`. Revisão independente QA/Anubis: PASS / APPROVED.
- Consulta SQL direta e somente leitura do catálogo staging comprovou `Lider Comercial`, ID 6, ativo, sem chamar ensureSetorBase, consultar usuários ou executar escrita. Evidência: `/tmp/setor-lider-comercial-20261021-catalogo-readonly.json`.
- Validação local utilizou somente URLs SQLite sintéticas. Nenhum banco/schema/seed/permissão, credencial, dependência ou ambiente foi alterado. Na etapa inicial de staging, produção não recebeu publicação.
- READY/SHA/alias/smoke staging foram confirmados após o push; fechamento documental local após produção, sem outro commit/deploy documental. Limite: não foi executado fluxo visual autenticado nem salvamento de usuários/permissões reais.

## Promoção autorizada para main/produção

- Pedido posterior do usuário: **“mande para a main tambem”**, referente exclusivamente ao patch Lider Comercial aprovado no staging.
- Base main preservada: `3b7ce8d01811619c227a7ca5ce9eecbfb58ecbba`. Cherry-pick seletivo de `87c2e78f1849494825cd7bbe01b61f38f53c3683` sem conflito; delta exato de 16 caminhos. Quatro registros documentais já exclusivos de main foram preservados.
- Todo código, testes, configuração e dependências resultantes são **byte-idênticos ao staging validado**. Herança dos quatro gates reais válida: lint sem erros, build padrão, typecheck e 691 arquivos/5.302 testes PASS (4 ignorados, 1 todo). Nenhum novo comportamento exige repetir gates.
- QA/Anubis incremental da integração: **PASS / APPROVED**, com preservação de concorrentes e ausência de grants, bypass, alterações de schema, dependências ou ambientes. Somente esta story recebeu metadados adicionais.
- Staging confirmado READY em `staging.alpha-comex.com`, deployment `dpl_CCCDHye3DDfWDJsQLfuBr3jEqGun`, SHA `87c2e78f`; smoke de disponibilidade/autorização aprovado.
- Catálogo de produção verificado por SQL direto somente leitura: um setor `Lider Comercial`, ID 6, ativo. Sem ensureSetorBase, acesso a usuários ou escrita. Evidência: `/tmp/setor-lider-comercial-main-20261021-catalogo-readonly.json`.
- Evidências de equivalência/gates: `/tmp/setor-lider-comercial-main-20261021-candidate.json` e `/tmp/setor-lider-comercial-20261021-gates.json`. Deploy de produção usará GitSource main no target production, sem copiar ambiente de staging. READY/SHA/alias/smoke serão confirmados após a publicação; root permanece na branch staging.
