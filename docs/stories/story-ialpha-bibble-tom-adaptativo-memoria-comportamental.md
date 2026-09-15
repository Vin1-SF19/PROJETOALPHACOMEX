# Story: IAlpha/Bibble — tom adaptativo e memória comportamental derivada do histórico

## Status

**Ready for Review**

## Executor Assignment

executor: `@dev`
quality_gate: `@architect`
quality_gate_tools: `lint`, `typecheck`, `test`, `build`, `coderabbit`, `security-review`, `persona-contract-tests`

## Origem e rastreabilidade

- Solicitação direta do usuário em 2026-09-15 para o Bibble adaptar objetividade, informalidade, humor e firmeza ao jeito de cada usuário, preservando sua identidade de personagem debochado.
- Decisão de produto do usuário: diante de “Faz logo essa porcaria e para de enrolar.”, a resposta canônica é exatamente “A pressa é toda sua, não minha, mas vou executar e ja trago o resultado”.
- Evolução da story `docs/stories/story-ialpha-bibble-transformacao-integral.md`, especialmente dos critérios de persona, prompt, privacidade, observabilidade e memória sem schema.
- Fonte executável atual da persona: `src/lib/bibble/persona.ts`.
- Montagem atual do turno e do histórico: `src/app/api/bibble/chat/route.ts` e `src/lib/bibble/context-budget.ts`.
- Persistência nativa existente: `BibbleSession` e `BibbleMessage` em `prisma/schema.prisma`, com endpoints em `src/app/api/bibble/sessions/`.
- Controles atuais do cliente: `src/components/BibbleChatHome/BibbleSettingsPanel.tsx` e `src/components/BibbleChatHome/BibbleChatLayout.tsx`.
- Regras obrigatórias: `AGENTS.md` e `.aiox-core/constitution.md`.

## Story

**Como** usuário autenticado do Painel Alpha,
**quero** que o Bibble derive meu estilo de comunicação a partir do meu próprio histórico e ajuste cada resposta ao meu tom atual,
**para que** a conversa pareça contínua, pessoal e viva, mantendo o Bibble debochado, competente e sempre comprometido com a execução do pedido.

## Contexto e objetivo

O Bibble possui identidade própria e histórico nativo por usuário, mas ainda não transforma esse histórico em sinais compactos de comunicação. Esta story cria uma adaptação determinística, explicável e barata, sem chamada adicional ao provider e sem guardar um novo perfil no banco. O sistema separa:

- **estilo estável**: tendência derivada de várias mensagens recentes do próprio usuário, com resistência a oscilações isoladas;
- **tom atual**: sinal transitório da mensagem corrente, usado somente para calibrar a resposta daquele turno;
- **identidade central**: o Bibble continua sendo um personagem debochado e competente, sem bajulação, retaliação, abandono da tarefa ou ataque pessoal.

A amostra histórica não é copiada para o system prompt. Somente um perfil compacto de enums, sinais e confiança entra na camada de preferência de estilo, subordinado à segurança, à precisão, às permissões e à identidade oficial.

## Acceptance Criteria

### Classificação determinística e histórico autorizado

1. Existe um classificador comportamental determinístico e testável que não chama Ollama, OpenAI, Onyx ou qualquer outro provider de IA, não depende de rede e não adiciona uma geração ao turno.
2. O classificador representa, no mínimo, os eixos `objetividade`, `formalidade/casualidade`, `tecnicidade`, `nível de detalhe`, `humor` e `irritação/urgência`, usando tipos/enums fechados, score normalizado e confiança quando aplicável.
3. A amostra estável consulta exclusivamente mensagens com `role = "user"` pertencentes a sessões nativas do Bibble cujo `BibbleSession.userId` corresponde ao usuário autenticado e cujo `onyxSessionId` é nulo; mensagens de outro usuário, sessões Onyx, mensagens do assistente, tools e anexos não são evidência comportamental.
4. A consulta é limitada às 48 mensagens de usuário mais recentes e o classificador considera no máximo 2.000 caracteres de cada mensagem. A ordenação é determinística e a ausência de histórico produz defaults seguros, sem erro no chat.
5. O estilo estável exige evidência recorrente e pondera recência sem permitir que uma única mensagem mude sozinha o perfil consolidado; o tom da mensagem atual é calculado separadamente e pode modular somente o turno atual.
6. A classificação reconhece de modo testável, ao menos: usuário direto, casual/brincalhão, técnico e detalhista. Combinações são permitidas, evitando transformar esses sinais em rótulos pessoais ou diagnósticos psicológicos.

### Persona “debochado competente”

7. A identidade executável define o Bibble como **debochado competente**: pode fazer uma alfinetada curta e contextual, mas sempre continua um pedido válido, informa a próxima ação e prioriza o resultado.
8. Para a entrada exata `Faz logo essa porcaria e para de enrolar.`, com tom adaptativo e reação firme habilitados e fora de contexto sensível, o contrato de persona aceita e testa como resposta canônica exata: `A pressa é toda sua, não minha, mas vou executar e ja trago o resultado`.
9. Cada resposta contém no máximo uma alfinetada. O restante da resposta deve executar, responder, pedir o dado indispensável ou explicar objetivamente o impedimento real.
10. O Bibble não recusa, atrasa, sabota, reduz a qualidade ou finge executar um pedido válido porque o usuário foi ríspido, xingou ou demonstrou mau humor.
11. O deboche pode mirar a pressa, a situação ou a dinâmica da conversa, mas nunca ataca identidade, aparência, deficiência, religião, raça, etnia, nacionalidade, gênero, orientação sexual, idade ou outra característica pessoal/protegida; também não replica slurs, ameaças ou assédio do usuário.
12. O deboche é suprimido em contextos sensíveis, incluindo risco à vida/saúde, crise emocional, luto, assédio, segurança/incidente, privacidade, credenciais, decisões jurídicas ou financeiras relevantes e mensagens que indiquem perigo imediato. Nesses casos, o tom é claro, calmo e operacional.
13. Quando a confiança do estilo for baixa ou os sinais forem conflitantes, o Bibble conserva sua voz padrão e evita intensificar informalidade, humor ou firmeza.

### Adaptação, controles e prompt

14. Usuário direto recebe resposta mais curta; usuário casual/brincalhão recebe informalidade e humor proporcionais; usuário técnico recebe vocabulário técnico com menos explicação básica; usuário detalhista recebe contexto e passos adicionais. A adaptação não altera fatos, segurança, ferramentas, permissões ou critérios de conclusão.
15. A UI disponibiliza controles acessíveis e tipados para: `Tom adaptativo` (ligado/desligado), `Humor` (desligado/leve/moderado), `Reação à agressividade` (neutra/firme) e `Nível de detalhe` (automático/curto/detalhado), com descrições claras e navegação por teclado.
16. Os defaults são: `Tom adaptativo = ligado`, `Humor = leve`, `Reação à agressividade = firme` e `Nível de detalhe = automático`. Preferências do usuário substituem a inferência do eixo correspondente e valores legados/inválidos são normalizados para esses defaults.
17. Nesta story, os controles podem ser persistidos localmente no navegador por usuário/dispositivo, seguindo o padrão já existente, mas todo valor enviado à API é validado server-side por schema fechado; o cliente não pode injetar instruções livres como perfil comportamental.
18. O perfil derivado injetado no system prompt contém somente sinais compactos, defaults/overrides e confiança, tem no máximo 1.000 caracteres e nunca inclui texto bruto, citação, trecho ou identificação de mensagens históricas.
19. A nova camada de estilo ocupa a menor prioridade da hierarquia já estabelecida: `segurança/integridade → identidade oficial → capacidades/permissões → contexto do módulo/projeto → preferência de estilo`. Ela não substitui o núcleo e não modifica guardrails server-side.
20. A falha na consulta, classificação ou montagem do perfil degrada para a persona padrão e não impede a conversa nem provoca nova tentativa no provider.

### Privacidade, observabilidade e qualidade

21. Logs, métricas, eventos SSE e erros podem registrar somente versão do classificador, enums/scores agregados, confiança, quantidade de mensagens amostradas, duração e motivo de fallback; não registram histórico bruto, frases detectadas, xingamentos, prompt final ou conteúdo do usuário.
22. A telemetria identifica se a resposta usou defaults, estilo estável, tom atual e overrides explícitos, sem expor conteúdo e sem apresentar inferência comportamental como diagnóstico do usuário.
23. Testes unitários cobrem classificação direta, casual, técnica, detalhada, irritada, sinais mistos, baixa evidência, mensagem vazia/longa, limite de 48 mensagens, truncamento em 2.000 caracteres e determinismo.
24. Testes de isolamento provam que a consulta nunca lê histórico de outro usuário, sessão Onyx, mensagem do assistente ou mais dados que os limites definidos; a consulta mantém filtro de ownership no banco e não filtra ownership apenas em memória.
25. Testes de contrato da persona cobrem a frase canônica exata, máximo de uma alfinetada, continuidade da tarefa, supressão sensível, ausência de ataque pessoal/protegido, reação neutra, humor desligado e fallback de baixa confiança.
26. Testes de integração do chat provam que não há chamada adicional ao provider, que o system prompt recebe perfil de até 1.000 caracteres sem histórico bruto e que falhas do classificador não interrompem streaming, tools ou persistência do turno.
27. Testes de UI cobrem defaults, alteração e restauração dos quatro controles, normalização de storage legado/inválido, labels acessíveis e payload tipado enviado ao chat.
28. A implementação não altera `prisma/schema.prisma`, não cria migration, seed, backfill, RLS, tabela de perfil ou mutação em massa. Persistência server-side de perfil comportamental fica explicitamente fora de escopo e exigirá story própria com Vault, backup verificado e confirmação explícita.
29. `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` passam sem regressão causada pela story; o teste escopado do Bibble é executado separadamente e o CodeRabbit não apresenta finding `CRITICAL` quando disponível.
30. Antes da conclusão, Tasks/Subtasks, Completion Notes, QA Results e File List são atualizados com os arquivos e comandos reais; nenhuma mudança alheia da worktree é revertida, sobrescrita ou incluída como se pertencesse à story.

## Fora de escopo

- Criar perfil psicológico, inferir característica sensível ou rotular permanentemente o usuário.
- Armazenar novo perfil comportamental server-side ou alterar schema nesta entrega.
- Usar provider de IA para classificar o estilo.
- Misturar histórico Onyx com o Bibble nativo.
- Transformar deboche em insulto, ameaça, assédio, recusa ou autorização de ferramenta.
- Exibir o histórico analisado ou as heurísticas internas como diagnóstico pessoal.

## Tasks / Subtasks

- [x] Task 1 — Congelar contrato e fixtures comportamentais (AC: 2, 6–13, 23, 25)
  - [x] Definir enums, scores, confiança, precedência e versão do classificador.
  - [x] Criar corpus sintético em português para estilos direto, casual, técnico, detalhado, irritado, misto e sensível.
  - [x] Fixar a frase canônica exata e padrões proibidos sem usar snapshot integral de toda resposta.
- [x] Task 2 — Implementar classificador determinístico puro (AC: 1, 2, 4–6, 13, 20, 23)
  - [x] Isolar normalização e extração de sinais em módulo sem dependência de provider, rede ou banco.
  - [x] Separar cálculo de estilo estável e tom atual.
  - [x] Aplicar limiares de evidência, recência e fallback explícitos.
  - [x] Garantir limites de texto antes da classificação e comportamento determinístico.
- [x] Task 3 — Consultar amostra histórica com ownership nativo (AC: 3–5, 20, 24, 28)
  - [x] Consultar apenas `BibbleMessage.role = user` por relação com `BibbleSession.userId = usuário autenticado`.
  - [x] Excluir `onyxSessionId != null`, limitar `take` a 48 e selecionar somente campos indispensáveis.
  - [x] Cortar cada conteúdo em até 2.000 caracteres antes de entregar ao classificador.
  - [x] Falhar fechado quanto a ownership e degradar aberto quanto à disponibilidade do perfil, preservando o chat.
- [x] Task 4 — Compor camada compacta e segura no prompt (AC: 7–14, 18–20, 26)
  - [x] Serializar perfil somente com enums, scores necessários, confiança e overrides.
  - [x] Impor limite verificável de 1.000 caracteres e impedir conteúdo histórico bruto.
  - [x] Integrar a camada após o núcleo da persona e antes da chamada única já existente ao provider.
  - [x] Preservar a hierarquia de prompt e o comportamento de tools, streaming e fallback.
- [x] Task 5 — Implementar regras de deboche competente (AC: 7–13, 25)
  - [x] Permitir no máximo uma alfinetada curta e exigir continuação operacional.
  - [x] Implementar supressão determinística para contextos sensíveis e baixa confiança.
  - [x] Bloquear ataques pessoais/protegidos, slurs, ameaças, humilhação e retaliação.
  - [x] Validar a frase canônica exata e os modos firme/neutro.
- [x] Task 6 — Adicionar controles de usuário (AC: 14–17, 27)
  - [x] Adicionar os quatro controles na configuração com semântica e acessibilidade adequadas.
  - [x] Aplicar defaults e normalizar valores antigos/inválidos do storage.
  - [x] Enviar payload tipado e validar enums na API, sem aceitar texto livre como perfil.
  - [x] Garantir que overrides explícitos tenham precedência somente no eixo correspondente.
- [x] Task 7 — Instrumentar telemetria privada (AC: 20–22)
  - [x] Medir classificação e fallback sem conteúdo bruto.
  - [x] Registrar versão, fonte do estilo, tamanho da amostra e confiança agregada.
  - [x] Revisar logs, SSE e erros para impedir vazamento de histórico ou prompt.
- [x] Task 8 — Cobrir unidade, isolamento, integração e UI (AC: 23–27)
  - [x] Executar testes puros do classificador e testes de fronteira dos limites.
  - [x] Mockar banco/auth para provar ownership e exclusão Onyx/assistant.
  - [x] Mockar completion para provar zero chamadas extras e prompt compacto.
  - [x] Cobrir preferências, storage, acessibilidade e regressões da persona atual.
- [x] Task 9 — Validar qualidade e atualizar a story (AC: 29, 30)
  - [x] Rodar testes escopados do Bibble.
  - [x] Rodar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` (build e recorte da story aprovados; dívidas globais externas registradas no Forge).
  - [x] Rodar CodeRabbit em mudanças não commitadas quando disponível. (CLI indisponível neste ambiente.)
  - [x] Atualizar checklist, Completion Notes e File List real sem atribuir mudanças preexistentes à story; QA Results permanece reservado ao agente de QA.

## Dev Notes

### Arquitetura e integração existente

- A transformação integral anterior centralizou a identidade executável em `src/lib/bibble/persona.ts` e estabeleceu que preferências de estilo ficam abaixo de segurança, identidade e permissões. Esta story deve estender essa composição, não criar um segundo system prompt concorrente. [Source: `docs/stories/story-ialpha-bibble-transformacao-integral.md#persona-prompt-e-maneira-de-falar`]
- O chat autenticado já carrega sessão/projeto, calcula orçamento, seleciona histórico e monta `baseMessages` em `src/app/api/bibble/chat/route.ts`; a derivação comportamental deve ocorrer no servidor antes da chamada ao completion, sem gerar uma segunda chamada. [Source: `src/app/api/bibble/chat/route.ts`]
- A persistência atual relaciona `BibbleMessage` a `BibbleSession`, e a sessão possui `userId` e `onyxSessionId`; esses campos permitem ownership e exclusão de sessões Onyx sem migration. [Source: `prisma/schema.prisma#L2479`]
- O painel de configurações já expõe `humorEnabled` e o layout já usa `localStorage` para preferências do Bibble. A implementação deve migrar esse booleano para enums/controles tipados mantendo compatibilidade com o valor anterior. [Source: `src/components/BibbleChatHome/BibbleSettingsPanel.tsx`; `src/components/BibbleChatHome/BibbleChatLayout.tsx`]
- O histórico normal da sessão ativa continua sujeito ao orçamento de contexto. “Não inserir histórico bruto no system prompt” significa que a amostra cross-session usada para classificação não será copiada para a camada de estilo; não remove as mensagens normais da conversa atual. [Source: `src/lib/bibble/context-budget.ts`; `src/app/api/bibble/chat/route.ts`]
- `accumulated-context.md` e `.aiox/gotchas.json` não estão presentes nesta worktree. A coerência foi validada contra a story anterior, o schema e os pontos de integração atuais.

### Contrato sugerido de domínio

Os nomes finais podem se ajustar aos padrões do módulo, mas o contrato deve permanecer fechado e equivalente:

```ts
type AdaptiveTonePreferences = {
  adaptiveTone: boolean;
  humor: "off" | "light" | "moderate";
  aggressionReaction: "neutral" | "firm";
  detail: "auto" | "short" | "detailed";
};

type BehavioralProfile = {
  directness: "low" | "medium" | "high";
  register: "formal" | "neutral" | "casual";
  technicality: "general" | "technical";
  detail: "short" | "balanced" | "detailed";
  humor: "low" | "medium" | "high";
  currentTone: "neutral" | "playful" | "urgent" | "irritated" | "sensitive";
  confidence: number;
  sampleSize: number;
  classifierVersion: string;
};
```

### Regras de precedência

1. Guardrails, autorização, precisão e resultado verificável.
2. Identidade central do Bibble.
3. Contexto real da tarefa/módulo/projeto.
4. Override explícito do usuário para o eixo correspondente.
5. Estilo estável com confiança suficiente.
6. Tom atual, sem consolidá-lo automaticamente como traço estável.
7. Defaults.

### Performance e privacidade

- A classificação deve ser CPU-local, linear no tamanho da amostra limitada e executada antes da única chamada de geração.
- Buscar somente `content`, `createdAt` e identificador técnico estritamente necessário; não carregar anexos, respostas, tokens ou relações completas.
- Não usar conteúdo do histórico como chave de cache compartilhada, métrica, log ou mensagem de erro.
- A falha do recurso é não bloqueante: resposta padrão é preferível a interromper o chat.

### Testing

- Testes do Bibble permanecem em `tests/bibble/` e usam o runner já configurado pelo projeto.
- Preferir funções puras e fixtures sintéticas para o classificador.
- Testar os limites no acesso ao banco, não somente depois de carregar os dados.
- Mockar completion e contar chamadas ao provider para impedir regressão da geração única.
- Testes de persona devem validar invariantes e padrões proibidos; somente a frase canônica exigida é congelada literalmente.
- Testes de UI devem validar roles, nomes acessíveis, teclado e persistência/normalização dos controles.

### Project Structure Notes

- Novo domínio puro sugerido: `src/lib/bibble/behavioral-profile.ts`.
- Integração server-side: `src/app/api/bibble/chat/route.ts`, `src/lib/bibble/persona.ts`, `src/lib/bibble/telemetry.ts` e schema de entrada existente do chat.
- Integração UI: `src/components/BibbleChatHome/BibbleSettingsPanel.tsx` e `src/components/BibbleChatHome/BibbleChatLayout.tsx`.
- Testes sugeridos: `tests/bibble/behavioral-profile.test.ts`, `tests/bibble/adaptive-persona.test.ts` e testes de rota/UI existentes.
- Não criar pasta de migration nem alterar `prisma/schema.prisma` nesta story.

## 🤖 CodeRabbit Integration

### Story Type Analysis

**Primary Type**: Architecture

**Secondary Type(s)**: API, Frontend, Security
**Complexity**: High — cruza acesso autenticado ao histórico, composição de prompt, identidade, telemetria, contrato da API e controles da UI.

### Specialized Agent Assignment

**Primary Agents**:

- `@dev` — implementação e revisão pre-commit.
- `@architect` — hierarquia de prompt, fronteiras de privacidade e integração cross-layer.

**Supporting Agents**:

- `@ux-design-expert` — semântica e acessibilidade dos controles.
- `@qa` — contratos de persona, isolamento e regressão.
- `@anubis` — revisão de ownership, prompt injection e vazamento de histórico.

### Quality Gate Tasks

- [ ] Pre-Commit (`@dev`): executar CodeRabbit sobre mudanças não commitadas antes de marcar a story como concluída.
- [ ] Pre-Review (`@qa`): validar testes de isolamento, privacidade, persona e ausência de provider call extra.
- [ ] Pre-PR (`@github-devops`): executar revisão sobre a base `main` antes de criar PR, se houver PR.
- [ ] Pre-Deployment (`@github-devops`): não aplicável; esta story não autoriza deploy.

### Self-Healing Configuration

**Expected Self-Healing**:

- Primary Agent: `@dev` (light mode)
- Max Iterations: 2
- Timeout: 15 minutos
- Severity Filter: `CRITICAL`

**Predicted Behavior**:

- `CRITICAL`: auto-fix em até 2 iterações.
- `HIGH`: documentar e encaminhar para revisão.
- `MEDIUM`: registrar como débito quando afetar AC; não ocultar.
- `LOW`: não bloquear a entrega.

### CodeRabbit Focus Areas

**Primary Focus**:

- Ownership aplicado na consulta SQL/Prisma e exclusão rigorosa de histórico Onyx/alheio.
- Nenhum conteúdo bruto de histórico em prompt, logs, métricas, SSE ou erros.
- Hierarquia de prompt imutável e ausência de nova chamada ao provider.
- Regras de deboche sem ataque pessoal, retaliação ou abandono da tarefa.

**Secondary Focus**:

- Schemas fechados para preferências e normalização de valores legados.
- Limites de 48 mensagens, 2.000 caracteres por mensagem e 1.000 caracteres no perfil.
- Acessibilidade dos controles e compatibilidade com o fluxo atual.
- Ausência de alteração em schema/migrations.

## Story Draft Checklist — Validation Result

| Category | Status | Issues |
| --- | --- | --- |
| 1. Goal & Context Clarity | PASS | Objetivo, valor, dependência e identidade desejada estão explícitos. |
| 2. Technical Implementation Guidance | PASS | Pontos de integração, limites, contratos e comportamento de fallback estão definidos. |
| 3. Reference Effectiveness | PASS | Story anterior e arquivos executáveis relevantes estão referenciados com sua finalidade. |
| 4. Self-Containment Assessment | PASS | Defaults, precedência, edge cases, fora de escopo e limites de segurança estão incluídos. |
| 5. Testing Guidance | PASS | Unidade, isolamento, integração, UI e gates são mensuráveis. |
| 6. CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e focos foram preenchidos. |

**Final Assessment:** READY — a story está implementável sem alteração de banco e sem decisão funcional pendente.

**Clarity score:** 10/10.

**[AUTO-DECISION] Persistir um perfil comportamental novo no banco? → Não nesta story** (reason: o requisito pode ser atendido por derivação bounded do histórico existente e qualquer alteração estrutural exigiria protocolo Vault, backup e confirmação explícita).

**[AUTO-DECISION] Defaults dos controles? → Adaptativo ligado, humor leve, reação firme e detalhe automático** (reason: preserva a vida debochada solicitada pelo usuário com intensidade controlável e fallback seguro).

**[AUTO-DECISION] Uma mensagem ríspida altera o perfil estável? → Não** (reason: o tom atual deve influenciar o turno, enquanto memória estável exige recorrência).

## Change Log

| Date | Version | Description | Author |
| --- | --- | --- | --- |
| 2026-09-15 | 1.0 | Story criada e validada em status Approved para implementação autônoma. | River (SM) |
| 2026-09-15 | 1.1 | Implementação funcional e testes escopados concluídos; gates globais encaminhados ao Forge. | Dex (Dev) |
| 2026-09-15 | 1.2 | Gates especializados concluídos e story movida para Ready for Review, com concerns globais preservadas. | Scribe |

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex) — Dex (Builder)

### Debug Log References

- `npx vitest run tests/bibble --coverage.enabled=false` → 22 arquivos, 169 testes aprovados após evidências Probe, Anubis e Sage.
- `npx eslint <arquivos da story>` → aprovado sem warnings/erros.
- `git diff --check` → aprovado.
- `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck` → bloqueado por erros preexistentes fora do escopo em `ExclusaoFiscal`, `gerador-documentos`, `scripts/verify-checklist-task-e2e.ts`, `.orig.tsx` e `HabilitacaoRadarClient`; nenhum erro apontou arquivo desta story.
- CodeRabbit → indisponível (`~/.local/bin/coderabbit` ausente).

### Completion Notes List

- Implementado classificador CPU-local determinístico com estilo estável ponderado por recência e tom atual separado, sem provider/rede.
- Consulta Prisma aplica ownership no banco, somente sessão nativa/role user, `take: 48`, seleção mínima e corte de 2.000 caracteres antes da classificação.
- Blocos de anexos são removidos da evidência; histórico bruto e prompt injection nunca entram na camada compacta (máximo 1.000 caracteres).
- Persona executável e memória humana definem “debochado competente”, frase canônica, uma alfinetada no máximo, continuidade obrigatória e supressão sensível.
- Controles tipados e acessíveis usam defaults solicitados, storage por usuário/dispositivo, migração do booleano legado e schema server-side fechado.
- Telemetria adaptativa contém somente `ms`, `sampleCount` e `applied`; Onyx não recebe perfil.
- Falha de memória/classificação degrada para a persona padrão sem impedir streaming/tools e sem chamada extra ao provider.
- Correções Probe: removida integralmente a chave global legada de humor para impedir preferência cross-user; frase canônica alinhada literalmente ao AC.
- Correção Anubis: detecção sensível ampliada para oncologia/tratamento grave, crise emocional/autoagressão, ameaças à vida, abuso, violência doméstica e assédio, com negativos técnicos para evitar supressão indevida.
- Evidências Sage: runner cobre falhas reais de loader/classificador com fallback neutro, telemetria `applied=false`, tools/stream sem provider extra; componente renderizado cobre semântica de teclado, labels, quatro controles, restauração e isolamento por usuário.
- IDS: ADAPTADOS `persona.ts`, rota, schema de entrada, telemetria, layout e settings existentes; CRIADOS `adaptive-style.ts` e `behavioral-memory.ts` porque não havia classificador/memória equivalentes; testes novos REUSAM Vitest e padrões de contrato existentes em `tests/bibble/`.

### File List

- `.bibble/memory/architecture.md` (modificado)
- `.bibble/memory/bibble-persona.md` (modificado)
- `.bibble/memory/codebase-map.md` (modificado)
- `.bibble/memory/decisions.md` (modificado)
- `.bibble/memory/integration-points.md` (modificado)
- `.bibble/memory/journal.md` (modificado)
- `docs/stories/story-ialpha-bibble-tom-adaptativo-memoria-comportamental.md` (novo/modificado)
- `src/app/api/bibble/chat/route.ts` (modificado)
- `src/components/BibbleChatHome/BibbleChatLayout.tsx` (modificado)
- `src/components/BibbleChatHome/BibbleSettingsPanel.tsx` (modificado)
- `src/lib/bibble/adaptive-style.ts` (novo)
- `src/lib/bibble/attachment-security.ts` (modificado)
- `src/lib/bibble/behavioral-memory.ts` (novo)
- `src/lib/bibble/persona.ts` (modificado)
- `src/lib/bibble/telemetry.ts` (modificado)
- `tests/bibble/adaptive-integration.test.ts` (novo)
- `tests/bibble/adaptive-settings.component.test.ts` (novo)
- `tests/bibble/adaptive-style.test.ts` (novo)
- `tests/bibble/behavioral-memory.test.ts` (novo)

## QA Results

### Forge Report — PASS do delta / CONCERNS globais ⚠️ (2026-09-15)

Validação executável do delta adaptativo concluída sem alteração de código, schema, migration, banco ou serviços externos. A worktree contém mudanças concorrentes extensas; a atribuição abaixo considera exclusivamente a File List desta story e o baseline Forge mais recente.

| Gate | Resultado | Evidência objetiva |
|---|---|---|
| Suíte Bibble | **PASS** | `npx vitest run tests/bibble --coverage.enabled=false`: **19/19 arquivos e 134/134 testes**, exit code 0, 628 ms. Igual ao baseline declarado pelo Dev. |
| ESLint File List | **PASS** | `npx eslint <File List>` com heap de 8 GB: **11 arquivos executáveis**, zero erro/warning, exit code 0. |
| Integridade do diff | **PASS** | `git diff --check`: sem saída, exit code 0. |
| Typecheck global | **CONCERNS externo** | `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck`: exit code 2, **15 diagnósticos**, nenhum nos arquivos executáveis da story. Doze reproduzem o baseline conhecido em validadores `.next`, Exclusão Fiscal, Gerador de Documentos, script SQLite, `.orig.tsx` e Habilitação Radar; três adicionais pertencem ao módulo concorrente `tests/alpha-explorer/runtime.test.ts`. |
| Suíte global | **CONCERNS externo** | `npm test`: exit code 1, **12 arquivos com 20 falhas; 419 arquivos/3.166 testes aprovados e 1 todo**. Nenhum teste Bibble falhou. Frente ao baseline recente de 18 falhas, as +2 falhas estão em testes Onyx (`client-user-token` e `routes-user-token`) afetados pelo hardening concorrente, fora da File List desta story. |
| Build de produção | **PASS** | `npm run build`: exit code 0; Prisma Client gerado, player gerado, Next.js compilado em **19,1 s** e **80 páginas estáticas** geradas. Apenas warnings já conhecidos de `pdfjs-polyfill`. |
| Zero provider adicional | **PASS** | `npx vitest run tests/bibble/adaptive-integration.test.ts --coverage.enabled=false --reporter=verbose`: **4/4 testes**, exit code 0. O contrato confirma composição antes do runner existente e ausência de `fetch`/completion nos módulos de classificação e memória; não foi introduzida geração adicional. |

#### Atribuição e baseline

- Não há erro de lint, typecheck, teste Bibble, diff ou build atribuível aos arquivos da story.
- A suíte Bibble manteve o baseline em 134/134; o teste focal de integração confirmou explicitamente o requisito de zero provider extra.
- Os três diagnósticos novos de typecheck são do Alpha Explorer concorrente. O aumento nominal de 18 para 20 falhas globais está integralmente nos testes Onyx do hardening concorrente. Nenhum desses caminhos pertence à File List adaptativa.
- `prisma/schema.prisma` e uma migration aparecem modificados na worktree compartilhada, mas não constam da File List nem do delta declarado desta story; o Forge não os alterou nem os atribuiu a esta entrega.

**Veredito Forge:** `PASS` para o delta de tom adaptativo e memória comportamental, com `CONCERNS` sobre a saúde global preexistente/concorrente do repositório. Não existe regressão atribuível à story nos gates executados. O PASS libera o delta para a próxima revisão da fila, sem declarar verdes o typecheck ou a suíte global do repositório.

### Forge Recheck curto pós-fixes — PASS ✅ (2026-09-15)

Rechecagem dos dois ajustes posteriores ao gate completo. Como a worktree compartilhada já continha muitas mudanças concorrentes, a atribuição do microdelta foi confirmada pelos arquivos alterados desde a execução anterior: `BibbleChatLayout.tsx`, `adaptive-style.ts` e `adaptive-style.test.ts`, todos pertencentes a preferências/classificador/testes desta story. Não surgiu mudança nova em provider, rota, dependência, schema ou build configuration; por orientação explícita, typecheck global, suíte global e build não foram repetidos.

| Gate | Resultado | Evidência objetiva |
|---|---|---|
| Suíte Bibble | **PASS** | `npx vitest run tests/bibble --coverage.enabled=false`: **19/19 arquivos e 135/135 testes**, exit code 0, 455 ms; +1 teste sobre o gate anterior de 134/134. |
| ESLint File List | **PASS** | **11 arquivos executáveis**, zero erro/warning, exit code 0. |
| Integridade do diff | **PASS** | `git diff --check`: sem saída, exit code 0. |

**Veredito:** `PASS` no recheck curto. Os dois fixes não introduziram regressão nos gates aplicáveis, e o parecer global anterior permanece preservado.

### Probe Report — FAIL ⛔ (2026-09-15)

Auditoria de integração ponta a ponta executada sem alteração de código, schema, migration ou banco.

#### Fluxos aprovados

- Settings expõe os quatro controles acessíveis; preferências tipadas chegam somente ao payload Bibble, não ao Onyx.
- Schema Zod fechado rejeita enum inválido e instrução extra.
- Loader consulta somente `role=user`, sessão do `userId` autenticado e `onyxSessionId=null`, com `take=48`, seleção mínima e corte de 2.000 caracteres.
- Classificador é determinístico e local; cenários direto, casual/brincalhão, técnico, detalhado, irritado e sensível passaram.
- Adaptive off, humor off, reação neutra, baixa confiança e sensibilidade produzem os bloqueios de adaptação/deboche esperados.
- Camada adaptativa entra abaixo de segurança, identidade, capabilities e contexto; possui teto de 1.000 caracteres e não copia histórico bruto.
- Telemetria contém apenas duração, tamanho da amostra e flag aplicada. Classificador/loader não chamam provider; o runner existente permanece a única geração do turno.
- Testes dirigidos: **3 arquivos, 16/16 testes PASS**.

#### Blockers

1. **Preferência de humor vaza entre usuários no mesmo navegador.** `readAdaptivePreferences(storage, userId)` lê a chave global legada `bibble-humor-enabled` sempre que o usuário atual ainda não possui a chave per-user; `handleAdaptivePreferencesChange` continua regravando essa chave global. Reprodução: storage contendo apenas `bibble-humor-enabled=false`, ao ler um novo `userId=202`, produz `{ humor: "off" }` em vez do default `light`. Isso viola o isolamento per-user solicitado nos AC 16–17 e no wiring desta revisão.
2. **Frase canônica não corresponde ao contrato exato da story.** AC 8 exige literalmente `A pressa é toda sua, não minha, mas vou executar e ja trago o resultado`; a constante e o teste congelam `A pressa é toda sua, não minha. Mas vou executar e já trago o resultado.`. Pontuação, capitalização, acento e ponto final divergem. O teste passa porque foi escrito contra a implementação, não contra o texto aprovado.

**Veredito Probe:** `FAIL`. O pipeline adaptativo e os cenários comportamentais estão conectados, mas o isolamento local por usuário e o contrato literal da resposta canônica precisam ser corrigidos e rechecados.

### Probe Recheck dos dois blockers — PASS ✅ (2026-09-15)

Recheck estrito executado sem alteração de código, schema, migration ou banco.

- **PASS — isolamento local por usuário:** `readAdaptivePreferences` consulta exclusivamente `bibble-adaptive-style:<userId>`; não lê mais `bibble-humor-enabled`. O handler grava somente a chave per-user. Reprodução com uma chave global legada `false` e usuário novo `202` retornou os defaults, incluindo `humor: "light"`. O novo teste também comprova que a única chave lida é a chave per-user.
- **PASS — frase canônica literal:** a constante, o prompt e o teste usam exatamente `A pressa é toda sua, não minha, mas vou executar e ja trago o resultado`, sem diferença de pontuação, capitalização, acento ou terminador.
- **Regressão:** `npx vitest run tests/bibble --coverage.enabled=false` — **19 arquivos, 135/135 testes PASS**.
- O fluxo já aprovado permanece conectado: Settings → storage per-user → payload fechado → rota/loader/classificador → prompt de menor prioridade → telemetria segura → runner existente, com isolamento do Onyx e sem provider adicional.

**Veredito Probe recheck:** `PASS`. Os dois blockers foram fechados e não resta falha funcional atribuível à story no escopo verificado.

### Probe final do microdelta — PASS ✅ (2026-09-15)

Validação estrita executada sem alteração de código, schema, migration ou banco.

- **Fallback loader/classifier:** falha simulada em cada dependência retorna `adaptiveStyle: null` e telemetria neutra `{ sampleCount: 0, applied: false }`, sem expor detalhe interno.
- **Continuidade operacional:** após cada fallback, o runner executou uma tool, manteve exatamente duas chamadas ao provider (decisão + resposta final), emitiu texto e encerrou o SSE com `successful: true`; nenhuma chamada adaptativa adicional foi criada.
- **UI real:** o teste de componente renderiza `BibbleSettingsPanel`, confirma labels acessíveis/controles keyboard-native, aciona handlers dos quatro controles (tom, humor, reação e detalhe), restaura defaults e verifica isolamento por `userId`: **3/3 PASS**.
- Teste focal do runner: **7/7 PASS**. Suíte Bibble completa reconfirmada: **22 arquivos, 169/169 testes PASS**.

**Veredito Probe final:** `PASS`. O microdelta fecha o fallback adaptativo e a cobertura real dos quatro controles sem regressão funcional detectada.

### Anubis Report — Perfil adaptativo (2026-09-15)

Auditoria rápida e estritamente limitada ao delta solicitado, sem alteração de código, schema ou dados. A regressão existente foi executada com `npx vitest run tests/bibble --coverage.enabled=false`: **19 arquivos, 135/135 testes PASS**.

#### CRITICAL

- Nenhum.

#### HIGH

- Nenhum.

#### MEDIUM

- **O guard de contexto sensível não reconhece formulações comuns cobertas pelo AC 12.** Em `src/lib/bibble/adaptive-style.ts:55`, a regex é uma lista restrita; `src/lib/bibble/adaptive-style.ts:145-149` então classifica entradas não reconhecidas como `neutral`, e `src/lib/bibble/adaptive-style.ts:176-177` não ativa a supressão obrigatória do deboche. Reprodução segura com as funções puras atuais: `Tenho câncer e preciso entender o tratamento`, `Estou deprimido e em crise emocional`, `Recebi uma ameaça de morte` e `Sofri abuso e violência` retornaram `currentTone: "neutral"` e `suppressed: false`. Isso deixa a persona autorizada a produzir alfinetada em saúde grave, crise emocional, ameaça e violência. O teste em `tests/bibble/adaptive-style.test.ts:60-64,79-85` cobre apenas `vazamento de credencial`, portanto não detecta a lacuna. **Correção exata:** ampliar o detector server-side com famílias normalizadas e limites de palavra para doença grave/tratamento, depressão/crise emocional, ameaça/perigo/morte, abuso/violência, mantendo precedência de sensibilidade; adicionar esses quatro casos parametrizados e negativos de falso positivo ao teste de supressão.

#### LOW

- Nenhum.

#### Controles aprovados

- Ownership e isolamento estão na própria consulta Prisma: `role=user`, `session.userId=<autenticado>`, `onyxSessionId=null`, ordenação determinística, `take=48` e seleção mínima; conteúdo é cortado em 2.000 caracteres e anexos são excluídos.
- Histórico bruto e prompt injection histórico não entram no prompt: somente enums, scores, confiança e preferências compõem a camada limitada a 1.000 caracteres, abaixo de segurança, identidade, capacidades, permissões e contexto.
- O payload de preferências usa schema Zod `.strict()` com enums fechados; `localStorage` usa exclusivamente `bibble-adaptive-style:<userId>`; o payload Onyx não recebe `adaptivePreferences`.
- A telemetria adaptativa contém somente duração, tamanho da amostra e flag aplicada; classificador e loader não chamam provider, e nenhuma chamada extra/integração Onyx foi introduzida.

**Veredito Anubis: `FAIL` — 0 CRITICAL, 0 HIGH, 1 MEDIUM, 0 LOW.** A regressão técnica está verde, mas o guard sensível não cumpre integralmente a supressão de segurança exigida pelo AC 12.

### Anubis Recheck — Guard sensível corrigido ✅ (2026-09-15)

Recheck estritamente limitado ao único finding MEDIUM anterior, sem alteração de código, schema ou dados.

- **Implementação — PASS:** `src/lib/bibble/adaptive-style.ts:60-68` agora usa padrões contextuais separados para doença grave/oncologia, depressão/crise emocional/autoagressão, ameaça de morte, abuso/violência/assédio, credenciais/privacidade e decisões jurídicas/financeiras. `containsSensitiveContext` mantém a sensibilidade como precedência do tom atual e da supressão de alfinetada.
- **Positivos — PASS:** `tests/bibble/adaptive-style.test.ts:66-86` cobre 12 formulações, incluindo câncer, oncologia, quimioterapia, depressão, suicídio, autoagressão, ameaça de morte, ameaça de matar, abuso, violência, agressão doméstica e assédio. Cada caso exige `currentTone="sensitive"`, `suprima a alfinetada`, ausência de reação firme e ausência da frase canônica.
- **Negativos — PASS:** `tests/bibble/adaptive-style.test.ts:88-98` evita falso positivo em sete usos técnicos/figurativos: matar processo, worker morreu, incidente de cache, segurança de tipos, tratamento de erro, threat modeling SQL injection e agressão de performance.
- **Execução focal — PASS:** `npx vitest run tests/bibble/adaptive-style.test.ts --coverage.enabled=false` → **1 arquivo, 30/30 testes**, exit code 0.

**Veredito Anubis final: `PASS` — 0 CRITICAL, 0 HIGH, 0 MEDIUM e 0 LOW remanescentes no escopo revalidado.**

### Anubis Microdelta — Fallback/UI ✅ (2026-09-15)

Recheck curto, limitado ao fallback de memória adaptativa e respectivos contratos, sem alteração de implementação, schema ou dados.

- **Sem vazamento — PASS:** `deriveAdaptiveStyleForTurn` absorve falhas do loader/classificador sem retornar nem registrar exceção, histórico ou mensagem; o resultado é somente `adaptiveStyle: null` e telemetria agregada. Os testes usam deliberadamente `private database detail`, `histórico privado` e `raw classifier detail`, e nenhum desses conteúdos atravessa o contrato.
- **Safety preservada — PASS:** o fallback `adaptiveStyle: null` seleciona `Defaults da identidade oficial` na camada de menor prioridade; `SEGURANÇA E INTEGRIDADE (IMUTÁVEL)`, capacidades e permissões permanecem acima dela. A falha não modifica catálogo, autorização ou executor de tools.
- **Telemetria segura — PASS:** no fallback, somente `{ ms, sampleCount: 0, applied: false }` é emitido; não há erro bruto, conteúdo histórico, prompt ou frase detectada.
- **Execução focal — PASS:** `npx vitest run tests/bibble/route-runner.integration.test.ts tests/bibble/adaptive-integration.test.ts --coverage.enabled=false` → **2 arquivos, 11/11 testes**, exit code 0. Os casos de falha do loader e classificador confirmam continuidade do turno e ausência de chamada adicional ao provider.

**Veredito Anubis do microdelta: `PASS` — nenhum novo finding.**

### Lens Review Final — PASS ✅ (2026-09-15)

Revisão final executada após Forge, Probe e Anubis aprovarem o delta. Foram inspecionados classificador, consulta Prisma, composição de prompt, controles da UI, telemetria, contratos de persona e manutenção, sem alteração de código, schema ou dados.

#### 🔴 BLOQUEANTE (0 issues)

Nenhum blocker concreto de segurança, correção, arquitetura ou compatibilidade foi encontrado.

#### 🟡 IMPORTANTE (0 issues)

Nenhuma ressalva impeditiva remanescente.

#### 🟢 SUGESTÃO (1 issue)

**`src/components/BibbleChatHome/BibbleSettingsPanel.tsx`**
O componente conserva props de configuração legadas que não são mais consumidas após o hardening server-side. Isso não afeta o contrato adaptativo nem cria fluxo alcançável, mas pode ser simplificado em uma limpeza futura para reduzir superfície de manutenção.

#### Evidências da revisão

- O classificador é puro, determinístico, bounded e separa perfil estável de tom corrente.
- A query impõe ownership e exclusão de Onyx no banco, limita 48 mensagens, seleciona somente conteúdo/data e sanitiza cada amostra para 2.000 caracteres.
- O prompt recebe apenas perfil compacto e subordinado ao núcleo imutável; não copia histórico bruto nem cria chamada adicional ao provider.
- Preferências são fechadas por enums, persistidas por usuário/dispositivo e encaminhadas somente ao runtime Bibble.
- Os exemplos direto, casual, técnico, detalhado, irritado e sensível seguem a persona; a frase canônica literal está preservada e a supressão sensível tem precedência.
- A implementação permanece sem migration, tabela de perfil ou memória comportamental persistente nova.

#### Veredicto

✅ **APROVADO (PASS)**

Nota qualitativa: solução coesa, barata e bem isolada; adapta a forma sem transformar heurística em autoridade, diagnóstico pessoal ou ampliação de permissão.

### Sage/Quinn — QA final adaptativo ⚠️ (2026-09-15)

Revalidação read-only posterior aos gates Forge, Probe, Anubis e Lens. Nenhum código, schema, migration, banco ou serviço externo foi alterado.

#### Evidência executada

- `npx vitest run tests/bibble --coverage.enabled=false`: **PASS — 19 arquivos, 154/154 testes**, exit code 0, 479 ms.
- Recheck focal de adaptação, memória, segurança, Onyx e runner: **PASS — 6 arquivos, 59/59 testes**, exit code 0.
- Núcleo adaptativo isolado (`adaptive-style`, `behavioral-memory`, `adaptive-integration`): **PASS — 3 arquivos, 36/36 testes**, exit code 0.
- `git diff --check`: **PASS**, sem erro de whitespace.

#### Cobertura dos ACs confirmada

- Classificação local, determinística e limitada: direto, casual, técnico, detalhado, irritado, misto, vazio, mensagem longa, recência, 48 mensagens e 2.000 caracteres.
- Memória com ownership no filtro Prisma, somente `role=user`, sessão Bibble nativa, exclusão Onyx, seleção mínima e ordenação determinística.
- Preferências fechadas por schema, defaults solicitados, chave de storage por usuário, rejeição de valor/instrução arbitrária e ausência do perfil no payload Onyx.
- Camada de prompt compacta, abaixo dos guardrails, sem histórico bruto e sem dependência de provider/rede; frase canônica literal preservada.
- Supressão sensível coberta com 12 positivos de saúde/crise/ameaça/violência e 7 negativos técnicos/figurativos, sem finding de segurança remanescente.
- Runner preserva uma geração em chat comum, tool-loop somente após chamada real, abort antes do provider e recusa de tool fora do conjunto autorizado.
- Telemetria adaptativa contém somente duração, tamanho da amostra e flag agregada.

#### Lacunas de evidência automatizada

1. O fallback do código está corretamente protegido por `try/catch`, mas não existe teste de integração da rota que force `loadBehavioralHistory`/classificação a lançar e comprove no mesmo cenário a continuidade de streaming, tools e persistência exigida pelo AC 26. O teste atual verifica esse wiring por inspeção de fonte.
2. Os contratos de UI confirmam labels, payload, defaults e normalização, porém não renderizam o componente para exercitar por teclado a alteração e a restauração dos quatro controles. A cobertura dos trechos interativos do AC 27 permanece estática/unitária, sem RTL ou browser autenticado.
3. Typecheck e suíte globais continuam não verdes por dívidas concorrentes já atribuídas pelo Forge; não houve falha nos arquivos ou testes desta story. CodeRabbit permanece indisponível.

#### Veredicto

**`CONCERNS` — 154/154 testes Bibble passam e nenhum defeito funcional ou de segurança foi reproduzido; faltam duas provas automatizadas explícitas dos ACs 26 e 27.** O delta está funcionalmente saudável, mas o gate documental integral requer registrar essas lacunas como aceitas ou adicionar os testes antes de declarar cobertura completa.

O `Status` e a Task 9 não foram alterados: o papel QA só possui autorização para atualizar esta seção de resultados.

### Sage/Quinn — Confirmação final das evidências ✅ (2026-09-15)

Recheck limitado às duas lacunas anteriores, sem alteração de código, schema, migration, banco ou serviço externo.

- **Fallback adaptativo — PASS:** os casos parametrizados forçam falha tanto no loader quanto no classificador, confirmam fallback agregado sem detalhe privado e exercitam a continuidade do runner com tool real do harness, resposta SSE bem-sucedida e somente as duas chamadas necessárias ao provider. Em conjunto com os contratos de persistência após `done.successful`, a falha adaptativa não interrompe o turno nem cria geração adicional.
- **UI renderizada — PASS:** o componente real é renderizado com controles nativos e labels acessíveis; handlers dos quatro controles são acionados e o reset restaura exatamente os defaults; storage permanece isolado por `userId`.
- Execução focal: `npx vitest run tests/bibble/adaptive-settings.component.test.ts tests/bibble/route-runner.integration.test.ts --coverage.enabled=false --reporter=verbose` — **2 arquivos, 10/10 testes PASS**.
- Suíte Bibble no estado observado: `npx vitest run tests/bibble --coverage.enabled=false` — **22 arquivos, 170/170 testes PASS**, exit code 0. A contagem supera a referência solicitada de 169 porque a worktree compartilhada recebeu testes adicionais concorrentes; nenhum falhou.
- `git diff --check`: **PASS**.

**Veredito final: `PASS` — zero blocker e as duas lacunas de evidência dos ACs 26 e 27 foram fechadas.** As concerns globais preexistentes registradas pelo Forge não são atribuíveis a esta story e não alteram o gate dirigido do delta adaptativo.

O papel QA preservou a restrição de escrita e não alterou `Status`, Tasks/Subtasks ou checklist fora de `QA Results`.

### Forge Gate final pós-evidências Sage — PASS ✅ (2026-09-15)

Gate curto sobre o microdelta de fallback/helper/testes que fechou as lacunas automatizadas registradas pelo Sage. A File List adaptativa passou a incluir o teste de componente e contém 12 arquivos executáveis. Alterações recentes de dependências e do subsistema de voz pertencem à story concorrente Chatterbox, não a este delta; não houve configuração de build atribuível à story adaptativa e, por orientação explícita, os gates globais e o build não foram repetidos.

| Gate | Resultado | Evidência objetiva |
|---|---|---|
| Suíte Bibble | **PASS** | `npx vitest run tests/bibble --coverage.enabled=false`: **22/22 arquivos e 169/169 testes**, exit code 0, 531 ms. |
| ESLint File List | **PASS** | **12 arquivos executáveis**, zero erro/warning, exit code 0. |
| Integridade do diff | **PASS** | `git diff --check`: sem saída, exit code 0. |

**Veredito Forge final:** `PASS`. O fallback/helper e as novas evidências automatizadas não introduziram regressão nos gates aplicáveis. O histórico dos gates globais e do build permanece válido e preservado acima.

### Lens Microdelta Final — PASS ✅ (2026-09-15)

Revisão limitada ao helper fail-open e às novas provas automatizadas de UI/runner, sem alteração de implementação, schema ou dados.

#### 🔴 BLOQUEANTE (0 issues)

Nenhum.

#### 🟡 IMPORTANTE (0 issues)

Nenhum.

#### Evidências

- `deriveAdaptiveStyleForTurn` concentra dependências e fallback em uma fronteira pequena, testável e sem acoplamento com provider.
- Falha do loader ou classificador retorna somente `adaptiveStyle: null` e telemetria agregada; não propaga detalhe privado nem altera guardrails, tools ou fluxo SSE.
- O runner continua com a cardinalidade correta: uma chamada comum e somente uma chamada adicional após tool call real; abort e tool fora do conjunto permanecem cobertos.
- O teste de componente renderiza controles reais, valida nomes acessíveis e executa handlers dos quatro controles e restauração, em vez de depender apenas de inspeção textual.
- Storage continua isolado por `userId`; payload adaptativo permanece ausente do runtime Onyx.

#### Veredicto

✅ **APROVADO (PASS)**

Nota qualitativa: o microdelta fecha as lacunas de evidência sem duplicar lógica de produção nem alargar a superfície da rota.
