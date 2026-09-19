# Story: Virtus — Gate Final Manual de Produção

## Status

Ready for Review

## Story

**Como** responsável por uma atualização do Painel Alpha,
**quero** invocar manualmente o agente Virtus ao final do trabalho,
**para que** build, testes e produção sejam avaliados antes de qualquer commit e push.

## Contexto

Virtus é o último gate antes de produção, mas não participa do planejamento automático do Roadmap Alpha. Sua ativação ocorre somente pelo comando `/virtus`. O agente executa e analisa os gates aplicáveis, apresenta seu veredicto e pergunta literalmente `Deseja que eu faça o commit e o push para produção agora?`. Commit e push exigem confirmação explícita do usuário.

## Critérios de aceitação

1. O catálogo de fallback do Painel Alpha expõe `Virtus`, com o título `Guardião Final de Produção` e ícone próprio.
2. O atalho `/virtus` aponta para a skill local instalada e declara ativação exclusivamente manual.
3. A skill é `user-invocable`, executa os gates finais e tem autoridade para commit e push somente depois da confirmação explícita.
4. Virtus não integra `ROADMAP_PHASE_AGENTS`, o gerador Qwen nem outro planejador ou executor automático.
5. Um teste focal protege a identidade, a frase canônica de confirmação, a autoridade condicionada e a exclusão dos fluxos automáticos.
6. Nenhum schema, migration, seed, backfill, dado ou outra estrutura de banco é alterada.

## Fora do escopo

- Acionar Virtus automaticamente ao terminar uma fase ou atualização.
- Adicionar Virtus à lista de agentes selecionáveis pelo Roadmap Alpha ou Qwen.
- Executar commit, push, deploy ou alteração de produção durante esta story.
- Alterar banco de dados.

## Tarefas / Subtarefas

- [x] **Task 1 — Integrar a identidade no Painel Alpha** (AC: 1–2)
  - [x] Adicionar os metadados de fallback de Virtus.
  - [x] Registrar o atalho exclusivamente manual `/virtus`.
- [x] **Task 2 — Proteger o contrato operacional** (AC: 3–5)
  - [x] Validar a skill instalada, o frontmatter e a pergunta de confirmação.
  - [x] Validar a autoridade condicionada para commit e push.
  - [x] Garantir que Virtus permaneça fora do Roadmap e do Qwen automáticos.
- [x] **Task 3 — Validar segurança de dados** (AC: 6)
  - [x] Confirmar que a entrega não altera banco, schema ou migrations.

## Decisões técnicas

- Manter Virtus somente no fallback de metadados e no atalho manual; não incluí-lo em `ROADMAP_PHASE_AGENTS` preserva a barreira contra ativação automática.
- Testar o arquivo rastreado `.agents/skills/virtus/SKILL.md` como fonte do contrato operacional instalado.
- Usar `🏛️` como ícone de Virtus, representando o julgamento final antes da produção.
- Não acionar Vault: não existe alteração estrutural, migration, seed/backfill, mutação em massa ou escrita de dados.

## Validação

- [x] Teste focal `tests/roadmap-alpha/virtus-agent.test.ts` — 3/3 testes passaram.
- [x] ESLint focal dos arquivos TypeScript — passou sem erros.
- [x] `git diff --check` no escopo da entrega — passou.
- [x] `npm run lint` — executado; mantém o baseline global de 2.474 erros e 1.237 warnings, sem erro nos arquivos TypeScript desta story.
- [x] `npm run typecheck` — executado; mantém somente erros preexistentes fora do escopo.
- [x] `npm test` — executado; 3.312 PASS, 20 falhas preexistentes e 1 TODO, sem falha no contrato Virtus.
- [x] `npm run build` — PASS.
- [x] Skill validator — PASS nas fontes Alpha e Alpak; pacote gerado em `/tmp/virtus.zip`.
- [x] Painel Alpak — teste focal 3/3, ESLint direcionado, typecheck e build PASS.

## File List

- `src/lib/roadmap-alpha/bibble-agents.ts` — metadados de fallback de Virtus.
- `tests/roadmap-alpha/virtus-agent.test.ts` — contrato de catálogo, ativação manual e exclusão dos planejadores.
- `AGENTS.md` — atalho manual `/virtus`.
- `docs/stories/story-virtus-final-production-gate.md` — rastreabilidade da integração.
- `.agents/skills/virtus/SKILL.md` — definição diretamente invocável do agente.
- `.agents/skills/bibble-squad/virtus/SKILL.md` — cópia instalada no namespace da squad.
- `.agents/skills/bibble/SKILL.md` — oferece a chamada manual de Virtus ao fim da atualização.
- `.agents/skills/bibble-squad/bibble/SKILL.md` — cópia namespaced da oferta manual.
- `.agents/skills/devops/SKILL.md` — reconhece a exceção restrita do Virtus para o push final confirmado.
- `.agents/skills/bibble-squad/devops/SKILL.md` — cópia namespaced da mesma separação de autoridade.
- `.bibble/core-config.yaml` — registra Virtus como gate `manual-only` e sua confirmação obrigatória.
- `.bibble/constitution.md` — delimita a autoridade final de commit/push sem substituir DevOps ou Vault.
- `.bibble/workflows/feature-workflow.md` — encerra o fluxo oferecendo `/virtus`, sem ativação automática.
- `.bibble/workflows/qa-loop.md` — substitui o push direto pela oferta manual do gate final.
- `.bibble/checklists/feature-dod.md` — adiciona o checklist de produção condicionado à chamada manual.
- `bibblesquad` — submódulo fonte com Virtus e seu contrato operacional; commit próprio e atualização do gitlink permanecem para o gate manual.

## Change Log

| Date | Version | Description | Author |
|---|---:|---|---|
| 2026-09-17 | 0.1.0 | Integração manual de Virtus no Painel Alpha e teste de regressão. | Codex |

## Completion Notes

- Virtus foi integrado ao fallback do catálogo e ao atalho `/virtus`, sem entrar em qualquer fluxo automático.
- A autorização de commit e push permanece condicionada à pergunta canônica e à resposta explícita do usuário.
- Nenhuma alteração de banco foi realizada ou é necessária para esta entrega.
- A mesma definição foi instalada no Painel Alpak, com capacidades completas no catálogo, sem bypass do RBAC persistido do Tool Center.
- Nenhum commit, push ou deploy foi executado; `.aiox/project-status.yaml` no Alpha e todo o working tree anterior do Alpak foram preservados.
