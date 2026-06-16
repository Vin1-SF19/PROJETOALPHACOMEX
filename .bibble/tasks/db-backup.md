# Task: DB Backup

**Agente:** Vault (detecta necessidade) / DataEngineer (executa)  
**Quando usar:** OBRIGATÓRIO antes de qualquer migration destrutiva em produção  
**Output:** Arquivo de backup confirmado  

---

## Objetivo

Criar backup do banco de dados antes de operações destrutivas. Nenhuma migration que afeta dados existentes roda sem backup confirmado.

## Pré-condições

- Acesso ao ambiente de produção (ou staging que será afetado)
- Vault identificou que a migration é destrutiva

## Detecção Automática (Vault)

Vault bloqueia e exige backup quando detecta:
```sql
DROP TABLE
DROP COLUMN
DELETE FROM
TRUNCATE
ALTER TABLE ... DROP
ALTER COLUMN ... NOT NULL  (se tabela tem dados)
prisma migrate reset
```

## Passos por Banco

### SQLite / Turso (LibSQL)

```bash
# SQLite local
cp prisma/dev.db prisma/dev.db.backup.$(date +%Y%m%d_%H%M%S)

# Turso (produção)
turso db shell [database-name] .dump > backup_$(date +%Y%m%d_%H%M%S).sql
# Ou via API:
turso db export [database-name] --output backup_$(date +%Y%m%d_%H%M%S).sql
```

### PostgreSQL

```bash
# Dump completo
pg_dump -U [user] -h [host] -d [database] \
  -F c \  # formato custom (comprimido)
  -f backup_$(date +%Y%m%d_%H%M%S).dump

# Verificar dump gerado
pg_restore --list backup_*.dump | head -20
```

### MySQL / MariaDB

```bash
mysqldump -u [user] -p[password] -h [host] [database] \
  --single-transaction \
  --routines \
  --triggers \
  > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Prisma (qualquer banco)

```bash
# Snapshot do schema atual
cp prisma/schema.prisma prisma/schema.prisma.backup.$(date +%Y%m%d_%H%M%S)

# Listar migrations aplicadas
npx prisma migrate status
```

## Verificação do Backup

Após criar backup:

```bash
# SQLite — verificar tamanho e integridade
ls -lh prisma/*.backup.*
sqlite3 prisma/dev.db.backup.* "SELECT COUNT(*) FROM sqlite_master;"

# PostgreSQL — verificar tamanho
ls -lh backup_*.dump

# Qualquer — verificar data/hora do arquivo
ls -la backup_*
```

## Checklist de Confirmação

Antes de prosseguir com a migration:

- [ ] Backup criado com sucesso
- [ ] Arquivo de backup tem tamanho razoável (não vazio)
- [ ] Timestamp no nome do arquivo
- [ ] Backup armazenado em local DIFERENTE do banco principal
- [ ] Restauração do backup foi testada (idealmente em dev)

## Procedimento de Rollback (se a migration der errado)

### SQLite
```bash
# Parar aplicação
# Restaurar backup
cp prisma/dev.db.backup.[timestamp] prisma/dev.db
# Verificar
sqlite3 prisma/dev.db ".tables"
```

### PostgreSQL
```bash
# Parar aplicação
# Dropar e recriar banco
dropdb [database] && createdb [database]
# Restaurar
pg_restore -U [user] -h [host] -d [database] backup_[timestamp].dump
```

## Output

```markdown
## Vault/DataEngineer — DB Backup

### Banco: [tipo e nome]
### Ambiente: [produção/staging]
### Arquivo: backup_[timestamp].[ext]
### Tamanho: [X MB]
### Criado em: [data/hora]

✅ Backup confirmado — migration pode prosseguir

### Migration pendente
[Descrever o que será executado]

### Rollback disponível
Caso necessário: [comando de restauração]
```

## Critérios de Sucesso

- Backup criado e verificado (não vazio)
- Timestamp no nome do arquivo
- Localização documentada
- Comando de rollback documentado
