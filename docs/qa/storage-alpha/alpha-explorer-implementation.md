# Alpha Explorer — blueprint e evidências

## Integração

- Domínio e autorização: `src/lib/alpha-explorer/`.
- Storage reutilizado: `src/lib/storage/` com listagem, copy, ListParts/ListUploads e presign por parte.
- Persistência: quatro tabelas aditivas, sem alteração de dados legados.
- HTTP: `src/app/api/alpha-explorer/`.
- UI: Server Component em `/PainelAlpha/ExploradorArquivos` e folhas interativas em `src/components/AlphaExplorer/`.
- Rollout: flags server-only independentes para leitura, escrita e fallback.

## Vault

- Backup: `database-backups/pre-change/painelalpha_turso_pre_change_2026-09-15T19-11-55-424Z.sql` (ignorado pelo Git).
- SHA-256: `80ea33cbced77a30520d3d63d6cb28129c99eaf0567034dafcf58de74f8e4a47`.
- 127.353.346 bytes, 308 tabelas e 124.318 registros; restauração, integridade e FKs aprovadas.
- Autorização explícita recebida em 2026-09-15.
- O diff Prisma contra o snapshot apresentou drift destrutivo antigo e foi rejeitado. Aplicou-se somente o SQL manual aprovado: quatro `CREATE TABLE` e 16 índices.
- Resultado remoto: 20 statements, quatro tabelas presentes, 16 índices e zero violação de FK.

## Evidências operacionais

| Verificação | Resultado |
|---|---|
| Testes direcionados finais | PASS; 32/32 em 8 arquivos |
| ESLint global | PASS |
| Typecheck global | FAIL; 21 erros fora do Explorer no snapshot final; o worktree paralelo continuou mudando durante a validação |
| Suíte global | FAIL; 3.179 passaram, 20 falharam e 1 ficou todo, em 431 arquivos |
| Build de produção | PASS; página e 8 rotas do Explorer emitidas |
| Prisma validate/generate | PASS/PASS |
| CLI doctor | PASS; NAS e Blob saudáveis |
| CLI permissions/list/reconcile | PASS; zero multipart incompleto |
| Smoke QuObjects 10 MiB | PASS; checksum e cleanup, 2.585 ms |
| Smoke Blob 10 MiB | PASS; checksum e cleanup, 3.726 ms |
| CodeRabbit | Não executado; binário `~/.local/bin/coderabbit` ausente |

O smoke Blob valida a fundação existente. O fallback do Explorer exige store privado; com `STORAGE_VERCEL_ACCESS=public`, ele falha fechado com `FALLBACK_NOT_PRIVATE`. `@vercel/blob` 2.8.x é usado para emitir URL GET assinada por objeto por 120 segundos no store privado, sem colocar a Function no caminho do download grande.

As falhas globais remanescentes estão em Alpha SEO, BPM, Gerador de Documentos, Onyx, Parceiros e Apresentações. Nenhuma saída dirigida aponta erro de TypeScript, lint ou teste no Alpha Explorer.
