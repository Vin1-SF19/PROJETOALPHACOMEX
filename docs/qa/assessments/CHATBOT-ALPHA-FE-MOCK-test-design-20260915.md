# Test Design: CHATBOT-ALPHA-FE-MOCK

Date: 2026-09-15
Designer: Quinn (Test Architect)

## Test Strategy Overview

- Total scenarios: 18
- Unit: 11
- Integration/structural: 5
- E2E/smoke: 2
- Priority: P0: 4, P1: 11, P2: 3

## Scenarios

| ID | AC | Level | Priority | Scenario |
|---|---:|---|---|---|
| CHATBOT-FE-INT-001 | 1, 2 | integration | P0 | Auth, permissão, bypass admin, redirect raiz e dez rotas materializadas |
| CHATBOT-FE-INT-002 | 3–6 | integration | P0 | UI usa service/store tipados, provider API permanece desabilitado e não há transportes/imports proibidos |
| CHATBOT-FE-UNIT-001 | 5 | unit | P1 | Busca, filtros, ordenação, paginação e isolamento das cópias mock |
| CHATBOT-FE-UNIT-002 | 5, 8 | unit | P0 | Envio concorrente no mesmo milissegundo preserva IDs únicos e atualiza preview sem rede |
| CHATBOT-FE-UNIT-003 | 5, 9 | unit | P1 | Falha controlada, erro normalizado e retry recuperam o mesmo store |
| CHATBOT-FE-UNIT-004 | 5, 9 | unit | P1 | Inicializações concorrentes realizam uma única hidratação |
| CHATBOT-FE-UNIT-005 | 10, 12–16 | unit | P1 | Schemas rejeitam campos extras, enums forjados e limites inválidos |
| CHATBOT-FE-INT-003 | 7–10 | integration | P1 | Inbox/contatos preservam filtros, composer, painel responsivo, formulários e bloqueio busy |
| CHATBOT-FE-UNIT-006 | 11 | unit | P1 | Flow válido, trigger obrigatório, node/edge órfãos e campos obrigatórios |
| CHATBOT-FE-UNIT-007 | 11 | unit | P1 | Remoção de node elimina arestas incidentes sem mutar a entrada |
| CHATBOT-FE-INT-004 | 11–17 | integration | P1 | Workspaces operacionais estão ligados às rotas/store e usam RHF/Zod |
| CHATBOT-FE-UNIT-008 | 17 | unit | P2 | Métricas do dashboard são derivadas novamente após mutações/eventos |
| CHATBOT-FE-UNIT-009 | 18 | unit | P0 | Sete eventos realtime aplicam mudanças sem transporte e criação é idempotente |
| CHATBOT-FE-UNIT-010 | 18 | unit | P1 | Repetição de eventos converge e não muta o snapshot de entrada |
| CHATBOT-FE-UNIT-011 | 18 | unit | P1 | Update de entidade desconhecida não cria registro parcial |
| CHATBOT-FE-INT-005 | 19, 22, 23 | integration | P1 | Fixtures sintéticas, formulários acessíveis e ausência de secrets/backend/banco/import externo |
| CHATBOT-FE-E2E-001 | 2, 7–17, 21 | e2e | P1 | Smoke autenticado pelas dez rotas e principais interações mock |
| CHATBOT-FE-E2E-002 | 9, 19, 21 | e2e | P2 | Estados loading/erro/vazio/retry e console sem erros atribuíveis ao módulo |

## Risco e ordem de execução

1. P0: fronteira sem rede, auth/permissão, unicidade de mensagens e realtime.
2. P1 unitários: provider, store, schemas e flows.
3. P1 estruturais: rotas, workspaces, formulários e imports proibidos.
4. Smoke E2E autenticado quando houver ambiente executável.

## Coverage gaps

- Smoke autenticado/console depende de ambiente browser com sessão válida; não foi automatizado nesta rodada.
- A suíte global do repositório tem 19 falhas externas ao ChatBot Alpha, portanto o gate global não está verde apesar da suíte escopada passar.
