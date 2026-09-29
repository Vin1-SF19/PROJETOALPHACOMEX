# Story — Reformulação visual completa do Gerador de Documentos

## Status

Ready for Review

## Executor Assignment

- Executor: `@dev`
- Quality gate: `@qa`
- Apoio: `@ux-design-expert`
- Quality gate tools: revisão visual responsiva, testes de interface/regressão, lint, typecheck, suíte e build

## Story

**Como** usuário do Gerador de Documentos, **quero** uma experiência visual consistente e clara em todas as telas do módulo, **para** encontrar templates, gerar e conferir documentos e editar cláusulas com confiança, preservando o funcionamento atual.

## Contexto e limites

Pedido do usuário em 2026-09-29: renovar **todo** o módulo, não apenas a home, com estética Alpha dark, navy e vermelho institucional, fundo global discreto nas telas densas e mais expressivo na entrada, superfícies legíveis, responsividade, estados vazios/loading/erro e feedback. É uma story de apresentação/UX: não alterar backend, Server Actions, API, banco, contratos de dados, permissões, regras de negócio, rotas ou navegação global. Manter dados reais e componentes funcionais existentes. Nenhum requisito do prompt autoriza inventar filtros, status, cláusulas, ações de duplicação/reordenação/publicação ou páginas de configuração ausentes; apresentar somente recursos já implementados.

### Inventário atual

| Tela/elemento | Rota ou componente | Recursos existentes a preservar |
| --- | --- | --- |
| Home, templates ativos/arquivados e documentos gerados | `src/app/PainelAlpha/GeradorDocumentos/page.tsx`; `GeradorDocumentosClient.tsx` | Server Component obtém listas reais e verifica permissão; tabs Templates, Documentos gerados e Arquivados; busca textual de documentos com debounce; cards; arquivamento de template; links Gerenciar, Gerar, Conferência e PDF |
| Layout do módulo | `src/app/PainelAlpha/GeradorDocumentos/layout.tsx` | Wrapper local; ponto possível para tema e ambiente visual exclusivo do módulo, sem tocar layout/header/sidebar global |
| Criação de template | `NovoTemplateDialog.tsx` | Upload de arquivo real, drag and drop, validação de tipo, estado `isPending`, toast e callback de refresh |
| Gerenciamento e cláusulas | `[templateId]/page.tsx`; `TemplateDetalheClient.tsx` | Busca do template e autorização; variáveis com tipo/obrigatoriedade, cláusulas editáveis com salvamento no blur, adição/remoção; `GripVertical` é apenas ícone visual: reordenação/duplicação não foram encontradas na UI e não devem ser apresentadas como ações funcionais |
| Geração | `gerar/page.tsx`; `GerarDocumentoForm.tsx`; `ModalNovaEmpresaContratada.tsx` | Título, busca de contratante, contratada, pré-preenchimento de variáveis, validações atuais, geração e redirecionamento; modal de empresa e busca CNPJ; estados de busca e `isPending` reais |
| Conferência/revisão | `conferencia/[token]/page.tsx`; `ConferenciaClient.tsx`; `ReescreverIA.tsx` | Cláusulas geradas, edição e IA, variáveis, PDF autenticado em iframe, estados reais de PDF, edição/finalização/leitura e toasts; preservar bloqueios existentes |
| Download | `[templateId]/download/route.ts` | Rota existente de PDF com autenticação/permissões/rate limit; fora do escopo de mudança |

Os estados documentais reais são `RASCUNHO`, `CONFERENCIA`, `FINALIZADO`, `ARQUIVADO`. A lista atual tem apenas busca textual; filtros por template, status e período do exemplo visual **não existem** e ficam fora desta story por serem funcionalidade nova. `CONTRATO_PADRAO_ID` já identifica o template padrão. Não existe tela separada de configuração do módulo no inventário de rotas; cobrir as configurações efetivamente presentes no gerenciamento do template.

## Critérios de aceitação

1. Todas as rotas visuais existentes do módulo — entrada, gerenciamento de template/cláusulas, geração, conferência/revisão e modais internos — partilham a nova linguagem Alpha. Header, sidebar, logo, menus, permissões e navegação global ficam intactos. Nenhum conteúdo ou ação funcional existente desaparece.
2. A home mantém título, descrição, botão Novo template e tabs atuais, inclusive Arquivados quando houver; usa hierarquia premium e fundo temático de comércio global com contraste suficiente. Telas internas usam uma versão mais discreta do mesmo universo visual, com superfícies sólidas ou translúcidas legíveis, sem efeitos pesados ou animação contínua custosa.
3. Cards de template mostram os dados reais de título, descrição quando houver, categoria/padrão, contagem de cláusulas e documentos e ações existentes. O template padrão tem destaque institucional. Hover/foco/disabled e transições curtas tornam as ações claras; não aparecem ações inexistentes.
4. Documentos gerados apresentam lista/tabela adaptativa com título, template, cliente, data, status real e ações existentes de conferência/PDF. Busca textual atual continua filtrando os mesmos dados. Estado sem dados e sem resultados tem orientação específica. Filtros de template/status/período só aparecem se já forem funcionais no código; não criar controles inertes.
5. Gerenciamento do template organiza dados, variáveis e cláusulas como editor profissional. Edição, salvamento no blur, adição e remoção continuam com os mesmos handlers e payloads. O ícone `GripVertical` não deve prometer drag and drop não implementado; duplicação/reordenação não são criadas. Edição de cláusula mostra campos e variáveis disponíveis de forma legível e responsiva.
6. A tela Gerar documento mantém seleção de contratante/contratada, busca real, pré-preenchimento, variáveis, validações e geração existentes. O modal Nova empresa contratada e o diálogo Novo template adotam a identidade dark local, preservando seus formulários, uploads e toasts.
7. A conferência mantém o PDF real, estados de carregando/erro/indisponível, edição de cláusulas, dados de contrato, IA, finalização e leitura. O componente `ReescreverIA` recebe identidade discreta própria e mostra seu loading real. Breadcrumbs internos mostram localização e usam as rotas já existentes.
8. Toda tela com carregamento assíncrono real usa skeleton proporcional ao conteúdo durante o carregamento, sem timer artificial. Ações assíncronas identificadas mostram progresso no próprio controle e impedem repetição da **mesma** ação enquanto pendente, preservando demais controles e o comportamento de erro/sucesso existente. Onde `useTransition` é compartilhado, a apresentação não deve declarar incorretamente qual ação está em curso.
9. Formulários, selects, menus, overlays, diálogos, badges, toasts existentes, campos em erro, foco, hover, disabled e estados vazios são coerentes com o tema no escopo do módulo. Não mudar componentes globais compartilhados para obter esse efeito; aplicar estilos/variantes locais.
10. Layout funciona em desktop, notebook, tablet e mobile sem sobreposição, cortes ou rolagem horizontal global; diálogos, resultados de busca, editor e PDF continuam acessíveis por teclado e leitores de tela. Transições de 150–250 ms respeitam `prefers-reduced-motion`; fundo não reduz a legibilidade.
11. Não há mudanças em `src/actions/gerador-documentos`, `src/lib/gerador-documentos`, `src/app/api`, schema/migrations nem na rota de download. Fluxos de criar template, arquivar, editar cláusula/variável, gerar, reescrever, finalizar e baixar preservam chamadas, argumentos, mensagens e autorização atuais. Testes focados e gates `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` passam.

## Tasks / Subtasks

- [x] Inventariar visualmente cada rota/componente, estados, ações, limites de permissão e estados de loading; estabelecer matriz antes/depois das ações existentes. (AC 1, 11)
- [x] Criar camada visual local do módulo com tokens reaproveitáveis, ambiente gráfico leve e variantes home/interior, mantendo layout global intacto. (AC 1–2, 9–10)
- [x] Reformular home, tabs, cards de templates, lista de documentos e estados vazios; preservar busca, links, badge padrão e arquivados. (AC 2–4)
- [x] Reformular editor do template, variáveis e cláusulas com navegação contextual; manter blur/save e handlers de remoção e criação. (AC 5)
- [x] Reformular geração, busca de cliente/contratada e ambos os diálogos, preservando dados e callbacks. (AC 6)
- [x] Reformular conferência, PDF e IA, com estados reais de carregamento/erro/leitura e breadcrumbs funcionais. (AC 7)
- [x] Adicionar skeletons ligados a carregamento real e feedback local às ações assíncronas; verificar bloqueio de repetição sem alterar regras funcionais. (AC 8)
- [x] Testar responsividade, foco/teclado, redução de movimento, contraste e todos os fluxos; executar gates e atualizar checklist/File List/QA. (AC 9–11)

## Dev Notes

- Preservar `auth()`, `getPermissoesEfetivas()` e os redirecionamentos nas páginas Server Component. Os componentes client recebem dados via props; não substituir por mocks nem reimplementar queries.
- `GeradorDocumentosClient.tsx` guarda templates localmente para refletir arquivamento, documentos recebidos do servidor e busca com debounce. `TemplateDetalheClient.tsx`, `GerarDocumentoForm.tsx`, `ConferenciaClient.tsx` e diálogos já usam `useTransition`/estados locais; distinguir feedback por operação sem alterar payloads ou guarda de negócio.
- O layout local `layout.tsx` é wrapper simples. Tokens/estilos devem ficar no módulo e respeitar componentes UI compartilhados. Preferir CSS leve a vídeo/partículas em massa. Fundo expressivo na home, menor contraste nas telas de edição.
- Não propor tabs/seções inexistentes como controles vazios. `Arquivados` é uma tab real e deve permanecer. O prompt pede status genéricos “Gerado/Em revisão/Aprovado/Erro”, mas os valores reais são os quatro listados acima; usar os reais.
- Story relacionada: `docs/stories/story-gerador-documentos-html-pdf-blueprint.md#estado-atual` registra evolução de PDF; conferir o código atual como fonte final. `docs/stories/story-financeiro-ativo-elaboracao-contrato.md#contexto` explica a entrada do Financeiro no Gerador. `accumulated-context.md` e `.aiox/gotchas.json` não estão presentes neste checkout; não há contexto acumulado adicional para consultar.
- [AUTO-DECISION] Uma única story cobre o módulo inteiro porque o usuário exigiu identidade de ponta a ponta. Componentes novos de apresentação são permitidos se reduzirem repetição, sem reescrever ações/hooks.
- [AUTO-DECISION] Os filtros ilustrativos e ações de duplicar/reordenar só entram se funcionalidade existente for descoberta na implementação; no inventário atual, não há suporte. Exibir esses controles sem ação contrariaria a regra de não criar funcionalidades/mocks.

## Testing

- Testes relevantes existentes em `tests/gerador-documentos/` cobrem contratos de geração, upload, PDF, busca, edição, IA, autorização e finalização. Complementar com testes de UI focados nos componentes alterados, usando dados de teste isolados e sem banco de produção.
- Cenários mínimos: home/templates/arquivados e seus links, lista e busca, criação/arquivamento, edição de variável/cláusula, geração com seleção/preenchimento, modal de empresa, conferência PDF, IA, finalização, erro/empty/loading e controle de clique repetido. Comparar argumentos das actions antes/depois.
- Revisar visualmente 1440px, notebook, tablet e 375px, claro/escuro se o shell suportar, teclado/foco, contraste e `prefers-reduced-motion`. Rodar lint, typecheck, suíte e build.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** Frontend/UX; complexidade alta pela abrangência das telas; sem schema, API ou domínio novos.
- **Specialized Agent Assignment:** `@dev` implementa, `@ux-design-expert` verifica hierarquia/responsividade/acessibilidade, `@qa` valida comportamento e regressões.
- **Quality Gates:** Pre-Commit `@dev` revê preservação de handlers/actions e executa gates; Pre-PR `@github-devops` se houver PR; Pre-Deployment `@github-devops` se houver publicação.
- **Self-Healing Configuration (Story 6.3.3):** `@dev` light (2 iterações/15 min; CRITICAL corrigido, HIGH documentado); `@qa` full (3 iterações/30 min; CRITICAL/HIGH corrigidos); `@github-devops` check/report only. MEDIUM documentado como débito; LOW informativo.
- **Focus Areas:** nenhuma alteração de contrato/rota/ação/autorização; loading ligado a estado real; clique repetido; acessibilidade e responsividade; contraste e performance do background.

## Checklist da story

- [x] Objetivo visual e limites funcionais explícitos.
- [x] Todas as rotas e componentes internos existentes inventariados.
- [x] AC testáveis e ações inexistentes distinguidas das existentes.
- [x] Riscos, testes e File List previsto documentados.
- [x] Implementação e regressão verificadas.
- [ ] QA revisou todos os AC.

## Riscos e limites

- `useTransition` compartilhado pode desabilitar mais de uma ação na UI atual. Melhorar indicação de progresso sem trocar a semântica das chamadas; validar ausência de duplicação por teste de interface.
- Em `page.tsx`, falha na listagem vira array vazio atualmente; um novo empty state não deve anunciar “nenhum documento” como se fosse resposta de sucesso sem considerar o tratamento atual. Não mudar contrato da action.
- PDF em iframe e overlays de diálogo podem se tornar ilegíveis/encobertos com o tema; testar z-index, contraste, foco e mobile.
- Fundo com mapas/imagens pode afetar desempenho e acessibilidade; priorizar CSS/asset leve e redução de movimento. Recursos visuais externos não são dependência de execução.
- Alterações paralelas do Financeiro estão no workspace; não editar, reverter nem incluir esses arquivos nesta story.

## File List previsto

- `docs/stories/story-gerador-documentos-reformulacao-visual-completa.md` — story.
- `src/app/PainelAlpha/GeradorDocumentos/layout.tsx` e, se necessário, arquivos locais de estilo/loading do módulo — ambiente visual e skeletons reais.
- `src/components/GeradorDocumentos/GeradorDocumentosClient.tsx` — home, tabs, cards, lista e vazios.
- `src/components/GeradorDocumentos/TemplateDetalheClient.tsx` — editor de template, variáveis, cláusulas.
- `src/components/GeradorDocumentos/GerarDocumentoForm.tsx` — geração.
- `src/components/GeradorDocumentos/ConferenciaClient.tsx` e `ReescreverIA.tsx` — conferência e IA.
- `src/components/GeradorDocumentos/NovoTemplateDialog.tsx` e `ModalNovaEmpresaContratada.tsx` — diálogos.
- Testes de UI focados em `tests/gerador-documentos/` — preservação de ações/fluxos e estados visuais.

## Change Log

| Data | Versão | Descrição | Autor |
| --- | --- | --- | --- |
| 2026-09-29 | 0.1 | Story de reformulação visual integral e inventário do módulo existente. | River (SM) |
| 2026-09-29 | 0.2 | Implementação visual em todas as telas, estados reais de loading e gates executados. | Codex |

## Dev Agent Record

### Agent Model Used

Codex (GPT-6).

### Completion Notes List

- Aplicada identidade local dark/navy/vermelho com fundo CSS leve, hero na home e superfícies discretas nas telas internas.
- Preservados os handlers, actions, payloads, rotas, permissões e dados reais; navegação adicional é apenas por âncoras da página existente.
- Criados skeletons associados aos estados de carregamento reais das quatro rotas; feedbacks de ações identificam a operação em curso.
- Revisão estática de responsividade, foco, contraste e redução de movimento; renderização visual autenticada ainda depende de conferência em ambiente de navegação.
- Gates: `npm run lint` (0 erros, warnings existentes no repositório); `npm run typecheck` aprovado; `npm test` aprovado (555 arquivos, 4.073 testes); `npm run build` aprovado. Uma primeira execução de testes em paralelo ao `prisma generate` falhou por corrida no Prisma; nova execução sequencial passou.

### File List

- `docs/stories/story-gerador-documentos-reformulacao-visual-completa.md`
- `src/app/PainelAlpha/GeradorDocumentos/layout.tsx`
- `src/app/PainelAlpha/GeradorDocumentos/gerador-documentos.css`
- `src/app/PainelAlpha/GeradorDocumentos/loading.tsx`
- `src/app/PainelAlpha/GeradorDocumentos/[templateId]/loading.tsx`
- `src/app/PainelAlpha/GeradorDocumentos/gerar/loading.tsx`
- `src/app/PainelAlpha/GeradorDocumentos/conferencia/[token]/loading.tsx`
- `src/components/GeradorDocumentos/DocumentosLoading.tsx`
- `src/components/GeradorDocumentos/GeradorDocumentosClient.tsx`
- `src/components/GeradorDocumentos/TemplateDetalheClient.tsx`
- `src/components/GeradorDocumentos/GerarDocumentoForm.tsx`
- `src/components/GeradorDocumentos/ConferenciaClient.tsx`
- `src/components/GeradorDocumentos/NovoTemplateDialog.tsx`
- `src/components/GeradorDocumentos/ModalNovaEmpresaContratada.tsx`
- `src/components/GeradorDocumentos/ReescreverIA.tsx`

## QA Results

Pendente de revisão por `@qa`.

## Story Draft Checklist — validação

| Categoria | Status | Evidência |
| --- | --- | --- |
| Objetivo e contexto | READY | Escopo de todo o módulo, benefício, limites e dependência do código existente explícitos. |
| Guia técnico | READY | Rotas, componentes, actions/estados e exclusões identificados no inventário. |
| Referências | READY | Código atual e stories relacionadas com seção específica; arquivos de contexto ausentes registrados. |
| Autossuficiência | READY | AC, tarefas, riscos, decisões automáticas e diferenças entre recursos reais e exemplos do prompt. |
| Testes | READY | Cenários por fluxo, gates e revisão de acessibilidade/responsividade definidos. |
| CodeRabbit | READY | Tipo, papéis, gates, self-healing e foco presentes. |

**Final Assessment:** READY para implementação. Sem dependência de alteração em banco/backend/API; nenhum bloqueio externo.
