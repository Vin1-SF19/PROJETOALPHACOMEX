# Story — CHATBOT-ALPHA-FE-MOCK: Frontend nativo e operacional do Chatbot Alpha

**Projeto:** Painel Alpha
**Status:** `Ready for Done`
**Tipo:** Frontend / Arquitetura de frontend
**Complexidade:** Alta
**Criado em:** 2026-09-15
**Executor:** `@dev`
**Quality Gate:** `@architect`
**Quality Gate Tools:** TypeScript, ESLint, Vitest, Next build, revisão de acessibilidade, smoke de navegação

---

## 1. Story

**Como** operador interno com acesso ao módulo ChatBot Alpha,
**quero** navegar e operar uma interface nativa e completa de atendimento, contatos, automações, agentes, campanhas e configurações usando dados simulados,
**para que** a experiência do produto seja validada no Painel Alpha antes de conectar o motor ChatbotX hospedado externamente.

---

## 2. Contexto e valor

O ChatbotX em `/home/ialpha/projetos/ChatbotX-main` é uma referência funcional, não uma dependência de runtime. A implementação desta story deve traduzir os conceitos reais encontrados nele para os padrões do Painel Alpha, sem importar arquivos do projeto de referência e sem alterá-lo.

O Painel Alpha já possui a rota protegida `/PainelAlpha/ChatBotAlpha`, a permissão `chatBotAlpha` e uma implementação legada que consome actions/API do ChatbotX e exibe ferramentas de infraestrutura. Esta story cria uma nova superfície frontend, inteiramente simulada, com arquitetura preparada para a API futura.

O valor desta etapa é permitir validação de produto, UX, navegação, estados, contratos e fluxo operacional sem depender de Railway, banco, realtime ou canais externos.

### Relação e conflito com a story anterior

A story `docs/stories/story-rm-2026-3d529d-chatbot-alpha-replicar-frontend.md` está concluída e registra uma integração real limitada por workspace token, além do hub Infra. Ela determina “sem mocks em produção”, enquanto o pedido atual determina explicitamente uma fase frontend mock-only.

Para esta entrega, o pedido atual é a fonte de verdade do novo frontend:

- os arquivos legados permanecem preservados no repositório;
- o novo frontend não pode importar nem invocar `src/actions/ChatBotAlpha.ts`, `src/actions/ChatBotAlphaChat.ts` ou `src/lib/chatbot-alpha/chat-api.ts`;
- a rota operacional nova não deve expor a aba Infra nem iniciar chamadas externas;
- nenhuma action, cliente HTTP legado, iframe de infraestrutura ou configuração externa pode ser acionada pelo novo fluxo;
- a story anterior permanece como registro histórico, sem ser reescrita.

`[AUTO-DECISION] accumulated-context.md não existe no repositório → usar a story anterior, o código real, o diagnóstico Scout e a solicitação atual como contexto acumulado (razão: preservar coerência sem inventar um artefato ausente).`

---

## 3. Escopo funcional confirmado na referência

### Seções da nova aplicação

1. Dashboard
2. Inbox
3. Contatos
4. Fluxos
5. Agentes IA
6. Campanhas — adaptação do conceito `broadcasts` do ChatbotX
7. Sequências
8. Templates
9. Integrações
10. Configurações

### Canais reais mapeados

- WhatsApp
- Messenger
- Instagram
- TikTok
- Telegram
- Zalo
- Webchat
- SMTP/E-mail
- API
- Omnichannel somente como filtro/fallback visual, não como canal conectável

### Integrações reais mapeadas

- Workspace token
- OpenAI
- Gemini
- Claude
- DeepSeek
- OpenRouter
- OpenAI-compatible
- Google Sheets
- Facebook Ads
- Make
- ActiveCampaign
- GetResponse
- Mailchimp
- MailerLite
- Moosend
- Drip
- SendGrid
- Klaviyo

### Tipos canônicos de nodes de fluxo

- `sendMessage`
- `startFlow`
- `performAction`
- `condition`
- `sendMail`
- `splitTraffic`
- `wait`
- `followUp`
- `landingPage`
- `addNotes`

Não adicionar tipos de node, canais, integrações ou módulos que não estejam nesta lista sem novo diagnóstico e atualização da story.

---

## 4. Matriz de dependências A–F

| Classe | O que pertence à classe | Tratamento nesta story |
|---|---|---|
| **A — Visual/frontend** | Shell, navegação, dashboard, inbox em 2/3 painéis, contatos, editor de fluxos, agentes, campanhas, sequências, templates, integrações, configurações, filtros, formulários, modais, feedback, estados responsivos | Implementar integralmente com componentes nativos e mocks centralizados |
| **B — Backend** | Persistência real, CRUD remoto, envio real de mensagem, execução de flow, campanhas, sequências, upload, analytics real, configuração efetiva | Não implementar; representar apenas por interface `ChatbotService` e documentar em `docs/chatbot-backend-contract.md` |
| **C — Realtime** | `conversation.created`, `conversation.updated`, `message.created`, `message.updated`, `message.delivered`, `message.read`, `contact.updated` | Não abrir WebSocket/SSE/Pusher; tipar eventos e criar ponto único para aplicar eventos/atualizações locais no store |
| **D — Integrações externas** | Railway, WhatsApp, Instagram, Messenger, TikTok, Telegram, Zalo, Webchat, SMTP, API e provedores de marketing/IA | Não conectar, autenticar, testar credenciais, executar OAuth ou emitir requests; somente estados e modais visuais sem secrets |
| **E — Autenticação** | Sessão do Painel Alpha, permissão `chatBotAlpha`, futuro escopo/autenticação da API ChatbotX | Reutilizar apenas a autenticação/permissão já existente no Painel; documentar a autenticação futura no contrato, sem criar auth paralela |
| **F — Banco** | Conversas, mensagens, contatos, tags, flows, agentes, campanhas, sequências, templates, integrações e preferências persistidas | Não alterar schema, Prisma, migrations, seeds, backfills ou dados; usar apenas armazenamento em memória no provider/store mock |

---

## 5. Arquitetura frontend aprovada

```text
/PainelAlpha/ChatBotAlpha
  layout.tsx                      auth + permissão do módulo, uma única vez
  page.tsx                        redireciona para /dashboard
  /dashboard/page.tsx
  /inbox/page.tsx
  /contatos/page.tsx
  /fluxos/page.tsx
  /agentes/page.tsx
  /campanhas/page.tsx
  /sequencias/page.tsx
  /templates/page.tsx
  /integracoes/page.tsx
  /configuracoes/page.tsx

UI por seção
  ↓
Zustand store
  ↓
ChatbotService (contrato único)
  ↓
MockProvider (único provider habilitado nesta fase)
  ↓ futuro
ApiProvider / Railway (não implementar nesta story)
```

### Regras arquiteturais

- O módulo deve utilizar App Router e se integrar ao shell existente do Painel Alpha/GlobalTabBar.
- A proteção por `auth()`, `getPermissoesEfetivas()` e `isAdminRole()` deve ficar no layout do módulo; páginas filhas não duplicam a regra.
- A raiz `/PainelAlpha/ChatBotAlpha` deve manter compatibilidade e levar ao Dashboard.
- A navegação interna deve usar rotas reais e indicar seção ativa; não usar uma landing page ou tabs locais que escondam a URL.
- O store não pode conhecer a implementação do provider. Componentes não podem importar mock data diretamente.
- O `ChatbotService` deve expor operações tipadas por domínio. O provider mock implementa o mesmo contrato esperado para o provider de API futuro.
- O provider configurado nesta fase é invariavelmente `mock`. Pode existir um discriminante/configuração tipada para a troca futura, mas a opção `api` não pode executar rede nem ser implementada nesta story.
- Mocks ficam em um único pacote de domínio e não dentro de páginas/componentes.
- Atualizações simuladas devem aparecer sem reload completo; envio de mensagem, edição e alterações de status devem atualizar o store/cache local.
- O editor visual usa `@xyflow/react`, já instalado, para nodes, edges, zoom, pan e controles.
- Reutilizar Tailwind 4, componentes shadcn/Radix existentes, `lucide-react`, Sonner, Zustand e os tokens/padrões visuais do Painel Alpha.
- Não adicionar biblioteca nova sem necessidade comprovada.

---

## 6. Acceptance Criteria

1. A rota `/PainelAlpha/ChatBotAlpha` continua protegida por sessão e permissão `chatBotAlpha`, com bypass somente para admin, e redireciona para `/PainelAlpha/ChatBotAlpha/dashboard` sem chamar backend ChatbotX, Railway, webhooks ou ferramentas de infraestrutura.
2. O módulo possui shell e navegação nativos, densos e responsivos para Dashboard, Inbox, Contatos, Fluxos, Agentes, Campanhas, Sequências, Templates, Integrações e Configurações, com rota ativa, navegação por teclado e identidade visual do Painel Alpha.
3. Existe um modelo de tipos centralizado cobrindo conversas, mensagens, contatos, canais, tags, atendentes, flows/nodes/edges, agentes, campanhas, sequências, templates, integrações, métricas, paginação, filtros, estados operacionais e eventos realtime futuros.
4. Existe uma interface `ChatbotService` desacoplada da UI, com operações de leitura e mutação necessárias às dez seções; páginas e componentes acessam dados apenas por hooks/store/service.
5. Existe um `MockProvider` centralizado com dados realistas, paginação, busca, filtros, ordenação e mutações em memória; nenhum array de dados de domínio é declarado diretamente dentro de páginas.
6. Não existe execução de `fetch`, Server Action, WebSocket, SSE, Pusher, OAuth, webhook, SDK de canal ou cliente de e-mail no novo frontend; o novo fluxo não importa as actions/clientes legados do ChatBot Alpha.
7. A Inbox implementa lista de conversas, painel de chat e painel responsivo de contato, exibindo avatar, nome, canal, última mensagem, horário, não lidas, status, atendente, tags, pesquisa, filtros e ordenação.
8. A Inbox diferencia mensagens recebidas/enviadas, horário e status de envio, e oferece composer visual com texto, emoji, anexo cenográfico seguro e ações da conversa; o envio simulado acrescenta a mensagem e atualiza a conversa sem reload e sem tráfego externo.
9. A Inbox possui estados verificáveis de carregamento, vazio global, erro com retry, conversa selecionada, nenhuma conversa selecionada e pesquisa sem resultados; a UI permanece utilizável em desktop e telas menores.
10. Contatos possui tabela/lista operacional com nome, telefone, e-mail, canal, tags, última interação, status, responsável e origem, além de pesquisa, filtros, paginação, visualização, edição simulada, histórico e ações não destrutivas.
11. Fluxos possui lista e editor visual baseado em nodes, limitado aos dez tipos canônicos mapeados, permitindo carregar mock, adicionar/remover/conectar nodes, editar propriedades, zoom, pan, salvar em memória e validar visualmente nodes/arestas obrigatórios sem executar automação.
12. Agentes IA permite listar, criar, editar e ativar/desativar agentes simulados, cobrindo nome, descrição, instruções, modelo/configuração aplicável, ferramentas, comportamento e vínculos visuais com flows/canais, sem realizar inferência ou chamar provedor de IA.
13. Campanhas preserva o conceito de broadcasts do ChatbotX e permite simular público, template, canal, agendamento e status; Sequências permite listar, criar/editar passos e ativar/desativar uma cadência, sem disparar mensagens ou jobs.
14. Templates permite pesquisar, filtrar, visualizar, criar/editar e simular ativação/instalação dos modelos compatíveis com os conceitos reais da referência, sem persistência externa.
15. Integrações lista somente o catálogo confirmado nesta story e apresenta estados Conectado, Desconectado, Erro e Configuração necessária; modais são exclusivamente visuais, não recebem/exibem credenciais reais, não fazem OAuth e não persistem secrets.
16. Configurações apresenta preferências visuais/operacionais relevantes ao frontend mock, incluindo disponibilidade, notificações, fila e aparência quando aplicável, sem editar configuração de backend, canais, banco ou infraestrutura.
17. Dashboard apresenta um resumo operacional compacto derivado dos mocks — conversas abertas/encerradas, mensagens/atendimentos, canais simulados, agentes, campanhas, automações, tempo médio de resposta e volume por período — sem excesso de gráficos ou cards gigantes.
18. O store possui um ponto de aplicação tipado para os eventos futuros `conversation.created`, `conversation.updated`, `message.created`, `message.updated`, `message.delivered`, `message.read` e `contact.updated`, testado sem implementar transporte realtime.
19. Todos os formulários e ações simuladas oferecem feedback visual, loading/disabled quando apropriado, foco visível, labels/ARIA, contraste WCAG 2.1 AA e mensagens de erro compreensíveis; secrets não aparecem em bundle, código, fixtures, DOM ou documentação.
20. `docs/chatbot-backend-contract.md` documenta, para cada operação necessária pelo frontend, operação/método futuro, payload, resposta, autenticação, eventos realtime, erros, paginação, filtros e dependências externas, marcando explicitamente tudo como contrato futuro não implementado.
21. A validação final executa `npm run typecheck`, `npm run lint`, `npm test` e `npm run build`; erros introduzidos são corrigidos, imports quebrados/exports mortos do novo módulo são eliminados e um smoke registra navegação, mocks, estados principais e ausência de erros de console atribuíveis ao módulo.
22. `/home/ialpha/projetos/ChatbotX-main` permanece byte-a-byte não modificado pela execução desta story; nenhuma importação do Painel Alpha aponta para arquivos internos dessa pasta.
23. Nenhum arquivo de banco, migration, Prisma schema, seed, webhook, Railway, `.env` ou backend é criado/modificado nesta story.

---

## 7. Requisitos de UX por seção

### Inbox

- Desktop: três painéis quando houver largura (`Conversas | Chat | Informações do contato`).
- Tablet: dois painéis, com informações do contato em Sheet/Drawer.
- Mobile: navegação progressiva lista → conversa → detalhes, com retorno explícito.
- Pesquisa e filtros não bloqueiam o composer ou a conversa selecionada sem necessidade.
- Anexo/emoji podem abrir popover/modal e produzir feedback simulado, mas não podem acessar upload/API externa.

### Contatos

- Tabela densa no desktop e cartões/linhas adaptáveis no mobile.
- Edição ocorre em Dialog ou Sheet reutilizando componentes do projeto.
- Histórico é visual e derivado do mock; nenhuma ação deve alegar persistência definitiva.

### Fluxos

- React Flow com grid discreto, MiniMap apenas se contribuir para orientação, Controls e painel de propriedades.
- Conexões inválidas, node órfão e campos obrigatórios devem ser sinalizados visualmente.
- Exclusão de node conectado exige confirmação visual e remove edges relacionadas no estado local.

### Listagens operacionais

- Agentes, campanhas, sequências e templates devem priorizar tabelas/listas, filtros e ações compactas.
- Dashboard deve ter hierarquia operacional, não estética de landing/SaaS genérico.
- Integrações devem ter cartões compactos, agrupados por categoria, sem formulários de credenciais.

### Estados globais

Cada seção que carrega dados deve possuir, quando aplicável:

- loading/skeleton;
- erro e retry;
- vazio inicial;
- vazio por filtro/pesquisa;
- sucesso;
- feedback de mutação simulada;
- controle desabilitado durante operação;
- layout responsivo.

---

## 8. Camada de serviço e contrato interno mínimo

O nome final dos métodos pode se adaptar ao padrão do projeto, mas deve haver equivalência tipada para:

| Domínio | Capacidades mínimas do service nesta fase |
|---|---|
| Dashboard | obter métricas/resumo e série de volume mock |
| Conversas | listar, obter detalhe, atualizar status/responsável/tags |
| Mensagens | listar, enviar texto simulado, simular status de entrega/leitura |
| Contatos | listar, obter, editar, consultar histórico |
| Flows | listar, obter grafo, salvar grafo em memória, validar estrutura |
| Agentes | listar, criar, editar, ativar/desativar |
| Campanhas | listar, obter, criar/editar simulação, alterar status permitido |
| Sequências | listar, obter, criar/editar passos, ativar/desativar |
| Templates | listar, obter, criar/editar, simular ativação/instalação |
| Integrações/canais | listar catálogo e alterar somente estado simulado |
| Configurações | obter e salvar preferências somente no estado local |

Resultados de listagem devem usar uma forma paginada coerente. Erros devem ser normalizados para a UI. Delay mock deve ser curto, previsível em testes e configurável/injetável; não usar temporizadores longos.

---

## 9. Tasks / Subtasks

- [x] **1. Confirmar baseline do Painel Alpha e preservar a referência** (AC: 22, 23)
  - [x] Registrar `git status --short` do Painel Alpha sem tocar em mudanças alheias.
  - [x] Registrar inventário da referência `/home/ialpha/projetos/ChatbotX-main` no diagnóstico Scout e confirmar ausência de escrita/import direto no teste estrutural.
  - [x] Confirmar App Router, shell, autenticação, permissão e componentes compartilhados no código real.

- [x] **2. Consolidar diagnóstico funcional e dependências** (AC: 3, 20, 22)
  - [x] Validar as dez seções, canais, integrações e dez tipos de node desta story contra a referência.
  - [x] Manter a matriz A–F como regra de escopo durante a implementação.

- [x] **3. Materializar a arquitetura frontend** (AC: 1–6)
  - [x] Criar layout protegido único e rotas aninhadas.
  - [x] Criar shell/navegação nativos integrados ao Painel Alpha.
  - [x] Desconectar a nova rota de actions, HTTP client e Infra legados sem apagar esses arquivos.

- [x] **4. Definir types de domínio e eventos** (AC: 3, 18)
  - [x] Tipar entidades, filtros, paginação, mutações, métricas e erros.
  - [x] Tipar a união discriminada dos sete eventos realtime futuros.

- [x] **5. Criar `ChatbotService` e fronteira de provider** (AC: 4, 6)
  - [x] Definir contrato por domínio e erro normalizado.
  - [x] Criar factory/resolver com mock como único provider funcional.
  - [x] Garantir que `api` seja apenas extensão futura, sem `fetch` ou fallback externo.

- [x] **6. Criar MockProvider profissional** (AC: 5, 18)
  - [x] Centralizar fixtures realistas e determinísticas.
  - [x] Implementar busca, filtros, ordenação, paginação e delay configurável.
  - [x] Implementar mutações em memória e atualização local sem reload.

- [x] **7. Criar hooks/store do módulo** (AC: 4, 5, 18)
  - [x] Encapsular chamadas ao service, seleção, filtros e estados assíncronos.
  - [x] Implementar `applyEvent` ou equivalente para os eventos futuros.

- [x] **8. Implementar shell e navegação** (AC: 1, 2, 19)
  - [x] Criar navegação desktop/mobile, rota ativa e cabeçalho operacional.
  - [x] Validar foco, labels e responsividade.

- [x] **9. Implementar Inbox** (AC: 7–9, 19)
  - [x] Componentizar lista/item, cabeçalho, mensagens/bubble, composer, contato e filtros.
  - [x] Implementar envio e ações simuladas com atualização imediata.
  - [x] Cobrir loading, erro, vazio, sem seleção e sem resultados.

- [x] **10. Implementar Contatos** (AC: 10, 19)
  - [x] Criar pesquisa, filtros, paginação, detalhe, edição e histórico mock.
  - [x] Adaptar tabela para mobile.

- [x] **11. Implementar Fluxos** (AC: 11, 19)
  - [x] Criar listagem e editor `@xyflow/react` com os dez nodes autorizados.
  - [x] Implementar adicionar/remover/conectar/editar/zoom/pan/salvar/carregar.
  - [x] Implementar validação visual determinística e confirmação de exclusão.

- [x] **12. Implementar Agentes IA** (AC: 12, 19)
  - [x] Criar listagem e editor de nome, descrição, instruções, modelo, ferramentas, comportamento e vínculos.
  - [x] Garantir ausência de chamada a modelos/SDKs externos.

- [x] **13. Implementar Campanhas e Sequências** (AC: 13, 19)
  - [x] Adaptar broadcasts para Campanhas com público, template, canal, agenda e status.
  - [x] Criar editor de passos de Sequências e estados simulados.

- [x] **14. Implementar Templates** (AC: 14, 19)
  - [x] Criar listagem, filtros, detalhe/editor e estados simulados.

- [x] **15. Implementar Integrações** (AC: 15, 19)
  - [x] Renderizar somente canais/integrações confirmados.
  - [x] Criar modais visuais sem campos/valores de secret e sem efeito externo.

- [x] **16. Implementar Dashboard** (AC: 17, 19)
  - [x] Derivar métricas dos mocks e criar visual compacto.
  - [x] Limitar gráficos ao necessário para leitura operacional.

- [x] **17. Implementar Configurações** (AC: 16, 19)
  - [x] Criar preferências frontend mock com feedback local.
  - [x] Bloquear qualquer configuração real de infraestrutura/canal/backend.

- [x] **18. Revisar UX, acessibilidade e segurança frontend** (AC: 2, 6, 19)
  - [x] Verificar teclado, foco, contraste, labels, ARIA e breakpoints; formulários usam erros por campo, `aria-invalid`, `aria-busy` e bloqueio durante mutações.
  - [x] Procurar secrets, credenciais, URLs externas e chamadas de rede no delta via teste estrutural.

- [x] **19. Validar tecnicamente e testar integração** (AC: 1–19, 21–23)
  - [x] Criar testes unitários de service/mock, filtros/paginação, mutations, concorrência/busy, eventos e validação de flows.
  - [x] Criar teste estrutural garantindo que novas rotas não importam actions/clientes legados nem o ChatbotX externo e que formulários usam RHF/Zod/bloqueio.
  - [x] Executar typecheck, lint, testes e build; Forge aprovou build, lint/typecheck do delta e 155 testes direcionados + 1 todo. Os gates globais conservam falhas externas preexistentes, registradas em QA Results.
  - [x] Validar estruturalmente as dez rotas, navegação, estados mock e ausência de transportes proibidos; Probe aprovou a integração. Smoke autenticado em navegador/console não foi executado e permanece registrado como risco residual, sem ser apresentado como evidência realizada.

- [x] **20. Gerar contrato do backend futuro e fechar rastreabilidade** (AC: 20, 21)
  - [x] Criar `docs/chatbot-backend-contract.md` com todas as operações requeridas pela UI.
  - [x] Atualizar esta checklist, Dev Agent Record e File List real.
  - [x] Confirmar novamente que a referência e áreas proibidas não foram modificadas.

---

## 10. Dev Notes

### Fontes e evidências

- O projeto utiliza Next.js 16, React 19, TypeScript, Tailwind 4, Zustand, Sonner, Radix/shadcn, `lucide-react` e `@xyflow/react`, conforme `package.json`.
- O shell do Painel Alpha está em `src/app/PainelAlpha/layout.tsx` e `src/components/layout/PainelLayoutClient.tsx`; a navegação global está em `src/components/layout/GlobalSidebar.tsx` e `src/components/layout/TabBar.tsx`.
- A rota atual, autenticação e permissão estão em `src/app/PainelAlpha/ChatBotAlpha/page.tsx`; o registro do módulo está em `src/lib/modulos-registry.ts`.
- Os componentes UI reutilizáveis incluem Button, Input, Card, Dialog, Sheet, Select, Tabs, Dropdown Menu, Skeleton, Switch, Avatar e Badge em `src/components/ui/`.
- A implementação anterior e suas limitações estão documentadas em `docs/stories/story-rm-2026-3d529d-chatbot-alpha-replicar-frontend.md#1-contexto`, `#4-matriz-de-paridade-validada-para-a-superfície-workspace-token` e `#15-file-list-atualizado--fases-615-corrigido-na-retomada-da-fase-6-e-da-fase-9`.
- As rotas funcionais da referência estão em `/home/ialpha/projetos/ChatbotX-main/apps/builder/src/app/space/[workspaceId]/`; o editor real está em `apps/builder/src/features/flows/react-flow/`.
- O mapa canônico de nodes está evidenciado em `/home/ialpha/projetos/ChatbotX-main/apps/builder/src/features/flows/react-flow/nodes/node-config.tsx` e `steps/index.tsx`.

### Project Structure Notes

- Os documentos sharded de arquitetura configurados em `.aiox-core/core-config.yaml` não estão presentes em `docs/architecture/`; por isso, esta story usa o código real, `package.json`, a story anterior e a referência ChatbotX como evidência verificável.
- Novos artefatos de frontend devem ficar no Painel Alpha. Uma organização esperada é `src/components/ChatBotAlpha/`, `src/lib/chatbot-alpha/frontend/`, `src/hooks/chatbot-alpha/` e `src/store/`, ajustável se o implementador encontrar um padrão local mais específico.
- Não criar imports cruzando para `/home/ialpha/projetos/ChatbotX-main`.
- Não modificar `src/actions/ChatBotAlpha.ts`, `src/actions/ChatBotAlphaChat.ts`, `src/lib/chatbot-alpha/chat-api.ts`, Prisma, migrations ou arquivos de infraestrutura.
- `src/lib/modulos-registry.ts` já contém `chatBotAlpha`; evitar alteração se as rotas filhas funcionarem com o registro atual.

### Dados e persistência

- Todos os dados desta fase são fixtures e memória de sessão do frontend.
- Não usar `localStorage` para simular banco sem necessidade. Se usado para preferência puramente visual, deve ser isolado, versionado e não conter PII/secrets.
- Avatares devem usar assets locais/placeholder seguro ou iniciais; não depender de imagens remotas.

### Segurança

- Não copiar `.env`, tokens ou credenciais da referência.
- Não renderizar valores de secret nem mesmo em fixture.
- A UI de integrações deve comunicar estado e requisitos, não coletar credenciais reais.
- Nenhuma operação “Enviar”, “Conectar”, “Executar”, “Publicar” ou “Agendar” pode realizar efeito externo; o texto de feedback deve indicar simulação quando houver risco de ambiguidade.

---

## 11. Testing

### Testes automatizados mínimos

1. MockProvider lista, busca, filtra, ordena e pagina sem mutar fixtures-base indevidamente.
2. Envio simulado cria mensagem, atualiza preview/horário da conversa e não chama `fetch`.
3. Edição de contato/agente/campanha/sequência/template/configuração atualiza somente estado em memória.
4. Reducer/handler de realtime aplica cada um dos sete eventos tipados de forma idempotente quando aplicável.
5. Validador de flow detecta node obrigatório inválido, edge órfã e grafo válido.
6. Remoção de node elimina edges relacionadas.
7. Rotas e itens de navegação cobrem exatamente as dez seções.
8. Teste estrutural falha se o novo frontend importar actions/client HTTP legados, caminho do ChatbotX externo ou usar `fetch`/WebSocket/EventSource/Pusher.
9. Componentes puros críticos têm testes quando o ambiente permitir; caso não haja DOM test environment, extrair lógica para funções testáveis e registrar o limite no Dev Agent Record.

### Smoke manual/integrado

- Acessar raiz e confirmar redirect ao Dashboard.
- Navegar pelas dez rotas sem 404, reload desnecessário ou perda de shell.
- Pesquisar/filtrar, abrir conversa, enviar mensagem simulada e editar contato.
- Criar/editar node e validar/salvar flow mock.
- Abrir agente, campanha, sequência, template e modal de integração.
- Alternar estados de loading, vazio, erro e retry por mecanismo de desenvolvimento/teste do MockProvider.
- Verificar desktop, tablet e mobile.
- Verificar console sem erros atribuíveis ao módulo.
- Confirmar ausência de requests externas na aba Network durante o uso do módulo.

### Quality commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Falhas globais pré-existentes devem ser separadas de erros introduzidos e documentadas com evidência; erros do delta desta story não podem ser ignorados.

---

## 12. Contrato obrigatório do backend futuro

`docs/chatbot-backend-contract.md` deve ser autocontido e cobrir, para cada operação consumida pelo frontend:

- necessidade/tela;
- operação e método/rota propostos;
- parâmetros, filtros, ordenação, cursor/página/limit;
- payload enviado;
- resposta esperada, incluindo metadados de paginação;
- autenticação/autorização e escopo de workspace;
- eventos realtime emitidos/consumidos;
- erros possíveis e comportamento esperado da UI;
- idempotência/concorrência quando aplicável;
- dependências externas;
- observações de PII/secrets;
- estado: `FUTURO — NÃO IMPLEMENTADO NESTA FASE`.

O documento deve cobrir todas as capacidades da tabela da seção 8, além do catálogo de canais/integrações e dos sete eventos realtime.

---

## 13. 🤖 CodeRabbit Integration

### Story Type Analysis

**Primary Type:** Frontend
**Secondary Type(s):** Arquitetura, Segurança
**Complexity:** Alta — dez rotas, estado compartilhado, provider desacoplado, editor visual e contrato futuro, mas sem backend/DB.

### Specialized Agent Assignment

**Primary Agents:**

- `@dev` — implementação e pre-commit
- `@ux-design-expert` — densidade operacional, responsividade e WCAG 2.1 AA

**Supporting Agents:**

- `@architect` — fronteiras de provider, rotas e preservação do legado
- `@qa` — cobertura, estados e integração
- `@security`/Anubis — garantir ausência de secrets, rede e auth paralela

### Quality Gate Tasks

- [ ] Pre-Commit (`@dev`): CodeRabbit sobre o delta não commitado, typecheck, lint e testes.
- [ ] Pre-PR (`@github-devops`): CodeRabbit contra `main`, build e revisão de compatibilidade.
- [ ] Pre-Deployment: não aplicável nesta story; não há deploy autorizado.

### Self-Healing Configuration

- Primary Agent: `@dev` (light mode)
- Max Iterations: 2
- Timeout: 15 minutos
- Severity Filter: CRITICAL
- CRITICAL: auto-fix até 2 iterações
- HIGH: documentar e encaminhar para revisão
- MEDIUM/LOW: registrar apenas se afetarem AC, segurança ou acessibilidade

### CodeRabbit Focus Areas

**Primary:**

- acessibilidade, navegação por teclado e responsividade;
- separação UI/store/service/provider e ausência de mocks nos componentes;
- ausência de rede, secrets e dependências diretas do ChatbotX;
- consistência dos dez tipos de node e catálogos confirmados.

**Secondary:**

- performance de listas/chat/editor;
- componentes pequenos e responsabilidades separadas;
- imports mortos, rotas quebradas e feedback de erros.

---

## 14. File List planejada (histórico)

> Planejamento preservado para rastreabilidade. A lista efetivamente entregue está no Dev Agent Record.

### Criar

- `src/app/PainelAlpha/ChatBotAlpha/layout.tsx`
- `src/app/PainelAlpha/ChatBotAlpha/{dashboard,inbox,contatos,fluxos,agentes,campanhas,sequencias,templates,integracoes,configuracoes}/page.tsx`
- `src/components/ChatBotAlpha/shell/*`
- `src/components/ChatBotAlpha/shared/*`
- `src/components/ChatBotAlpha/dashboard/*`
- `src/components/ChatBotAlpha/inbox/*`
- `src/components/ChatBotAlpha/contacts/*`
- `src/components/ChatBotAlpha/flows/*`
- `src/components/ChatBotAlpha/agents/*`
- `src/components/ChatBotAlpha/campaigns/*`
- `src/components/ChatBotAlpha/sequences/*`
- `src/components/ChatBotAlpha/templates/*`
- `src/components/ChatBotAlpha/integrations/*`
- `src/components/ChatBotAlpha/settings/*`
- `src/lib/chatbot-alpha/frontend/types.ts`
- `src/lib/chatbot-alpha/frontend/service.ts`
- `src/lib/chatbot-alpha/frontend/mock-data.ts`
- `src/lib/chatbot-alpha/frontend/mock-provider.ts`
- `src/lib/chatbot-alpha/frontend/realtime-events.ts`
- `src/store/useChatbotAlphaFrontend.ts`
- `tests/chatbot-alpha/frontend-*.test.ts`
- `docs/chatbot-backend-contract.md`

### Modificar

- `src/app/PainelAlpha/ChatBotAlpha/page.tsx` — remover consumo externo/legado do fluxo da raiz e redirecionar ao Dashboard.

### Preservar sem modificação

- `/home/ialpha/projetos/ChatbotX-main/**`
- `src/actions/ChatBotAlpha.ts`
- `src/actions/ChatBotAlphaChat.ts`
- `src/lib/chatbot-alpha/chat-api.ts`
- `src/components/ChatBotAlpha/IframeChatBotAlpha.tsx`
- `src/components/ChatBotAlpha/SeletorSistemaChatBot.tsx`
- arquivos de banco, Prisma, migrations, Railway, webhooks e `.env*`
- mudanças concorrentes fora do módulo e desta story

---

## 15. Definition of Done / Checklist

- [x] Todos os 23 Acceptance Criteria foram implementados e rastreados; a evidência visual do AC 21 fica limitada à validação estrutural porque o smoke autenticado em navegador/console não foi executado.
- [x] Tasks 1–20 foram concluídas na ordem prevista ou desvios foram justificados.
- [x] As dez seções são navegáveis e operacionais com mocks.
- [x] Os estados loading/erro/vazio/sucesso foram verificados.
- [x] A arquitetura não contém mock data dentro de páginas/componentes.
- [x] Nenhuma chamada externa ocorre no novo módulo.
- [x] Nenhum secret/credencial foi incluído ou exposto.
- [x] Nenhum backend, banco, webhook, Railway ou canal foi alterado/conectado.
- [x] O ChatbotX original permanece sem imports diretos e não recebeu escrita desta implementação.
- [x] Acessibilidade e responsividade foram revisadas no delta Lens; navegação e painéis móveis usam Radix Sheet com focus trap/Escape.
- [x] TypeScript, lint, testes e build foram executados com resultado documentado: Forge aprovou build, lint/typecheck do delta e suíte ChatBot Alpha; falhas globais externas continuam discriminadas em QA Results.
- [ ] Smoke autenticado das dez rotas e inspeção do console no navegador não foram executados; navegação, mocks e flows foram cobertos por testes estruturais/unitários e aprovados pelo Probe.
- [x] `docs/chatbot-backend-contract.md` foi criado e revisado.
- [x] Dev Agent Record, checklist e File List real foram atualizados.

---

## 16. Story Draft Checklist — validação inicial

| Categoria | Status | Evidência/observação |
|---|---|---|
| Goal & Context Clarity | PASS | Objetivo, valor, escopo frontend-only e conflito com a story anterior estão explícitos. |
| Technical Implementation Guidance | PASS | Rotas, camadas, tipos, provider, store, UI, nodes e fronteiras estão definidos. |
| Reference Effectiveness | PASS | Story anterior, código do Painel e caminhos exatos da referência foram identificados. |
| Self-Containment Assessment | PASS | Matriz A–F, catálogos, edge cases, restrições e arquitetura estão dentro da story. |
| Testing Guidance | PASS | Há testes unitários/estruturais, smoke, estados e quatro quality commands. |
| CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e foco foram preenchidos. |

**Readiness:** READY
**Clarity score:** 10/10
**Gaps bloqueantes:** nenhum para iniciar a implementação frontend.
**Risco principal de retrabalho:** reativar sem intenção o legado de rede/Infra; mitigado pelos ACs 1, 6, 22, 23 e teste estrutural.

`[AUTO-DECISION] sincronização ClickUp não executada → manter story local em Draft (razão: nenhum conector/identificador de Epic ClickUp foi disponibilizado nesta missão e a criação local foi explicitamente solicitada).`

---

## 17. Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-09-15 | 0.1 | Story frontend mock-only criada a partir do pedido atual e diagnóstico Scout; conflito com integração legada documentado | River (SM) |
| 2026-09-15 | 0.2 | Findings Lens corrigidos: hidratação async/retry, erros propagados, Inbox responsiva, vínculos de agentes, novo fluxo, métricas derivadas e testes | Codex |
| 2026-09-15 | 0.3 | Formulários operacionais migrados para React Hook Form/Zod; mutações protegidas por busy/finally e concorrência testada | Codex |
| 2026-09-15 | 0.4 | Gates finais consolidados, checklist/file list sincronizados e story promovida a Ready for Done com baselines globais e smoke autenticado pendente explícitos | Scribe |
| 2026-09-15 | 0.5 | Compatibilidade sem `structuredClone` nativo, regressão automatizada e promoção segura do stage por stop → build → start documentadas | Scribe |

---

## 18. Dev Agent Record

### Agent Model Used

Codex / Nova — Frontend Specialist.

### Debug Log References

- Forge: `npm run build` **APPROVED**; build de produção concluído e materializou as dez rotas do módulo.
- Forge: TypeScript e ESLint do delta ChatBot Alpha **APPROVED**, sem diagnóstico atribuível à implementação.
- `npx vitest run tests/chatbot-alpha --coverage=false`: **PASS após o fix — 13 arquivos, 158 testes aprovados e 1 todo**.
- O stage autoritativo na porta 3005 serve o Build ID `5kqIHl35UZV--w8j5SpVh`; o `next-server` PID 502162 iniciou às 18:18:56Z depois do build das 18:17:36Z, e 31 chunks responderam HTTP 200. A promoção usou `restartProject` em ordem stop → build → start; `.next-chatbot-fix-verify` permaneceu apenas como artefato isolado do Forge.
- Gates globais também foram executados: typecheck/lint/test conservam falhas preexistentes fora do ChatBot Alpha, discriminadas em QA Results; isso não foi mascarado como sucesso global.

### Completion Notes List

- Nova raiz redireciona ao Dashboard e o gate de sessão/permissão foi centralizado no layout.
- Nenhuma chamada de rede, backend legado, Infra, WebSocket ou provider externo foi adicionada ao novo fluxo.
- Mock provider é isolado, determinístico e mutável em memória; store aplica sete eventos futuros sem transporte realtime.
- Inbox operacional e editor de Fluxos foram entregues com estados, responsividade e feedback simulado.
- Dashboard, Contatos, Agentes, Campanhas, Sequências, Templates, Integrações e Configurações estão integrados às rotas nativas e ao mesmo store mock.
- Hidratação do snapshot é assíncrona; shell cobre loading/erro/retry antes de montar as páginas e nenhuma API síncrona de snapshot integra o contrato público.
- Mutações compartilham controle `busy/error/finally`, propagam falhas aos formulários e mantêm métricas derivadas coerentes com o snapshot.
- Contatos, Agentes, Campanhas, Sequências, Templates e Configurações usam React Hook Form com `zodResolver`, mensagens por campo e `aria-invalid`; Integrações e todos os submits/toggles respeitam `isBusy`.
- A store rejeita uma segunda mutação enquanto outra está pendente e sempre libera `isBusy` em `finally`; teste dedicado cobre a concorrência.
- Clones do módulo agora passam por `src/services/chatbot/clone.ts`: caminho nativo quando disponível e fallback JSON-safe em navegadores/webviews sem `structuredClone`; o teste dedicado cobre import, snapshot, provider, mensagem, store, evento realtime e flow sem a API.
- Regra operacional consolidada: nunca executar build sobre a `.next` usada por um `next start` ativo; reinícios do stage devem usar stop → build → start para impedir manifesto/chunks de versões diferentes.

### File List real

**Criados nesta story:**

- `src/types/chatbot.ts`
- `src/mocks/chatbot/data.ts`
- `src/services/chatbot/{clone,constants,dashboard,flow-validation,index,mock-provider,schemas,service}.ts`
- `src/store/useChatbotStore.ts`
- `src/app/PainelAlpha/ChatBotAlpha/layout.tsx`
- `src/app/PainelAlpha/ChatBotAlpha/{dashboard,inbox,contatos,fluxos,agentes,campanhas,sequencias,templates,integracoes,configuracoes}/page.tsx`
- `src/components/ChatBotAlpha/shell/navigation.ts`
- `src/components/ChatBotAlpha/shell/ChatbotShell.tsx`
- `src/components/ChatBotAlpha/shared/{ChannelBadge,OperationalState}.tsx`
- `src/components/ChatBotAlpha/dashboard/ChatbotDashboard.tsx`
- `src/components/ChatBotAlpha/inbox/{InboxWorkspace,ConversationList,MessageThread,MessageComposer,ContactPanel}.tsx`
- `src/components/ChatBotAlpha/flows/{FlowsWorkspace,FlowEditor,FlowNodeCard}.tsx`
- `src/components/ChatBotAlpha/contatos/ContactsWorkspace.tsx`
- `src/components/ChatBotAlpha/agentes/AgentsWorkspace.tsx`
- `src/components/ChatBotAlpha/campanhas/CampaignsWorkspace.tsx`
- `src/components/ChatBotAlpha/sequencias/SequencesWorkspace.tsx`
- `src/components/ChatBotAlpha/templates/TemplatesWorkspace.tsx`
- `src/components/ChatBotAlpha/integracoes/IntegrationsWorkspace.tsx`
- `src/components/ChatBotAlpha/configuracoes/SettingsWorkspace.tsx`
- `tests/chatbot-alpha/frontend-{architecture,edge-cases,mock-provider,realtime-flow,store,structured-clone-compat}.test.ts`
- `.ai/qa-chatbot-structured-clone-2026-09-15.json`
- `docs/chatbot-backend-contract.md`
- `docs/qa/assessments/CHATBOT-ALPHA-FE-MOCK-test-design-20260915.md`
- `docs/stories/story-chatbot-alpha-frontend-nativo-mock.md`

**Modificado nesta story:**

- `src/app/PainelAlpha/ChatBotAlpha/page.tsx`

**Preservados:**

- `src/components/ChatBotAlpha/{ChatBotAlphaClient,ChatConversa,IframeChatBotAlpha,SeletorSistemaChatBot}.tsx` — frontend legado mantido no repositório, sem import pelo novo shell.
- `src/actions/ChatBotAlpha*.ts`, `src/lib/chatbot-alpha/chat-api.ts`, ChatbotX original, banco, migrations, webhooks, Railway e `.env*` — sem alteração desta story.

---

## 19. QA Results

- **Forge — APPROVED:** build de produção aprovado; TypeScript e ESLint do delta sem erros; suíte ChatBot Alpha com 12 arquivos, 155 testes aprovados e 1 todo.
- **Probe — APPROVED:** gate único, raiz/redirect, shell e exatamente dez rotas/navegação foram verificados; os testes estruturais cobrem materialização das páginas, mocks e ausência de acoplamento ao frontend legado.
- **Anubis — APPROVED:** nenhuma rede, WebSocket/SSE/Pusher, OAuth, secret, auth paralela ou importação do ChatbotX original foi introduzida; a sessão e a permissão `chatBotAlpha` continuam no layout server-side.
- **Lens — APPROVED:** separação UI → store → service → mock provider, loading/error/retry, responsividade, formulários e manutenção do delta aprovados após as correções.
- Testes estruturais confirmam RHF + `zodResolver`, `aria-invalid`, `isBusy`/`disabled`, ausência de `FormData` e ausência de transportes/imports proibidos.

### Correção de compatibilidade e stage (2026-09-15)

- **Causa corrigida:** usos diretos de `structuredClone` podiam lançar exceção antes da montagem em navegadores/webviews sem a API. `cloneChatbotData` passou a ser a única fronteira de clone do código ChatBot Alpha, com fallback restrito aos DTOs JSON-safe do contrato.
- **Regressão:** `frontend-structured-clone-compat.test.ts` cobre o fluxo do módulo com `structuredClone` ausente e protege contra reintrodução de chamadas diretas; suíte ChatBot Alpha em **PASS — 13 arquivos, 158 testes e 1 todo**.
- **QA:** `.ai/qa-chatbot-structured-clone-2026-09-15.json` registra fallback, caminho nativo, import/snapshot, provider, store/realtime, flow, lint escopado e `git diff --check` aprovados. O typecheck global segue vermelho apenas por erros preexistentes fora deste delta.
- **Operação:** o stage da porta 3005 foi promovido com `restartProject` em ordem stop → build → start e confirmado no Build ID `5kqIHl35UZV--w8j5SpVh`; 31 chunks responderam HTTP 200. Esta ordem é obrigatória porque construir sobre a `.next` usada por um `next start` ativo pode misturar manifesto e chunks e gerar `ChunkLoadError`.
- **Ressalva não bloqueante:** o React Flow usa atualmente o default `connectOnClick=true`; explicitá-lo é melhoria futura de interação/acessibilidade, não causa a exceção de entrada e não bloqueia este fix.
- **Risco residual:** a verificação HTTP prova processo, Build ID e chunks coerentes, mas não substitui o smoke autenticado das dez rotas nem a inspeção do console.

### Sage — QA final de regressão (2026-09-15)

- Adicionado `tests/chatbot-alpha/frontend-edge-cases.test.ts` com 11 cenários para provider API desabilitado, not-found/inputs inválidos, retry, hidratação concorrente, idempotência/imutabilidade realtime, updates desconhecidos, remoção/validação de flows, schemas e materialização/auth das rotas.
- Finding corrigido durante a rodada: mensagens concorrentes com `Date.now()` congelado geravam IDs duplicados; o provider passou a usar sequência monotônica por instância e ganhou teste de regressão com três envios simultâneos.
- `npx vitest run tests/chatbot-alpha --coverage=false`: **PASS — 12 arquivos, 155 testes aprovados, 1 todo**.
- ESLint escopado ao delta ChatBot Alpha e testes: **PASS**.
- `npm test`: **FAIL global — 19 testes falharam em 11 arquivos externos ao ChatBot Alpha; 3.037 passaram e 1 ficou todo**. Falhas observadas em Alpha SEO, BPM, Bibble, Parceiros, Gerador de Documentos e Apresentações.
- `NODE_OPTIONS=--max-old-space-size=8192 npm run lint`: **FAIL global — 10.108 erros e 194.169 warnings**, majoritariamente porque o lint percorre `.agents`, `.aiox-core` e dívida histórica fora do delta. A primeira execução sem heap ampliado também encerrou por OOM.
- Test design: `docs/qa/assessments/CHATBOT-ALPHA-FE-MOCK-test-design-20260915.md`.
- Risco residual: smoke browser autenticado/console não foi automatizado nesta rodada.

**Gate Decision da story: READY FOR DONE.** O delta ChatBot Alpha foi aprovado por Forge, Probe, Anubis e Lens; a rodada Sage está verde no escopo (155 testes + 1 todo) e mantém **CONCERNS no repositório global** pelas falhas externas acima. O smoke autenticado em navegador/console não foi executado e permanece a única evidência manual pendente; por isso a story não é marcada como `Done` automaticamente.
