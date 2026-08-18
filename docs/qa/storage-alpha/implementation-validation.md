# Storage Alpha — validação da implementação

**Data:** 2026-08-18  
**Story:** `story-storage-alpha-fundacao-cli-multipart-poc.md`  
**Escopo:** fundação CLI, providers, multipart e fallback; sem UI e sem banco.

## Resultado direcionado

| Gate | Resultado |
|---|---|
| `npm run storage:inventory` | PASS — 35 consumidores: 10 client/direct e 25 server; 14 permanecem `unclassified` por falta de evidência segura. |
| `npm run storage:doctor` com ambiente POC | PASS — QuObjects e Vercel Blob saudáveis; bucket `pa-poc-private` reconhecido. |
| `npm run storage:poc` sem confirmação | PASS de segurança — recusou escrita com `EXPLICIT_CONFIRMATION_REQUIRED`. |
| Vitest `tests/storage-alpha` | PASS — 30 testes. |
| ESLint direcionado | PASS — zero erros e zero avisos. |
| TypeScript nos arquivos da story | PASS — o typecheck completo não apontou erro em `src/lib/storage`, `scripts/storage-alpha.mjs` ou `tests/storage-alpha`. |
| `next build` | PASS — compilação e geração das 70 páginas concluídas. |
| Dependências novas | PASS — sem advisory direto para `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` ou `server-only`. |

## Baseline externo ao Storage Alpha

- `npm test`: 1.499/1.502 testes passaram. As falhas estão em `tests/bpm/card-modal-integration.test.ts`, `tests/apresentacoes/pptx-parser.test.ts` e um timeout em `tests/google-calendar/cli.test.ts`; todas fora do Storage Alpha.
- `npm run typecheck`: mantém erros preexistentes em `api/ExclusaoFiscal`, `HabilitacaoRadarClient` e `tests/google-calendar/sync-queue.test.ts`; nenhum erro pertence ao Storage Alpha.
- `npm run lint`: o comando global inclui `.aiox-core`, `.agents` e código legado e reporta milhares de diagnósticos preexistentes; o conjunto direcionado desta story passou limpo.
- `npm run build`: parou em `prisma generate` por DLL do Prisma em uso (`EPERM`). `npm run build:player` e `npx next build` passaram sem erro.
- CodeRabbit: indisponível nesta máquina porque o WSL não está instalado.

## Validação real concluída

| Prova | Resultado |
|---|---|
| QuObjects 10 MiB | PASS — 1 parte, checksum SHA-256 confirmado e limpeza concluída. Evidência: `poc-small-20260818-retry3.json`. |
| QuObjects 2 GiB | PASS — 2.147.483.648 bytes, 32 partes de 64 MiB, checksum confirmado, 285.190 ms e limpeza concluída. Evidência: `poc-2gib-20260818.json`. |
| Vercel Blob 10 MiB | PASS — multipart, `HEAD`, download, checksum e limpeza concluídos. Evidência: `poc-fallback-20260818-retry1.json`. |
| Auditoria final QuObjects | PASS — zero objetos e zero uploads multipart incompletos sob `storage-alpha-poc/`. |

### Compatibilidades encontradas no ambiente real

- O QuObjects conclui `UploadPart`, mas o `ETag` não atravessa o gateway no cabeçalho da resposta. O adapter recupera o valor autoritativo com `ListParts`, sem calcular ou adivinhar hash.
- O QuObjects aceita `PUT`, `GET` e `DELETE`, mas responde 403 para `HeadObject` pelo endpoint público. O adapter tenta `HeadObject` primeiro e, somente nesse caso, consulta a chave exata com `ListObjects`, sem baixar o objeto.
- O Vercel Blob público responde 400 quando `get()` recebe `useCache: false`. O adapter usa essa opção somente para stores privados.
- Todas as falhas intermediárias foram sanitizadas e limpas. Os relatórios de tentativa foram preservados para rastreabilidade e não contêm segredos.
