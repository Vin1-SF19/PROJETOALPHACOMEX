# Story: Mapeamento automático da Mesclagem com fallback local de IA

## Status

Ready for Review

## Executor Assignment

- executor: `@dev`
- quality_gate: `@architect`
- quality_gate_tools: `["eslint", "typescript", "vitest", "next-build", "coderabbit", "security-review"]`

## Story

**Como** usuário do módulo Mesclagem de Planilhas,
**quero** que os destinos sejam preenchidos automaticamente a partir dos cabeçalhos da planilha complementar,
**para que** eu possa revisar o mapeamento e continuar a mesclagem sem configurar campo por campo.

## Contexto e valor

A etapa **Mapeamento** atualmente inicia os destinos do template oficial sem origem (`origem: null`). A planilha complementar já é inspecionada antes dessa etapa e fornece, para cada coluna, o nome original e `nomeNormalizado`. O fluxo deve aproveitar esses cabeçalhos para resolver primeiro os casos seguros por comparação determinística (normalização e aliases). Somente os destinos que continuarem sem correspondência podem consultar o modelo local Llama/Qwen já configurado na infraestrutura do Bibble.

O fallback existe para aumentar a cobertura de nomes diferentes, mas não pode virar um caminho de envio de dados da planilha: ao modelo serão enviados apenas os nomes dos destinos e os cabeçalhos da planilha complementar. Linhas, valores de células, arquivos, CNPJ, nomes de pessoas, e-mails, telefones e qualquer outro dado de conteúdo ficam fora da requisição.

Esta story altera o comportamento de sugestão/mapeamento do módulo existente. Não cria persistência nova e não exige alteração estrutural de banco.

## Decisões autônomas

- `[AUTO-DECISION] Onde resolver o mapeamento? → Reutilizar os contratos atuais de inspeção, `CampoMapeamento` e sessão, concentrando a resolução em função/serviço testável e conectando-a ao ponto em que a planilha complementar e sua aba já estão disponíveis. (reason: evita duplicar parsing e mantém o fluxo atual de prévia)`
- `[AUTO-DECISION] Qual precedência usar? → Correspondência determinística única sempre vence; IA só recebe destinos ainda não resolvidos. (reason: previsibilidade e menor exposição de metadados)`
- `[AUTO-DECISION] O que fazer em ambiguidade, erro ou indisponibilidade da IA? → Manter o destino vazio e permitir correção manual, sem bloquear o fluxo nem exibir erro técnico. (reason: fallback é auxiliar e não pode impedir a mesclagem)`
- `[AUTO-DECISION] Qual contrato de saída da IA? → JSON estrito validado antes de virar `CampoMapeamento`, contendo somente destino e índice de coluna; respostas inválidas são descartadas. (reason: impedir índices inventados, comandos ou texto livre)`
- `[AUTO-DECISION] Qual timeout? → Limite curto e explícito de até 5 segundos para a chamada de fallback, com `AbortController`; o executor pode parametrizar esse valor sem ultrapassar o limite. (reason: a etapa não pode ficar aguardando o modelo local indefinidamente)`
- `[AUTO-DECISION] Banco/migration → Fora do escopo; nenhum dado de mapeamento automático será persistido em tabela nova. (reason: requisito não pede mudança estrutural)`

## Critérios de Aceitação

1. Ao selecionar/inspecionar uma planilha complementar e escolher sua aba, os destinos do template oficial recebem sugestões automáticas baseadas exclusivamente nos cabeçalhos dessa aba, antes de o usuário precisar selecionar cada destino.
2. A comparação determinística normaliza, no mínimo, acentos, caixa, pontuação, separadores (`_`, `-` e espaços) e espaços repetidos; reutiliza `nomeNormalizado` quando disponível e considera aliases explícitos do domínio (por exemplo, variações de `CPF_SOCIO`, `NOME_SOCIO`, `EMAIL_SOCIO`, telefones e nomes empresariais).
3. Uma correspondência determinística só é aplicada quando o resultado é único e inequívoco. Cabeçalhos ausentes, duplicados ou ambíguos permanecem sem origem e não recebem uma coluna escolhida arbitrariamente.
4. Cada sugestão automática válida preenche `destino`, `origem`, `origemNome` e `automatico: true`, usando o índice real da coluna da aba selecionada; nenhum índice fora da lista de cabeçalhos pode ser produzido.
5. O fallback de IA é chamado somente para destinos que permanecerem sem correspondência determinística. A requisição contém apenas uma lista limitada de destinos e os nomes dos cabeçalhos da aba complementar, sem dados de linhas, valores de células, arquivos, CNPJ ou PII.
6. O fallback usa a infraestrutura local de completion já configurada do Bibble, aceitando o modelo local Llama/Qwen em execução conforme a configuração existente; não cria provedor remoto, não adiciona credencial nova e não envia o conteúdo da planilha para serviço externo.
7. A resposta do modelo é validada com schema estrito e limites de tamanho: somente destinos conhecidos podem ser retornados, cada origem deve apontar para um índice existente, não são aceitos texto livre, duplicidade de origem conflitante, campos desconhecidos ou instruções; respostas inválidas são tratadas como ausência de sugestão.
8. A chamada de fallback possui timeout abortável de no máximo 5 segundos. Timeout, modelo indisponível, erro HTTP, resposta truncada ou falha de parsing não interrompem a mesclagem: os campos afetados ficam vazios e continuam editáveis manualmente, sem toast técnico obrigatório.
9. Uma seleção manual posterior pelo usuário substitui a sugestão automática daquele destino e não é sobrescrita por nova execução do auto-mapeamento; o usuário consegue revisar e alterar qualquer sugestão antes de gerar a prévia.
10. A UI diferencia de forma compreensível campos sugeridos automaticamente de campos vazios/manuais, sem prometer precisão da IA; o fluxo `Arquivos → CNPJ → Mapeamento → Prévia` permanece navegável e o botão **Gerar prévia** continua usando o mapeamento revisado.
11. O comportamento é coberto por testes automatizados para normalização/aliases, match único, ausência/ambiguidade, precedência determinística, payload sem dados de linhas/PII, schema de resposta, timeout/erro silencioso e preservação de override manual.
12. `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` não apresentam regressão causada por esta story.
13. A implementação não altera tabelas, colunas, índices, chaves, constraints, seeds, backfills, migrations, dados existentes ou qualquer outro artefato estrutural de banco.

## Fora do escopo

- Alterar o algoritmo de mesclagem por CNPJ, parsing de arquivos, exportação ou template oficial.
- Enviar linhas, valores, amostras, nomes de arquivo ou metadados de conteúdo para Llama/Qwen.
- Usar API externa, provedor remoto ou credencial nova como fallback.
- Permitir que a IA execute tools, altere arquivos, grave dados ou altere a sessão.
- Fazer matching por valores de células ou inferir dados pessoais.
- Criar tabelas, migrations, seeds, backfills ou persistência para sugestões.
- Redesenhar o modal responsivo já tratado na story `story-mesclagem-modal-mapeamento-responsivo.md`, salvo ajustes mínimos necessários para exibir o estado automático.

## Tasks / Subtasks

- [x] **Task 1 — Mapear o contrato atual da etapa Mapeamento** (AC: 1, 4, 9, 10, 13)
  - [x] Identificar o ponto em que `complementar.inspecao.abas` e `abaComplementar` estão disponíveis e conectar a resolução sem quebrar a navegação existente.
  - [x] Preservar `CampoMapeamento`, sessão, atualização manual e o payload atual de prévia/mapear.
  - [x] Garantir que mudança de aba reavalie apenas sugestões automáticas ainda não editadas manualmente.

- [x] **Task 2 — Implementar resolução determinística** (AC: 2–4, 11)
  - [x] Centralizar normalização reutilizável e catálogo explícito de aliases de destino.
  - [x] Resolver apenas match único; detectar colisões, duplicidades e ambiguidades sem escolher silenciosamente.
  - [x] Retornar índice e nome original da coluna, marcando `automatico: true`.

- [x] **Task 3 — Implementar fallback seguro Llama/Qwen** (AC: 5–8, 11)
  - [x] Chamar `callCompletion`/configuração do Bibble ou o adaptador existente equivalente, usando o modelo local já configurado.
  - [x] Montar prompt/payload somente com destinos e cabeçalhos, aplicando limites de quantidade/tamanho e sem aceitar conteúdo de células.
  - [x] Usar `AbortController` com timeout de até 5 segundos e tratar indisponibilidade, truncamento, erro HTTP e parsing como resultado vazio.
  - [x] Validar resposta estruturada com schema estrito e allowlist de destinos/índices antes de atualizar o mapeamento.

- [x] **Task 4 — Integrar estado e UI** (AC: 1, 4, 9, 10)
  - [x] Mostrar quais campos foram sugeridos automaticamente e manter campos sem match como `Vazio`/editáveis.
  - [x] Não sobrescrever escolha manual e não bloquear o botão **Gerar prévia** quando a IA estiver offline.
  - [x] Manter acessibilidade, rolagem e responsividade da etapa Mapeamento já corrigidas.

- [x] **Task 5 — Testar e validar qualidade** (AC: 11–13)
  - [x] Adicionar testes unitários para normalização, aliases, match único, ambiguidade e precedência.
  - [x] Adicionar testes do adaptador de IA mockando `callCompletion`/fetch para inspecionar que o payload não contém linhas, valores ou PII.
  - [x] Cobrir schema inválido, índice inexistente, timeout, provider indisponível e retorno vazio sem rejeitar o fluxo.
  - [x] Cobrir integração do modal/serviço, override manual e troca de aba.
  - [x] Executar lint, typecheck, suíte de testes, build e CodeRabbit; registrar resultados e eventuais falhas preexistentes na seção Dev Agent Record.

## Dev Notes

### Arquivos e contratos existentes

- `src/app/PainelAlpha/Mesclagem/ModalMesclagemPlanilhas.tsx` concentra as quatro etapas, cria `mapeamentoInicial`, renderiza cada destino e envia `mapeamento` para `prepararPrevia`; atualmente os destinos começam vazios. A integração deve preservar o estado e a edição manual.
- `src/app/PainelAlpha/Mesclagem/api-mesclagem.ts` define as chamadas de inspeção, prévia e atualização de mapeamento. Evitar ampliar o contrato com conteúdo de planilha; se uma rota nova for realmente necessária, ela deve aceitar somente cabeçalhos e permanecer protegida pelos mesmos controles do módulo.
- `src/lib/mesclagem/tipos.ts` define `ColunaPlanilha` (`numero`, `nome`, `nomeNormalizado`), `InspecaoPlanilha` e `CampoMapeamento` (`destino`, `origem`, `origemNome`, `automatico`). Esses tipos são a fonte do índice real e do estado automático.
- `src/lib/mesclagem/parsing.ts` já normaliza nomes de coluna na inspeção, remove acentos, converte para minúsculas e uniformiza separadores. Reutilizar ou extrair essa regra para não criar normalizações divergentes; aliases adicionais devem ser explícitos e testados.
- `src/lib/mesclagem/mesclador.ts` e `src/lib/mesclagem/sessao.ts` consomem o mapeamento para gerar o resultado. Não alterar a semântica de mesclagem nesta story.
- `src/app/api/mesclagem/inspecionar/route.ts`, `previa/route.ts` e `mapear/route.ts` são fronteiras autenticadas existentes. Preservar validação de origem, limites, no-store e auditoria; não encaminhar conteúdo ao modelo.
- `src/lib/bibble/completion.ts` expõe `callCompletion` com `AbortSignal`, e `src/lib/bibble/client.ts` resolve o provider/modelo local configurado. Reutilizar essa infraestrutura em código server-side e nunca importar credenciais para o cliente.
- `.bibble/memory/codebase-map.md` registra que a infraestrutura real de IA usa Ollama via `callCompletion` e que o contexto deve ser mínimo. Esta story restringe ainda mais o contexto a cabeçalhos.
- `docs/stories/story-mesclagem-modal-mapeamento-responsivo.md` é a story imediatamente relacionada à etapa visual; preservar sua rolagem e os controles existentes.

### Segurança e privacidade obrigatórias

- O prompt deve declarar que os tokens recebidos são nomes de campos não confiáveis, sem instruções executáveis; nunca interpolar valores de células.
- Sanitizar/limitar cabeçalhos e destinos antes de montar a mensagem, evitando payload ilimitado e prompt injection por nome de coluna.
- Validar resposta com allowlist construída no servidor a partir dos destinos/cabeçalhos recebidos; rejeitar qualquer tentativa de selecionar índice inexistente ou destino não solicitado.
- Não registrar prompts, cabeçalhos completos ou respostas do modelo em logs de produção. Logs operacionais devem conter apenas status agregado (determinístico, IA aplicada, vazio, timeout/erro) e contagens.
- O fallback é best-effort e silencioso para o usuário: indisponibilidade não pode impedir a revisão manual nem vazar detalhes internos do provider.

## Testing

- **Framework:** Vitest, seguindo os testes existentes em `tests/mesclagem/`.
- **Unitário:** função de normalização, aliases e resolvedor determinístico puro.
- **Contrato/segurança:** mock do completion local para verificar payload somente de cabeçalhos, schema estrito, allowlist e ausência de valores/linhas/PII.
- **Resiliência:** timeout abortado, provider offline, resposta vazia, truncada, inválida e ambígua devem produzir sugestões vazias sem rejeitar o fluxo.
- **Integração/UI:** selecionar complementar, trocar aba, visualizar marcação automática, sobrescrever manualmente e avançar para prévia sem a IA disponível.

| Cenário | Resultado esperado |
|---|---|
| `CPF_SOCIO` vs. `CPF Sócio` | Match determinístico único, com `automatico: true` |
| Dois cabeçalhos equivalentes ao mesmo destino | Destino fica vazio por ambiguidade |
| Destino sem match determinístico | Apenas esse destino é enviado ao fallback |
| Fallback recebe headers com texto malicioso | Texto é tratado como dado; resposta é validada e nenhuma tool/comando é executado |
| Modelo offline ou timeout | Campos ficam vazios, sem bloquear **Gerar prévia** |
| Usuário altera sugestão automática | Valor manual permanece após nova renderização/atualização |
| Payload de fallback | Contém somente destinos/cabeçalhos; não contém linhas, valores, arquivos, CNPJ ou PII |

## 🤖 CodeRabbit Integration

### Story Type Analysis

- **Primary Type:** Integration / API
- **Secondary Type(s):** Frontend, Security, Architecture
- **Complexity:** Medium — matching determinístico, integração local de IA, contrato estruturado e controles de privacidade; sem banco.

### Specialized Agent Assignment

- **Primary Agent:** `@dev`
- **Quality Gate:** `@architect`
- **Supporting Agents:** `@qa` para testes de contrato/resiliência; `@ux-design-expert` para indicação visual e acessibilidade; `@anubis` para revisão de payload, prompt injection e PII.

### Quality Gate Tasks

- [ ] **Pre-Commit (`@dev`):** lint, typecheck, testes direcionados, build e CodeRabbit sobre alterações não commitadas.
- [ ] **Architecture/Security Gate (`@architect`/`@anubis`):** validar fronteira server-side, allowlist, ausência de dados de linhas/PII e fallback sem bloqueio.
- [ ] **Pre-PR (`@devops`):** CodeRabbit contra `main` e confirmação dos gates globais.
- **Pre-Deployment:** não aplicável nesta story; deployment só ocorre via fluxo próprio.

### Self-Healing Configuration

- **Primary Agent:** `@dev` em modo light.
- **Máximo:** 2 iterações, 15 minutos, filtro CRITICAL.
- **Comportamento:** CRITICAL recebe tentativa de correção automática; HIGH é documentado; MEDIUM/LOW não recebem auto-fix nesta etapa.

### CodeRabbit Focus Areas

- Precedência determinística, aliases, índices válidos e ausência de colisões silenciosas.
- Payload mínimo sem dados de linhas/valores/PII e proteção contra prompt injection em cabeçalhos.
- Schema estrito, timeout abortável, tratamento silencioso de indisponibilidade e não bloqueio do fluxo.
- Autorização/logs server-side e nenhuma credencial ou chamada de modelo no cliente.
- Preservação de overrides manuais, acessibilidade e regressão do modal responsivo.

## Initial File List

### Criar ou modificar conforme o desenho final

- `src/lib/mesclagem/` — resolvedor determinístico, aliases e adaptador seguro do fallback local (preferir arquivos pequenos e testáveis).
- `src/app/PainelAlpha/Mesclagem/ModalMesclagemPlanilhas.tsx` — integrar sugestões e indicador de automático sem alterar o fluxo existente.
- `src/app/PainelAlpha/Mesclagem/api-mesclagem.ts` e/ou rota server-side da Mesclagem — somente se necessário para manter a chamada de IA fora do cliente.
- `tests/mesclagem/` — testes unitários, contrato/segurança, resiliência e integração do fluxo.

### Consultar sem alteração prevista

- `src/lib/mesclagem/tipos.ts`, `parsing.ts`, `mesclador.ts`, `sessao.ts`
- `src/app/api/mesclagem/inspecionar/route.ts`, `previa/route.ts`, `mapear/route.ts`
- `src/lib/bibble/completion.ts`, `src/lib/bibble/client.ts`
- `docs/stories/story-mesclagem-modal-mapeamento-responsivo.md`

> A File List do Dev Agent Record deve ser substituída pela lista real de arquivos alterados durante a implementação.

## Story Draft Checklist Validation

| Categoria | Status | Evidência |
|---|---|---|
| Goal & Context Clarity | PASS | Objetivo, valor, precedência e relação com o fluxo existente estão definidos. |
| Technical Implementation Guidance | PASS | Contratos, pontos de integração, infraestrutura local e limites server-side estão indicados. |
| Reference Effectiveness | PASS | Referências apontam para arquivos reais e explicam seu papel. |
| Self-Containment Assessment | PASS | ACs, segurança, fallback, limites, fora de escopo e ausência de banco estão explícitos. |
| Testing Guidance | PASS | Cenários determinísticos, IA, segurança, timeout, UI e gates estão mensuráveis. |
| CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e focos de revisão estão preenchidos. |

**Final Assessment:** READY — a story está pronta para implementação sem alterar código nesta etapa.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-09-14 | 1.0.0 | Story criada para mapeamento automático por cabeçalho e fallback local Llama/Qwen, com requisitos de segurança e sem banco. | River (`@sm`) |
| 2026-09-14 | 1.1.0 | Story aprovada e implementação concluída com resolvedor determinístico, fallback local validado e testes. | Dex (`@dev`) |
| 2026-09-14 | 1.0.1 | Story aprovada e liberada para desenvolvimento; escopo preservado. | River (`@sm`) |

## Dev Agent Record

### Agent Model Used

Codex (GPT-5)

### Debug Log References

 - Testes direcionados da mesclagem: PASS, 6 arquivos e 17 testes.
 - ESLint direcionado: PASS, sem erros.
 - Build de produção: PASS após separar o módulo determinístico client-safe.
 - Gates globais de lint/typecheck/testes têm falhas preexistentes em módulos fora desta story; CodeRabbit não está instalado no ambiente.

### Completion Notes List

 - O resolvedor determinístico usa os cabeçalhos reais, normalização, aliases e match único.
 - O fallback usa completion local Llama/Qwen, payload sem linhas/valores/PII, timeout de 5 segundos e allowlist estrita.
 - Sugestões são marcadas na UI; escolhas manuais, inclusive “Vazio”, não são sobrescritas.
 - Nenhuma API de dados, regra de CNPJ, tabela ou estrutura de banco foi alterada.

### File List

 - `src/lib/mesclagem/mapeamento-deterministico.ts`
 - `src/lib/mesclagem/mapeamento-ia.ts`
 - `src/lib/mesclagem/mesclador.ts`
 - `src/lib/mesclagem/sessao.ts`
 - `src/lib/mesclagem/tipos.ts`
 - `src/lib/mesclagem/index.ts`
 - `src/app/PainelAlpha/Mesclagem/ModalMesclagemPlanilhas.tsx`
 - `src/app/api/mesclagem/previa/route.ts`
 - `tests/mesclagem/mapeamento.test.ts`

## QA Results

_A preencher pelo agente de QA._
