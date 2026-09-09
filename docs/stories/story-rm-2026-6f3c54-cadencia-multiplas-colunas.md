# Story — RM-2026-6F3C54: Cadência em múltiplas colunas

## Status

Concluída em 2026-09-08; pronta para testes funcionais, sem promoção para produção.

## Objetivo

Permitir que uma única cadência do Alpha CRM seja configurada em múltiplas colunas do mesmo pipeline por um campo multiselect, preservando uma cadência ou nenhuma por coluna e ativação automática exata.

## Contexto auditado em 2026-09-08

- Rota administrativa: `/PainelAlpha/AlphaCRM/admin/cadencias`, protegida por sessão e papel administrativo.
- Editor: `CadenciaFormDialog`; hoje usa um `Select` singular ligado a `BpmCadencia.etapaId`.
- Configuração por pipeline: `CadenciaEtapasSection` → `ConfigurarCadenciaEtapaBpm`.
- Runtime: criação/movimento → `ativarCadenciasNaEntradaBpm(..., tx)` → `BpmCardCadencia`; executor idempotente cria tarefas posteriormente.
- Persistência atual: `BpmCadencia.pipelineId + etapaId`; não existe tabela de associação.
- Banco ativo: uma cadência, uma com etapa, nenhuma ativa, nenhum escopo inválido, nenhuma coluna duplicada e zero violações de FK.

`AUTO_ADJUSTMENT_REQUIRED`: o seletor singular e a coluna `etapaId` não representam várias colunas sem duplicar definições.

`AUTO_ADJUSTMENT_ACCEPTANCE`: administrador seleciona duas ou mais colunas no editor real, salva e recarrega; a mesma definição ativa em cada coluna selecionada e não ativa nas demais.

## Blueprint de integração

1. Adicionar `BpmCadenciaEtapa`, relação normalizada entre cadência e etapa, com FK e unicidade de `etapaId`.
2. Preservar `BpmCadencia.etapaId` como shadow legado não autoritativo. Toda gravação mantém nele a primeira coluna ordenada; rollback de código subaplica em uma coluna, mas nunca transforma uma cadência multicoluna em escopo universal.
3. Representar escopo de entrada no pipeline por `etapaIds: []`, `etapaId: null` e ausência de associações.
4. Backfill idempotente de cada vínculo legado válido para a nova tabela; abortar preflight se etapa e cadência pertencerem a pipelines diferentes ou houver duplicidade.
5. Actions recebem arrays Zod limitados e sem duplicatas, revalidam pipeline, etapas ativas e ocupação dentro de transação serializável, salvam por diff e auditam somente IDs/metadados.
6. `ativarCadenciasNaEntradaBpm` resolve coluna por `etapas.some(etapaId)` e entrada de pipeline somente por cadência sem associações. Não há fallback universal.
7. `CadenciaFormDialog` troca o seletor singular por lista multiselect acessível; troca de pipeline limpa as seleções. `CadenciaEtapasSection` passa a permitir a mesma cadência em várias linhas e remove somente a associação escolhida.
8. Ciclos já ativos são snapshots e não sofrem reprocessamento retroativo quando uma coluna é adicionada ou removida.

## Escopo

- Schema, migration aditiva, backfill e Prisma Client.
- Schemas Zod, actions, consultas e auditoria.
- Runtime de ativação automática e projeções administrativas/do card.
- Multiselect e configuração por coluna.
- Testes unitários, integração, concorrência, migration e consumo.
- Documentação permanente e relatório final.

## Fora de escopo

- Remover `BpmCadencia.etapaId`.
- Duplicar cadências/passos por coluna.
- Alterar ou reiniciar vínculos de cards já existentes.
- Alterar executor, intervalos, tipos de tarefa ou cadências de entrada no pipeline.
- Push, deploy ou promoção para produção.

## Invariantes

- Uma cadência pode ter zero, uma ou várias colunas do seu próprio pipeline.
- Uma coluna pertence a no máximo uma cadência, garantido também no banco.
- Zero colunas significa entrada no pipeline; nunca todas as colunas.
- Somente colunas ativas e pertencentes ao pipeline podem ser salvas.
- Entrada em coluna selecionada ativa a definição; coluna não selecionada não ativa.
- Vínculos ativos/terminais e chave idempotente por ciclo são preservados.
- Ativação de cadência e mutação do card compartilham a mesma transação; falha antes do commit desfaz ambas e evita estado parcial.
- Publicação realtime ocorre após o commit e pode falhar sem invalidar o domínio persistido.

## Checkpoint Vault — `VAULT-RM-2026-6F3C54-V1`

### Ambiente e banco

- Projeto: Painel Alpha.
- Banco afetado: Turso/libSQL configurado pelo servidor em `.env.local`; credenciais não são registradas.
- Mudança aditiva: uma tabela e dois índices. Nenhuma tabela/coluna atual é removida ou renomeada.

### Delta proposto

```sql
CREATE TABLE "BpmCadenciaEtapa" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "cadenciaId" TEXT NOT NULL,
  "etapaId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BpmCadenciaEtapa_cadenciaId_fkey"
    FOREIGN KEY ("cadenciaId") REFERENCES "BpmCadencia" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BpmCadenciaEtapa_etapaId_fkey"
    FOREIGN KEY ("etapaId") REFERENCES "BpmEtapa" ("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BpmCadenciaEtapa_etapaId_key"
  ON "BpmCadenciaEtapa"("etapaId");
CREATE INDEX "BpmCadenciaEtapa_cadenciaId_idx"
  ON "BpmCadenciaEtapa"("cadenciaId");
INSERT OR IGNORE INTO "BpmCadenciaEtapa" ("id", "cadenciaId", "etapaId")
SELECT 'legacy:' || c."id" || ':' || c."etapaId", c."id", c."etapaId"
FROM "BpmCadencia" c
JOIN "BpmEtapa" e ON e."id" = c."etapaId" AND e."pipelineId" = c."pipelineId"
WHERE c."etapaId" IS NOT NULL;
```

O arquivo final foi criado e aplicado somente após a aprovação. O backfill é idempotente e o preflight foi executado antes do DDL.

### Backup verificado

- Dump: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-08T20-40-39-977Z.sql`
- Manifesto: arquivo homônimo `.manifest.json`.
- SHA-256: `4b3b6b2c4d63e22152075c3720d9df5046b81bee474e11108bd83bbe2552e6f8`
- Tamanho: 106.125.243 bytes; 304 tabelas; 83.422 linhas.
- Restauração temporária: `integrity_check=ok`, zero violações de FK e contagens idênticas.
- Validade: até 2026-09-10T20:40:39Z.

### Impacto e riscos

- DDL cria tabela/índices e pode tomar lock curto de schema; não reescreve `BpmCadencia`.
- A unicidade recusa duas cadências na mesma coluna, inclusive concorrentes.
- Um conflito ou vínculo legado inválido aborta o preflight; o estado atual não possui nenhum.
- Durante rollback de código, somente a primeira coluna espelhada em `etapaId` permanece operacional; associações extras continuam preservadas na tabela.
- A nova tabela aumenta leituras por include/filtro, mitigadas pelos índices de `etapaId` único e `cadenciaId`.

### Alternativa não destrutiva rejeitada

Duplicar uma cadência para cada coluna evitaria migration, porém duplicaria passos, versões, auditoria e vínculos, permitindo divergência funcional. IDs em JSON/CSV também eliminariam FK, ownership e unicidade concorrente. A relação normalizada é a menor solução consistente.

### Preflight, aplicação e pós-validação

```bash
# preflight read-only: tabela ausente, FK íntegra, escopos válidos e sem duplicidade
node scripts/verificar-migration-cadencia-multicoluna.mjs --preflight

# somente após aprovação explícita
node scripts/apply-turso-migration.mjs prisma/migrations/20260908205000_bpm_cadencia_multiplas_etapas/migration.sql
npx prisma generate

# validação read-only e backfill idempotente
node scripts/verificar-migration-cadencia-multicoluna.mjs --post
```

### Rollback

1. Desabilitar novas gravações multicoluna pelo rollback do código.
2. Manter a tabela aditiva intacta enquanto o incidente é analisado; o shadow legado conserva uma coluna por cadência.
3. Exportar/validar associações antes de qualquer remoção estrutural.
4. Se rollback de estrutura for indispensável e aprovado em novo checkpoint, remover índices/tabela; em perda ou corrupção, restaurar integralmente o dump verificado.

### Aprovação registrada

- Confirmação humana: `Aprovo` em 2026-09-08.
- Aprovador autenticado: `Administrador` (`cmtdc4dz70000ihb4xzne5bwu`).
- Hash: `a1f3373cddb870bdbb1fe012cbb1eecaf9f269f21e506631814c5dce7250f2bf`.
- Aplicação: quatro statements concluídos; Prisma Client regenerado.
- Pós-validação: 1 associação, 0 backfills ausentes, 0 associações inválidas/duplicadas e 0 violações de FK.

## Critérios de aceite

- [x] Relação normalizada persiste várias colunas e recarrega o conjunto integral.
- [x] Unicidade impede mais de uma cadência por coluna sob concorrência.
- [x] Backfill preserva o vínculo legado atual e pode ser repetido sem duplicar.
- [x] Etapa inexistente, inativa ou de outro pipeline é rejeitada.
- [x] Multiselect permite adicionar/remover colunas, é acessível e restaura estado canônico em erro.
- [x] Mesma cadência ativa ao entrar em cada coluna selecionada.
- [x] Coluna não selecionada não ativa a cadência.
- [x] Escopo de entrada no pipeline continua funcionando sem fallback universal.
- [x] Remover associação não altera ciclos já iniciados.
- [x] Ativação e movimento permanecem atômicos na mesma transação.
- [x] Actions exigem sessão/admin, Zod, ownership transacional e auditoria sanitizada.
- [x] Gates específicos, segurança, arquitetura, robustez e consumo passam.

## Fases

- [x] 0 — contexto, entregabilidade e caminho de consumo auditados.
- [x] 1 — story e blueprint criados.
- [x] 2 — checkpoint Vault aprovado, backup restaurável e migration validada.
- [x] 3 — persistência e comportamento operacional.
- [x] 4 — multiselect administrativo.
- [x] 5–9 — gates técnicos e revisões.
- [x] 10–11 — documentação e encerramento.

## Evidências finais

- Suíte focal: 8 arquivos e 40 testes aprovados.
- E2E isolado sobre restauração do backup: duas colunas selecionadas ativaram; a não selecionada não ativou; reentrada não duplicou; remoção preservou o ciclo existente e impediu ativações futuras; escopo de pipeline permaneceu funcional; 0 violações de FK.
- ESLint direcionado e `git diff --check`: aprovados.
- Build de produção: aprovado, 78 páginas geradas; aviso preexistente do `pdfjs` sem falha de build.
- Smoke do build: `/` respondeu 200; `/PainelAlpha/AlphaCRM/admin/cadencias` respondeu 307 para visitante sem sessão.
- Typecheck global: falhou somente em arquivos externos à entrega (Exclusão Fiscal, Gerador de Documentos, Calendário e testes legados); nenhum diagnóstico nos arquivos deste objetivo.
- Lint global: 3.702 erros preexistentes/concorrentes, majoritariamente em `.aiox-core`, `.agents` e componentes legados; o escopo desta RM está limpo.
- Suíte global: 2.588 testes aprovados, 49 falhas e 1 todo em módulos externos/concorrentes; todos os testes de cadência passaram.
- Revisão de segurança: autenticação/admin antes das operações e repetida na transação; arrays estritos, limitados e sem duplicatas; ownership exato; unicidade no banco; auditoria por IDs; logs sanitizados e nenhuma credencial em artefatos.
- Revisão arquitetural: relação normalizada é canônica; `etapaId` é shadow de rollback; zero associações significa entrada no pipeline; ciclos em andamento são snapshots; nenhum CSV/JSON paralelo foi introduzido.

## File List entregue

- `prisma/schema.prisma`
- `prisma/migrations/20260908205000_bpm_cadencia_multiplas_etapas/migration.sql`
- `scripts/verificar-migration-cadencia-multicoluna.mjs`
- `scripts/verificar-cadencia-multicoluna-e2e.ts`
- `src/lib/bpm/cadencias/schemas.ts`
- `src/lib/bpm/cadencias/ativacao-automatica.ts`
- `src/actions/bpm/Cadencias.ts`
- `src/components/bpm/cadencias/types.ts`
- `src/components/bpm/cadencias/CadenciaFormDialog.tsx`
- `src/components/bpm/cadencias/CadenciasWorkspace.tsx`
- `src/components/bpm/cadencias/PainelCadenciasCard.tsx`
- `src/app/PainelAlpha/AlphaCRM/admin/pipelines/[pipelineId]/CadenciaEtapasSection.tsx`
- `tests/bpm/cadencias-multicoluna-migration.test.ts`
- testes BPM direcionados, memórias Bibble e esta story.

**Última atualização:** 2026-09-08 por Codex (RM-2026-6F3C54)
