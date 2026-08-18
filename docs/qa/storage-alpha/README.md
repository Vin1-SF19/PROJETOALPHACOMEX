# Storage Alpha — execução controlada do POC

Os comandos desta pasta validam a fundação de storage sem alterar os uploads atuais do Painel Alpha.

## 1. Configuração

Configure as variáveis `STORAGE_*` descritas em `.env.example` somente no ambiente server-side. Não grave access key, secret key ou token Blob em arquivos versionados.

## 2. Diagnóstico read-only

```powershell
npm run storage:doctor
```

Exit code `0` indica os dois providers saudáveis; `1`, indisponibilidade; `2`, configuração inválida.

## 3. Inventário read-only

```powershell
npm run storage:inventory
```

O resultado lista os consumidores atuais do Vercel Blob sem ler valores de tokens.

## 4. Smoke pequeno no QuObjects

```powershell
npm run storage:poc -- --execute --confirm=storage-alpha-poc --provider=quobjects --size=10MiB --evidence=docs/qa/storage-alpha/poc-small.json
```

## 5. Prova de 2 GiB no QuObjects

```powershell
npm run storage:poc -- --execute --confirm=storage-alpha-poc --provider=quobjects --size=2GiB --evidence=docs/qa/storage-alpha/poc-2gib.json
```

O comando gera o conteúdo em streaming, envia partes de 64 MiB, executa `HEAD`, baixa para verificar SHA-256 e apaga somente a chave exclusiva criada pela execução.

## 6. Smoke do fallback Blob

```powershell
npm run storage:poc -- --execute --confirm=storage-alpha-poc --provider=vercel-blob --size=10MiB --evidence=docs/qa/storage-alpha/poc-fallback.json
```

Não use `2GiB` no fallback sem necessidade: isso transfere dados reais e pode gerar custo no Vercel Blob.

## Segurança

- O comando de POC recusa escrita sem `--execute` e `--confirm=storage-alpha-poc`.
- Arquivos de evidência são criados sem sobrescrever arquivos existentes.
- A saída não contém tokens, secrets, endpoint interno ou URL assinada.
- O POC não lista nem exclui objetos por prefixo; remove apenas a chave aleatória criada na própria execução.
