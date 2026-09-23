# Story: Integridade das consultas tributárias da Pré-Análise

## Status

Ready for Review

## Executor Assignment

- executor: `@dev`
- quality_gate: `@qa`
- quality_gate_tools: `lint`, `typecheck`, `vitest`, `build`, testes de contrato das rotas

## Story

**Como** usuário da Pré-Análise do Painel Alpha,  
**quero** receber resultados tributários verificáveis e estados explícitos de falha ou ausência de dados,  
**para** não tomar uma decisão com informação incompleta apresentada como certeza.

## Contexto e origem

Pedido do usuário em 2026-09-23: implementar todas as melhorias propostas após análise e teste das APIs `/api/ReceitaFederal`, `/api/EmpresaAqui`, `/api/RadarFiscal` e `/api/ConsultaRadar`. Não foi encontrado épico/PRD específico nem `accumulated-context.md` neste checkout; os critérios abaixo derivam do pedido e dos achados confirmados nas rotas existentes. A story `story-alpha-crm-overlay-dados-empresa.md` também consome os contratos de ReceitaFederal e RadarFiscal; preservar os campos cadastrais existentes e adaptar consumidores ao novo estado tributário.

Achados de partida: EmpresaAqui desabilita a validação TLS e não verifica status/timeout; ReceitaFederal transforma ausência de Simples/MEI em `false`; RadarFiscal absorve falha EmpresaAqui e pode qualificar com regime desconhecido; ConsultaRadar aceita CNPJ curto e loga resposta bruta; as rotas não exigem sessão; a tela chama ReceitaFederal e RadarFiscal para o mesmo CNPJ.

## Acceptance Criteria

1. EmpresaAqui valida o certificado TLS, impõe timeout, limite de tamanho de resposta, verifica status HTTP e valida o formato mínimo do payload antes de consumi-lo. Falhas retornam erro controlado sem expor token, URL completa ou resposta sensível. O token permanece no caminho externo somente se o contrato do provedor não oferecer cabeçalho ou corpo autenticado.
2. ReceitaFederal distingue `sim`, `não` e `não informado` para Simples e MEI nas duas fontes; ausência de campo não vira `false` nem “Regime Normal”. O fallback ReceitaWS → CNPJ.ws ocorre somente quando a primeira fonte falha ou não fornece cadastro utilizável, com timeout e validação da resposta.
3. RadarFiscal representa explicitamente a indisponibilidade ou insuficiência da EmpresaAqui e da Receita. Regime tributário, qualificação e regras dependentes de Simples ou histórico não são calculados como valores definitivos quando os dados necessários são desconhecidos. Uma resposta parcial identifica quais fontes falharam; a interface a apresenta como parcial ou indeterminada.
4. ConsultaRadar rejeita CNPJ com quantidade diferente de 14 dígitos com HTTP 400; distingue resposta vazia, erro lógico do provedor e sucesso real; usa timeout. Não devolve HTTP 200 com dados padrão quando a consulta externa não encontrou resultado válido.
5. As quatro rotas exigem sessão e permissão compatível com cada consumidor existente. A consulta pública de CNPJ no fluxo de convite de parceiro continua disponível somente mediante validação server-side do token/PIN do convite, com escopo de leitura e limite de frequência próprio. Acesso anônimo sem convite válido ou sem permissão falha antes de acionar provedores; o excesso de frequência recebe resposta controlada.
6. Os logs das quatro rotas e clientes externos não contêm token, URL autenticada nem resposta integral do provedor. Erros devolvidos ao cliente não incluem segredos ou mensagens internas do fornecedor.
7. Uma ação de consulta da Pré-Análise não repete a busca cadastral na mesma execução. Cadastro e avaliação tributária provêm do mesmo resultado da Receita; os campos já consumidos pela tela e por outros módulos continuam disponíveis ou os consumidores são adaptados explicitamente.
8. A interface apresenta “Não informado”, “Consulta parcial” ou erro com nova tentativa conforme o estado real, sem mostrar “NÃO”, “Regime Normal”, “QUALIFICADO”, “PREMIUM” ou “NÃO LOCALIZADO” como inferência de campo ausente.
9. Testes automatizados cobrem as quatro rotas e normalizadores com CNPJ válido/inválido, acesso negado, limite de frequência, timeout, HTTP não 2xx, JSON inválido, payload parcial/vazio, falha de uma ou ambas fontes, Simples/MEI desconhecido e prevenção de qualificação indevida. Provedores são simulados; uma verificação real de leitura pode ser documentada separadamente, sem depender dela para a suíte.
10. `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` são executados. O checklist e a File List desta story registram os resultados e separam falhas preexistentes de regressões introduzidas.
11. As consultas permanecem somente leitura, sem migration, alteração de schema, seed, backfill ou mutação em massa.

## Tasks / Subtasks

- [x] Fortalecer o cliente EmpresaAqui e seus erros controlados (AC: 1, 6).
- [x] Normalizar ReceitaWS/CNPJ.ws com estados triestados e fallback validado (AC: 2, 6).
- [x] Corrigir a composição e a qualificação do RadarFiscal para fontes parciais (AC: 3, 8).
- [x] Corrigir validação, status externo, timeout e logs da ConsultaRadar (AC: 4, 6).
- [x] Aplicar autenticação, autorização e limite de frequência às quatro rotas, preservando o convite público com token/PIN validado no servidor (AC: 5).
- [x] Compartilhar o resultado cadastral da consulta e atualizar os consumidores da tela (AC: 7, 8).
- [x] Implementar testes com provedores simulados e executar gates (AC: 9, 10).
- [x] Atualizar checklist, File List e resultados de QA antes de concluir (AC: 10).

## Dev Notes

- Rotas: `src/app/api/{ReceitaFederal,EmpresaAqui,RadarFiscal,ConsultaRadar}/route.ts`.
- Clientes: `src/lib/cnpj/{receita-federal,empresa-aqui}.ts`.
- UI: `src/app/PainelAlpha/SistemaPreAnalise/{SistemaPreAnaliseClient,BlocoResultados}.tsx`.
- O middleware atual exclui `/api`; proteção precisa ser aplicada de forma efetiva nas rotas ou em mecanismo compartilhado que as cubra.
- Verificar chamadas fora da Pré-Análise antes de alterar contratos: a story de gaveta do CRM consome ReceitaFederal/RadarFiscal.
- Não há alteração de schema, migration, seed ou mutação em massa planejada (AC 11). Se a implementação passar a exigir banco, a política Vault do `AGENTS.md` se aplica antes de qualquer alteração.
- `src/components/Parceiros/Convite/StepEmpresa.tsx` também chama `/api/ReceitaFederal` sem sessão; proteger essa rota exige manter uma entrada pública restrita ao token/PIN válido do convite. Outros consumidores da rota devem continuar sob suas permissões próprias, sem receber acesso de Pré-Análise por acidente.
- [AUTO-DECISION] Épico/AC original inexistente → critérios derivados literalmente do pedido e dos achados confirmados, sem acrescentar funcionalidade de produto.
- [AUTO-DECISION] Estratégia de erro parcial → contrato explícito e compatível com consumidores existentes, evitando resposta aparentemente conclusiva.

## Testing

- Testes de contrato e unidade com `fetch`/HTTPS simulados; nenhuma chamada paga ou externa nos testes automatizados.
- Confirmar HTTP 400 para CNPJ curto em todas as rotas e 401/403/429 para cenários de acesso; verificar sucesso do convite válido com token/PIN, bloqueio do convite inválido e aplicação do limite de frequência.
- Confirmar que uma falha EmpresaAqui não gera qualificação e que campos ausentes em ambas as fontes não viram negação de Simples/MEI.
- Confirmar que o payload não expõe segredos nem devolve sucesso vazio após erro lógico do provedor.

## 🤖 CodeRabbit Integration

- **Story Type Analysis:** primário API; secundários Security, Integration e Frontend; complexidade alta.
- **Specialized Agent Assignment:** `@dev` implementa; `@architect` revisa contrato e proteção; `@qa` valida testes e comportamento.
- **Quality Gate Tasks:** Pre-Commit `@dev` antes de Review; Pre-PR `@devops` se houver PR; Pre-Deployment `@devops` se houver publicação.
- **Self-Healing Configuration:** `@dev` light, até 2 iterações/15 min para CRITICAL; HIGH documentado. `@qa` full, até 3 iterações/30 min para CRITICAL e HIGH. `@devops` check, apenas relatório.
- **Focus Areas:** autorização antes de I/O externo, validação de entrada e saída, TLS, segredos em logs, decisões tributárias com fontes parciais e compatibilidade de contrato.

## Story Draft Validation

| Category | Status | Issues |
|---|---|---|
| Goal & Context Clarity | PASS | Pedido e riscos explícitos |
| Technical Implementation Guidance | PASS | Rotas, clientes e consumidores identificados |
| Reference Effectiveness | PASS | Referências apontam para código e story existente |
| Self-Containment Assessment | PASS | Estados, falhas e compatibilidade definidos |
| Testing Guidance | PASS | Matriz de cenários e gates definidos |
| CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e foco presentes |

**Final Assessment:** READY — implementação possível com as fontes locais; validar o contrato de autenticação do provedor EmpresaAqui antes de mover o token da URL.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-09-23 | 1.0 | Story criada a partir do pedido e dos achados das quatro APIs. | River |
| 2026-09-23 | 1.1 | Preservação da consulta pública por convite válido e garantia de consulta somente leitura. | River |
| 2026-09-23 | 1.2 | APIs, clientes, interface e consumidores corrigidos; testes e gates executados. | Codex |
| 2026-09-23 | 1.3 | Gates repetidos após a alteração concorrente; build aprovado e falhas globais documentadas. | Codex |
| 2026-09-23 | 1.4 | Resposta de erro do protocolo protegida; teste de não exposição adicionado e gates focados repetidos. | Codex |
| 2026-09-23 | 1.5 | Cotas de consulta transferidas para contador atômico compartilhado já existente. | Codex |

## Dev Agent Record

### Agent Model Used

Codex GPT-6.

### Debug Log References

`/tmp/preanalise-build.log`, `/tmp/preanalise-build-final.log`, `/tmp/preanalise-test.log`, `/tmp/preanalise-lint.log` (artefatos locais não versionados).

### Completion Notes List

- Quatro rotas protegidas por autenticação e permissão; convite público usa POST separado com token/PIN.
- Consulta consolidada na Pré-Análise e no AlphaConnect; fonte Receita devolvida junto ao resultado tributário.
- Falha ou insuficiência da EmpresaAqui gera resultado parcial e bloqueia protocolo conclusivo.
- Falha de gravação no protocolo devolve erro genérico ao cliente, sem mensagem interna do banco.
- EmpresaAqui usa TLS verificado, timeout, status HTTP, limite de resposta e validação de CNPJ.
- O token permanece na URL externa conforme contrato documentado do fornecedor; URLs autenticadas não são registradas pelo código.
- Limites por usuário e convite usam o contador atômico `AuthRateLimit` já existente, com chaves HMAC e escopos separados. Falha do contador bloqueia a consulta antes de chamar fornecedores.
- QA final: PASS no escopo de código e testes focados.

### File List

- `docs/stories/story-pre-analise-integridade-apis-tributarias.md`
- `src/actions/PreAnalise.ts`
- `src/actions/RadarFiscal.ts`
- `src/app/PainelAlpha/AlphaConnect/BotaoUploadExcel.tsx`
- `src/app/PainelAlpha/AlphaConnect/ModalDetalhesCNPJ.tsx`
- `src/app/PainelAlpha/AlphaConnect/ModalPesquisa.tsx`
- `src/app/PainelAlpha/AlphaConnect/RadarFiscalClient.tsx`
- `src/app/PainelAlpha/AlphaConnect/TabelaRadar.tsx`
- `src/app/PainelAlpha/SistemaPreAnalise/BlocoResultados.tsx`
- `src/app/PainelAlpha/SistemaPreAnalise/SistemaPreAnaliseClient.tsx`
- `src/app/PainelAlpha/SistemaPreAnalise/page.tsx`
- `src/app/api/ChatBot/route.ts`
- `src/app/api/ConsultaRadar/route.ts`
- `src/app/api/EmpresaAqui/route.ts`
- `src/app/api/RadarFiscal/route.ts`
- `src/app/api/ReceitaFederal/route.ts`
- `src/app/api/convite/consulta-cnpj/route.ts`
- `src/components/Parceiros/Convite/ConviteWizard.tsx`
- `src/components/Parceiros/Convite/StepEmpresa.tsx`
- `src/lib/cnpj/empresa-aqui.ts`
- `src/lib/cnpj/receita-federal.ts`
- `src/lib/auth/rate-limit.ts`
- `src/lib/pre-analise/access.ts`
- `tests/auth/rate-limit.test.ts`
- `tests/pre-analise/access.test.ts`
- `tests/pre-analise/consultas-tributarias.test.ts`
- `tests/pre-analise/convite-cnpj.test.ts`
- `tests/pre-analise/empresa-aqui.test.ts`
- `tests/pre-analise/protocolo-radar.test.ts`
- `tests/pre-analise/receita-federal.test.ts`

## QA Results

**PASS no escopo da story:** 54 testes focados aprovados na verificação retomada; consulta real dos clientes EmpresaAqui (TLS verificado) e ReceitaWS concluída na sessão original; as quatro rotas devolveram 401 sem sessão antes de chamar fornecedores.

**Gates globais:** `npm run typecheck` passou na execução sequencial final. `npm test` terminou com 17 falhas em módulos externos à story (mesma quantidade observada antes da implementação). `npm run lint` terminou com 2.409 erros e 1.214 warnings no repositório (antes da implementação: 2.417 erros). O primeiro `npm run build` passou; a repetição final falhou em `src/actions/bpm/Cards.ts:2334` por exports não async em arquivo `use server`, editado por outro fluxo e fora desta File List. Um typecheck executado em paralelo ao build final encontrou arquivos `.next/types` transitórios removidos pela recompilação; a repetição sequencial passou.

**Verificação retomada em 2026-09-23:** após a correção final, `npx vitest run tests/pre-analise` passou (6 arquivos, 52 testes), `npm run typecheck` passou e `npm run build` passou na execução sequencial, inclusive geração das 78 páginas estáticas. O build emitiu warnings em `src/lib/bibble/pdfjs-polyfill.ts` e na carga do worker PDF, fora da story. Antes da correção final, `npm test` terminou com 17 falhas em Alpha SEO, Bibble, Apresentações, Gerador de Documentos, Onyx e Aquisição de Parceiros (17 falhas, mesmo total anterior; nenhuma em `tests/pre-analise`). `npm run lint` indicou 2.409 erros e 1.214 warnings globais naquela execução. `git diff --check` nos arquivos centrais da Pré-Análise não apontou erro. O build anteriormente bloqueado por `src/actions/bpm/Cards.ts` está resolvido no estado atual; os gates globais de teste e lint ainda impedem declarar a branch pronta para merge conforme a Constitution.

**Cota compartilhada:** os escopos `pre_analise_cadastro`, `pre_analise_tributario` e `pre_analise_convite` foram adicionados ao limitador persistente `AuthRateLimit`, sem alterar o schema ou executar migration. `npx vitest run tests/pre-analise tests/auth/rate-limit.test.ts` passou (7 arquivos, 60 testes) e `npm run typecheck` passou após a mudança inicial. O teste adicional confirma falha fechada da rota de convite se o contador ficar indisponível. A tabela consta da migration `20260919141000_auth_login_security` e uma consulta somente leitura confirmou sua presença no banco configurado neste ambiente.

**Fechamento dos gates globais em 2026-09-23:** a story `story-qualidade-global-testes-lint-20260923.md` resolveu as falhas externas à Pré-Análise. `npm run lint` passou com 0 erros e 1.192 avisos; `npm run typecheck` e `npm run build` passaram; `npm test -- --coverage.reportsDirectory=/tmp/qualidade-final-coverage` passou com 3.756 testes aprovados, quatro ignorados pela ausência do checkout histórico OpenSEO (confirmada pelo usuário) e um `todo` preexistente. A primeira execução de `npm test` foi interrompida por colisão no diretório temporário de cobertura com outro Vitest concorrente, antes da repetição isolada. A última edição em `protocolarNoRadarAction` foi validada por `tests/pre-analise/protocolo-radar.test.ts` (7/7). Estes resultados substituem o estado pendente dos gates registrado acima.

**Revalidação para commit conjunto:** após alterações concorrentes em outros módulos, os quatro gates passaram novamente; a suíte global atual encerrou com 500 arquivos, 3.763 testes aprovados, quatro ignorados pela mesma ausência de checkout e um `todo`.
