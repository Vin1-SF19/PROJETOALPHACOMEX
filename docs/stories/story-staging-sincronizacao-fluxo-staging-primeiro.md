# Story — Sincronizar staging e adotar validação antes de produção

## Status

Ready for Review — pacote isolado e quatro gates aprovados; publicação e configuração de staging em andamento, sem alteração em produção.

## Executor Assignment

executor: "@devops"
quality_gate: "@qa"
quality_gate_tools: ["git diff", "npm run lint", "npm run typecheck", "npm test", "npm run build", "verificação remota de release e ambiente"]

## Story

Como responsável pelo Painel Alpha, quero atualizar o staging com todas as modificações autorizadas do aplicativo, incluindo a etapa e a automação da Assessoria Smart, para validar as entregas nesse ambiente antes de solicitar sua promoção para produção.

Origem: pedido direto do usuário em 2026-10-20. A story relacionada `story-alpha-crm-assessoria-smart-enviar-revisao.md` registra a configuração anterior e seus limites; seus IDs e evidências de produção não comprovam configuração em staging.

## Acceptance Criteria

1. O aplicativo correto do Painel Alpha em staging recebe todas as alterações pendentes e autorizadas do aplicativo, após inventário dos arquivos modificados e novos. Segredos, arquivos `.env`, caches, dumps e artefatos locais não integram a publicação. Alterações prévias são preservadas e o inventário permite conferir o conteúdo da release.
2. Antes de publicar ou configurar o CRM, são identificados o serviço/URL de staging e o banco efetivamente usado por ele. O banco isolado de staging é utilizado se disponível; não se assume isolamento pelo nome da branch ou do arquivo de ambiente. Banco compartilhado ou divergência de destino é registrada e resolvida antes de testar mutações.
3. A configuração de negócio em staging é conferida separadamente do deploy do código: Assessoria Smart possui **Enviar para REVISÃO** na penúltima posição e uma automação ativa de entrada nessa etapa espelha o card em **Operacional → Revisão**. IDs, etapas, versões e vínculos são obtidos do inventário real desse ambiente. Não se copia o banco inteiro de produção para satisfazer este critério.
4. O espelhamento preserva o card original, cria/mantém vínculo e não duplica destino não arquivado já vinculado ao reentrar, conforme o mecanismo canônico e a story relacionada. As transições mínimas e o formulário seguem a configuração já especificada nessa story, sem inventar lifecycle, campos ou regras adicionais. Configuração existente divergente é relatada antes de sobrescrita.
5. Produção permanece preservada nesta entrega. Não são executados schema, migrations, seeds, backfills ou mutações em massa. Se uma dessas operações se tornar necessária, aplica-se o gate Vault do `AGENTS.md`: relatório prévio, backup completo verificado com até 48 horas e confirmação explícita específica antes da execução.
6. São executados `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` sobre a entrega, com resultados reais registrados. A verificação remota registra URL, commit/release publicada, disponibilidade do aplicativo e conferência do ambiente/configuração Smart. Testes sintéticos, configuração persistida e evento real autenticado são distinguidos; limitações não são declaradas como aprovação.
7. `AGENTS.md` e `docs/dev-tools.md` registram a política durável: desenvolvimento e validação em staging primeiro; promoção para produção somente após validação em staging e pedido explícito do usuário. A autorização desta entrega cobre staging.
8. Antes de concluir, checklist, File List e evidências desta story são atualizados com arquivos efetivamente incluídos, release, comandos, resultados, limitações e eventual rollback de staging. Nenhuma alegação de publicação depende apenas de código local ou de resposta anterior da conversa.

## Tarefas / subtarefas

- [x] Registrar pedido, critérios, limites e contexto da configuração Smart.
- [x] Aplicar `story-draft-checklist.md` à preparação.
- [x] Inventariar alterações autorizadas do aplicativo e excluir segredos/artefatos do pacote de publicação (AC 1).
- [x] Confirmar serviço, URL e ambiente efetivo do staging, incluindo isolamento do banco (AC 2).
- [x] Registrar política de staging primeiro em `AGENTS.md` e `docs/dev-tools.md` (AC 7).
- [x] Executar gates reais e revisar escopo/configuração da release (AC 1, 5–6).
- [ ] Publicar somente o aplicativo de staging e verificar commit/release e disponibilidade remota (AC 1–2, 5–6).
- [ ] Inventariar Smart e Operacional/Revisão no staging; conferir ou aplicar configuração administrativa delimitada pelos mecanismos existentes (AC 3–5).
- [ ] Validar configuração persistida e cenários de entrada/reentrada em ambiente isolado; registrar eventual limitação de sessão autenticada (AC 3–6).
- [ ] Atualizar status, checklist, File List, evidências e limitações reais (AC 8).

## Dev Notes e referências

- [Fonte: `AGENTS.md`, Core Rules e Quality Gates; `.aiox-core/constitution.md`, artigos II–V]: trabalho associado à story, publicação remota por @devops, preservação do escopo e gates reais. O gate de banco permanece obrigatório quando aplicável.
- [Fonte: `docs/dev-tools.md`, Fluxo local de desenvolvimento e Limites da sessão]: worktrees não isolam bancos, portas ou serviços; ambiente e dependências precisam ser conferidos por tarefa. Acrescentar a política solicitada sem remover instruções existentes.
- [Fonte: `docs/stories/story-alpha-crm-assessoria-smart-enviar-revisao.md`, Acceptance Criteria e Dev Agent Record]: configuração Smart já especificada, com gatilho `ENTRAR_COLUNA`, ação `CRIAR_CARD_OUTRO_PIPELINE`, `vincularAoOriginal:true` e `somenteSeNaoExistirAtivo:false`. A deduplicação por destino não arquivado vinculado pertence ao runtime canônico; não copiar IDs de produção sem conferência. A configuração anterior não exigiu deploy de código.
- [Fonte: `scripts/configurar-assessoria-smart-revisao.mts`]: artefato existente da configuração delimitada Smart; conferir destino e preflight antes de reutilizar. Não pressupor compatibilidade dos IDs com staging.
- [Fonte: `package.json`, scripts]: comandos de lint, TypeScript, Vitest com cobertura e build Next.js estão disponíveis. Os quatro gates são exigidos, e seus resultados anteriores não substituem a validação desta release.

Não foi encontrada orientação genérica específica de deploy em `docs/architecture/index.md` ou `docs/framework/`; esses caminhos não existem neste checkout. `accumulated-context.md` e `.aiox/gotchas.json` também não foram encontrados. O contexto entre stories foi obtido da story Smart acima, sem inventar epic, infraestrutura, URL ou mecanismo de release.

**[AUTO-DECISION] Identificação e tracking:** usar o nome de arquivo fornecido pelo executor principal e o pedido direto como origem; não criar numeração de epic ou tarefa externa, pois a missão autoriza somente este arquivo.

**[AUTO-DECISION] Escopo de sincronização:** inventariar e publicar as alterações autorizadas do aplicativo, preservando o checkout compartilhado. A lista final depende da revisão da release pelo executor; arquivos novos no diretório não são autorização automática para publicar ferramentas locais ou segredos.

**[AUTO-DECISION] Banco:** verificar o banco isolado indicado pelo executor principal, sem assumir sua vinculação ao serviço remoto e sem criar/copiar estrutura. Ausência de isolamento não autoriza usar produção para testes mutantes.

## Testing

| Verificação | Evidência esperada |
| --- | --- |
| Gates locais | Comando, resultado e logs reais dos quatro gates; falhas/interrupções explícitas |
| Conteúdo da release | Commit/release e inventário dos arquivos incluídos, sem segredos/cache/dumps |
| Destino remoto | URL/serviço correto, release ativa e disponibilidade observada |
| Banco | Destino efetivo de staging conferido sem expor credenciais; isolamento demonstrado quando disponível |
| Configuração Smart | Etapa penúltima, automação ativa, destino Revisão real e parâmetros canônicos |
| Entrada e reentrada | Espelho vinculado, origem preservada e ausência de duplicata de destino já vinculado; identificar teste sintético ou autenticado |
| Preservação | Nenhuma publicação ou mutação de produção; configurações alheias preservadas |
| Política durável | Fluxo staging antes de produção registrado nos dois documentos |

Priorizar testes existentes e smoke adequado ao ambiente isolado; não movimentar cards reais em produção para produzir evidência. Registrar separadamente verificações bloqueadas por autenticação ou infraestrutura.

## CodeRabbit Integration

- **Story Type Analysis:** Deployment; secundários Integration e Process. Complexidade média pelo inventário de alterações e separação entre release e configuração de negócio.
- **Specialized Agent Assignment:** @github-devops/@devops para publicação; @dev para revisão Pre-Commit e ajustes autorizados; @qa para validação independente. Vault se surgir mudança estrutural ou mutação abrangida pela política do banco.
- **Quality Gate Tasks:** Pre-Commit (@dev): revisão do diff, quatro gates e CodeRabbit se disponível. Pre-PR (@devops): revisão de configuração/escopo se houver PR. Pre-Deployment (@devops): validar destino, segredos, release e rollback de staging. Deploy de produção fora do escopo.
- **Self-Healing Configuration:** @dev light, até 2 iterações/15 minutos para CRITICAL; HIGH documentado. @qa full, até 3 iterações/30 minutos para CRITICAL/HIGH; MEDIUM como dívida. @devops check, somente reporte. CLI indisponível exige registro da limitação e revisão alternativa.
- **Focus Areas:** ambiente efetivo, isolamento de banco, conteúdo completo da release autorizada, exclusão de segredos/artefatos, configuração persistida versus execução testada, preservação de produção e reversibilidade do deploy de staging.

## Validação da preparação — @sm

Checklist `.aiox-core/product/checklists/story-draft-checklist.md` aplicado em modo autônomo.

| Categoria | Resultado |
| --- | --- |
| Objetivo e contexto | PASS — pedido e benefício definidos |
| Orientação técnica | PASS — arquivos e inventário necessário explícitos |
| Referências | PASS — fontes locais e seções identificadas |
| Informação autocontida | PASS — escopo, limites e dependências expostos |
| Testes | PASS — resultados verificáveis e limites da evidência |
| CodeRabbit | PASS — agentes, gates, configuração e foco definidos |

**Preparação: READY, clareza 9/10.** A implementação deve confirmar infraestrutura e inventário de staging; essa investigação é tarefa explícita. Esta avaliação não comprova publicação, testes ou QA da entrega.

## Dev Agent Record

Ambiente confirmado: Vercel custom `staging` (`env_sKT0JOh0HB03g20jmcqN5pTHMjqT`), branch `staging`, domínio `https://staging.alpha-comex.com`. O serviço systemd antigo está inativo e não foi usado. A base do pacote isolado é `1ab82aec`; o inventário completo de arquivos e exclusões está em `docs/reports/staging-sincronizacao-20261020.md`.

- Banco de staging distinto de produção, selecionado por `.env.staging.local`; inventário real confirmou Smart versão 1, quatro etapas e ausência da automação; destino Operacional/Revisão presente com IDs conferidos. Backup completo de staging em preparação antes do CRUD delimitado.
- `AGENTS.md` e `docs/dev-tools.md` atualizados com a decisão permanente do usuário. `.env.development.local` local/ignorado passou a selecionar o banco de staging, preservando as outras variáveis. Arquivos `.env.local`/`.env` de produção não foram alterados e nenhum segredo foi versionado.
- Script Smart agora usa staging por padrão, aceita `--env-file`, rejeita URL herdada divergente e exige `--production` para aplicar em outro banco remoto. QA independente aprovou esses ajustes, três negativas reais de preflight e ESLint individual sem erros/avisos.
- DevOps confirmou os quatro gates: lint sem erros (1.193 avisos legados), 674 arquivos e 5.083 testes aprovados (4 skipped, 1 todo), typecheck final aprovado após geração do bundle do player e build completo aprovado (81 páginas). Ainda não se declara publicação nesta entrada parcial.
- Audit de dependências: 126 avisos herdados (10 critical, 53 high, 61 moderate, 2 low), registrados como CONCERNS de baseline; não se declara npm audit aprovado. dependencies/devDependencies e package-lock são idênticos à base `1ab82aec`, sem dependência nova nesta entrega. Atualizar a stack inteira fica fora do escopo da publicação de staging; nenhuma promoção para produção está autorizada.

### File List

- `docs/stories/story-staging-sincronizacao-fluxo-staging-primeiro.md` — criado nesta preparação.
- `AGENTS.md` — política permanente de staging primeiro e promoção explícita.
- `docs/dev-tools.md` — ambiente ativo, sequência de entrega e comandos de staging.
- `scripts/configurar-assessoria-smart-revisao.mts` — seleção explícita/default de staging e proteções de destino.
- `docs/reports/staging-sincronizacao-20261020.md` — inventário completo do pacote de app, exclusões e evidências de release, mantido no worktree isolado por DevOps.

Os demais arquivos do aplicativo, testes e documentação efetivamente incluídos na release constam no inventário acima; ferramentas de piloto, `testApis`, dados, segredos e caches não pertencem ao pacote do painel.

## QA Results

Pendente de execução e revisão da entrega.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-10-20 | 0.1 | Preparação a partir do pedido direto, critérios e checklist de draft | River (@sm) |
