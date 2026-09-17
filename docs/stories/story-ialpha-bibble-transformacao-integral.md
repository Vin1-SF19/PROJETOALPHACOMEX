# Story: IAlpha/Bibble — hardening, geração única, observabilidade e identidade operacional

## Status

**Ready for Review**

## Executor Assignment

executor: `@dev`
quality_gate: `@architect`
quality_gate_tools: `security-review`, `lint`, `typecheck`, `test`, `build`, `coderabbit`, `benchmark-local`

## Origem e rastreabilidade

- Solicitação direta do usuário em 2026-09-15 para aplicar integralmente as melhorias do diagnóstico do IAlpha/Bibble.
- Diagnóstico técnico aprovado na conversa: capacidades, voz, latência, tokens por segundo, janela de contexto, tools, memória, UX, observabilidade e riscos.
- Implementação atual do chat: `src/app/api/bibble/chat/route.ts`.
- Cliente de inference e catálogo do modelo: `src/lib/bibble/client.ts` e `src/lib/bibble/completion.ts`.
- Prompt e persona existentes: `src/lib/bibble/system-prompt.ts` e `.bibble/memory/bibble-persona.md`.
- Registry e executor das ferramentas: `src/lib/bibble/tools.ts` e `src/lib/bibble/tool-executor.ts`.
- Home do IAlpha: `src/components/BibbleChatHome/`.
- Persistência atual: `src/app/api/bibble/sessions/` e modelos Bibble já existentes em `prisma/schema.prisma`.
- Story relacionada em andamento: `docs/stories/story-ialpha-bibble-leitura-confiavel-pdf-respostas-completas.md`.
- Regras obrigatórias: `AGENTS.md` e `.aiox-core/constitution.md`.

## Story

**Como** usuário autenticado do Painel Alpha,
**quero** que o IAlpha/Bibble responda com menor espera, identidade verbal coerente, contexto correto e operações protegidas e observáveis,
**para que** eu possa confiar nas respostas e ações do assistente sem expor o servidor, dados, credenciais ou permissões do painel.

## Contexto e objetivo

O Bibble já integra conversa, documentos, voz, calendário, dados operacionais, ferramentas de filesystem e agentes Onyx. O diagnóstico identificou que esse conjunto funciona, mas está concentrado em uma rota extensa e apresenta riscos e inconsistências importantes:

- a resposta comum pode ser gerada uma vez sem streaming, descartada, e gerada novamente para o usuário;
- a rota de modelos aceita uma URL fornecida pelo cliente e encaminha credenciais server-side;
- o acesso ao filesystem depende de um booleano do cliente e aceita paths absolutos fora de uma raiz isolada;
- a rota principal, curiosidades e operações de IA não possuem proteção uniforme contra abuso e concorrência;
- o prompt oficial, a persona documentada, a home e o mascote usam vozes contraditórias;
- prompts de projeto/usuário podem substituir guardrails centrais;
- a home não recebe contexto confiável do módulo ou aba efetivamente ativo;
- o cliente oferece janela maior que o limite físico conhecido do runtime;
- a telemetria não permite medir fila, TTFT, tokens, throughput, ciclos de tool ou p50/p95;
- a gravação de usuário e assistente ocorre em operações independentes;
- a lista completa de tools é enviada mesmo quando a intenção não exige a maioria delas.

Esta story entrega a correção sem alterar schema. A ordem obrigatória de implementação é `CLI → observabilidade → UI`, preservando a compatibilidade dos fluxos já existentes e da story de leitura confiável de PDF.

## Acceptance Criteria

### Segurança e contenção

1. `GET /api/bibble/models` não aceita mais host, protocolo, porta, path ou URL arbitrários fornecidos pelo cliente; o destino é resolvido exclusivamente de configuração server-side validada ou de allowlist fixa, e credenciais do servidor nunca são encaminhadas a host controlado pelo request.
2. Os endpoints do Bibble que consomem inference ou recursos relevantes, incluindo chat e curiosidades, exigem sessão autenticada e aplicam uma proteção local por usuário contra rajadas e concorrência; excesso retorna resposta explícita e retryável, sem iniciar geração no modelo.
3. A proteção de AC 2 não se apresenta como rate limit distribuído: funciona corretamente na instância atual, possui limites configuráveis e testáveis e documenta que coordenação multi-instância depende de infraestrutura futura.
4. As tools de filesystem ficam indisponíveis por padrão. Habilitá-las exige autorização server-side por role/permissão efetiva; o booleano `computerAccess` enviado pelo cliente nunca concede acesso por si só.
5. Toda operação de filesystem resolve o alvo por `realpath` ou validação canônica equivalente dentro de uma raiz server-side explícita. Path absoluto externo, traversal, symlink escape, raiz ampla, variável não resolvida e alvo protegido são bloqueados.
6. Criar, escrever, mover, copiar e apagar arquivos exigem contrato de autorização e limites de tamanho/escopo; apagar ou sobrescrever exige confirmação explícita vinculada ao alvo atual. A implementação não executa exclusão recursiva de raiz ampla.
7. Todas as 32 tools atuais passam por um guard comum antes da execução, além de suas regras específicas: autenticação, autorização, validação dos argumentos, timeout, limite por turno, resultado sanitizado e confirmação quando a mutação exigir.
8. Ferramentas de consulta e mutação não confirmam sucesso com base apenas na fala do modelo. A resposta final só afirma alteração efetivada quando o executor retorna sucesso verificável no turno atual.
9. Configurações de providers e segredos ficam server-side. O fluxo não grava API keys novas em arquivo versionável ou resposta ao navegador; qualquer suporte legado a `.bibble/cloud-providers.json` é removido, desativado com erro claro ou migrado para variáveis de ambiente sem copiar segredo para Git.
10. Logs, erros, headers e eventos SSE não incluem prompt, resposta completa, texto de documento, base64, bearer token, API key, URL assinada, path sensível ou dados pessoais desnecessários.

### Performance, geração e orçamento

11. Uma solicitação comum sem tool call usa uma única geração do modelo. Nenhuma resposta completa não-streaming é gerada e descartada antes do stream visível.
12. Tool calling funciona em um loop único compatível com streaming: somente ciclos que realmente solicitam tools geram novas chamadas, respeitando limites globais já existentes ou mais restritivos, e a resposta final é enviada ao usuário sem repetir uma geração já concluída.
13. O sistema registra em teste o número de chamadas ao provider por cenário: conversa simples = 1; conversa com tool = somente os ciclos necessários mais a resposta final; retry ou continuação são identificados separadamente e nunca ficam ocultos como geração normal.
14. O deadline é fim a fim: fila local, montagem de contexto, chamadas ao provider, tools e continuações recebem orçamento temporal restante. Uma nova etapa não inicia quando não houver tempo seguro para terminá-la.
15. O limite de saída é compatível com o deadline e throughput observado. O sistema não anuncia nem solicita silenciosamente uma saída que, pelas configurações correntes, não cabe no tempo restante; quando houver truncamento, informa a limitação e preserva uma continuação segura e explícita.
16. Existe roteamento de tools por intenção e permissões. Pedidos inequívocos recebem somente as tools relevantes; pedidos ambíguos usam fallback seguro para o conjunto autorizado. O roteador nunca adiciona tool que o usuário não pode executar.
17. O catálogo de capacidades exibido ou injetado no prompt é derivado do registry real de tools e permissões, evitando lista manual divergente. Tool desativada ou não autorizada não é anunciada como disponível.
18. Existe benchmark local reprodutível, executável por CLI, que mede ao menos: tempo total, tempo até primeiro token, tokens de saída por segundo, tempo de processamento do prompt quando disponível, número de chamadas ao provider, ciclos de tool, tamanho do contexto e motivo de término.
19. O relatório antes/depois usa a mesma configuração, prompt sintético e modelo; demonstra a remoção da geração descartada e não apresenta regressão funcional. Se o ambiente não disponibilizar contagem exata de tokens, a métrica é marcada como estimada, nunca apresentada como exata.

### Janela de contexto e documentos

20. A janela efetiva é decidida e limitada no servidor por capacidade configurada do modelo. O cliente não consegue forçar 262.144 tokens quando o runtime ativo suporta 131.072, e a UI não oferece valores acima do teto retornado pelo servidor.
21. O orçamento central contabiliza system prompt, contexto do módulo, histórico, mensagem atual, anexos, definições de tools, resultados de tools, margem de segurança e reserva positiva de saída, mantendo a requisição dentro da janela efetiva.
22. A política de contexto atende todos os anexos textuais suportados, não apenas PDF. PDF, DOCX, XLSX, CSV, TXT e formatos equivalentes seguem orçamento consciente da capacidade e informam de modo explícito quando o conteúdo for parcial.
23. A estimativa de tokens fica centralizada e identificada como exata ou estimada. Quando não houver tokenizer compatível disponível no runtime, uma margem conservadora comprovada por testes substitui a regra dispersa de quatro caracteres sem proteção.
24. O histórico é compactado de forma determinística quando necessário, preservando mensagens recentes, instruções imutáveis, resultados de mutação relevantes e avisos de documento parcial. Nenhum resumo pode inventar fatos ou ocultar que houve redução.
25. A configuração de contexto na UI mostra janela efetiva, reserva de saída e uso aproximado. Valores antigos inválidos em `localStorage` são normalizados ao teto server-side sem quebrar a conversa.
26. Todas as garantias da story `story-ialpha-bibble-leitura-confiavel-pdf-respostas-completas.md` permanecem válidas, incluindo upload pronto antes do envio, início/meio/fim, transparência de leitura parcial e SSE integral.

### Observabilidade e diagnóstico

27. Cada requisição recebe `requestId` não sensível, propagado por logs estruturados, eventos/headers permitidos e chamadas internas do turno.
28. A telemetria por requisição registra: timestamp, usuário por identificador irreversível ou interno permitido, modelo, TTFT, duração total, espera na fila local, tempo de montagem de contexto, tokens de entrada/saída quando disponíveis, natureza exata/estimada, tokens/s, cache quando reportado, tools selecionadas, latência e resultado de cada tool, ciclos, continuações, interrupção, truncamento e categoria de erro.
29. Métricas de AC 28 são emitidas por logs estruturados e/ou headers `Server-Timing` apropriados, sem criar tabela ou armazenamento histórico durável nesta story.
30. Existe comando CLI read-only de diagnóstico que verifica configuração, endpoint fixo, modelo, janela, limite de saída, concorrência e disponibilidade do provider sem imprimir segredos; o comando retorna saída estável e exit code diferente de zero para configuração inválida ou provider indisponível.
31. Existe documentação operacional que explica como coletar amostra, calcular p50/p95/p99 fora do request, interpretar TTFT e tokens/s e distinguir fila, prompt, tool e geração. A UI não precisa expor dashboard histórico nesta story.

### Persona, prompt e maneira de falar

32. Existe uma única fonte executável de identidade do Bibble, usada para produzir o prompt de runtime e as mensagens estáticas relevantes. A persona documental deixa de divergir silenciosamente do comportamento efetivo.
33. A hierarquia de prompt é imutável e testada: segurança/integridade → identidade oficial → capacidades reais → usuário/permissões → contexto do módulo → instruções do projeto → preferência de estilo. Prompt de projeto ou usuário complementa o núcleo e não o substitui.
34. Instruções customizadas que tentem remover autenticação, autorização, confirmação, transparência documental, precisão financeira, restrições de tool ou identidade central são tratadas como conteúdo de menor prioridade e não alteram os guardrails server-side.
35. A voz padrão é: colega operacional competente, direto, cordial, transparente e não bajulador; usa “você”, formalidade profissional moderada, 1–3 frases por padrão e detalhamento proporcional ao pedido.
36. A saudação é consistente em prompt e home, seguindo a intenção “Olá. O que vamos resolver hoje?”. São removidas contradições como exigir “Como posso ajudar?” onde a persona a proíbe.
37. Mascote, estados de espera, erros, empty states e sugestões não usam hostilidade, sarcasmo depreciativo, culpa, garantias sem evidência ou promessas de capacidade inexistente. Humor é leve, contextual e pode ser desativado.
38. Confirmações usam resultado real: “Feito” somente após sucesso verificável; erro explica o que falhou, informa se texto/anexos foram preservados e oferece próxima ação possível sem inventar causa.
39. Existem testes de contrato de persona para saudação, sucesso, falha, desconhecimento, recusa, documento parcial, ação destrutiva, financeiro e interrupção. Os testes verificam padrões proibidos e não tentam congelar toda resposta por snapshot literal.

### Contexto do painel, sugestões e Onyx

40. O cliente envia contexto tipado e mínimo da aba/módulo ativo: module key canônica, rota autorizada e, quando aplicável, identificadores não sensíveis necessários à ação. Texto ou URL arbitrários não são promovidos a instrução de sistema.
41. O servidor valida o contexto do módulo contra o registry e as permissões do usuário. Contexto inválido, oculto ou não autorizado é descartado e registrado sem revelar o recurso.
42. O Bibble usa o contexto validado para orientar respostas e sugestões, mas não executa automaticamente uma ação nem amplia acesso com base apenas na aba aberta.
43. Sugestões da home são derivadas de capabilities e permissões, agrupadas por consultar/analisar/criar quando útil, indicam dados mínimos necessários e não oferecem ações indisponíveis.
44. Ao selecionar um agente Onyx, nome, avatar, placeholder, empty state e sugestões identificam imediatamente o agente ativo. Ao voltar ao Bibble, a identidade oficial é restaurada sem misturar memórias ou capabilities dos dois runtimes.
45. Entrada por voz, TTS, anexos, Markdown, tabelas, código, downloads, interromper/restaurar e histórico continuam funcionais e acessíveis por teclado; estados de fila e ferramenta informam progresso sem expor raciocínio interno do modelo.

### Persistência e memória sem schema

46. O turno nativo é persistido atomicamente usando os modelos atuais: mensagem do usuário e resposta válida são gravadas na mesma transação ou por mecanismo equivalente que não deixe metade do turno como sucesso.
47. Falha, interrupção ou truncamento não classificado como sucesso não é persistido como resposta concluída. O cliente preserva texto e anexos necessários para nova tentativa de acordo com as garantias existentes.
48. O campo de tokens existente só é preenchido quando a contagem tiver origem confiável e significado documentado; estimativas não são gravadas como contagem exata. A ausência de contagem permanece representável sem migration.
49. A compactação de memória desta story ocorre em tempo de montagem do contexto, usando histórico atual e estruturas existentes; não cria embeddings, perfil persistente, memória semântica entre sessões nem fatos pessoais implícitos.
50. Exclusão já autorizada de sessão/projeto continua removendo o histórico correspondente segundo o contrato atual. Não há limpeza retroativa de blobs nem nova política persistida de retenção nesta entrega.

### Compatibilidade, qualidade e entrega

51. Não há mudança de schema, migration, seed, backfill, RLS ou mutação em massa. Qualquer necessidade descoberta nessa direção é interrompida e movida para story própria com Vault, backup válido e confirmação explícita.
52. APIs modificadas validam entrada com schema runtime, retornam erros sanitizados e mantêm compatibilidade com sessões e projetos existentes sempre que o contrato anterior era seguro.
53. Testes automatizados cobrem os ACs críticos de segurança, geração única, contexto, observabilidade, persona, permissões, persistência e UI sem depender de provider real, documento privado ou rede no CI.
54. Um smoke local controlado valida provider, streaming, tool read-only, interrupção, TTFT e benchmark; mutações reais, filesystem fora da sandbox e exclusões não fazem parte do smoke automático.
55. `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` passam sem regressão causada pela story. CodeRabbit não apresenta issue `CRITICAL` quando disponível.
56. Antes de concluir, todos os checkboxes implementados, resultados de benchmark, Completion Notes e File List real são atualizados nesta story.

## Tasks / Subtasks

### Fase 0 — baseline e contenção de segurança

- [x] Task 1 — Capturar baseline e congelar contratos atuais (AC: 18, 19, 26, 45, 54)
  - [x] Criar fixtures sintéticas para conversa simples, tool read-only, documento textual e interrupção.
  - [x] Registrar modelo, janela, limite de saída, máquina/runtime e metodologia do benchmark.
  - [x] Medir chamadas ao provider, TTFT, duração, tokens/s e ciclos sem persistir conteúdo sensível.
  - [x] Mapear regressões da story de PDF que precisam continuar verdes.
- [x] Task 2 — Corrigir SSRF e configuração de provider (AC: 1, 9, 10, 30, 52)
  - [x] Remover a URL arbitrária do contrato público de `/api/bibble/models`.
  - [x] Centralizar resolução server-side e validação do endpoint.
  - [x] Garantir que bearer/API key nunca alcance host não aprovado.
  - [x] Desativar armazenamento plaintext/versionável de providers e adicionar testes de vazamento.
- [x] Task 3 — Isolar e autorizar filesystem (AC: 4–8, 10, 54)
  - [x] Desabilitar filesystem no catálogo e runtime até existir aprovação humana server-side vinculada ao turno.
  - [x] Definir raiz isolada e validação canônica contra traversal/symlink escape.
  - [x] Rejeitar toda operação de filesystem, inclusive quando o modelo envia campos de confirmação.
  - [x] Cobrir paths absolutos, relativos, symlinks, raízes amplas, tamanho e timeout.
- [x] Task 4 — Proteger inference e tools contra abuso local (AC: 2, 3, 7, 14)
  - [x] Exigir autenticação também nas rotas auxiliares que geram conteúdo.
  - [x] Implementar limite local por usuário e fila/concorrência compatível com o slot do runtime.
  - [x] Propagar cancelamento e orçamento de deadline a provider e tools.
  - [x] Retornar status retryável e observável antes de consumir GPU quando excedido.

### Fase 1 — geração única e observabilidade CLI-first

- [x] Task 5 — Refatorar o runner para geração única (AC: 11–15)
  - [x] Consumir stream capaz de detectar tool calls sem gerar e descartar resposta comum.
  - [x] Manter loop limitado de tools e gerar nova etapa somente após tool call real.
  - [x] Classificar finalização, truncamento, continuação, cancelamento e timeout.
  - [x] Provar geração simples com parser e fluxo de tool em harness real read-only (2 provider calls, 1 ciclo, usage exato).
- [x] Task 6 — Implementar telemetria segura por request (AC: 10, 27–29)
  - [x] Criar requestId e contexto de medição do turno.
  - [x] Medir fila, TTFT, prompt/contexto, geração, tokens/s, tools e duração total.
  - [x] Identificar métrica exata versus estimada e cache somente quando reportado.
  - [x] Emitir logs estruturados e `Server-Timing` sem payload sensível.
- [x] Task 7 — Entregar diagnóstico e benchmark por CLI (AC: 18, 19, 30, 31)
  - [x] Implementar comando doctor estritamente read-only com saída e exit codes estáveis.
  - [x] Implementar benchmark sintético comparável antes/depois.
  - [x] Documentar coleta p50/p95/p99 e interpretação das etapas.
  - [x] Acrescentar scripts npm canônicos sem tornar a UI requisito operacional.

### Fase 2 — contexto e catálogo de ferramentas

- [x] Task 8 — Unificar orçamento de contexto (AC: 14, 15, 20–26)
  - [x] Resolver capacidade do modelo no servidor e expor apenas teto seguro ao cliente.
  - [x] Centralizar cálculo de input, tools, resultados, histórico, anexos e output.
  - [x] Aplicar política a todos os formatos textuais suportados.
  - [x] Compactar histórico de forma determinística e transparente.
  - [x] Normalizar preferências antigas do cliente.
- [x] Task 9 — Criar registry executável de capabilities e guards (AC: 7, 8, 16, 17)
  - [x] Associar a cada tool domínio, mutabilidade, permissão, confirmação, timeout e limite de resultado.
  - [x] Derivar do registry a lista para o provider e a descrição para UI/prompt.
  - [x] Implementar roteamento por intenção com fallback seguro.
  - [x] Testar que nenhuma das 32 tools bypassa o guard comum.

### Fase 3 — persona e UX contextual

- [x] Task 10 — Consolidar persona e hierarquia de prompt (AC: 32–39)
  - [x] Definir uma fonte executável e remover cópias contraditórias.
  - [x] Compor camadas de prompt sem permitir override dos guardrails.
  - [x] Revisar saudação, falas do mascote, loading, sucesso, erro e recusa.
  - [x] Tornar humor leve opcional sem criar um novo perfil persistente.
  - [x] Criar testes de contrato verbal e integridade operacional.
- [x] Task 11 — Conectar contexto autorizado da aba (AC: 40–42)
  - [x] Definir payload mínimo com module key e identificadores permitidos.
  - [x] Integrar o estado real da navegação/aba da home ao request.
  - [x] Validar registry e permissão no servidor antes de compor contexto.
  - [x] Impedir que rota, título ou texto arbitrário vire system instruction.
- [x] Task 12 — Tornar sugestões e identidade do agente coerentes (AC: 43–45)
  - [x] Derivar sugestões de capabilities, permissões e contexto do módulo.
  - [x] Informar dados mínimos e natureza consultiva ou mutável da sugestão.
  - [x] Trocar integralmente a identidade visual/verbal ao selecionar Onyx.
  - [x] Aplicar reduced motion ao sprite, labels/roles acessíveis e interrupção/reset ao trocar runtime (smoke autenticado de browser não foi alegado).

### Fase 4 — persistência robusta e fechamento

- [x] Task 13 — Tornar o turno atômico sem migration (AC: 46–51)
  - [x] Usar transação ou mecanismo equivalente compatível com o adapter atual.
  - [x] Definir estados persistíveis de sucesso, falha, truncamento e interrupção.
  - [x] Popular tokens existentes somente com contagem confiável.
  - [x] Implementar compactação in-request sem memória persistente nova.
- [ ] Task 14 — Regressão completa e handoff (AC: 52–56)
  - [x] Executar testes unitários, integração, segurança e componentes (suíte Bibble direcionada: 118/118).
  - [x] Executar smoke local de provider e tool read-only (`benchmark:tool`: 2 chamadas, 1 ciclo); interrupção fica coberta de forma automatizada, sem alegar browser autenticado.
  - [ ] Executar `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` (delegado ao Forge).
  - [ ] Executar CodeRabbit quando disponível e tratar findings `CRITICAL` (delegado ao gate seguinte).
  - [x] Atualizar Tasks, benchmark, Completion Notes e File List real.

## Fora do Escopo desta execução

Os itens abaixo não estão autorizados nesta story, mesmo que sejam melhorias desejáveis. Eles exigem desenho próprio e, quando afetarem banco ou dados em massa, acionamento do Vault, relatório de impacto, backup completo verificado com até 48 horas e confirmação explícita do usuário:

- qualquer alteração de schema, migration, seed, backfill, índice, constraint, RLS ou mutação em massa;
- memória persistente entre sessões, embeddings, RAG sobre histórico ou perfil permanente do usuário;
- tabelas ou storage durável para métricas históricas, dashboards p50/p95/p99 ou billing;
- metadata persistente de retenção, classificação de sensibilidade ou expiração de anexos;
- rate limit distribuído ou coordenação multi-instância baseada em Redis/banco/serviço externo;
- limpeza retroativa, bulk delete ou migração de blobs e anexos já existentes;
- troca do modelo Qwen, nova GPU, cluster de inference ou contratação de provider;
- reescrever o runtime dos agentes Onyx ou compartilhar memória entre Onyx e Bibble;
- mudança estrutural de permissões ou roles no banco.

Se um destes itens se tornar necessário para cumprir um AC, o desenvolvimento deve parar nesse ponto, registrar a dependência e solicitar uma story separada; não deve contornar a política de banco.

## Dev Notes

### Estado técnico confirmado

- A home usa `BibbleChatLayout` para carregar sessões, montar histórico, enviar anexos/contexto e consumir SSE. [Source: `src/components/BibbleChatHome/BibbleChatLayout.tsx`]
- A rota nativa compõe system prompt, permissões, contexto temporal, histórico, anexos e tools, e executa o loop do provider. [Source: `src/app/api/bibble/chat/route.ts`]
- No runner atual, quando há tools disponíveis, ocorre primeiro uma completion não-streaming para detectar tool call; na ausência de tool call, o conteúdo pode ser descartado e a resposta ser solicitada novamente por streaming. [Source: `src/app/api/bibble/chat/route.ts#runStream`]
- O runtime default usa endpoint local configurável e modelo `qwen3.8-131k`; o servidor observado possui um slot de concorrência. [Source: `src/lib/bibble/client.ts`; diagnóstico de 2026-09-15]
- A janela comum e a janela ampliada de anexos são tratadas em `context-budget.ts`, enquanto a UI ainda aceita valores até 262.144. [Source: `src/lib/bibble/context-budget.ts`; `src/components/BibbleChatHome/BibbleSettingsPanel.tsx`]
- O catálogo atual possui 32 tools e o acesso ao filesystem é incluído a partir de `computerAccess`. [Source: `src/lib/bibble/tools.ts`; `src/app/api/bibble/chat/route.ts`]
- O executor de filesystem precisa ser restringido a uma raiz canônica; verificar apenas `..` não protege contra path absoluto ou symlink escape. [Source: `src/lib/bibble/tool-executor.ts`]
- A descoberta de modelos aceita `url` da query e usa headers obtidos da configuração server-side, formando o risco de SSRF e encaminhamento de credencial. [Source: `src/app/api/bibble/models/route.ts`]
- A rota de curiosidade usa inference e não possuía o mesmo contrato de autenticação e limitação da home no momento do diagnóstico. [Source: `src/app/api/bibble/curiosidade/route.ts`]
- A persona oficial e o system prompt discordam na saudação; o mascote possui falas que conflitam com cordialidade e capacidades verificáveis. [Source: `.bibble/memory/bibble-persona.md`; `src/lib/bibble/system-prompt.ts`; `src/components/BibbleChatHome/BibbleSpriteCompanion.tsx`]
- Prompt de projeto pode substituir o núcleo atual ao carregar `project.systemPrompt`; a nova composição deve preservar guardrails. [Source: `src/app/api/bibble/chat/route.ts#POST`]
- Mensagens do usuário e assistente são persistidas em dois creates independentes. [Source: `src/app/api/bibble/sessions/[id]/messages/route.ts`]
- O modelo `BibbleMessage` já possui campo de tokens. Esta story pode usar o campo existente somente com semântica confiável, sem alterar o schema. [Source: `prisma/schema.prisma#BibbleMessage`]
- A story de PDF já implementa orçamento consciente, proteção de upload, transparência e testes associados; esta entrega deve estender, não remover, essas garantias. [Source: `docs/stories/story-ialpha-bibble-leitura-confiavel-pdf-respostas-completas.md`]
- Não foram encontrados `docs/architecture/`, `docs/framework/`, `.aiox/gotchas.json` ou `accumulated-context.md` nos caminhos configurados durante a preparação. Os detalhes foram derivados do código, story relacionada, diagnóstico aprovado, Constitution e AGENTS.md.

### Princípios de implementação

- CLI first: doctor e benchmark devem funcionar sem abrir a home; a observabilidade deve existir antes do polimento visual. [Source: `.aiox-core/constitution.md#I-CLI-First`]
- Story driven: progresso, decisões e File List permanecem neste documento. [Source: `.aiox-core/constitution.md#III-Story-Driven-Development`]
- Quality first: lint, typecheck, testes e build são bloqueadores de conclusão. [Source: `.aiox-core/constitution.md#V-Quality-First`; `AGENTS.md#Quality-Gates`]
- Não registrar payload para “facilitar debug”; métricas precisam ser suficientes sem copiar conteúdo do usuário.
- Toda autorização é server-side. Ocultar botão ou retirar tool do prompt é defesa adicional, não controle de acesso.
- O roteador de intenção é otimização, não autoridade: executor e guard continuam sendo a fronteira final.
- Resultados de mutação são dados não confiáveis até passarem pelo contrato de sucesso do executor.
- A telemetria desta story é efêmera em logs/headers. Não simular histórico durável em arquivo local versionável.
- A compactação do histórico não equivale a memória permanente e não pode misturar sessões ou agentes.

### Contratos sugeridos para manter separação de responsabilidades

Os nomes finais podem ser ajustados pelo desenvolvedor se os testes e a arquitetura preservarem os contratos. Não introduzir dependência externa sem necessidade comprovada.

- `runtime-config`: endpoint/modelo/capacidades validados server-side.
- `request-context`: requestId, deadline, usuário e métricas do turno.
- `tool-registry`: metadata canônica, filtros de permissão e guard comum.
- `tool-router`: seleção de tools autorizadas por intenção, com fallback seguro.
- `context-budget`: janela, reserva, anexos, histórico e compactação.
- `persona`: fonte oficial e composição em camadas.
- `local-admission-control`: fila, concorrência e rajada por usuário na instância.
- `telemetry`: eventos estruturados e sanitização.

### Riscos e cuidados

- O provider OpenAI-compatible pode emitir tool call em delta ou apenas no fechamento; o parser precisa cobrir o formato real do llama.cpp sem voltar à geração duplicada.
- Cancelar o request do navegador deve abortar espera, provider e tools cooperativas; não persistir o turno como sucesso após desconexão.
- Fila em memória deve remover entradas abandonadas e não pode permitir que um usuário monopolize o único slot.
- `Server-Timing` e headers possuem limites; usar metadados compactos e manter detalhes nos logs estruturados.
- Contar chunks não equivale a contar tokens. Use usage do provider ou tokenizador compatível; caso contrário marque estimativa.
- Prompts de projeto existentes devem continuar úteis como contexto de negócio, mas nunca ocupar a camada de sistema imutável.
- Contexto da aba pode conter identificadores de cliente ou empresa; envie somente os necessários e reautorize o acesso no servidor.
- A troca para Onyx deve encerrar ou isolar stream nativo pendente para evitar resposta atribuída ao agente errado.
- Prisma `$transaction` deve ser validado com o adapter LibSQL atual. Se transação interativa não for suportada, usar uma alternativa atômica compatível e testada sem schema novo.

## Testing

### Unitários

- URL server-side e bloqueio de SSRF, protocolos, hosts e redirects não autorizados.
- Canonicalização de filesystem: traversal, absoluto, symlink, raiz, alvo protegido e confirmação.
- Admission control local: rajada, concorrência, fairness, cancelamento e liberação após erro.
- Tool registry: as 32 tools possuem metadata/guard; filtro nunca amplia permissão.
- Tool router: intenções inequívocas, ambíguas, múltiplas e fallback seguro.
- Orçamento: teto server-side, output/deadline, histórico, anexos e valor legado do cliente.
- Telemetria: TTFT, tokens/s exato/estimado, tool latency, finish reason e redaction.
- Persona: matriz de voz e tentativas de override por projeto/usuário.
- Contexto do módulo: registry, permissão, payload inválido e instrução maliciosa.
- Persistência: atomicidade, contagem de tokens confiável e falhas parciais.

### Integração

- Chat simples produz exatamente uma chamada ao provider e transmite todos os chunks.
- Chat com tool read-only executa apenas ciclos necessários e resposta final.
- Tool mutável sem confirmação é bloqueada; com confirmação e sucesso real é reportada como concluída.
- Prompt de projeto não substitui guardrails e contexto não autorizado não chega ao modelo.
- Deadline interrompe fila/provider/tool e não inicia continuação sem orçamento.
- Sessão salva usuário+assistente atomicamente e rejeita resposta malsucedida.
- Curiosidade exige autenticação e respeita admission control.
- Endpoint de modelos não acessa URL fornecida pelo request nem vaza bearer.

### Componentes e E2E controlado

- UI limita janela ao teto server-side e corrige `localStorage` legado.
- Sugestões variam por permissão/módulo e não oferecem ação bloqueada.
- Seleção Onyx troca nome, avatar, placeholder, empty state e capabilities.
- Interrupção preserva texto/anexos conforme contrato e não mistura streams.
- Mascote e erros não contêm frases proibidas ou promessas falsas.
- Navegação por teclado, leitura por screen reader e reduced motion permanecem funcionais.

### Benchmark e smoke local

- Rodar em ambiente local controlado com modelo e parâmetros fixos.
- Executar aquecimento antes das amostras comparáveis.
- Medir múltiplas amostras de conversa simples e tool read-only.
- Registrar p50/p95 da amostra, TTFT, duração, output tokens/s, chamadas e ciclos.
- Não usar mutação, filesystem real externo, dados privados ou documento corporativo.
- Guardar apenas relatório sanitizado em `docs/qa/`, nunca prompts/respostas integrais.

### Gates

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`
- CodeRabbit em mudanças não commitadas, quando disponível.
- Revisão de segurança focada em SSRF, filesystem, autorização, segredo e prompt injection.

## Story Draft Checklist

| Categoria | Status | Evidência |
|---|---|---|
| Goal & Context Clarity | PASS | Objetivo, riscos, valor, ordem de execução e relação com o fluxo existente estão explícitos. |
| Technical Implementation Guidance | PASS | Rotas, módulos, contratos, limites e integração points estão identificados. |
| Reference Effectiveness | PASS | Cada achado técnico aponta para arquivo ou artefato específico e o conteúdo crítico foi resumido. |
| Self-Containment Assessment | PASS | Escopo, guardrails, edge cases, fora de escopo e critérios mensuráveis estão no documento. |
| Testing Guidance | PASS | Há matriz unitária, integração, UI/E2E, benchmark, smoke e gates. |
| CodeRabbit Integration | PASS | Tipo, agentes, gates, self-healing e focos estão definidos abaixo. |

**Final Assessment:** READY — clareza 9/10. A story é ampla e deve ser implementada na ordem das fases; nenhuma decisão de banco está autorizada. A principal fonte potencial de retrabalho é a variação do protocolo de tool streaming do llama.cpp, mitigada por fixture do payload real e contrato isolado.

## 🤖 CodeRabbit Integration

### Story Type Analysis

- **Primary Type**: Security
- **Secondary Type(s)**: Architecture, API, Integration, Frontend, Performance e Observability
- **Complexity**: High — afeta autenticação, runtime de inference, 32 tools, contexto, persistência e home do IAlpha.

### Specialized Agent Assignment

**Primary Agents**:

- `@dev` — implementação e revisão pre-commit.
- `@architect` — gate de arquitetura, streaming, composição de prompt e fronteiras de autorização.

**Supporting Agents**:

- `@qa` — testes de regressão, segurança, benchmark e contrato verbal.
- `@devops` — revisão pre-PR, configuração segura e gates; sem deploy automático autorizado.

### Quality Gate Tasks

- [x] Pre-Commit (`@dev`): CodeRabbit uncommitted, lint, typecheck e testes focados antes de marcar pronta.
- [x] Architecture Gate (`@architect`): validar generation runner, tool boundary, prompt hierarchy, telemetria e compatibilidade.
- [x] Security Gate (`@qa`): validar SSRF, filesystem escape, IDOR/permissão, segredo, prompt injection e cancelamento.
- [x] Pre-PR (`@devops`): diff contra `main`, suíte completa, build e relatório sanitizado de benchmark.
- [x] Pre-Deployment (`@devops`): revisar variáveis, rollback e feature flags; deploy não faz parte desta story.

### Self-Healing Configuration

- Primary Agent: `@dev` (light mode)
- Max Iterations: 2
- Timeout: 15 minutos
- Severity Filter: CRITICAL
- CRITICAL: auto-fix em até duas iterações.
- HIGH: document-only e encaminhamento ao gate especializado.
- MEDIUM/LOW: registrar como débito quando relevante, sem auto-fix obrigatório.

### CodeRabbit Focus Areas

**Primary Focus**:

- SSRF, redirect, exfiltração de bearer e segredo em logs/respostas.
- Autorização server-side e isolamento canônico do filesystem.
- Geração única sem perda de tool call ou duplicação de mutação.
- Hierarquia de prompt resistente a override e injection.

**Secondary Focus**:

- Deadlines, fila local, cancelamento e liberação de recursos.
- Context budget e contagem exata versus estimada.
- Atomicidade da persistência no adapter atual.
- Acessibilidade e identidade separada entre Bibble e Onyx.

## Initial File List

Lista inicial prevista; o desenvolvedor deve substituir/confirmar pelos arquivos reais tocados.

### Arquivos centrais a modificar

- `src/app/api/bibble/chat/route.ts`
- `src/app/api/bibble/models/route.ts`
- `src/app/api/bibble/curiosidade/route.ts`
- `src/app/api/bibble/sessions/[id]/messages/route.ts`
- `src/lib/bibble/client.ts`
- `src/lib/bibble/completion.ts`
- `src/lib/bibble/context-budget.ts`
- `src/lib/bibble/system-prompt.ts`
- `src/lib/bibble/tools.ts`
- `src/lib/bibble/tool-executor.ts`
- `src/components/BibbleChatHome/BibbleChatLayout.tsx`
- `src/components/BibbleChatHome/BibbleChatWindow.tsx`
- `src/components/BibbleChatHome/BibbleSettingsPanel.tsx`
- `src/components/BibbleChatHome/BibbleSpriteCompanion.tsx`
- `package.json`
- `.env.example`

### Módulos candidatos a criar sob `src/lib/bibble/`

- `runtime-config.ts`
- `request-context.ts`
- `telemetry.ts`
- `admission-control.ts`
- `tool-registry.ts`
- `tool-router.ts`
- `persona.ts`

### Scripts, testes e documentação candidatos

- `scripts/bibble-doctor.mjs`
- `scripts/bibble-benchmark.mjs`
- `tests/bibble/` — ampliar suíte existente por contrato.
- `docs/qa/bibble/` — metodologia e evidência sanitizada do benchmark/smoke.
- `docs/operations/bibble-observability.md`
- `.bibble/memory/bibble-persona.md` — manter como documentação gerada ou apontar para a fonte executável, sem divergência.
- `docs/stories/story-ialpha-bibble-transformacao-integral.md`

### Arquivos explicitamente não previstos

- `prisma/schema.prisma`
- `prisma/migrations/**`
- qualquer dump em `database-backups/**`

## Autonomous Decisions

- `[AUTO-DECISION] Qual status inicial usar? → Approved (reason: o usuário autorizou explicitamente a aplicação integral e o lead pediu status aprovado para desenvolvimento).`
- `[AUTO-DECISION] Criar migration para métricas/memória? → Não (reason: a missão restringe a entrega a logs/headers e estruturas atuais; banco exige Vault, backup e confirmação específica).`
- `[AUTO-DECISION] Tornar rate limit distribuído? → Não (reason: a proteção imediata pode ser local e testável; infraestrutura distribuída foi explicitamente retirada do escopo).`
- `[AUTO-DECISION] Limpar blobs antigos? → Não (reason: bulk delete/limpeza retroativa é mutação de alto risco e exige inventário, política e autorização separada).`
- `[AUTO-DECISION] Trocar o modelo para melhorar qualidade? → Não (reason: o diagnóstico mostra que os maiores ganhos estão na arquitetura do runner, tools, contexto e persona).`
- `[AUTO-DECISION] Como preservar memória sem schema? → Compactação somente durante a montagem do contexto atual (reason: melhora uso da janela sem criar perfil ou memória persistente implícita).`
- `[AUTO-DECISION] Como reconciliar a story de PDF em andamento? → Tratá-la como baseline obrigatório e estender seus contratos (reason: evita regressão e duplicação de solução).`

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-09-15 | 1.0.0 | Story integral criada a partir do diagnóstico aprovado, com hardening, geração única, observabilidade, contexto, persona, UX e persistência sem migration. | River |
| 2026-09-15 | 1.1.0 | Development started (YOLO mode) — Status: Approved → InProgress | Dex |
| 2026-09-15 | 1.2.0 | Implementação e gates especializados concluídos; Status: InProgress → Ready for Review. Mantidas explícitas as pendências globais, manuais e dependentes de Vault. | Scribe |

## Dev Agent Record

### Agent Model Used

Codex GPT-5 / Dex (Builder), modo autônomo YOLO.

### Debug Log References

- IDS: REUSE de `BIBBLE_TOOLS`, `getPermissoesEfetivas`, `MODULOS_REGISTRY`, budget e protocolo SSE existentes; ADAPT das rotas, runner, executor e UI; CREATE somente para contratos ausentes (`runtime-config`, admission, telemetry, persona, module-context, tool-policy e CLI).
- Working tree auditado antes de patches; migração llama.cpp preexistente em `client.ts`, models/Layout preservada; exclusão preexistente de `ollama-manager.ts` não foi revertida nem incluída como trabalho desta story.
- `npx vitest run tests/bibble --coverage.enabled=false`: 13 arquivos, 96 testes, todos PASS.
- Revalidação pós-Probe: `npx vitest run tests/bibble --coverage.enabled=false`: 13 arquivos, 99 testes, todos PASS; ESLint direcionado e `git diff --check`: PASS; typecheck filtrado sem diagnóstico Bibble.
- `npm run bibble:benchmark:tool`: PASS real no provider local, 2 chamadas, 1 tool call read-only, 1 ciclo, 2.384 ms e usage exato nas duas etapas.
- ESLint direcionado dos arquivos da story: PASS sem erros; warnings antigos fora/adjacentes não bloqueiam o gate direcionado.
- Typecheck filtrado para arquivos Bibble tocados: nenhum erro atribuível; o typecheck global permanece para Forge devido a erros preexistentes fora do escopo.
- `node --import tsx scripts/bibble.mjs doctor`: PASS, provider 17 ms, modelo disponível.
- `node --import tsx scripts/bibble.mjs capabilities`: PASS, 25 tools públicas; sete tools de filesystem removidas do catálogo.
- Revalidação pós-Probe 2: 15 arquivos/107 testes Bibble PASS; inclui runner integral mockado (1 call simples, 2 calls após tool real, abort sem provider), interrupção/restauração, margem de deadline e reduced-motion. ESLint direcionado, typecheck filtrado e `git diff --check`: PASS.
- CLI final pós-Probe 2: doctor PASS (14 ms); tool benchmark PASS (2 calls/1 ciclo/2.167 ms); benchmark simples PASS (3/3 com uma call, p50 1.238 ms, TTFT p50 1.156 ms).
- Reconciliação documental pós-Forge: os cinco arquivos do terceiro lote validados pelo ESLint estão registrados na File List (`src/app/api/onyx/session/[id]/route.ts`, `src/lib/onyx/client.ts`, `src/lib/bibble/turn-interruption.ts` e os dois testes novos).
- Correção final pós-Probe: 15 arquivos/110 testes PASS. Regressões cobrem requestId antes de auth/contexto, TTFT no retorno textual da decisão com tools, transição humor on→off com abort/limpeza e bloqueio do fallback Bibble após falha/409 do probe Onyx. ESLint direcionado e `git diff --check`: PASS.
- Hardening pós-Anubis: 16 arquivos/116 testes Bibble PASS antes do ajuste final de vínculo agente/sessão Onyx; catálogo CLI confirmado com 18 capabilities somente leitura. O último ajuste fail-closed exige sessão local própria e compara o agente remoto da sessão, sem schema/migration; revisão de diff dirigida permaneceu limpa.
- Alinhamento UI pós-Probe: removidas sugestões de chamado/PDF, affordance de upload/paperclip, seletores/badges de modelo e configuração de providers; a interface agora informa apenas identidade e capacidades autorizadas pelo servidor.
- Revalidação UI segura: 16 arquivos/117 testes Bibble PASS; ESLint dos componentes/testes alterados e `git diff --check` direcionado PASS.
- Fechamento MEDIUM Anubis: PATCH de projeto/sessão com Zod strict, limite de body e same-origin; histórico limitado a 100 itens/página; tokens permanecem `null` até existir usage exato autoritativo server-side e receipts do cliente são rejeitados; timer/listener pré-lease limpos em 401/403/429/504. Suíte Bibble 16 arquivos/118 testes, ESLint e diff-check direcionados PASS.
- Correção de abertura de chamados (2026-09-17): `abrir_chamado` foi reabilitada como única mutação pública, somente em turno sem anexos com intenção explícita; grant opaco server-owned vincula usuário, requestId, tool, expiração e texto atual e é consumido uma única vez. Metadata declara criação self-service sem permissão de módulo, preservando `chamados` apenas na consulta; teste do runner comprova o repasse do mesmo grant por identidade e a ausência dele na consulta. Hardening adicional mascara spans entre aspas antes de classificar intenção e reconhece ações positivas somente no início da mensagem após prefixos diretos opcionais, rejeitando discurso reportado, narrativa/passado/meta/condicional e perguntas informativas de automação por construção; exige que payload seja derivado literalmente do texto autorizado, revalida solicitante e técnico elegível imediatamente antes do write e executa dedupe de cinco minutos + criação numa transação interativa `Serializable`. Notificação falsa/indisponível não desfaz nem mascara criação confirmada. Limitações residuais: após o commit, uma interrupção de rede/deadline pode impedir a entrega da confirmação ao cliente; a deduplicação transacional protege o retry sequencial, mas corrida concorrente real contra o Turso permanece como smoke operacional pendente e não foi alegada como testada. Suíte Bibble: 24 arquivos/221 testes PASS; ESLint escopado PASS; typecheck global continua falhando apenas em dívidas preexistentes fora do delta.
- Hotfix de deploy Vercel (2026-09-17): o build anterior com Turbopack, heap de 8 GiB e 23 workers atingiu 8.215.452 KiB RSS (cerca de 7,84 GiB) e reproduziu a causa do `SIGKILL`. O build de produção passou a usar Webpack, heap de 3 GiB, geração estática serializada e `webpackMemoryOptimizations`; `@react-pdf/renderer` é transpilado em vez de externalizado. `npm run build` concluiu com 80/80 páginas em 1m15s e pico medido de 7.380.788 KiB (cerca de 7,04 GiB), preservando mais de 1 GiB de margem no container padrão de 8 GiB.
- Self-critique: `plan/self-critique-bibble-transformacao-integral.json`.

### Completion Notes List

- SSRF da rota de modelos removido: URL do request é ignorada e o endpoint validado vem apenas do servidor; respostas não revelam o endpoint.
- Providers externos agora são env-only; POST/DELETE de chave plaintext retornam 410 e arquivo/cache estão ignorados pelo Git.
- Inference recebeu auth uniforme nas rotas auxiliares e admission control local por usuário/instância com resposta 429 retryable. Coordenação distribuída continua explicitamente fora do escopo.
- Filesystem foi retirado do catálogo/runtime para todos os usuários, inclusive admin, até existir aprovação humana server-side vinculada a turno/nonce; campos de confirmação produzidos pelo modelo são sempre rejeitados. O timeout falso via `Promise.race` foi removido.
- O catálogo público/CLI contém agora 25 capabilities executáveis; as sete definições FS não chegam ao provider nem ao comando `capabilities`, enquanto o executor conserva recusa em profundidade.
- A matriz distingue `radar` (`buscar_empresa`) de `analise` (`buscar_empresa`, ficha e consultas recentes), inclusive nas sugestões.
- Deadline/AbortController únicos nascem no início do POST e atravessam todos os ciclos; mutações sem margem de 20 s são recusadas. Completion e tool logs recebem o mesmo requestId; TTFT usa primeiro texto visível e tokens/s usa duração pós-TTFT.
- Reidratação Onyx recupera `persona_id` da sessão autoritativa e restaura a identidade original; ausência de identidade retorna 409 e impede fallback incorreto ao Bibble.
- Falha/409 ao verificar sessão Onyx agora cria estado bloqueado visível, limpa qualquer agente anterior, retorna antes do histórico nativo e impede envio até uma sessão/runtime autoritativo ser escolhido.
- Desligar humor aborta requests pendentes, limpa refs/estado de curiosidade e piada e condiciona a renderização ao toggle, impedindo resposta atrasada.
- O requestId é criado antes de autenticação/contexto e semeia a telemetria posterior; o caminho de decisão com texto final marca TTFT imediatamente antes do primeiro evento visível.
- Tools são filtradas antes do provider por role e permissões efetivas, além do roteamento por intenção; usuário sem permissão não recebe capabilities de análise/Skills/calendário.
- O shell publica contexto same-origin da aba ativa/último módulo/abas abertas e a home valida formato e origem; o servidor resolve somente rotas registradas e autorizadas.
- A troca Bibble/Onyx agora aborta o request, limpa sessão/histórico/anexos e atualiza header, placeholder, empty state e sugestões, evitando mistura de runtimes.
- O contrato de persistência usa o mesmo limite máximo por mensagem dos anexos; falha de save deixa aviso visível em vez de somente console. `/api/onyx/chat` ganhou Zod, limite de corpo, arquivo e histórico.
- Humor tem toggle acessível persistido, default off; frases de culpa/sarcasmo/elogio genérico foram removidas e o sprite respeita reduced motion.
- Runner usa uma única geração streaming para conversa simples e agrega `tool_calls` fragmentados; uma nova chamada ocorre somente após tool call real. Usage exato do provider alimenta telemetria sem persistir payload.
- Contexto local foi limitado a 131.072, saída a 4.096, estimativa conservadora a 3 chars/token e policy documental estendida a qualquer anexo textual. Preferências antigas acima do teto são normalizadas.
- Prompt nativo agora é composto em camadas imutáveis a partir de `persona.ts`; projeto/estilo não substituem guardrails. Home, Onyx empty state, sugestões e mascote foram alinhados; humor é opt-in e desligado por padrão.
- Persistência do par user/assistant usa `$transaction` e Zod; tokens só podem ser gravados com flag de contagem exata. Nenhum schema/migration/seed/backfill/blob foi alterado.
- Achados Anubis críticos/high foram fechados sem migration: Onyx exige PAT individual e ownership de agente/sessão, file proxy e anexos Onyx falham fechados, reasoning é descartado, tool calls usam Set exato autorizado, modelo do request é ignorado, todas as mutações saíram do catálogo/runtime, admission antecede o body e upload/blob público retorna 503 até existir storage privado com ownership verificável.
- Abertura de chamado voltou a funcionar para qualquer usuário autenticado ativo, sem exigir permissão do módulo: a tool só chega ao modelo após pedido explícito atual e exige grant efêmero one-shot no executor. Parâmetros usam Zod strict; responsável é resolvido exclusivamente por nome para um único usuário de TI ativo; IDs fornecidos pelo modelo são recusados; calendário e filesystem permanecem bloqueados.
- Benchmark pós-refatoração (3 amostras): 1 chamada/amostra, p50 total 1.241 ms, p95 1.493 ms, TTFT p50 1.159 ms, p95 1.411 ms; relatório em `docs/qa/bibble/benchmark-2026-09-15.md`.
- Pendências explícitas após os gates: browser/a11y smoke autenticado, dívidas externas dos gates globais e CodeRabbit indisponível.

### File List

- `.bibble/memory/bibble-persona.md`
- `.bibble/memory/architecture.md`
- `.bibble/memory/codebase-map.md`
- `.bibble/memory/decisions.md`
- `.bibble/memory/integration-points.md`
- `.bibble/memory/journal.md`
- `.gitignore`
- `bibble-falas.md`
- `next.config.ts`
- `package.json`
- `docs/operations/bibble-observability.md` (novo)
- `docs/qa/bibble/benchmark-2026-09-15.md` (novo)
- `docs/stories/story-ialpha-bibble-transformacao-integral.md`
- `plan/self-critique-bibble-transformacao-integral.json` (novo)
- `scripts/bibble.mjs` (novo)
- `src/app/PainelAlpha/page.tsx`
- `src/app/api/bibble/chat/route.ts`
- `src/app/api/bibble/cloud-providers/route.ts`
- `src/app/api/bibble/curiosidade/route.ts`
- `src/app/api/bibble/falas/route.ts`
- `src/app/api/bibble/models/route.ts`
- `src/app/api/bibble/piada/route.ts`
- `src/app/api/bibble/projects/route.ts`
- `src/app/api/bibble/projects/[id]/route.ts`
- `src/app/api/bibble/sessions/[id]/route.ts`
- `src/app/api/bibble/sessions/[id]/messages/route.ts`
- `src/app/api/bibble/sessions/route.ts`
- `src/app/api/bibble/upload-to-blob/route.ts`
- `src/app/api/onyx/agents/[id]/route.ts`
- `src/app/api/onyx/chat/route.ts`
- `src/app/api/onyx/connectors/upload/route.ts`
- `src/app/api/onyx/file/[fileId]/route.ts`
- `src/app/api/onyx/session/[id]/route.ts`
- `src/components/BibbleChatHome/BibbleChatLayout.tsx`
- `src/components/BibbleChatHome/BibbleChatHeader.tsx`
- `src/components/BibbleChatHome/BibbleChatInput.tsx`
- `src/components/BibbleChatHome/BibbleChatWindow.tsx`
- `src/components/BibbleChatHome/BibbleEmptyState.tsx`
- `src/components/BibbleChatHome/BibblePromptSuggestions.tsx`
- `src/components/BibbleChatHome/BibbleSettingsPanel.tsx`
- `src/components/BibbleChatHome/BibbleSpriteCompanion.tsx`
- `src/components/layout/PainelLayoutClient.tsx`
- `src/lib/bibble/admission-control.ts` (novo)
- `src/lib/bibble/attachment-security.ts`
- `src/lib/bibble/client.ts`
- `src/lib/bibble/completion.ts`
- `src/lib/bibble/context-budget.ts`
- `src/lib/bibble/chamado-guard.ts`
- `src/lib/bibble/module-context.ts` (novo)
- `src/lib/bibble/mutation-grant.ts` (novo)
- `src/lib/bibble/persona.ts` (novo)
- `src/lib/bibble/runtime-config.ts` (novo)
- `src/lib/bibble/system-prompt.ts`
- `src/lib/bibble/telemetry.ts` (novo)
- `src/lib/bibble/tool-executor.ts`
- `src/lib/bibble/tool-policy.ts` (novo)
- `src/lib/bibble/turn-interruption.ts` (novo)
- `src/lib/bibble/tools.ts`
- `src/lib/modulos-registry.ts`
- `src/lib/onyx/client.ts`
- `src/lib/onyx/ownership.ts`
- `src/lib/onyx/user-token.ts`
- `tests/bibble/attachment-security.test.ts`
- `tests/bibble/chamado-creation-security.test.ts` (novo)
- `tests/bibble/attachment-readiness.test.ts`
- `tests/bibble/completion-budget-stream.test.ts`
- `tests/bibble/context-budget.test.ts`
- `tests/bibble/hardening-and-persona.test.ts` (novo)
- `tests/bibble/stream-tool-calls.test.ts` (novo)
- `tests/bibble/interruption-and-runtime.test.ts` (novo)
- `tests/bibble/module-knowledge.test.ts`
- `tests/bibble/route-runner.integration.test.ts` (novo)
- `tests/bibble/onyx-security-boundaries.test.ts` (novo)

## QA Results

### Forge Report — CONCERNS ⚠️ (2026-09-15)

Gate objetivo executado sobre o working tree atual. Não houve alteração de código, schema, migration ou banco durante esta validação.

| Verificação | Resultado | Evidência |
|---|---|---|
| `npm run typecheck` | OOM / `exit 134` | Node atingiu o heap padrão de aproximadamente 4 GB; caso já catalogado em `.bibble/memory/known-errors.md`. |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck` | Falha global / `exit 2` | 12 diagnósticos em `.next-alpha-dev`, `.next`, `scripts/verify-checklist-task-e2e.ts`, Gerador de Documentos e `HabilitacaoRadarClient.tsx`; nenhum arquivo da File List Bibble foi apontado. |
| `npm run lint` | OOM / `exit 134` | Node atingiu o heap padrão de aproximadamente 4 GB. |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run lint` | Falha global / `exit 1` | 204.277 problemas: 10.108 erros e 194.169 warnings, majoritariamente em `.agents`, `.aiox-core` e legado já fora do escopo. |
| ESLint escopado à File List | PASS / `exit 0` | 35 arquivos executáveis da story verificados, sem erro nem warning. |
| `npm test` | Falha global / `exit 1` | 3.063 testes passaram, 18 falharam, 1 `todo`; 10 arquivos falhos em Alpha SEO, BPM, Parceiros, Gerador de Documentos e Apresentações, nenhum em Bibble. |
| `npx vitest run tests/bibble --coverage.enabled=false` | PASS / `exit 0` | 13 arquivos e 96/96 testes aprovados em 429 ms. |
| `npm run build` — tentativa 1 | Bloqueio ambiental / `exit 1` | Prisma e player concluíram; `next build` encontrou `.next/lock` pertencente a outro build ativo. O processo concorrente terminou sozinho após 5 s; nenhum processo foi encerrado e nenhum lock foi removido. |
| `npm run build` — tentativa 2 | PASS / `exit 0` | Next.js 16.1.6 compilou em 14,2 s, gerou 78 páginas e incluiu todas as rotas Bibble. Foram emitidos avisos não bloqueantes/preexistentes do `pdfjs-polyfill`. |
| `git diff --check` | PASS / `exit 0` | Nenhum erro de whitespace no diff atual. |
| CodeRabbit `uncommitted` | INDISPONÍVEL | Nem `coderabbit`/`cr`, nem script npm/configuração, nem o binário previsto em `/home/ialpha/.local/bin/coderabbit` estão disponíveis; nenhuma revisão foi simulada. |

**Atribuição:** não foi encontrada falha de typecheck, lint ou teste atribuível aos arquivos da story. O build e todos os gates direcionados do Bibble passam. As falhas globais permanecem externas à File List e coerentes com a dívida/baselines catalogados, embora as contagens globais atuais substituam números históricos para esta execução.

**Veredito Forge:** `CONCERNS`. A implementação Bibble está tecnicamente liberada para revisão especializada de segurança/integração, mas a story não pode declarar todos os gates globais verdes nem marcar CodeRabbit como executado. Permanecem também fora do Forge o mock integral de rota com contagem de ciclos de tool e o smoke de browser/a11y já registrados como pendentes na Task 14.

### Probe Report — FAIL ⛔ (2026-09-15)

Auditoria de integração executada após Forge, sem alteração de código, schema, migration ou banco. O blueprint funcional foi conferido contra a própria story e `.bibble/memory/integration-points.md`; não foi localizado um artefato Scout separado para esta transformação.

#### Evidências aprovadas

| Integração | Resultado | Evidência |
|---|---|---|
| Home autenticada | PASS | `/PainelAlpha` monta `BibbleChatLayout`; smoke HTTP sem cookie retornou `307` para a página e `401` para chat, models, curiosidade, falas, piada e cloud-providers. |
| Provider local | PASS | `npm run bibble:doctor`: modelo `qwen3.8-131k` disponível no endpoint fixo, janela 131.072, concorrência 1. |
| Registry CLI | PASS | `npm run bibble:capabilities`: 32 tools enumeradas. |
| Testes focados | PASS | `npx vitest run tests/bibble --coverage.enabled=false`: 13 arquivos, 96/96 testes. |
| Streaming de tool do llama.cpp | PASS parcial | Smoke sintético read-only direto no provider: `finishReason=tool_calls`, tool fragmentada reconstruível, usage exato; 1 chamada, primeiro delta em 1.557 ms e total em 1.935 ms. Não valida a rota autenticada inteira. |
| SSRF da rota de models | PASS estático | `GET /api/bibble/models` não lê query/URL do request e resolve destino server-side. |
| Anexos Onyx | PASS estático | Downloads de texto/imagem passam por `fetchTrustedBibbleBlob`, com origem/prefixo e redirect controlados. |
| Persistência do par | PASS isolado | Endpoint usa ownership + Zod + `$transaction` para user/assistant/update. |

#### Falhas bloqueantes de integração

1. **Confirmação de filesystem não é uma confirmação do usuário.** `validateFilesystemMutation` aceita `confirmado=true` e `confirmacao_alvo` vindos do JSON gerado pelo próprio modelo; não existe estado server-side que prove uma pergunta anterior e uma resposta afirmativa do usuário, como existe no cancelamento de calendário. Reprodução read-only: chamar `validateFilesystemMutation('apagar', { caminho: 'arquivo.txt', confirmado: true, confirmacao_alvo: 'arquivo.txt' })` é aceito. Além disso, o timeout usa `Promise.race` sem abortar a operação subjacente; uma mutação pode terminar após o retorno de timeout. Viola AC 6, 7 e 14. Arquivos: `src/lib/bibble/tool-policy.ts`, `src/lib/bibble/tool-executor.ts`.
2. **Tools não são filtradas por permissão antes do provider.** `authorizedTools` filtra somente filesystem e ignora `getToolMetadata().permission`. Reprodução: usuário `Operador` com `permissoes=[]` ainda recebe `buscar_empresa`; para o prompt de CNPJ, o roteador seleciona `buscar_empresa`, `gerar_ficha_pre_analise` e `buscar_consultas_recentes`. Guards internos evitam parte das leituras, mas o catálogo/prompt anuncia tools não autorizadas e algumas tools de Skills não têm checagem equivalente no executor. Viola AC 7, 16, 17, 33 e 41. Arquivo: `src/lib/bibble/tool-policy.ts`.
3. **Contexto da aba não está conectado.** `PainelLayoutClient` não envia contexto de tab para o iframe do IAlpha; `BibbleChatLayout` envia sempre `{ moduleKey: "ialpha", route: "/PainelAlpha" }`. A rota valida corretamente o payload recebido, mas nunca recebe o módulo real/anterior do shell. Viola AC 40–43. Arquivos: `src/components/layout/PainelLayoutClient.tsx`, `src/components/BibbleChatHome/BibbleChatLayout.tsx`.
4. **Identidade Onyx fica incompleta e mistura runtimes.** Em conversa com mensagens, `BibbleChatWindow` deixou de passar `activeAgentName/activeAgentAvatarUrl` ao header; `BibbleChatInput` conserva o placeholder “Pergunte algo ao Bibble...”. Ao adicionar/remover agente, as mensagens são preservadas e reenviadas como histórico indistinto ao outro runtime. Viola AC 44. Arquivos: `src/components/BibbleChatHome/BibbleChatWindow.tsx`, `BibbleChatInput.tsx`, `BibbleChatLayout.tsx`.
5. **Deadline e telemetria não são fim a fim.** `createBibbleMetrics` e o timer de deadline nascem somente depois de autenticação, consultas, montagem de prompt, download/extração de anexos e orçamento. `contextMs` nunca é preenchido; admission não possui fila e reporta `queueMs=0`; requestId não é propagado para `callCompletion`/tools; TTFT do caminho com tool mede delta interno bufferizado, não o primeiro texto visível; tokens/s do log usa duração total, divergindo da métrica pós-TTFT do benchmark. Viola AC 14 e 27–31. Arquivos: `src/app/api/bibble/chat/route.ts`, `src/lib/bibble/admission-control.ts`, `src/lib/bibble/telemetry.ts`, `src/lib/bibble/completion.ts`.
6. **Contrato de persistência diverge do contrato de anexos.** O chat aceita até 10 conteúdos extraídos de 480.000 chars (potencial de 4.800.000 chars persistidos), mas `/sessions/[id]/messages` limita `userContent` a 2.000.000. Um turno válido com múltiplos documentos pode responder e depois falhar ao salvar; o cliente apenas registra erro no console. Viola AC 26, 46, 47 e 52. Arquivos: `src/lib/bibble/attachment-security.ts`, `src/components/BibbleChatHome/BibbleChatLayout.tsx`, `src/app/api/bibble/sessions/[id]/messages/route.ts`.
7. **Persona/humor ainda diverge no runtime.** O opt-in `bibble-humor-enabled` não possui controle de UI e só bloqueia curiosidade/piada. Falas contextuais e de streaming com sarcasmo/culpa/elogio continuam ativas com humor desligado, incluindo “ninguém liga o ar”, “eu também quero descansar”, “vai pro meu diário” e “Boa pergunta”. Fallbacks ainda usam “Tive um problema. Tenta de novo.” sem próxima ação específica. Viola AC 32, 35–39. Arquivos: `src/components/BibbleChatHome/BibbleSpriteCompanion.tsx`, `BibbleChatLayout.tsx`.
8. **Janela e benchmark não cumprem o contrato completo.** A UI usa teto hardcoded, sem consumir capacidade retornada pelo servidor nem mostrar reserva/uso aproximado. O benchmark executa somente conversa simples e fixa `toolCycles=0`; a documentação afirma smoke com tool read-only que o script não realiza. O antes/depois não usa uma execução equivalente da mesma configuração e o relatório de throughput não coincide com a fórmula do log de produção. Viola AC 18, 19, 20, 25, 28 e 54. Arquivos: `scripts/bibble.mjs`, `docs/qa/bibble/benchmark-2026-09-15.md`, `docs/operations/bibble-observability.md`, `src/components/BibbleChatHome/BibbleSettingsPanel.tsx`.
9. **Geração única não possui prova de rota integral.** O parser de deltas e o provider real foram validados isoladamente, mas não existe o mock da rota que prove contagem 1 no chat simples e `N tools + final` no fluxo completo, nem smoke autenticado de interrupção. A própria Task 5 permanece aberta. Viola AC 13, 53 e 54.
10. **Acessibilidade do conjunto permanece sem gate.** Não houve browser autenticado disponível para validar teclado, screen reader e reduced motion; o sprite usa animações contínuas sem `useReducedMotion`. A própria Task 12 permanece aberta. Viola AC 45, 53–56.

#### Checklist Probe

- Presença visual e URL: **PASS parcial** — home e rotas existem; browser autenticado não disponível.
- Triggers/navegação: **FAIL** — contexto da tab não chega ao IAlpha.
- Roteamento: **FAIL** — seleção anterior ao provider não respeita permissões efetivas.
- Permissões: **FAIL** — defense-in-depth incompleta e confirmação destrutiva não vinculada ao turno do usuário.
- Persistência: **FAIL** — transação isolada correta, limites ponta a ponta incompatíveis.
- Estados/identidade UI: **FAIL** — Onyx incompleto, humor/persona e a11y pendentes.
- Regressão: **CONCERNS** — build e suite Bibble passaram no Forge; gates globais e CodeRabbit continuam não verdes/indisponíveis.

**Veredito Probe:** `FAIL`. A feature não está pronta para Lens/Sage nem para sinalização de conclusão. Retornar ao Developer para corrigir os itens 1–10 e repetir Forge + Probe. Nenhuma mudança de banco é necessária para as correções apontadas.

### Forge Recheck pós-Probe — CONCERNS ⚠️ (2026-09-15)

Nova rodada executada após as correções dos dez achados do Probe. Este registro complementa e não substitui os pareceres anteriores. O Forge não alterou código, schema, migration ou banco.

| Verificação | Resultado | Comparação/evidência |
|---|---|---|
| `npx vitest run tests/bibble --coverage.enabled=false` | PASS / `exit 0` | 13 arquivos, 99/99 testes em 430 ms; +3 testes aprovados sobre o gate anterior (96/96). |
| ESLint escopado à File List | PASS / `exit 0` | 36 arquivos executáveis, sem erro nem warning; inclui agora `PainelLayoutClient.tsx`. |
| `git diff --check` | PASS / `exit 0` | Nenhum erro de whitespace no diff rastreado atual. |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck` | Falha global / `exit 2` | 11 diagnósticos, contra 12 anteriormente. Permanecem somente `.next-alpha-dev`/`.next` + Exclusão Fiscal, `scripts/verify-checklist-task-e2e.ts`, Gerador de Documentos e `HabilitacaoRadarClient.tsx`; nenhum arquivo da story. |
| `npm test` | Falha global / `exit 1` | 3.088 passaram, 18 falharam e 1 `todo` em 414 arquivos. As mesmas 18 falhas externas do gate anterior permanecem; aprovados cresceram de 3.063 para 3.088 e arquivos aprovados de 402 para 404. Nenhuma falha Bibble. |
| `npm run build` | PASS / `exit 0` | Passou de primeira; Next.js 16.1.6 compilou em 14,2 s e gerou 78 páginas. Apenas avisos conhecidos do `pdfjs-polyfill`. |
| `npm run bibble:doctor` | PASS / `exit 0` | Provider disponível em 13 ms; `qwen3.8-131k`, janela 131.072, saída 4.096, concorrência 1, rate limit local. |
| `npm run bibble:capabilities` | PASS / `exit 0` | Registry enumerou 32 tools. |
| `npm run bibble:benchmark` | PASS / `exit 0` | 3 amostras, exatamente 1 chamada e 0 ciclos de tool por amostra; p50 total 1.250 ms, p95 1.412 ms, TTFT p50 1.168 ms, p95 1.329 ms, 58 tokens exatos por amostra. |
| `npm run bibble:benchmark:tool` | PASS / `exit 0` | 2 chamadas ao provider, 1 tool call read-only, 1 ciclo, 2.158 ms, usage exato em decisão e resposta final, `finishReason=stop`. |
| CodeRabbit `uncommitted` | INDISPONÍVEL | `coderabbit`, `cr` e `/home/ialpha/.local/bin/coderabbit` continuam ausentes; nenhuma aprovação foi simulada. |

**Atribuição comparativa:** as correções pós-Probe não introduziram regressão detectável. O escopo Bibble ganhou três testes, mantém lint limpo, compila em produção e passa nos quatro comandos CLI operacionais. O conjunto global preserva exatamente as mesmas 18 falhas de teste externas e reduziu o typecheck de 12 para 11 diagnósticos, todos fora da File List.

**Veredito Forge final:** `CONCERNS`. Do ponto de vista de compilação, testes direcionados e integração CLI/provider, o Bibble está liberado para uma nova execução do Probe e para os gates especializados seguintes. A story ainda não pode declarar os quality gates globais totalmente verdes porque typecheck e suíte global retornam código não zero por dívida externa, e o CodeRabbit permanece indisponível.

### Probe Recheck pós-correções — FAIL ⛔ (2026-09-15)

Segunda auditoria de integração executada sobre o working tree pós-Forge. Este registro preserva os pareceres anteriores e revalida explicitamente os dez bloqueios do primeiro Probe. Nenhum código, schema, migration ou banco foi alterado; somente este QA Result foi acrescentado.

| # | Bloqueio anterior | Resultado do recheck | Evidência objetiva |
|---|---|---|---|
| 1 | Filesystem sem aprovação confiável | **FAIL parcial** | O runtime ficou fail-closed: reprodução direta de `executarTool` para as sete tools (`ler_arquivo`, criar/escrever/apagar/mover/copiar e criar pasta) retornou “Acesso a arquivos desabilitado” e não criou `/tmp/probe-nao-criar`. Porém `npm run bibble:capabilities` ainda publica as sete tools e descrições que dizem “Disponível apenas quando o usuário habilitou acesso ao computador”. Portanto filesystem é zero no catálogo enviado ao provider, mas não no catálogo CLI/registry solicitado. `toolRegistry(BIBBLE_TOOLS)` e o teste correspondente continuam exigindo 32 entradas. |
| 2 | Filtro de tools por role/permissão/intenção | **FAIL** | Reprodução direta de `authorizedTools`: `USER` com somente `radar` recebe `buscar_empresa`, `gerar_ficha_pre_analise` e `buscar_consultas_recentes`; o executor exige `analise` para as duas últimas. Logo o provider ainda vê capabilities que o usuário não pode executar. As sugestões também escondem “Buscar empresa” de `radar`, pois exigem apenas `analise`. Usuário sem permissões ficou corretamente limitado a `abrir_chamado`. |
| 3 | Contexto real das tabs | **PASS estático / CONCERNS visual** | `PainelLayoutClient` publica `activeUrl`, `lastOperationalUrl` e `openModules` para o iframe da home com `window.location.origin`; `BibbleChatLayout` valida `origin`, `source`, forma e limites; a API reduz o payload a rota registrada e autorizada. Há reenvio no `onLoad`, além do effect por mudança de tabs. Não havia aplicação autenticada utilizável para smoke visual; as portas locais consultadas não serviam a rota do Painel, portanto nenhuma execução de browser foi alegada. |
| 4 | Identidade Bibble ↔ Onyx | **PASS no fluxo ativo / CONCERNS na reidratação** | Header, placeholder, empty state e sugestões recebem a identidade ativa. Adicionar/remover agente aborta request e limpa sessão, mensagens, input e anexos. Risco residual: `/api/onyx/session/[id]` devolve apenas `onyx` e mensagens, sem `agentId`; `loadSession` não restaura `selectedAgent`. Assim uma conversa Onyx histórica pode reabrir visualmente como Bibble e o próximo envio usar `/api/bibble/chat`. |
| 5 | Deadline, requestId e métricas fim a fim | **FAIL** | `requestStartedAt` e `contextMs` foram adicionados e `X-Request-Id`/tools recebem o id. Contudo o `AbortController` e timer de 100 s só nascem depois de auth, DB, confirmação, anexos, extração e orçamento; o timer ganha mais 100 s completos, em vez do saldo desde `requestStartedAt`. `runStream` também reinicia a contagem em `inicioRequisicao`. `executarTool` apenas consulta `signal.aborted` antes de `executarToolUnsafe`; Calendar/Prisma/Receita/Onyx em curso não recebem o sinal. `callCompletion` registra metadados sem `requestId`. TTFT pode ser marcado por texto interno de decisão antes do primeiro texto visível, e `safeBibbleLog` calcula tokens/s pela duração total, enquanto CLI/docs usam o trecho pós-TTFT. `queueMs=0` é, isoladamente, legítimo e verdadeiro para o admission process-local sem fila (rejeição 429 imediata), não foi tratado como falha por si só. |
| 6 | Persistência, anexos e contrato Onyx | **PASS** | Persistência usa ownership, Zod e `$transaction`; `userContent` agora aceita `BIBBLE_HISTORY_MESSAGE_MAX_CHARS`; falha de save produz aviso visível. Bibble e Onyx usam leitura de corpo limitada, Zod strict, máximo de dez arquivos, tipos/tamanho/URL confiável e `fetchTrustedBibbleBlob`. Os testes de anexos cobrem teto individual/agregado, magic bytes, redirect e histórico máximo. |
| 7 | Humor off, toggle e fala | **FAIL** | O toggle existe, é `role=switch`, persistido e default off, mas `humorEnabled` só impede fetch de curiosidade/piada. `buildContextFalas`, `FALLBACK_FALAS` e `STREAMING_FALAS` continuam escolhidos sem consultar o toggle e contêm humor (“isso é conspiração”, “até eu quero dormir”, “relatório de horas extras”, “por que nós dois ainda estamos aqui?”, “pixels, mas valem”, “depende da perspectiva”, “neurônios virtuais”). Portanto “off” não desativa o humor do mascote. |
| 8 | Janela dinâmica e benchmark com tool | **PASS parcial** | `npm run bibble:doctor` passou (provider 14 ms, modelo disponível, 131.072/4.096). `npm run bibble:benchmark` passou com 3 chamadas simples, uma por amostra, p50 1.240 ms e p95 1.391 ms; `npm run bibble:benchmark:tool` passou com 2 chamadas, 1 tool call read-only e 1 ciclo em 2.138 ms. A UI recebe `maxContextWindow`, filtra presets e mostra uso/reserva, mas o input numérico e ambos os normalizadores ainda fixam 131.072 em vez de usar integralmente o teto retornado; hoje coincide com o runtime, porém o contrato não é realmente dinâmico. |
| 9 | Prova integral e interrupção automatizável | **FAIL** | Os testes comprovam parser SSE do provider e do app, e o benchmark comprova um tool-loop direto no provider. Não existe teste da rota autenticada contando provider calls no fluxo completo. Não existe teste Bibble de `handleStop`/abort/restauração/não persistência; busca na suíte encontrou apenas verificações estáticas de stream failure. A marcação da Task 14 de que interrupção “fica coberta de forma automatizada” não tem evidência executável correspondente. |
| 10 | A11y/reduced motion | **FAIL parcial / CONCERNS visual** | `useReducedMotion` foi adicionado e interrompe a rotação/bobbing do sprite. Porém a bolha ainda usa `initial/animate/exit` e os três dots de streaming usam animação infinita sem condicionar `reduceMotion`. Toggle tem semântica acessível, mas teclado/screen reader/browser autenticado não foram executados; isso permanece CONCERNS não bloqueante por ambiente, enquanto o bypass de reduced motion é uma falha estática reproduzível. |

#### Integração ponta a ponta

- Home → layout → API: **PASS estático**. `/PainelAlpha` monta o chat, contexto real chega no payload Bibble e a rota autentica/valida antes do provider.
- Policy/admission/deadline: **FAIL**. Admission local e 429 estão coerentes; autorização fina e deadline/cancelamento ainda não.
- Completion/tool-loop → SSE/cliente: **PASS parcial**. Fragmentação de tool call, usage e protocolo `done.successful` passam; falta o teste da rota integral e a correlação completa por `requestId`.
- Persistência e anexos: **PASS** nos contratos direcionados e na inspeção do wiring.
- CLI/provider: **PASS operacional**, com ressalva bloqueante do catálogo FS. Doctor, benchmark simples e benchmark tool executaram contra o provider local.
- Rotas auxiliares/providers: **PASS estático**. Models usa endpoint server-side; inferência auxiliar exige auth; providers externos são env-only e mutações retornam 410 para admin.
- Métricas admin: **N/A conforme AC 31**. A story exige logs/headers e documentação, não dashboard ou armazenamento histórico; o escopo process-local foi respeitado.

#### Execuções desta rodada

| Comando/reprodução | Resultado |
|---|---|
| `npx vitest run tests/bibble --coverage.enabled=false` | PASS — 13 arquivos, 99/99 testes em 540 ms. |
| `npm run bibble:doctor` | PASS — provider/modelo disponíveis, exit 0. |
| `npm run bibble:capabilities` | Exit 0, mas **contrato FAIL** — 32 tools, incluindo sete FS desativadas. |
| `npm run bibble:benchmark` | PASS — 3/3 amostras, 1 chamada e 0 ciclos cada. |
| `npm run bibble:benchmark:tool` | PASS — 2 chamadas, 1 tool call, 1 ciclo, read-only. |
| Reprodução `authorizedTools` | **FAIL** — perfil somente `radar` recebeu duas tools exclusivas de `analise`. |
| Reprodução runtime FS | PASS fail-closed — 7/7 recusadas e zero efeito no alvo de teste. |

#### Correções bloqueantes restantes

1. Remover as sete tools FS do catálogo público/CLI enquanto o runtime estiver desabilitado, ou separar explicitamente registry interno de capabilities disponíveis sem afirmar disponibilidade por toggle do cliente.
2. Autorizar cada tool individualmente: `buscar_empresa` aceita `radar|analise`; `gerar_ficha_pre_analise` e `buscar_consultas_recentes` exigem `analise`. Alinhar sugestões (incluindo busca RADAR e manuais por módulo) à mesma matriz.
3. Criar deadline no começo do POST, compor o sinal do request, passar somente o saldo para todas as etapas e propagar cancelamento real aos adaptadores de tools; correlacionar completion/tool logs pelo mesmo `requestId` e alinhar TTFT/tokens/s ao texto visível.
4. Fazer `humorEnabled=false` selecionar somente corpus neutro e aplicar reduced motion também à bolha e aos dots.
5. Adicionar teste automatizado de interrupção e teste integrado da rota com provider mockado, cobrindo contagem de chamadas, abort, restauração do turno e ausência de persistência parcial.
6. Preservar/restaurar a identidade do agente na reidratação de sessões Onyx, sem exigir migration (por exemplo, metadado confiável retornado pelo Onyx/sessão ou tratamento explícito que impeça enviar histórico Onyx ao Bibble).

**Veredito Probe recheck:** `FAIL`. Houve avanço substancial e persistência/anexos/benchmark/contexto ativo ficaram conectados, mas os requisitos funcionais de catálogo FS zero, autorização antes do provider, deadline/cancelamento fim a fim, humor off/reduced motion e interrupção automatizável ainda não estão cumpridos. Retornar ao Developer e repetir Forge + Probe. Nenhuma mudança de banco é necessária para os bloqueios apontados.

### Forge Recheck final — terceiro lote — CONCERNS ⚠️ (2026-09-15)

Terceira rodada objetiva executada depois das correções do segundo Probe. Este registro preserva todo o histórico anterior. O Forge não alterou código, schema, migration ou banco.

| Verificação | Resultado | Comparação/evidência |
|---|---|---|
| `npx vitest run tests/bibble --coverage.enabled=false` | PASS / `exit 0` | 15 arquivos, 107/107 testes em 417 ms; +8 testes e +2 arquivos sobre o recheck anterior (99/99 em 13 arquivos). |
| ESLint escopado | PASS / `exit 0` | 41 arquivos sem erro nem warning: File List executável mais os cinco arquivos pós-Probe ainda ausentes dela (`src/app/api/onyx/session/[id]/route.ts`, `src/lib/onyx/client.ts`, `src/lib/bibble/turn-interruption.ts`, `tests/bibble/interruption-and-runtime.test.ts` e `tests/bibble/route-runner.integration.test.ts`). |
| `git diff --check` | PASS / `exit 0` | Nenhum erro de whitespace no diff rastreado atual. |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck` | Falha global / `exit 1` | Mantidos os mesmos 11 diagnósticos externos do recheck anterior: `.next-alpha-dev`/`.next` + Exclusão Fiscal, checklist E2E, Gerador de Documentos e Habilitação Radar. Nenhum arquivo da story/terceiro lote. |
| `npm test` | Falha global / `exit 1` | 3.102 passaram, 18 falharam e 1 `todo` em 418 arquivos. São as mesmas 18 falhas externas; aprovados cresceram de 3.088 para 3.102 e arquivos aprovados de 404 para 408. Nenhuma falha Bibble. |
| `npm run build` | PASS / `exit 0` | Passou de primeira; Next.js 16.1.6 compilou em 14,2 s e gerou 78 páginas. Apenas avisos conhecidos do `pdfjs-polyfill`. |
| `npm run bibble:doctor` | PASS / `exit 0` | Provider disponível em 13 ms; `qwen3.8-131k`, janela 131.072, saída 4.096, concorrência 1 e rate limit local. |
| `npm run bibble:capabilities` | PASS / `exit 0` | Catálogo público reduziu de 32 para as 25 tools esperadas; as sete tools de filesystem não são mais publicadas. |
| `npm run bibble:benchmark` | PASS / `exit 0` | 3 amostras, 1 chamada e 0 ciclos por amostra, 58 tokens exatos; p50 total 1.241 ms e p95 1.267 ms, contra 1.250/1.412 ms no recheck anterior. TTFT p50 1.159 ms e p95 1.185 ms. |
| `npm run bibble:benchmark:tool` | PASS / `exit 0` | 2 chamadas, 1 tool read-only, 1 ciclo, usage exato e `finishReason=stop`; total 2.128 ms, contra 2.158 ms anteriormente. |

**Atribuição comparativa:** o terceiro lote não introduziu regressão detectável. Houve aumento de cobertura direcionada, catálogo público corrigido para 25 capabilities, build estável e pequena melhora observada nos benchmarks. As falhas globais permaneceram quantitativa e funcionalmente iguais, todas fora da File List.

**Pendência documental:** os cinco arquivos pós-Probe validados pelo ESLint ainda precisam ser incluídos na File List pelo executor da story antes do fechamento do AC 56.

**Veredito Forge final:** `CONCERNS`. O código da transformação Bibble passa integralmente nos gates direcionados, no build e nos comandos CLI/provider e está liberado para o Probe final. O repositório como um todo ainda retorna código não zero em typecheck e testes por dívida externa conhecida; a File List também precisa incorporar os cinco arquivos do terceiro lote. Não há falha Forge atribuível ao Bibble.

### Probe Final — FAIL ⛔ (2026-09-15)

Terceira auditoria Probe executada após o terceiro lote e a reconciliação da File List. O parecer preserva os relatórios anteriores. Nenhum código, schema, migration ou banco foi alterado; somente este QA Result foi acrescentado. O smoke visual autenticado permaneceu pendência manual não bloqueante e não foi alegado.

| # | Critério do Probe 2 | Resultado final | Reprodução/evidência |
|---|---|---|---|
| 1 | Catálogo público sem filesystem | **PASS** | `npm run bibble:capabilities` retornou exatamente 25 tools e nenhuma das sete tools FS. `BIBBLE_TOOLS` filtra o registry interno e o teste exige 25 entries não-FS. O executor continua fail-closed para chamadas defensivas internas. |
| 2 | Perfil RADAR sem tools de Pré-Análise | **PASS** | Reprodução direta com `role=USER` e `permissoes=['radar']` retornou somente `buscar_empresa` e `abrir_chamado`; `gerar_ficha_pre_analise` e `buscar_consultas_recentes` não foram expostas. |
| 3 | Deadline único, cancelamento e margem | **PASS parcial / CONCERNS** | O POST agora cria `deadlineAt` e `AbortController` no início, compõe `req.signal`, passa o mesmo deadline ao runner, cancela provider e downloads/extrator, e impede iniciar mutação com menos de 20 s de margem. O teste de margem passou. Permanecem dois débitos não bloqueantes nesta rubrica: retornos antecipados comuns não limpam o timer, e `executarToolUnsafe` não recebe o signal — adaptadores internos não abortáveis dependem da margem/timeout próprio. Não há mais relógio reiniciado no runner. |
| 4 | `requestId`, TTFT e throughput | **FAIL** | Completion e tool logs agora recebem o id e `safeBibbleLog` calcula throughput pós-TTFT; reprodução de 10 tokens, duração 1.100 ms e TTFT 1.000 ms produziu `generationMs=100` e `tokensPerSecond=100`. Porém `requestId` só é criado com `createBibbleMetrics` depois de toda a montagem de contexto, portanto logs/erros anteriores não têm o id da requisição. Há ainda um caminho concreto sem TTFT: quando `tools.length > 0`, mas a decisão do provider termina com texto sem tool call, o runner envia `decisionText` diretamente e retorna sucesso sem definir `metrics.ttftMs`; nesse turno throughput fica indisponível. |
| 5 | Humor desligado operacional | **FAIL de transição** | Com humor desligado desde o início, o componente não busca falas/clima/piada e escolhe somente `OPERATIONAL_FALAS`/`OPERATIONAL_STREAMING_FALAS`, corrigindo o caso principal. Contudo desligar o toggle enquanto uma curiosidade/piada está visível ou pendente não limpa `curiosidade`, `piada` e refs; `isCuriosidade`/`isPiada` não dependem de `humorEnabled`. A fala humorística pode continuar ou ser promovida após o usuário desligar o recurso. |
| 6 | Reduced motion completo | **PASS estático** | `useReducedMotion` interrompe rotação/bobbing; a bolha usa `initial=false`, exit desabilitado e duração zero; dots não animam e usam duração zero. O teste dedicado passou. Smoke de preferência real no browser permanece manual. |
| 7 | Runner integral e interrupção automatizável | **PASS direcionado** | `route-runner.integration.test.ts` prova 1 chamada em chat comum, 2 chamadas apenas após tool call real, SSE successful e controller já abortado sem trabalho de provider. `turn-interruption.ts` está conectado ao `handleStop`; o teste comprova abort e remoção do par não persistido. |
| 8 | Reidratação Onyx por `persona_id` e 409 | **FAIL ponta a ponta** | A API consulta a sessão Onyx, resolve `persona_id`/`persona.id`, devolve `agentId` e retorna 409 se a identidade não puder ser validada. O caminho de sucesso restaura `selectedAgent`. Porém o cliente só entra nessa lógica quando `onyxRes.ok`; um 409 não é tratado como bloqueio e cai silenciosamente no fallback `/api/bibble/sessions/[id]`. Assim a sessão Onyx local pode ser carregada como Bibble — ou manter outro agente previamente selecionado — e o próximo envio usar o runtime errado. Não existe teste cobrindo o 409 no cliente/API. |

#### Fluxo e gates positivos reconfirmados

- Home IAlpha → `BibbleChatLayout` → `/api/bibble/chat` → policy/admission → completion/tool runner → SSE/cliente → persistência: **PASS parcial**, bloqueado apenas pelos itens 4 e 8 acima.
- Contexto de tabs same-origin, validação de registry/permissão, identidade ativa, header, placeholder, reset Bibble/Onyx, sugestões filtradas, anexos trusted, Onyx Zod, persistência transacional e falha de save visível: **PASS por código e testes direcionados**.
- File List: **PASS**, incluindo rota de sessão Onyx, client Onyx, helper de interrupção e os dois testes novos.
- `npx vitest run tests/bibble --coverage.enabled=false`: **PASS**, 15 arquivos e 107/107 testes em 510 ms.
- ESLint dos arquivos críticos/terceiro lote: **PASS**, sem saída e exit 0.
- `npm run bibble:doctor`: **PASS**, provider em 15 ms e modelo `qwen3.8-131k` disponível.
- `npm run bibble:benchmark`: **PASS**, 3/3 amostras, uma chamada por amostra, p50 1.247 ms, p95 1.386 ms, TTFT p50 1.165 ms e p95 1.304 ms.
- `npm run bibble:benchmark:tool`: **PASS**, duas chamadas, uma tool read-only, um ciclo, usage exato e `finishReason=stop` em 2.164 ms.
- Build e gates globais não foram repetidos pelo Probe: o Forge final já registrou build PASS e as 18 falhas/11 diagnósticos globais externos conhecidos.

#### Correções bloqueantes finais

1. Criar `requestId` no início do POST e correlacionar também contexto/erros antecipados; definir TTFT imediatamente antes do primeiro `send({ type: "text" })` no caminho de decisão final sem tool.
2. Em `loadSession`, tratar explicitamente 409/erro da rota Onyx como estado bloqueado e retornar sem consultar/carregar a sessão Bibble; limpar qualquer agente anterior. Cobrir sucesso por `persona_id` e 409 com teste de integração cliente/API.
3. Ao desligar humor, limpar imediatamente curiosidade/piada ativas e pendentes, ou condicionar `isCuriosidade`/`isPiada` ao toggle, com teste da transição on → off.

**Veredito Probe FINAL:** `FAIL`. Seis dos oito bloqueios foram corrigidos de forma suficiente, mas a correlação/TTFT ainda falha em um caminho real, o 409 Onyx não impede fallback para o runtime Bibble e o humor off não é imediato durante a transição. Retornar ao Developer para o último lote e repetir somente os testes direcionados desses três fluxos antes do fechamento. Nenhuma alteração de banco é necessária.

### Forge Recheck de fechamento — correção residual — CONCERNS ⚠️ (2026-09-15)

Última rodada objetiva executada após as correções residuais do Probe Final. Todo o histórico anterior permanece preservado. O Forge não alterou código, schema, migration ou banco.

| Verificação | Resultado | Comparação/evidência |
|---|---|---|
| `npx vitest run tests/bibble --coverage.enabled=false` | PASS / `exit 0` | 15 arquivos, 110/110 testes em 966 ms; +3 testes sobre o lote anterior (107/107). |
| ESLint da File List | PASS / `exit 0` | 41 arquivos executáveis reconciliados, sem erro nem warning. |
| `git diff --check` | PASS / `exit 0` | Nenhum erro de whitespace no diff rastreado atual. |
| `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck` | Falha global / `exit 2` | 12 diagnósticos externos: os mesmos 11 grupos anteriores mais uma cópia gerada do erro de Exclusão Fiscal em `.next-chatbot-fix-verify/types/validator.ts`. Nenhum arquivo Bibble/Onyx da story foi apontado. |
| `npm test` | Falha global / `exit 1` | 3.107 passaram, 18 falharam e 1 `todo` em 419 arquivos. Permanecem exatamente as mesmas 18 falhas externas; aprovados cresceram de 3.102 para 3.107 e arquivos aprovados de 408 para 409. Nenhuma falha Bibble. |
| `npm run build` | PASS / `exit 0` | Passou de primeira; Next.js 16.1.6 compilou em 17,6 s e gerou 78 páginas. Apenas avisos conhecidos do `pdfjs-polyfill`. |
| `npm run bibble:doctor` | PASS / `exit 0` | Reexecutado porque `chat/route.ts` e `completion.ts` mudaram: provider disponível em 16 ms, `qwen3.8-131k`, janela 131.072, saída 4.096 e concorrência 1. |
| `npm run bibble:capabilities` | PASS / `exit 0` | Mantidas exatamente 25 capabilities públicas e nenhuma tool de filesystem. |
| `npm run bibble:benchmark` | PASS / `exit 0` | 3 amostras com exatamente 1 chamada/0 tool cycles e 58 tokens exatos; p50 total estável em 1.241 ms, p95 1.502 ms por uma amostra de 1.502 ms; TTFT p50 1.159 ms e p95 1.420 ms. |
| `npm run bibble:benchmark:tool` | PASS / `exit 0` | 2 chamadas, 1 tool read-only, 1 ciclo, usage exato e `finishReason=stop`; total 2.135 ms, contra 2.128 ms anteriormente. |

**Atribuição comparativa:** a correção residual não introduziu regressão detectável. O escopo ganhou três testes, mantém ESLint/File List limpos, build aprovado, catálogo de 25 tools estável e contratos de chamada do provider inalterados. A variação de p95 da amostra curta não alterou p50, quantidade de chamadas, ciclos, tokens ou término; não configura regressão funcional.

**Veredito Forge de fechamento:** `CONCERNS`. O código Bibble passa integralmente nos gates direcionados, build e CLIs e está liberado para o Probe de confirmação e gates especializados. O repositório global continua com 18 falhas de teste externas e 11 erros-fonte externos duplicados em 12 diagnósticos por artefato `.next-chatbot-fix-verify`; não há falha Forge atribuível à transformação Bibble.

### Probe de Confirmação Definitivo — CONCERNS ✅ (2026-09-15)

Auditoria final executada sobre o lote residual, preservando todos os pareceres anteriores. Nenhum código, schema, migration ou banco foi alterado; somente este QA Result foi acrescentado. Os três bloqueios do Probe Final foram corrigidos e reproduzidos. O smoke visual autenticado permanece pendência manual não bloqueante e não foi alegado.

| Bloqueio residual | Resultado | Reprodução/evidência |
|---|---|---|
| Correlação no início e TTFT em decisão sem tool | **PASS** | `requestStartedAt` e `requestId` são criados nas primeiras linhas do `POST`, antes de deadline, `auth()` e montagem de contexto; o mesmo seed entra em `createBibbleMetrics`. No caminho com tools disponíveis em que a decisão devolve somente texto, `metrics.ttftMs` é marcado imediatamente antes do primeiro evento `text`. O teste dinâmico `marks TTFT when a tool-enabled decision returns visible final text` comprovou uma única chamada ao provider, TTFT numérico e texto no SSE. |
| Humor on → off, cancelamento e resposta tardia | **PASS funcional** | Ao desligar o toggle, o effect aborta os dois controllers, zera pendências, estados ativos e timestamps e limpa curiosidade/piada. Os fetches recebem `AbortSignal` e só promovem resultado se o sinal não estiver abortado. Além disso, `isCuriosidade`/`isPiada` dependem de `humorEnabled`, ocultando imediatamente a fala mesmo antes do effect. O contrato está coberto no teste de interrupção/runtime. |
| Reidratação Onyx sem fallback indevido | **PASS** | `loadSession` trata qualquer `!onyxRes.ok`, com mensagem específica para 409, limpa agente/sessão, seta `runtimeBlocked` e retorna antes do fallback nativo. Exceções seguem o mesmo fail-closed. Somente resposta `ok` com `onyx:false` prossegue para `/api/bibble/sessions`; resposta Onyx válida restaura `agentId`, e agente inexistente também bloqueia. `handleSend` retorna enquanto `runtimeBlocked` estiver ativo. |

#### Reconfirmação dos oito critérios anteriores

| # | Critério | Resultado definitivo |
|---|---|---|
| 1 | 25 capabilities públicas, zero filesystem | **PASS** — CLI retornou 25 e nenhuma tool FS. |
| 2 | RADAR sem tools exclusivas de análise | **PASS** — reprodução direta retornou somente `buscar_empresa` e `abrir_chamado`. |
| 3 | Deadline único, sinal do request e margem de mutação | **PASS / CONCERNS técnico não bloqueante** — relógio nasce na entrada, sinal é composto, saldo é propagado e mutações exigem margem. Adaptadores internos não cooperativos continuam dependentes de timeout próprio/margem, sem ampliar o prazo global. |
| 4 | `requestId`, TTFT e throughput pós-TTFT | **PASS** — os dois caminhos de primeiro texto marcam TTFT e a telemetria usa a duração de geração. |
| 5 | Humor desligado, inclusive transição | **PASS** — corpus operacional, abort, limpeza e guarda de render confirmados. |
| 6 | Reduced motion completo | **PASS estático** — loop, sprite, bolha e dots respeitam a preferência. |
| 7 | Runner real e interrupção automatizável | **PASS** — testes comprovam uma chamada sem tool, duas somente após tool call real, abort sem trabalho do provider e remoção do par não persistido. |
| 8 | Onyx `persona_id`, erro/409 e `onyx:false` | **PASS** — identidade válida é restaurada; erro/409 bloqueia runtime/envio; `onyx:false` é o único fallback nativo permitido. |

#### Execuções e integração

- `npx vitest run tests/bibble --coverage.enabled=false`: **PASS**, 15 arquivos e **110/110 testes** em 581 ms.
- `npm run bibble:capabilities`: **PASS**, exatamente **25 capabilities** e nenhuma tool de filesystem.
- Reprodução direta de autorização RADAR: **PASS**, saída `['buscar_empresa', 'abrir_chamado']`.
- Home IAlpha → `BibbleChatLayout` → `/api/bibble/chat` → policy/admission/deadline → completion/tool-loop → SSE/cliente → persistência: **PASS por código e testes direcionados**.
- Contexto same-origin das tabs, sugestões/permissões, identidade/reset Bibble↔Onyx, anexos trusted, contratos Zod, models/providers/rotas auxiliares, métricas e scripts CLI permanecem conectados conforme os gates positivos anteriores.
- O Forge de fechamento já registrou ESLint/File List e build verdes, doctor e benchmarks simples/tool verdes. Não foram simuladas novas execuções desses gates nesta etapa Probe.

**Pendências não bloqueantes:** smoke visual autenticado de teclado/screen reader/reduced-motion continua manual por ausência de ambiente autenticado; typecheck e suíte globais permanecem não verdes exclusivamente pelas dívidas externas já discriminadas pelo Forge. Métricas de admission/processo local (`queueMs=0` sem fila) são legítimas e não constituem falha funcional.

**Veredito Probe definitivo:** `CONCERNS` — **integração Bibble aprovada, sem bloqueio funcional remanescente atribuível à story**. Os três blockers finais foram fechados, os oito critérios foram reconfirmados e a suíte dirigida passou 110/110. As concerns restantes são validação visual autenticada e gates globais externos, não regressões do Bibble.

### Probe curto pós-hardening — FAIL ⛔ (2026-09-15)

Validação limitada ao delta de hardening. Nenhum código, schema, migration ou banco foi alterado; somente este QA Result foi acrescentado.

#### Gates confirmados

- **PASS:** `npx vitest run tests/bibble --coverage.enabled=false` — 16 arquivos, **116/116 testes**.
- **PASS:** `npm run bibble:capabilities` — exatamente **18 tools**, todas classificadas como read-only, sem filesystem e sem mutações.
- **PASS:** admission do chat é adquirido após autenticação/status e antes de `readRequestTextWithLimit(req)`; rejeições liberam lease/timer.
- **PASS:** o runner cria `Set` exclusivamente das tools filtradas para o turno e recusa qualquer tool call fora dele.
- **PASS:** o chat fixa `activeModel = BIBBLE_MODEL`; o modelo recebido do cliente não seleciona provider/modelo.
- **PASS:** Onyx exige PAT individual, agente permitido, sessão local pertencente ao usuário e vínculo agente/sessão remoto; ausência/divergência falha fechada. Anexos Onyx ficam bloqueados.
- **PASS:** upload Bibble adquire lease e retorna **503 fail-closed**, sem ler multipart nem criar Blob público.

#### Blockers reproduzidos

1. **UI oferece mutação removida:** `BibblePromptSuggestions.tsx` ainda exibe “Abrir chamado de suporte” e preenche “Preciso abrir um chamado...”, mas `abrir_chamado` foi removida de `BIBBLE_TOOLS`. O usuário é induzido a pedir uma capacidade que o runtime não pode executar.
2. **UI oferece anexos indisponíveis:** a sugestão “Analisar documento PDF”, o paperclip e o fluxo de seleção/upload continuam ativos, enquanto `/api/bibble/upload-to-blob` retorna 503 incondicionalmente. O resultado real é apenas “Falha no upload”, sem estado prévio de indisponibilidade.
3. **UI promete modelos que o chat não pode selecionar:** `BibbleSettingsPanel.tsx` ainda afirma que modelos externos configurados “aparecerão para todos os usuários” e mantém ações de configuração; `BibbleChatLayout` fixa `DEFAULT_MODEL`, ainda envia `model` no payload e mostra badge desse valor, enquanto o servidor ignora o campo e usa somente `BIBBLE_MODEL`. A interface pode anunciar um modelo diferente do runtime efetivo.

**Veredito Probe pós-hardening:** `FAIL`. As fronteiras backend solicitadas passam, mas a UI ainda promete/escolhe capacidades removidas ou indisponíveis. Corrigir os três pontos acima e repetir este Probe curto.

### Probe recheck dos blockers de UI — PASS ✅ (2026-09-15)

Recheck estrito dos três blockers anteriores, sem alteração de código, schema, migration ou banco.

- **PASS — chamado:** sugestões não contêm mais “Abrir chamado” nem promessa equivalente.
- **PASS — upload/PDF:** sugestões não oferecem análise de PDF; o input não contém `Paperclip` nem seletor de upload. O código legado de upload no layout ficou sem trigger visual, enquanto a rota permanece 503 fail-closed.
- **PASS — provider/modelo:** painel de configuração de provider/modelo e badge foram removidos; input/empty state não exibem seletor/modelo, e o payload do chat não envia mais `model`. O modelo efetivo permanece exclusivamente server-side.
- Testes estáticos dirigidos: `hardening-and-persona`, `attachment-security` e `interruption-and-runtime` — **3 arquivos, 31/31 testes PASS**.
- Backend reconfirmado pelo gate imediatamente anterior: **18 capabilities read-only**.

**Veredito Probe recheck:** `PASS`. Os três blockers de integração da UI foram fechados.

### Anubis Report — FAIL ⛔ (2026-09-15)

Auditoria de segurança executada após Forge e Probe sobre o working tree final. Foram revisados auth/status, autorização server-side, SSRF, providers/secrets, tools e prompt injection, filesystem, mutações, deadline/cancelamento, rate/concurrency, persistência, logs, XSS e blobs. Nenhum código, schema, migration, banco, blob ou serviço remoto foi alterado; somente este parecer foi acrescentado.

#### 🔴 CRITICAL

1. **Onyx opera como confused deputy com credencial administrativa e IDs controlados pelo cliente.** `POST /api/onyx/chat` aceita `agentId` e `onyxSessionId` sem provar que a persona é pública/própria nem que a sessão remota pertence ao usuário (`src/app/api/onyx/chat/route.ts:61-70`, `:175-188`, `:247-304`). Quando não existe PAT individual, `getUserOnyxToken` escolhe o PAT de qualquer Admin/CEO/TI e o client ainda possui fallback para `ONYX_API_KEY` (`src/lib/onyx/user-token.ts:9-32`, `src/lib/onyx/client.ts:24-40`). A enumeração também é facilitada porque `GET /api/onyx/agents/[id]` não chama `ensureCanManage`/não valida visibilidade (`src/app/api/onyx/agents/[id]/route.ts:39-55`). O mesmo padrão permite buscar qualquer `fileId` do Onyx sem vínculo com sessão/mensagem do usuário e carregar o corpo inteiro em memória (`src/app/api/onyx/file/[fileId]/route.ts:10-31`). **Reprodução segura por inspeção:** um usuário autenticado pode enviar `{ "agentId": <id_privado>, "onyxSessionId": <id_conhecido>, "message": "..." }`; o código encaminha ambos diretamente usando o token privilegiado. A chamada remota não foi executada para não tocar dados. **Correção exigida:** eliminar fallback de usuário comum para PAT admin/service; resolver e validar no servidor a visibilidade/ownership de `agentId`; vincular `onyxSessionId` a `BibbleSession.userId` e ao agente antes de enviar; vincular `fileId` a mensagem/sessão autorizada; falhar fechado se o vínculo não puder ser provado.

#### 🟠 HIGH

2. **Tool call fora do catálogo autorizado atravessa o guard comum.** O runner executa todo nome retornado pelo modelo sem conferir se ele pertence a `tools` daquele turno (`src/app/api/bibble/chat/route.ts:383-434`). O guard comum apenas valida `userId` e se o nome existe no registry global (`src/lib/bibble/tool-executor.ts:886-909`); não reaplica `authorizedTools`. Várias tools de Skills, metas e Onyx não fazem autorização interna equivalente. **Reprodução executada sem banco:** perfil `USER` sem permissões recebeu apenas `abrir_chamado` de `authorizedTools`, mas `executarTool('detalhes_curso', {}, ctx)` foi aceito pelo guard e respondeu `Informe o nome do curso.`, em vez de `Ferramenta indisponível`. **Correção exigida:** passar ao executor o conjunto imutável de nomes autorizados no turno, recusar qualquer nome fora dele e reaplicar a matriz role/permissão no guard comum; manter checks específicos como defesa adicional.

3. **O cliente escolhe provider/modelo externo com secrets e custo server-side.** `model` aceita qualquer string e vira `activeModel` sem allowlist (`src/lib/bibble/attachment-security.ts:142-153`, `src/app/api/bibble/chat/route.ts:678`, `:734`). Prefixos arbitrários `gpt-`, `claude-` e `gemini-` selecionam endpoints externos e chaves do servidor (`src/lib/bibble/client.ts:41-47`, `:94-126`). **Reprodução local:** `getProvider('gpt-attacker-model')`, `getProvider('claude-anything')` e `getProvider('gemini-anything')` retornaram, respectivamente, `openai`, `anthropic` e `google`. Assim qualquer usuário autenticado pode provocar cobrança e envio de prompt/anexos a um terceiro provider se a env estiver configurada. **Correção exigida:** resolver o modelo exclusivamente em catálogo server-side habilitado por política/role, ignorar ID fora da allowlist e negar provider sem autorização explícita; nunca inferir provider apenas por prefixo vindo do request.

4. **Mutações não estão vinculadas a intenção/confirmacão humana do turno.** O roteador inclui todas as tools de calendário, inclusive criar/editar/cancelar, até em pedidos apenas consultivos (`src/lib/bibble/tool-policy.ts:51-65`). O runner executa tool calls do modelo e o guard só verifica margem de deadline; `solicitouAbrirChamado` não é exigido para `abrir_chamado`, e criar/editar calendário não possuem nonce/intenção server-side (`src/app/api/bibble/chat/route.ts:397-434`, `src/lib/bibble/tool-executor.ts:890-909`). Histórico e resultados de tools são conteúdo não confiável, logo prompt injection indireta pode promover consulta a mutação. **Reprodução segura:** com `solicitouAbrirChamado=false`, `executarTool('abrir_chamado', {}, ctx)` alcançou o handler mutável e só parou por argumentos vazios. **Correção exigida:** separar tools read-only das mutáveis no roteamento; emitir mutável somente após classificar intenção explícita do texto atual; exigir nonce server-side, target e payload confirmados para efeitos destrutivos/sensíveis; recusar mutação que não conste no contrato do turno.

5. **Admission control ocorre depois das etapas caras e uploads não têm contenção.** No chat, lease/rate limit só é adquirido após auth, queries, base64, downloads e extração/Tika (`src/app/api/bibble/chat/route.ts:621-885`, lease em `:886`). `/api/bibble/upload-to-blob` aceita até 100 MB, persiste o blob e inicia extração/OCR com `maxDuration=600`, sem rate/concurrency/deadline compartilhado (`src/app/api/bibble/upload-to-blob/route.ts:13-66`). Retornos antecipados do chat também deixam o timer de até 100 s ativo, pois ele só é limpo no runner/caminhos pontuais (`src/app/api/bibble/chat/route.ts:621-652`, `:787-829`, `:886-925`). Um usuário autenticado pode paralelizar trabalho caro antes do 429 e consumir RAM, OCR, storage e workers. **Correção exigida:** adquirir lease imediatamente após auth/status e antes de ler/extrair corpo/anexo; aplicar quota de upload por usuário, limite de concorrência e deadline; fazer cleanup único em `finally` para todo retorno; transmitir `AbortSignal` ao Tika/OCR e cancelar trabalho subjacente.

6. **Blob “trusted” não prova store, ownership nem tamanho real, e anexos ficam públicos.** A validação aceita qualquer host que termine em `.blob.vercel-storage.com` com path `/bibble-chat/`, inclusive store de atacante (`src/lib/bibble/attachment-security.ts:76-113`); a reprodução local confirmou que `https://attacker-store.public.blob.vercel-storage.com/bibble-chat/payload` é aceita. `size` vem do cliente, mas downloads não conferem `Content-Length` nem limitam bytes; imagens usam `arrayBuffer()`/`blob()` integral (`src/app/api/bibble/chat/route.ts:225-250`, `src/app/api/onyx/chat/route.ts:199-209`). O upload oficial usa `access: "public"` (`src/app/api/bibble/upload-to-blob/route.ts:57-64`). **Correção exigida:** allowlist do hostname/store exato ou ID assinado server-side vinculado a user/session; streaming com teto real de bytes e Content-Type/magic bytes; blobs privados/proxy autenticado; não confiar em `size`, `name`, `type` ou `extractedContent` do cliente.

7. **Onyx expõe reasoning interno e recebe documentos não confiáveis em agentes com tools.** O proxy envia até 8.000 caracteres de `reasoning_delta` ao navegador (`src/app/api/onyx/chat/route.ts:314-349`), contrariando o contrato de não expor raciocínio e podendo revelar instruções/dados intermediários. Texto do anexo é concatenado diretamente à mensagem (`src/app/api/onyx/chat/route.ts:96-141`, `:190-195`) sem desativar tools do agente Onyx ou impor fronteira contra prompt injection. **Correção exigida:** descartar reasoning server-side; tratar anexo como dado delimitado; para documento, usar runtime sem tools mutáveis ou policy server-side que bloqueie tool calls derivadas de conteúdo; exigir confirmação fora do modelo para efeitos.

#### 🟡 MEDIUM

8. **Contratos CRUD permanecem parcialmente sem Zod/limite de corpo.** Embora criação e persistência de turno tenham schema e ownership, `PATCH` de projeto e sessão ainda usa cast de JSON sem schema/teto, aceita strings sem limite e lê corpo integral; listagem de projetos e histórico de sessão não possui paginação/teto de mensagens (`src/app/api/bibble/projects/[id]/route.ts:7-39`, `src/app/api/bibble/sessions/[id]/route.ts:13-58`). O cliente também pode declarar `tokenCountExact: true` e fornecer `assistantTokens`, logo a exatidão não tem origem confiável (`src/app/api/bibble/sessions/[id]/messages/route.ts:9-14`, `:29-37`). **Correção exigida:** Zod strict em todos os métodos, reader com limite de bytes, paginação/take, update/delete com predicate de ownership no write e tokens derivados somente de receipt assinado/estado server-side do turno.

9. **Logs e erros ainda carregam identificadores ou corpo remoto desnecessário.** Cancelamento registra `userId` e `googleEventId` em claro (`src/app/api/bibble/chat/route.ts:315-345`); o Onyx converte corpo de erro remoto em `OnyxError` e o registra integralmente (`src/app/api/onyx/chat/route.ts:306-308`, `:417-425`). Rotas de arquivo/sessão ainda devolvem mensagem crua do upstream em alguns catches (`src/app/api/onyx/file/[fileId]/route.ts:33-35`, `src/app/api/onyx/session/[id]/route.ts:112-115`). **Correção exigida:** requestId + códigos estáveis, hash/omit de IDs, nunca logar body remoto, resposta sanitizada e detalhes apenas em canal interno redigido.

#### 🟢 Controles confirmados

- `npx vitest run tests/bibble --coverage.enabled=false`: **15 arquivos, 110/110 testes PASS**.
- Filesystem público: **fail-closed**. A reprodução `executarTool('ler_arquivo', { caminho: '/etc/passwd' }, ctx)` retornou “Acesso a arquivos desabilitado” e não leu o alvo; as sete tools continuam fora das 25 capabilities públicas.
- SSRF de `/api/bibble/models?url=`: corrigido no contrato atual; a rota usa destino server-side e ignora URL do request.
- `.bibble/cloud-providers.json`: ausente e não rastreado; regra de ignore presente. POST/DELETE de providers não persistem chaves.
- Contexto de aba Bibble valida `origin`, `source`, registry e permissão antes de compor o prompt. ReactMarkdown não habilita HTML bruto; não foi encontrado `dangerouslySetInnerHTML` no escopo Bibble.
- Auth global revalida status ativo do usuário. O cookie de sessão é `httpOnly`, `SameSite=Lax` e `Secure` em produção; isso reduz CSRF cross-site, embora mutations críticas ainda devam usar confirmação/nonce próprio.

#### Veredito

**`FAIL` — 1 CRITICAL, 6 HIGH, 2 MEDIUM.** A implementação não pode ser sinalizada como concluída nem avançar para Lens/Sage enquanto o confused deputy/IDOR do Onyx, o bypass de autorização de tools e a seleção arbitrária de providers permanecerem exploráveis. Os achados 4–7 também são P1 e bloqueiam entrega. Retornar ao Developer, corrigir, acrescentar testes negativos de autorização e repetir Forge → Probe → Anubis. Nenhuma correção acima exige mudança de schema; se for proposto vínculo persistente novo para Onyx/blob, deve ir para story separada com Vault, backup válido e confirmação explícita.

### Anubis Recheck Final — CONCERNS ⚠️ (2026-09-15)

Reauditoria estrita dos nove achados anteriores após hardening e sincronização da UI. Nenhum código, banco, blob ou serviço remoto foi alterado.

| Finding anterior | Resultado final | Evidência |
|---|---|---|
| CRITICAL — Onyx confused deputy/IDOR | **FECHADO** | `getUserOnyxToken` não usa PAT admin/service; chat exige PAT individual, `userCanUseAgent`, `painelSessionId` próprio, vínculo exato de `onyxSessionId` e `persona_id`; detalhe de agente valida visibilidade; proxy de `fileId` falha fechado em 403. |
| HIGH — tool fora do catálogo do turno | **FECHADO** | Runner cria `authorizedToolNames` e recusa nome externo antes do executor; executor reaplica `authorizedTools`. Reprodução sem banco: `detalhes_curso` para usuário sem permissão retornou `Ferramenta indisponível para este usuário`. |
| HIGH — model/provider controlado pelo cliente | **FECHADO** | Chat usa exclusivamente `const activeModel = BIBBLE_MODEL`; `modelOverride` não existe no handler. |
| HIGH — mutação sem intenção/nonce | **FECHADO por contenção** | Catálogo público contém 18 tools e nenhuma marcada mutável; executor recusa toda `BIBBLE_MUTATING_TOOLS`. Reprodução de `abrir_chamado` retornou `Ferramenta indisponível`. |
| HIGH — admission tardio/upload caro | **FECHADO com resíduo LOW/MEDIUM** | Lease do chat nasce após auth/status e antes do body/permissões/anexos; upload oficial adquire lease e retorna 503 sem ler/persistir arquivo. Restam timers de deadline não limpos nos retornos 401/403 anteriores ao lease (`chat/route.ts:583-601`), com vida máxima limitada ao deadline. |
| HIGH — blob sem store/ownership/teto | **FECHADO por contenção** | Host exige igualdade com env, namespace HMAC por usuário é validado e `extractedContent` do cliente é descartado; upload está 503 e a UI não envia anexos. |
| HIGH — Onyx reasoning/anexo com tools | **FECHADO** | Qualquer `files.length` recebe 403 antes do runtime; `reasoning_*` é descartado e não vira SSE. |
| MEDIUM — CRUD/Zod/token exato | **PARCIAL / PENDENTE** | O turno continua transacional e com ownership/Zod, mas `PATCH` de projeto/sessão ainda usa cast de `req.json()` sem Zod/limite, GET de histórico segue sem paginação, e `tokenCountExact: true` ainda é declaração do cliente (`projects/[id]/route.ts:22-29`, `sessions/[id]/route.ts:23-35,51-55`, `sessions/[id]/messages/route.ts:9-14,29-37`). |
| MEDIUM — logs/erros sensíveis | **FECHADO** | Logs Onyx agora registram código/status estável; reasoning/body remoto e IDs de calendário não são logados no fluxo ativo; client cancela body de erro e retorna mensagem sanitizada. |

#### Testes e reproduções

- `npx vitest run tests/bibble --coverage.enabled=false`: **16 arquivos, 117/117 PASS**.
- `npm run bibble:capabilities`: **18 tools**, todas classificadas não mutáveis pelo contrato atual.
- Reproduções locais negativas: tool não autorizada recusada; mutação recusada; nenhuma consulta a banco, arquivo sensível ou serviço remoto foi executada.
- `tests/bibble/onyx-security-boundaries.test.ts` cobre ausência de fallback PAT, agent/session ownership, anexos Onyx, reasoning e `fileId` fail-closed.

#### Veredito

**`CONCERNS` — zero CRITICAL e zero HIGH remanescentes; um MEDIUM anterior permanece parcial e há um resíduo de cleanup de timer.** As explorações P0/P1 que reprovaram o gate anterior foram fechadas. Para `PASS` integral e aderência ao AC 52/regras Anubis, ainda é necessário aplicar Zod + limite de bytes aos PATCHes, paginar o histórico, remover a confiança em `tokenCountExact` do cliente e limpar o deadline timer também nos retornos pré-lease. Nenhuma dessas correções exige migration ou acesso ao banco.

### Anubis — Confirmação dos 4 MEDIUM — CONCERNS ⚠️ (2026-09-15)

Revalidação limitada aos quatro resíduos do recheck anterior, sem alteração de código, banco ou serviço:

| Resíduo | Resultado | Evidência |
|---|---|---|
| Zod + limite de corpo nos PATCHes | **FECHADO** | Projeto usa `projectPatchSchema` strict e reader de 32 KiB; sessão usa `sessionPatchSchema` strict e reader de 4 KiB. Ambos validam same-origin quando `Origin` está presente. |
| Paginação do histórico | **FECHADO** | GET de sessão valida `page/limit`, limita a 100 mensagens e usa `skip/take + 1` com `hasMore`. |
| Contagem exata confiada ao cliente | **PARCIAL / MEDIUM** | `tokenCountExact` e `assistantTokens` foram removidos do contrato, fechando a falsificação pelo cliente. Porém a rota calcula `Math.ceil(assistantContent.length / 4)` e grava esse valor estimado em `BibbleMessage.tokens` (`src/app/api/bibble/sessions/[id]/messages/route.ts:27-37`). Isso contraria AC 48, que proíbe persistir estimativa como contagem exata e permite `null`. Correção: persistir `tokens: null` até a contagem exata vir de estado/receipt server-side confiável. |
| Cleanup do deadline pré-lease | **FECHADO** | `rejectBeforeLease` limpa timer e listener nos retornos 401/403/429/504; `rejectEarly` libera lease e timer depois da admissão. |

Teste executado: `npx vitest run tests/bibble --coverage.enabled=false` — **16 arquivos, 118/118 PASS**. O teste novo comprova remoção dos campos de token controlados pelo cliente, mas não detecta que a estimativa passou a ser persistida no mesmo campo.

**Veredito final desta confirmação: `CONCERNS` — zero CRITICAL, zero HIGH e um MEDIUM restante.** Não existe bloqueio P0/P1; falta somente manter `tokens=null` enquanto não houver contagem exata server-side para obter `PASS` integral.

### Anubis — PASS Final ✅ (2026-09-15)

Confirmação estritamente limitada ao último finding: `src/app/api/bibble/sessions/[id]/messages/route.ts:35` persiste agora `tokens: null`; `tokenCountExact`, `assistantTokens` e a estimativa `chars/4` não fazem parte do contrato nem da gravação. O teste de contrato também exige `content: assistantContent, tokens: null`.

**Veredito Anubis final: `PASS` — zero CRITICAL, zero HIGH e zero MEDIUM remanescentes entre os findings auditados.**

### Forge Gate curto pós-hardening — PASS direcionado ✅ (2026-09-15)

Rechecagem urgente do delta de hardening, limitada aos gates solicitados. O Forge não alterou código, schema, migration, banco ou serviço externo; somente registrou estas evidências. Os gates globais já conhecidos não foram repetidos por orientação explícita desta rodada.

| Verificação | Resultado | Evidência objetiva |
|---|---|---|
| Suíte Bibble completa | **PASS** | `npx vitest run tests/bibble --coverage.enabled=false`: **16 arquivos, 116/116 testes**, exit code 0, duração total 561 ms. Evolução de +6 testes sobre o baseline anterior de 110/110. |
| ESLint da File List | **PASS** | **49 arquivos executáveis existentes** extraídos da File List e validados com heap de 8 GB; zero erro e zero warning, exit code 0. |
| Integridade do diff | **PASS** | `git diff --check`: sem saída, exit code 0. |
| Capabilities públicas | **PASS** | `npm run bibble:capabilities`: `count: 18`, exatamente o contrato esperado após o hardening; nenhuma tool pública de filesystem e nenhuma mutação de calendário exposta. |
| Build de produção | **PASS após retry ambiental** | Primeira tentativa falhou exclusivamente ao baixar `GeistMono` de `fonts.gstatic.com`; repetição imediata concluiu com exit code 0, compilação Next.js em 17,7 s e **78 páginas estáticas** geradas. Permaneceram apenas os warnings já conhecidos de `pdfjs-polyfill`. |

**Atribuição:** não foi identificada regressão de teste, lint, diff, catálogo público ou build atribuível aos arquivos da story. A falha inicial do build foi transitória de rede e não se reproduziu.

**Veredito Forge desta rodada:** `PASS` no gate curto pós-hardening. Este parecer confirma somente os gates acima e **não revoga nem substitui** o `FAIL` de segurança do Anubis registrado anteriormente; o fluxo deve prosseguir para nova verificação Probe/Anubis do hardening antes de qualquer sinalização de conclusão.

### QA Results — Lens Review Final ✅ (2026-09-15)

Revisão final do delta após Forge, Probe e Anubis aprovarem. Foram inspecionados os contratos de geração única/streaming, SSE, autorização e roteamento de tools, persistência atômica, contexto de módulo, identidade Bibble/Onyx e compatibilidade dos consumidores. Evidências herdadas do gate: build de produção PASS, ESLint escopado PASS, suíte Bibble 118/118 PASS e recheck complementar 15/15 PASS.

#### 🔴 BLOQUEANTE (0 issues)

Nenhum blocker concreto de segurança, correção ou compatibilidade foi encontrado no estado final revisado.

#### 🟡 IMPORTANTE (0 issues)

Nenhuma ressalva impeditiva remanescente. As contenções visíveis — tools mutáveis/filesystem fora do catálogo público, anexos indisponíveis até storage privado e provider/modelo definidos no servidor — são fail-closed deliberado, estão refletidas na UI e não constituem promessa falsa ao usuário.

#### 🟢 SUGESTÃO (1 issue)

**`src/components/BibbleChatHome/BibbleChatLayout.tsx` / `BibbleChatInput.tsx`**
O layout ainda preserva estado/callbacks legados de upload, enquanto o input não expõe mais o seletor e a rota responde 503. Isso não cria fluxo alcançável nem regressão de segurança, mas pode ser removido em limpeza futura quando o storage privado ganhar story própria, reduzindo superfície morta sem misturar essa entrega com expansão de escopo.

#### Veredicto

✅ **APROVADO (PASS)**

Nota qualitativa: o delta final está coerente com a arquitetura fail-closed adotada, preserva os consumidores SSE e fecha os riscos P0/P1 sem introduzir schema ou dependência persistente nova.

### Sage/Quinn — QA final de cobertura e edge cases ⚠️ (2026-09-15)

Validação final exclusivamente read-only do estado corrente, posterior aos pareceres Lens e Anubis. Nenhum código, schema, migration, banco ou serviço externo foi alterado.

#### Evidência executada

- `npx vitest run tests/bibble --coverage.enabled=false`: **PASS — 16 arquivos, 118/118 testes**, exit code 0, 437 ms.
- Recheck dirigido de runner, tokens/persistência, policies, segurança, interrupção, Onyx e contratos de UI: **PASS — 7 arquivos, 43/43 testes**, exit code 0.
- Recheck dirigido de protocolo SSE, anexos e restauração antes da persistência: **PASS — 3 arquivos, 25/25 testes**, exit code 0.
- `npm run bibble:capabilities`: **PASS — 18 capabilities server-side**, sem filesystem público e sem mutação exposta.
- `git diff --check`: **PASS**, sem erro de whitespace.

#### Cobertura confirmada

- **Geração/runner:** uma chamada ao provider no chat comum; duas apenas após tool call real; tool injetada fora do conjunto exato do turno é recusada; abort anterior à geração não aciona provider.
- **Tokens/persistência:** par user/assistant gravado em transação; campos de contagem controlados pelo cliente não existem; `BibbleMessage.tokens` permanece `null` sem receipt exato server-side; falha/interrupção remove o par otimista e não persiste resposta incompleta.
- **Policy e segurança:** endpoint do provider é server-side; admission rejeita concorrência; filesystem falha fechado e bloqueia symlink escape; capabilities respeitam role/permissão; catálogo público contém somente 18 tools read-only; UI não promete upload, mutação ou seleção de provider indisponível.
- **Onyx:** não há fallback para PAT administrativo; agente, sessão e arquivo falham fechados sem vínculo; anexos são rejeitados; reasoning interno não é propagado ao navegador.
- **Streaming/interrupção/UI:** SSE exige `done.successful`, rejeita EOF parcial e truncamento; TTFT e throughput pós-TTFT são exercitados; reduced motion, humor desligado e troca de runtime possuem contratos automatizados.

#### Gaps legítimos, não atribuíveis ao delta

- Não há smoke autenticado de browser com teclado, leitor de tela e preferência real de reduced motion; a cobertura de UI desta rodada é contratual/estática, não visual E2E.
- Persistência atômica foi validada por contrato e testes isolados, sem induzir indisponibilidade em banco real nesta rodada.
- Os gates globais do repositório continuam com dívidas externas já registradas pelo Forge (`typecheck` e suíte global), e o CodeRabbit permanece indisponível; os gates direcionados do Bibble e o build estão verdes.
- A story ainda conserva `Status: InProgress` e checkboxes antigos nas Tasks 5, 12 e 14. O papel QA não tem autorização para alterar Status, Tasks/Subtasks ou checklist fora desta seção.

#### Veredito

**`CONCERNS` — zero falha no escopo Bibble (118/118 PASS), zero finding funcional ou de segurança remanescente; ressalvas limitadas a evidência visual/autenticada e gates globais externos.** O delta Bibble está aprovado tecnicamente no escopo dirigido, mas a story não deve alegar que todos os quality gates globais passaram enquanto os registros acima permanecerem verdadeiros.
