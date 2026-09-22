# RM-2026-6F4E3F — Edição local de campos GLOBAL com fonte

Status: Implementada; revalidação local com FAIL nos gates globais (ver evidências mais recentes)

## Objetivo e blueprint Scout
Usuários autorizados editam CNPJ e demais GLOBAL com fonte no formulário do card.
Blueprint recebido da Fase 0 e conferido: PainelCamposEtapaAtual, DTO em
requisitos-etapa-server, validador campos-dinamicos e AtualizarCardBpm.
Autoajuste: corrigir bloqueios/leitura no servidor e criar esta story.
Também conferir comando compartilhado de transição. Sem schema/migration.

## Critérios e checklist
- [x] Fonte automática não bloqueia edição; selo automático permanece.
- [x] Valor local não vazio prevalece; limpar restaura fonte na próxima leitura.
- [x] Preservar CNPJ válido, bloqueios explícitos, perfis e mapeamentos.
- [x] Regime tributário explicitamente protegido permanece canônico.
- [x] Persistência por card sem escrita na entidade mestre, auth/Zod/CAS preservados.
- [x] Executar lint, typecheck, testes e build; registrar resultados.
- [ ] Validar editar/salvar/reabrir em navegador autenticado.

## Entregabilidade
Artefato: editor existente integrado ao DTO e persistência por card.
Consumidor: usuário autorizado em /PainelAlpha/AlphaCRM/pipeline/[pipelineId]
→ abrir card → Formulário da Etapa → CardOpenFormSlot → PainelCamposEtapaAtual.
Caminho conferido no código; configuração real do pipeline e navegador pendentes.

## File list
- docs/stories/story-rm-2026-6f4e3f-edicao-global-fonte.md
- src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx
- src/lib/bpm/requisitos-etapa-server.ts
- src/lib/bpm/campos-dinamicos.ts
- src/actions/bpm/Cards.ts
- src/lib/bpm/transicao-command.ts

## Evidências da execução
Autoajustes aplicados no DTO, validação, leitura e transição; flags da definição
também preservadas no DTO. Sem alteração de auth/Zod/CAS ou entidade mestre.
Regime tributário conserva restrições explícitas; configuração real não consultada.
Não houve banco, migration ou Git mutável. Delegação indisponível (erro da ferramenta);
nenhuma aprovação independente de Forge/Probe/Anubis/Lens foi obtida.
- npm run lint: exit 1; log .roadmap-worker/rm-2026-6f4e3f-gates/gate-0.log.
- npm run typecheck: exit 2; log .roadmap-worker/rm-2026-6f4e3f-gates/gate-1.log.
- npm test: exit 1; log .roadmap-worker/rm-2026-6f4e3f-gates/gate-2.log.
- npm run build: exit 0; log .roadmap-worker/rm-2026-6f4e3f-gates/gate-3.log.
- npx tsc --noEmit: 134.

Testes direcionados (resultado real):
```text

 RUN  v4.1.10 /home/ialpha/projetos/alpha-comex/painel-alpha


 Test Files  6 passed (6)
      Tests  84 passed (84)
   Start at  15:18:11
   Duration  870ms (transform 575ms, setup 0ms, import 1.28s, tests 42ms, environment 0ms)


```

DELIVERY_READY: caminho validado no código: pipeline → card → Formulário da Etapa → editor → AtualizarCardBpm. Validação autenticada em navegador pendente.

File list adicional:
- tests/bpm/requisitos-etapa-server.test.ts
- tests/bpm/edicao-campos-card.test.ts
- tests/bpm/campos-dinamicos.test.ts
- .bibble/memory/journal.md
- .bibble/memory/decisions.md

Correção final: removida propriedade valor da fixture de camposBase (Omit).
Typecheck repetido: exit 0.
Build aprovado (exit 0). Lint focado sem diagnósticos. Lint global: 2417 erros/1218 avisos (débito pré-existente do repositório, não introduzido por esta mudança); npm test bloqueado por EBUSY em coverage (trava de ambiente, não falha de código). npx tsc sem limite ampliado terminou por OOM; script typecheck usa limite do projeto.
Resultado da sessão anterior: FAIL por gates globais pré-existentes, apesar dos 84 testes direcionados aprovados, build e typecheck (com limite do projeto) verdes.

### Revisão desta sessão (2026-09-22)
Reinspecionei estaticamente todos os arquivos da file list e confirmei que o contrato funcional dos 5 requisitos da Fase 1 está implementado e consistente: `PainelCamposEtapaAtual.tsx:230-231` (somenteLeitura sem bloqueio GLOBAL+fonteEntidade; selo "· automático" independente), `requisitos-etapa-server.ts:388-402` (prevalência do valor local não vazio, fallback ao canônico), `campos-dinamicos.ts:77-91` (CNPJ validado, somenteLeitura/editavel explícitos ainda bloqueiam, string vazia aceita para reativar fallback), `Cards.ts:1884-1327` e `transicao-command.ts:524-533` (persistência por card, sem escrita na entidade mestre, `idsGlobais` exclui campos com `fonteEntidade` do armazenamento global), `CampoBpmInput.tsx:61,177-196` (`bloqueado = disabled || readOnly`; CNPJ editável quando não bloqueado). Catálogo de ferramentas desta sessão (Read/Grep/Glob/Edit/Write) não inclui shell, então os gates não foram reexecutados aqui; os resultados acima são os da última execução real registrada. Validação em navegador autenticado permanece pendente (fora do catálogo desta sessão).

### Revalidação Nova com shell — 2026-09-22

Implementação existente preservada, sem alteração funcional nesta sessão. Blueprint
Scout revalidado na UI, DTO, validador, persistência e transição. O override local
não vazio prevalece para GLOBAL com fonte editável; vazio/espaços restauram o
canônico. Flags explícitas e mapeamentos continuam protegidos. Auth, Zod,
permissão editarCard e upsert por card continuam presentes. Nenhum novo componente.

- [x] Revalidar implementação e caminho de consumo no código.
- [x] Reexecutar os comandos obrigatórios com resultados reais.
- [ ] Aprovar gates globais: lint falhou; suíte completa bloqueada por EBUSY.
- [ ] Confirmar interação e configuração real em navegador autenticado.

Resultados desta execução (não herdados):
- 5 arquivos de testes direcionados: 78 testes aprovados, exit 0.
- ESLint dos 5 arquivos da implementação: exit 0.
- npm run lint: exit 1; 2417 erros e 1218 avisos, mesma contagem histórica.
- npm run typecheck: exit 0.
- NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit: exit 0.
- npm test: exit 1 antes dos testes, EBUSY ao remover coverage; diretório preservado.
- npm run build: exit 0.

Logs: .roadmap-worker/rm-2026-6f4e3f-recheck-20260922/ (results.json e logs por gate).
DELIVERY_READY: caminho validado no código para usuários autorizados:
/PainelAlpha/AlphaCRM/pipeline/[pipelineId] → abrir card → Formulário da Etapa
→ PainelCamposEtapaAtual → AtualizarCardBpm. Sem validação em navegador nesta execução.

Arquivos documentais atualizados: esta story e .bibble/memory/journal.md.
Build também regenera seus artefatos usuais; nenhuma alteração intencional de código,
schema, dados ou Git mutável. RESULT: FAIL por gates globais, sem atribuir a falha
do lint a este ajuste e sem declarar aprovação independente dos demais agentes.
