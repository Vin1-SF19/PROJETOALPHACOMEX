# Storage Alpha — validação da implementação

**Data:** 2026-08-18  
**Story:** `story-storage-alpha-fundacao-cli-multipart-poc.md`  
**Escopo:** fundação CLI, providers, multipart e fallback; sem UI e sem banco.

## Resultado direcionado

| Gate | Resultado |
|---|---|
| `npm run storage:inventory` | PASS — 35 consumidores: 10 client/direct e 25 server; 14 permanecem `unclassified` por falta de evidência segura. |
| `npm run storage:doctor` sem credenciais POC | PASS de segurança — exit code 2, somente campos ausentes, nenhum segredo impresso. |
| `npm run storage:poc` sem confirmação | PASS de segurança — recusou escrita com `EXPLICIT_CONFIRMATION_REQUIRED`. |
| Vitest `tests/storage-alpha` | PASS — 23 testes. |
| ESLint direcionado | PASS — zero erros e zero avisos. |
| TypeScript nos arquivos da story | PASS — o typecheck completo não apontou erro em `src/lib/storage`, `scripts/storage-alpha.mjs` ou `tests/storage-alpha`. |
| `next build` | PASS — compilação e geração das 70 páginas concluídas. |
| Dependências novas | PASS — sem advisory direto para `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` ou `server-only`. |

## Baseline externo ao Storage Alpha

- `npm test`: 1.489/1.491 testes passaram. As duas falhas estão em `tests/bpm/card-modal-integration.test.ts` e `tests/apresentacoes/pptx-parser.test.ts`, relacionadas a mudanças preexistentes no CRM/Apresentações.
- `npm run typecheck`: mantém erros preexistentes em `api/ExclusaoFiscal`, `HabilitacaoRadarClient` e `tests/google-calendar/sync-queue.test.ts`; nenhum erro pertence ao Storage Alpha.
- `npm run lint`: o comando global inclui `.aiox-core`, `.agents` e código legado e reporta milhares de diagnósticos preexistentes; o conjunto direcionado desta story passou limpo.
- `npm run build`: parou em `prisma generate` por DLL do Prisma em uso (`EPERM`). `npm run build:player` e `npx next build` passaram sem erro.
- CodeRabbit: indisponível nesta máquina porque o WSL não está instalado.

## Validação real pendente

O ambiente local ainda não possui `STORAGE_QUOBJECTS_ENDPOINT`, `STORAGE_QUOBJECTS_ACCESS_KEY_ID` e `STORAGE_QUOBJECTS_SECRET_ACCESS_KEY`. Portanto, nenhum upload real foi iniciado e nenhum objeto do NAS ou Blob foi alterado.

Depois de configurar essas variáveis server-side, executar na ordem:

1. `npm run storage:doctor`
2. smoke QuObjects de 10 MiB;
3. POC QuObjects de 2 GiB;
4. smoke Vercel Blob de 10 MiB.

Os comandos exatos estão em `docs/qa/storage-alpha/README.md`.
