# Story: Liberar download no Instagram Studio embutido

**ID:** STORY-MARKETING-INSTAGRAM-STUDIO-DOWNLOAD
**Módulo:** Marketing / Instagram Studio
**Status:** In Progress
**Prioridade:** Alta
**Tipo:** Frontend / Deploy
**Data de criação:** 2026-07-28

## Executor Assignment

```yaml
executor: "@dev"
quality_gate: "@qa"
quality_gate_tools:
  - vitest
  - eslint
  - typescript
  - next-build
  - browser
```

## Story

**Como** usuário autorizado do Instagram Studio no Painel Alpha,
**quero** baixar arquivos pelo botão **Download** da aplicação embutida,
**para** concluir o fluxo sem precisar abrir o Studio fora do painel.

## Acceptance Criteria

- [x] **AC-001 — Iframe correto:** A correção é aplicada ao iframe que incorpora a URL externa do Instagram Studio em `src/app/PainelAlpha/Marketing/MarketingClient.tsx`; o iframe persistente de abas em `PainelLayoutClient.tsx` não é alterado.
- [x] **AC-002 — Sandbox preservado:** O iframe do Instagram Studio continua com o atributo `sandbox` e preserva os tokens atuais `allow-same-origin`, `allow-scripts` e `allow-forms`.
- [x] **AC-003 — Permissões mínimas adicionadas:** O mesmo `sandbox` inclui `allow-downloads` e `allow-top-navigation-by-user-activation`, sem adicionar `allow-top-navigation` irrestrito, remover o sandbox ou ampliar outras capacidades.
- [ ] **AC-004 — Download funcional:** Em navegador suportado, dentro do Painel Alpha e com o Instagram Studio carregado, um clique normal no botão **Download** inicia/conclui o download esperado, sem exigir abrir nova aba, usar menu de contexto ou executar ação fora do iframe.
- [x] **AC-005 — Comportamento existente preservado:** Carregamento, estado de erro, tentativa de recarregar e exibição do Instagram Studio continuam funcionando como antes.
- [x] **AC-006 — Escopo de segurança:** Não há alteração em autenticação, autorização, permissões de usuários, `Marketing/page.tsx`, registro de módulos, iframe global de abas ou qualquer outra tela.
- [x] **AC-007 — Regressão automatizada:** Existe teste focado que detecta a remoção de qualquer um dos cinco tokens obrigatórios do sandbox e garante que o iframe continue sandboxed.
- [ ] **AC-008 — Quality gates:** `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` são executados e aprovados antes da entrega; eventual falha preexistente ou ambiental deve ser registrada com evidência e não pode ocultar regressão causada pela story.
- [ ] **AC-009 — Deploy e smoke pós-deploy:** Após aprovação dos gates, a correção é publicada pelo fluxo de deploy vigente do projeto e o clique normal em **Download** é validado novamente no ambiente publicado.

## Fora do Escopo

- Alterar o serviço externo Instagram Studio, sua URL ou a variável `NEXT_PUBLIC_INSTAGRAM_STUDIO_URL`.
- Alterar autenticação, sessão, papéis, permissões ou a regra de acesso `instagramStudio`.
- Alterar o mecanismo global de abas/iframes do Painel Alpha.
- Remover o `sandbox` ou conceder permissões adicionais além das duas exigidas nesta story.
- Modificar outras telas ou módulos.

## Tasks / Subtasks

- [x] **Task 1 — Ajustar o sandbox do iframe do Studio** (AC: 1–3, 5, 6)
  - [x] Alterar somente o iframe externo renderizado por `MarketingClient.tsx`.
  - [x] Preservar `allow-same-origin allow-scripts allow-forms`.
  - [x] Acrescentar `allow-downloads allow-top-navigation-by-user-activation`.
  - [x] Confirmar que o atributo `sandbox` permanece presente e sem permissões extras.

- [x] **Task 2 — Criar regressão automatizada focada** (AC: 2, 3, 7)
  - [x] Cobrir a presença do `sandbox` e dos cinco tokens obrigatórios.
  - [x] Cobrir a ausência de `allow-top-navigation` irrestrito.
  - [x] Manter o teste compatível com a infraestrutura Vitest existente.

- [ ] **Task 3 — Validar o fluxo real no navegador** (AC: 4, 5)
  - [ ] Acessar o módulo pelo Painel Alpha com usuário autorizado.
  - [ ] Aguardar o Instagram Studio carregar dentro do iframe.
  - [ ] Acionar **Download** com clique normal e comprovar que o arquivo foi baixado.
  - [ ] Verificar carregamento, erro/tentativa de recarga e navegação básica do Studio.

- [ ] **Task 4 — Executar gates e entregar** (AC: 6, 8, 9)
  - [x] Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.
  - [x] Revisar o diff para confirmar que auth, permissões, iframe global e outras telas não mudaram.
  - [x] Executar os gates CodeRabbit previstos e registrar os resultados.
  - [ ] Encaminhar o deploy ao agente autorizado e realizar smoke pós-deploy do download.

## Dev Notes

### Fluxo real verificado

- `Marketing/page.tsx` resolve `NEXT_PUBLIC_INSTAGRAM_STUDIO_URL`, valida sessão e acesso ao módulo e entrega somente `iframeUrl` ao client. Esse arquivo não precisa ser modificado. [Source: `src/app/PainelAlpha/Marketing/page.tsx`]
- `MarketingClient.tsx` renderiza o iframe que aponta diretamente para o Instagram Studio. Seu sandbox atual é `allow-same-origin allow-scripts allow-forms`; este é o ponto isolado da correção. [Source: `src/app/PainelAlpha/Marketing/MarketingClient.tsx`]
- `PainelLayoutClient.tsx` mantém um iframe por aba do Painel Alpha. Ele apenas carrega a rota `/PainelAlpha/Marketing` e não é o sandbox que bloqueia o download externo. [Source: `src/components/layout/PainelLayoutClient.tsx`, bloco “One iframe per tab”]
- Não foram encontrados documentos em `docs/architecture/`, `docs/prd/` nem `accumulated-context.md`; a coerência foi verificada diretamente no fluxo atual e nas regras do projeto.

### Restrições técnicas

- Valor final esperado do sandbox: `allow-same-origin allow-scripts allow-forms allow-downloads allow-top-navigation-by-user-activation`.
- `allow-top-navigation-by-user-activation` limita a navegação superior a uma ação iniciada pelo usuário; não substituir por `allow-top-navigation`.
- A mudança não envolve banco, migration, API, contrato de dados, novas variáveis de ambiente ou dependências.
- O deploy é parte da entrega, mas operações remotas permanecem sob responsabilidade do agente autorizado do projeto.

### [AUTO-DECISION]

- `[AUTO-DECISION] Qual iframe deve ser alterado? → O iframe externo de MarketingClient.tsx (reason: é o único com sandbox e incorpora diretamente o Instagram Studio).`
- `[AUTO-DECISION] A story deve seguir numeração de epic? → Usar o padrão descritivo já adotado em docs/stories (reason: o requisito não pertence a um epic numerado disponível e o usuário forneceu título/escopo direto).`

## Testing

| Cenário | Resultado esperado |
|---|---|
| Contrato do sandbox | Os cinco tokens obrigatórios estão presentes |
| Permissão excessiva | `allow-top-navigation` irrestrito não está presente |
| Clique normal em **Download** | O navegador baixa o arquivo dentro do fluxo embutido |
| Carregamento e retry | Comportamento atual permanece funcional |
| Usuário autorizado | Acessa o Studio como antes |
| Auth/permissões | Nenhum arquivo ou comportamento do controle de acesso é alterado |
| Smoke pós-deploy | Download funciona no ambiente publicado |

## CodeRabbit Integration

- **Primary Type:** Frontend
- **Secondary Type:** Deployment
- **Complexity:** Low — alteração isolada em um iframe, com validação real de integração.
- **Primary Agents:** `@dev`
- **Supporting Agents:** `@qa`, `@github-devops`
- [ ] **Pre-Commit (@dev):** executar CodeRabbit em alterações não commitadas, com foco no sandbox mínimo e no escopo.
- [ ] **Pre-PR (@github-devops):** revisar regressões e confirmar zero findings CRITICAL.
- [ ] **Pre-Deployment (@github-devops):** confirmar gates, diff restrito e prontidão de rollback.
- **Self-healing:** `@dev` light, máximo de 2 iterações, 15 minutos, CRITICAL `auto_fix` e HIGH `document_only`.
- **Focus Areas:** preservação do sandbox, princípio de menor privilégio, ausência de mudanças em auth/permissões e evidência do download no navegador.

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-07-28 | 1.0 | Story criada, mapeada e validada para desenvolvimento | River (SM) |

## Dev Agent Record

### Agent Model Used

Codex (GPT-5)

### Debug Log References

- `npx eslint src/app/PainelAlpha/Marketing/MarketingClient.tsx tests/marketing/instagram-studio-iframe.test.ts` — aprovado.
- `npx vitest run tests/marketing/instagram-studio-iframe.test.ts --coverage=false` — 1/1 aprovado.
- `npm run lint` — atingiu o limite de 120 s ao percorrer o repositório completo.
- `npm run typecheck` — bloqueios preexistentes em `ExclusaoFiscal/route`, `ModalPerfilColaborador` e `HabilitacaoRadarClient`.
- `npm test` — 378 aprovados e 3 falhas preexistentes no mock `auditoriaComissao.create`.
- `npx vitest run --coverage=false --exclude tests/commissions/configuracoes.test.ts` — 372/372 aprovados.
- `npm run build` — `prisma generate` bloqueado por lock local do DLL do engine.
- `npx next build` — aprovado.
- Browser conectado — indisponível; lista de navegadores retornou vazia.
- CodeRabbit — WSL indisponível; revisão manual registrada em `docs/qa/coderabbit-reports/`.

### Completion Notes List

- O iframe efetivamente usado para a URL externa recebeu somente os dois tokens solicitados.
- O iframe global de abas e os controles de autenticação/permissão não foram alterados.
- O Instagram Studio configurado em `.env.local` respondeu HTTP 200.
- A validação visual do clique permanece pendente por ausência de navegador conectado.

### File List

- `src/app/PainelAlpha/Marketing/MarketingClient.tsx`
- `tests/marketing/instagram-studio-iframe.test.ts`
- `docs/stories/story-marketing-instagram-studio-download-iframe.md`
- `docs/qa/coderabbit-reports/story-marketing-instagram-studio-download-iframe.md`
## QA Results
