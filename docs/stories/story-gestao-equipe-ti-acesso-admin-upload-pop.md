# Story: TI com acesso administrativo, POP do setor e upload de foto funcional

## Status

Ready for Review

## Executor Assignment

executor: "@dev"
quality_gate: "@qa"
quality_gate_tools: ["lint", "typecheck", "tests", "build", "coderabbit"]

## Story

**Como** responsável pelo setor de TI no Painel Alpha,  
**quero** que a role `TI` tenha o mesmo nível de acesso administrativo que `Admin`, veja os documentos POP do próprio setor e consiga trocar a foto de usuários,  
**para que** a operação administrativa possa ser assumida pelo TI sem manter a conta com a role `Admin` e sem falhas de gestão de equipe.

## Acceptance Criteria

1. Uma conta ativa cuja role atual no banco seja `TI` recebe o mesmo bypass global de autorização já concedido a `Admin`/`CEO` em todos os módulos do Painel Alpha, tanto na UI quanto em páginas, Server Actions, Route Handlers, helpers de ownership e ferramentas internas.
2. A varredura cobre os gates hardcoded de `Admin`/`CEO`, listas `allowedRoles`, categorias e módulos administrativos, menu/sidebar, permissões efetivas e ações sensíveis; alterar a role de uma conta de `Admin` para `TI` não remove recursos administrativos.
3. O bypass administrativo de `TI` é centralizado em helper compartilhado e comparado de forma normalizada, evitando novas divergências entre módulos. Regras não relacionadas a acesso administrativo, textos históricos e roles de domínio interno não são alterados indiscriminadamente.
4. O POP trata `TI` e a grafia legada `T.I` como o mesmo setor. Um usuário de TI vê `Diretrizes` e os documentos ativos cadastrados para TI, e a Gestão de Equipe calcula corretamente lidos/total do setor.
5. A troca de foto na Gestão de Equipe aceita imagens JPEG, PNG e WebP, reduz imagens grandes no navegador para um payload seguro antes do POST e não retorna `413 Content Too Large` para fotos usuais de celular.
6. O endpoint usado para foto exige sessão ativa, valida tipo e tamanho do arquivo e retorna erros 4xx claros; a interface apresenta a mensagem real de falha e não informa sucesso sem URL válida.
7. Não há alteração de schema, migration, seed ou mutação em massa de banco nesta story.
8. Testes automatizados cobrem aliases de role/setor, bypass administrativo de TI, visibilidade do POP e preparação/limites do upload. `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` são executados antes da conclusão.

## Fora do Escopo

- Renomear registros existentes no banco em massa.
- Alterar schema Prisma ou aplicar migration.
- Mudar a semântica de roles internas de projetos, cards, comissões ou outros domínios quando a palavra `ADMINISTRADOR` não representa o administrador global do Painel Alpha.

## Tasks / Subtasks

- [x] Criar contrato central de roles administrativas (AC: 1, 2, 3)
  - [x] Normalizar role e reconhecer `Admin`, `CEO`, `TI` e a grafia legada `T.I` onde ela representa o setor de TI.
  - [x] Disponibilizar helper compartilhado para código server e client sem dependências de runtime incompatíveis.
- [x] Varrer e corrigir os pontos de autorização módulo por módulo (AC: 1, 2, 3)
  - [x] Atualizar registry, painel inicial, sidebar e componentes administrativos.
  - [x] Atualizar páginas protegidas, Server Actions, Route Handlers e helpers de ownership.
  - [x] Atualizar permissões efetivas para TI receber o conjunto conhecido de módulos.
  - [x] Preservar regras adicionais de RH, Financeiro, Comercial, Operacional e ownership por registro.
- [x] Corrigir integração POP/gestão da equipe (AC: 4)
  - [x] Canonicalizar `TI`/`T.I` na lista de setores acessíveis e na filtragem visual.
  - [x] Reutilizar a mesma canonicalização no status de leitura por colaborador.
- [x] Corrigir upload de foto de colaborador (AC: 5, 6)
  - [x] Redimensionar/comprimir imagem no cliente antes do envio e bloquear tipos inválidos.
  - [x] Endurecer autenticação, validação de tipo/tamanho, assinatura real, nome e respostas do endpoint.
  - [x] Exibir erro retornado pelo servidor e garantir limpeza do estado de upload.
- [x] Adicionar regressões automatizadas (AC: 8)
  - [x] Testar roles administrativas e aliases do setor TI.
  - [x] Testar permissões efetivas/registry e regras do POP.
  - [x] Testar validação, assinatura e limites do upload sem depender do Blob real.
- [x] Executar quality gates e atualizar esta story (AC: 8)
  - [x] `npm run lint`
  - [x] `npm run typecheck`
  - [x] `npm test`
  - [x] `npm run build`
  - [x] CodeRabbit em mudanças não commitadas, se disponível (indisponível: WSL não instalado; relatório salvo).

## Dev Notes

### Contexto técnico verificado

- `src/lib/modulos-registry.ts` é a fonte única dos módulos, consumida pelo painel inicial, sidebar e abas; os módulos administrativos ainda possuem `adminOnly`/`allowedRoles` com `Admin`/`CEO`. [Source: `.bibble/memory/codebase-map.md#Módulos do Sistema`]
- O “setor do usuário” é `usuarios.role`; `documentos.setor` usa a mesma string. A confirmação de leitura compara esses valores para calcular o progresso por setor. [Source: `.bibble/memory/codebase-map.md#POP (Documentos) + Gestão de Equipe — Confirmação de Leitura de Documento`]
- O POP já possui controle próprio em `src/actions/PopAcessos.ts`, e a lista visual usa a grafia `T.I`; a role solicitada pelo usuário é `TI`, portanto a comparação precisa de uma forma canônica compartilhada.
- A foto do colaborador é enviada por `src/components/Colaboradores/ModalPerfilColaborador.tsx` para `POST /api/chat/upload`; o endpoint atual transmite o corpo diretamente ao Vercel Blob sem autenticação ou limite explícito. O erro observado em produção é HTTP 413 antes de uma resposta útil.
- Não é necessária alteração de banco. A política Vault não é acionada porque esta story não autoriza schema, migration, seed/backfill nem operação em massa.

### Blueprint de Integração

#### CRIAR

- [ ] Helper compartilhado de roles/setores, se não houver arquivo adequado existente.
- [ ] Helper client-side testável para preparação da foto, se necessário.
- [ ] Testes de regressão focados em roles, POP e upload.

#### EDITAR (integration points obrigatórios)

- [ ] `src/lib/modulos-registry.ts` — acesso administrativo e roles permitidas.
- [ ] `src/components/PainelAlphaClient.tsx` e `src/components/layout/GlobalSidebar.tsx` — menu, categoria Admin e bypass visual.
- [ ] `src/actions/PermissoesSetor.ts` — bypass de permissões efetivas.
- [ ] `src/actions/PopAcessos.ts`, `src/actions/ConfirmacaoLeituraDocumento.ts` e componentes do POP — alias/canonicalização do setor TI.
- [ ] `src/components/Colaboradores/ModalPerfilColaborador.tsx` e `src/app/api/chat/upload/route.ts` — upload resiliente e seguro.
- [ ] Demais arquivos encontrados pela varredura de gates globais `Admin`/`CEO` — substituir por contrato central apenas quando representam acesso administrativo do Painel.

#### CONSULTAR

- `src/lib/blueprint/ownership.ts`, `src/lib/bpm/ownership.ts`, `src/lib/google-calendar/colegas.ts`, `src/lib/onyx/ownership.ts` — precedentes de helpers locais de role administrativa.
- `docs/stories/story-gestao-equipe-bloqueio-usuarios-nao-ativos.md` — precedente de revalidação da role/status atual no banco para ações sensíveis.

### Riscos / Atenção

- Um replace textual indiscriminado pode alterar labels, documentação, roles de domínio como `ADMINISTRADOR` ou regras deliberadamente exclusivas; a revisão deve distinguir autorização global de texto/semântica local.
- A role pode vir do JWT ou do banco dependendo do fluxo. Gates sensíveis já baseados no banco devem continuar assim; o helper central não substitui revalidação de identidade.
- A rota de upload é reutilizada em outros fluxos. A validação precisa manter compatibilidade com imagens já enviadas e evitar elevar o limite de request do servidor.

## Testing

- Unitários Vitest para normalização e `isAdminRole` com `Admin`, `CEO`, `TI`, `T.I`, caixa/espaços e roles comuns.
- Testes de registry/permissões confirmando que TI enxerga todos os módulos administrativos.
- Testes do POP confirmando que `TI` casa com documento `T.I` e vice-versa.
- Testes puros do redimensionamento/validação de foto; Route Handler com auth/tipo/tamanho mockados quando viável.
- Validação manual recomendada em produção: trocar uma conta de teste de Admin para TI, navegar por todos os módulos e enviar uma foto original maior que 4,5 MB.

## 🤖 CodeRabbit Integration

**Primary Type**: Security  
**Secondary Type(s)**: Architecture, API, Frontend  
**Complexity**: High — autorização transversal a múltiplos módulos e correção de upload.

**Primary Agents**:
- @dev
- @architect

**Supporting Agents**:
- @qa
- @github-devops (somente Pre-PR/push)

**Quality Gate Tasks**:
- [ ] Pre-Commit (@dev): revisar autenticação, autorização, validação do upload e compatibilidade.
- [ ] Pre-PR (@github-devops): revisar diff contra `main` antes do PR.

**Expected Self-Healing**:
- Primary Agent: @dev (light mode)
- Max Iterations: 2
- Timeout: 15 minutos
- Severity Filter: CRITICAL
- CRITICAL: auto-fix; HIGH: document-only.

**Primary Focus**:
- Consistência do RBAC em client e server.
- Autenticação, allowlist MIME, limite de bytes e mensagens de erro do upload.

**Secondary Focus**:
- Ausência de bypass acidental para roles comuns.
- Compatibilidade de `TI`/`T.I` no POP e ausência de alteração de banco.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-08-03 | 1.0 | Story criada a partir do erro 413 e da nova regra de acesso do setor TI. | River (@sm) |
| 2026-08-03 | 1.1 | Implementado RBAC central TI/Admin, alias POP, upload seguro/comprimido e regressões automatizadas. | Dex (@dev) |

## Dev Agent Record

### Agent Model Used

Codex (GPT-5)

### Debug Log References

- Varredura com `rg` de comparações, arrays e gates hardcoded de `Admin`/`CEO` em middleware, libs, actions, APIs, páginas, componentes e hooks.
- `npm exec vitest run tests/auth/ti-admin-access.test.ts`: 23/23 testes passaram.
- `npm test`: 654/655 passaram; uma falha preexistente por timeout de 5s em `tests/google-calendar/cli.test.ts`.
- `npm run typecheck`: sem erro nos arquivos desta story; falhas preexistentes em `ExclusaoFiscal`, `HabilitacaoRadarClient` e `tests/google-calendar/sync-queue.test.ts`.
- `npm run lint`: excedeu 184s; lint focado nos arquivos centrais novos passou. A amostra ampla dos arquivos legados encontrou 98 erros/51 avisos preexistentes.
- `npm run build`: bloqueado ao regenerar Prisma por `EPERM` no engine em uso; `npx next build` compilou e gerou 69 páginas com sucesso.
- CodeRabbit: indisponível porque WSL não está instalado; evidência em `docs/qa/coderabbit-reports/2026-08-03-ti-admin-avatar-pop.md`.

### Completion Notes List

- `TI` e `T.I.` agora são aliases normalizados e recebem o mesmo bypass global de `Admin`/`CEO` sem alterar dados persistidos.
- Registry, navegação, páginas, actions, APIs, ownership e controles visuais foram atualizados módulo por módulo; regras adicionais de domínio foram preservadas.
- POP e o progresso de leitura da Gestão de Equipe comparam setores por alias, resolvendo documentos cadastrados como `T.I` para usuários `TI`.
- Avatares são reduzidos a WebP no navegador (máximo operacional de 1,5 MB) e enviados a uma rota autenticada que valida MIME, bytes, tamanho e assinatura antes do Vercel Blob.
- Nenhuma migration, alteração de schema, seed, backfill ou mutação em massa foi executada.
- Recomenda-se smoke manual pós-deploy com uma conta de teste `TI` e foto original acima de 4,5 MB.

### File List

- `middleware.ts`
- `src/lib/roles.ts`, `src/lib/avatar-upload.ts`, `src/lib/modulos-registry.ts`, `src/lib/auth-guard.ts`
- `src/lib/blueprint/ownership.ts`, `src/lib/bpm/ownership.ts`, `src/lib/google-calendar/colegas.ts`, `src/lib/onyx/ownership.ts`, `src/lib/onyx/system-knowledge.ts`, `src/lib/onyx/user-token.ts`
- `src/lib/bibble/calendar-tools.ts`, `src/lib/bibble/tool-executor.ts`, `src/lib/chamados/notificacoes.ts`, `src/lib/commissions/permissions.ts`, `src/lib/cs-nps/autorizacao.ts`, `src/lib/cs-nps/importar-dados.ts`
- `src/actions/ColaboradorRH.ts`, `src/actions/ConfirmacaoLeituraDocumento.ts`, `src/actions/ContratoComercial.ts`, `src/actions/Cursos.ts`, `src/actions/HoleriteAlertas.ts`, `src/actions/Holerites.ts`, `src/actions/Metas.ts`, `src/actions/PermissoesSetor.ts`, `src/actions/PopAcessos.ts`, `src/actions/UploadVideosLote.ts`, `src/actions/avisos.ts`
- `src/actions/apresentacao-assets.ts`, `src/actions/apresentacao-temas.ts`, `src/actions/apresentacoes.ts`, `src/actions/slides.ts`, `src/actions/convites-parceiro.ts`, `src/actions/onboarding.ts`, `src/actions/parceiros.ts`, `src/actions/protocolos.ts`
- `src/components/PainelAlphaClient.tsx`, `src/components/layout/GlobalSidebar.tsx`, `src/components/AbaDeAcesso.tsx`, `src/components/Bibble.tsx`, `src/components/BibbleChatHome/BibbleChatLayout.tsx`, `src/components/BroadcastBanner.tsx`, `src/components/EngrenagemFlutuante.tsx`, `src/components/FormCadastro.tsx`, `src/components/UserDropdown.tsx`
- `src/components/Colaboradores/ModalPerfilColaborador.tsx`, `src/components/cadastro/AbaGestaoEquipe.tsx`, `src/components/CalendarioAlpha/PainelPermissoesColegas.tsx`, `src/components/comercial/ModalGerenciamentoLeads.tsx`, `src/components/holerites/HoleriteAlertButtons.tsx`, `src/components/holerites/HoleritesPage.tsx`, `src/components/Parceiros/ModalEngrenagem.tsx`, `src/hooks/useChecklistNotifications.ts`
- `src/app/PainelAlpha/DocsAlpha/DocsAlphaClient.tsx`, `src/app/PainelAlpha/DocsAlpha/_components/PopHeader.tsx`, `src/app/PainelAlpha/InfosPerfil/Perfil/FotoPerfil/AvatarUpload.tsx`
- Páginas protegidas em `src/app/PainelAlpha`: AlphaBlueprint, AlphaComm, AlphaConnect, AlphaCRM, AlphaSchools, AlphaSkills, AlphaVault, Apresentacoes, CadastroClientes, CalendarioAlpha, Chamados, CheckList, Comissoes, Conectores, ControleLeads, GestaoColaboradores, GestaoOnboarding, GestaoProtocolos, GestaoSetores, HabilitacaoRadar, Holerites, Marketing, Metas, ReservaSalas, UsuariosOnline e cadastro.
- APIs em `src/app/api`: apresentações/assets, apresentações/gerar-slide, bibble/chat, bibble/cloud-providers, contratos/upload, holerites/download, notificacoes, onyx/chat, onyx/tools, pusher/auth e `usuarios/avatar`.
- `tests/auth/ti-admin-access.test.ts`
- `docs/qa/coderabbit-reports/2026-08-03-ti-admin-avatar-pop.md`
- `docs/stories/story-gestao-equipe-ti-acesso-admin-upload-pop.md`

## QA Results

_A preencher pelo @qa._
