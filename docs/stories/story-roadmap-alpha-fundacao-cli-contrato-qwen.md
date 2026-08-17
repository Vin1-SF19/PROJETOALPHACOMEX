# Story: Roadmap Alpha — fundação CLI, catálogo e contrato Qwen

## Status

Ready for Review

## Executor Assignment

- executor: `@dev`
- quality_gate: `@architect`
- quality_gate_tools: `["lint", "typecheck", "test", "build", "coderabbit"]`

## Story

**Como** mantenedor do Roadmap Alpha,
**quero** validar por CLI o catálogo de módulos e a configuração exata do Qwen 3.8, além de congelar o contrato dos prompts,
**para que** a futura fila e a UI sejam construídas sobre uma fundação segura, testável e sem inventar contratos durante a implementação.

## Escopo

Fundação estritamente read-only e CLI-first. Não inclui UI, CRUD, banco, schema, migration, fila, worker, filesystem de artefatos, cron ou deploy.

## Critérios de aceitação

1. `roadmap:doctor` carrega `.env` e depois `.env.local` com override, valida configuração/catálogo e consulta `/api/tags` com timeout.
2. `ROADMAP_QWEN_MODEL` é obrigatório, trimado, começa com `qwen3.8` e precisa corresponder exatamente a uma tag retornada; não há fallback.
3. O doctor reutiliza `getOllamaHeaders`, nunca imprime URL, token, Authorization, valores brutos de env ou resposta bruta do servidor.
4. O doctor classifica timeout, DNS, 401/403, HTTP não-2xx, JSON inválido e tag ausente com mensagens sanitizadas.
5. `roadmap:check-modules` é o nome canônico e audita 100% de `MODULOS_REGISTRY`, sem filtro de permissão/admin/visibilidade e sem escrever nada. `roadmap:sync-modules` é um alias de compatibilidade estritamente read-only para a mesma auditoria.
6. A auditoria reporta contagem, IDs duplicados, campos inválidos e snapshot sanitizado de `id`, `label`, `href`, `category` e `permission`.
7. Os dois comandos emitem JSON no formato `{ ok, command, code, checks, timestamp }`.
8. Exit code `0` significa saudável/válido; `1`, endpoint/modelo indisponível; `2`, configuração/catálogo/contrato inválido.
9. O catálogo Roadmap é server-only e deriva diretamente de `MODULOS_REGISTRY`.
10. O contrato Zod do objetivo é estrito e versionado:
    - `contractVersion: 1`;
    - `moduleKey`: 1–80 caracteres e ID presente no catálogo;
    - `title`: 3–180;
    - `description`: 10–10.000;
    - `desiredOutcome`: opcional, máximo 4.000;
    - `constraints`: opcional, máximo 8.000;
    - `acceptanceCriteria`: 1–50 itens, cada um com 3–500;
    - `globalPriority`: inteiro entre 1 e 9.999.
11. O manifesto Zod é estrito e versionado:
    - `contractVersion: 1`;
    - `summary`: 20–2.000;
    - `phases`: 2–24 itens e máximo total de 1.000.000 caracteres Markdown.
12. Cada fase é estrita e contém:
    - `number`: inteiro 0–99;
    - `slug`: 1–80, somente `[a-z0-9]+(?:-[a-z0-9]+)*`;
    - `title`: 3–140;
    - `kind`: `CONTEXT | EXECUTION | VERIFICATION | CLOSURE`;
    - `agent`: catálogo fechado `context | scout | vault | iris | echo | nova | cortex | anubis | forge | probe | lens | sage | scribe | kowalski | dev`;
    - `dependsOn`: 0–10 números de fases anteriores, sem duplicidade;
    - `markdown`: 100–50.000 caracteres.
13. As fases são únicas, contíguas e começam em `0`; a fase `0` é `CONTEXT/context`; há ao menos uma fase `EXECUTION`; dependências apontam somente para fases anteriores.
14. Slug não aceita ponto, slash, backslash, espaços, caminho absoluto ou `..`; filename futuro será sempre criado pela aplicação como `NN-slug.md`.
15. Schemas rejeitam chaves desconhecidas e conteúdo parcial.
16. `zod` passa a ser dependência direta do projeto, eliminando dependência transitiva acidental.
17. Testes usam `env` e `fetch` injetáveis e nunca acessam rede real.
18. Testes cobrem env ausente, prefixo inválido, tag semelhante mas não exata, endpoint indisponível, timeout, 401/403, HTTP não-2xx, JSON inválido, duplicidade de módulos e não vazamento de segredos.
19. Lint direcionado, typecheck, testes direcionados e build não apresentam regressão causada pela story.

## Tasks

- [x] Criar catálogo server-only e auditoria read-only (AC 5, 6, 9).
- [x] Criar schemas Zod e regras cruzadas (AC 10–16).
- [x] Criar runtime config e doctor com dependências injetáveis (AC 1–4, 7, 8).
- [x] Criar CLI e scripts no `package.json` (AC 1, 5, 7, 8).
- [x] Declarar `zod` diretamente (AC 16).
- [x] Criar testes unitários sem rede real (AC 17, 18).
- [x] Executar gates e atualizar esta story (AC 19).

## Fora do escopo

- UI, Server Actions, persistência, schema/migration, criação de objetivos, fila, geração real, escrita em `prompt-phases`, cron e deploy.
- Alterar o registry ou permissões existentes.

## Notas técnicas

- A disponibilidade da tag configurada é tratada como não verificada até o `roadmap:doctor` consultar o servidor; nenhuma tag é fixada no código.
- `.env.example` documenta apenas `ROADMAP_QWEN_MODEL=` sem valor secreto.
- A implementação reutiliza o header autenticado já existente, mantendo configuração somente no servidor.
- Fontes: `docs/stories/story-roadmap-alpha-objetivos-prompt-phases-qwen.md`, `src/lib/modulos-registry.ts`, `src/lib/bibble/client.ts`, `prompt-phases/README.md` e `.aiox-core/constitution.md`.

## Testing

- Unitários para catálogo, schemas, config e doctor.
- Fetch e env sempre injetados nos testes.
- Gates: ESLint direcionado, `npm run typecheck`, testes direcionados, `npm run build` e CodeRabbit quando disponível.

## CodeRabbit Integration

### Story Type Analysis

- Primary type: CLI/Integration.
- Secondary types: Security e Architecture.
- Complexity: Medium.
- Integration enabled: true.

### Quality Gate Tasks

- [x] Pre-Commit (`@dev`): revisar alterações não commitadas e executar lint, typecheck e testes direcionados.
- [ ] Pre-PR (`@architect`): revisar contrato, segurança, compatibilidade e resultado do build.

### Self-Healing Configuration

- Primary agent: `@dev`, modo light.
- Max iterations: 2.
- Timeout: 15 minutos.
- Severity filter: CRITICAL.
- CRITICAL: auto-fix; HIGH: documentar; MEDIUM/LOW: registrar sem auto-fix.

### Focus Areas

- Vazamento de segredo e sanitização do JSON de saída.
- Validação estrita e invariantes cruzadas dos contratos.
- Rede completamente mockada nos testes.
- Dependência server-only do catálogo e compatibilidade do CLI.

## Predicted File List

- `docs/stories/story-roadmap-alpha-fundacao-cli-contrato-qwen.md`
- `src/lib/roadmap-alpha/catalog.ts`
- `src/lib/roadmap-alpha/contracts.ts`
- `src/lib/roadmap-alpha/doctor.ts`
- `src/lib/roadmap-alpha/runtime-config.ts`
- `scripts/roadmap-alpha.mjs`
- `tests/roadmap-alpha/catalog.test.ts`
- `tests/roadmap-alpha/contracts.test.ts`
- `tests/roadmap-alpha/doctor.test.ts`
- `package.json`
- `package-lock.json`
- `.env.example`

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-08-15 | 0.1.0 | Recorte CLI-first criado a partir da story principal. | River (`@sm`) |
| 2026-08-15 | 0.2.0 | Contratos, comandos, gates e critérios de prontidão detalhados após revisão. | `@po` / Codex |
| 2026-08-15 | 1.0.0 | Story validada com veredito GO e implementação CLI-first iniciada. | `@po` / `@dev` |

## Dev Agent Record

### Agent Model Used

Codex (GPT-5)

### Completion Notes

- Catálogo read-only criado a partir de todos os módulos do registry, incluindo módulos ocultos e administrativos; após registrar o próprio Roadmap, o catálogo possui 34 módulos.
- Contratos Zod estritos e versionados implementados para objetivos, manifestos e fases.
- CLI implementado com `roadmap:doctor`, `roadmap:check-modules` e alias `roadmap:sync-modules`.
- O diagnóstico real confirmou a tag exata configurada `qwen3.8:27b`, sem imprimir URL, token ou headers.
- 20 testes direcionados passaram; ESLint direcionado passou.
- `npm run build` passou integralmente após a parada controlada dos processos locais que mantinham a DLL do Prisma aberta.
- O typecheck não apresentou erros nos arquivos desta story; permanece interrompido por cinco diagnósticos preexistentes fora do Roadmap Alpha.
- CodeRabbit não está disponível nesta sessão; o gate Pre-PR permanece pendente.

### File List

- `.env.example`
- `docs/stories/story-roadmap-alpha-fundacao-cli-contrato-qwen.md`
- `package-lock.json`
- `package.json`
- `scripts/roadmap-alpha.mjs`
- `src/lib/bibble/client.ts`
- `src/lib/roadmap-alpha/catalog.ts`
- `src/lib/roadmap-alpha/contracts.ts`
- `src/lib/roadmap-alpha/doctor.ts`
- `src/lib/roadmap-alpha/runtime-config.ts`
- `tests/roadmap-alpha/catalog.test.ts`
- `tests/roadmap-alpha/contracts.test.ts`
- `tests/roadmap-alpha/doctor.test.ts`

## QA Results

- `PASS` — ESLint direcionado, 20 testes unitários, auditoria dos 34 módulos, aliases CLI, doctor real e build Next passaram.
- `KNOWN BASELINE` — typecheck mantém cinco erros preexistentes fora do escopo; nenhum diagnóstico aponta para arquivos do Roadmap.
- `PASS` — o wrapper completo `npm run build`, incluindo `prisma generate`, concluiu com sucesso.
- Revisão formal Pre-PR/CodeRabbit permanece pendente.
