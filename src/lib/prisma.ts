import { PrismaClient, type Prisma } from '@prisma/client'
import { PrismaLibSQL as PrismaLibSqlNode } from '@prisma/adapter-libsql'
// Variante /web usa @libsql/client/web (HTTP puro, sem binário nativo)
// Necessário no Windows/Node 24 onde @libsql/win32-x64-msvc não carrega
import { PrismaLibSQL as PrismaLibSql } from '@prisma/adapter-libsql/web'

// Configuração administrativa só é carregada com select explícito no servidor.
export const camposPrivadosPrisma: Prisma.GlobalOmitConfig = { bpmPipeline: { visualizacaoConfigJson: true } };

// libsql:// → https:// para usar transport HTTP puro
const configuredUrl = process.env.TURSO_DATABASE_URL ?? ''
const tursoUrl = configuredUrl.replace(/^libsql:\/\//, 'https://')

// `file:` é aceito somente quando fornecido explicitamente (smokes/E2E locais).
// O runtime normal continua no transporte HTTP puro usado pelo Turso.
const adapter = configuredUrl.startsWith('file:')
  ? new PrismaLibSqlNode({ url: configuredUrl })
  : new PrismaLibSql({
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })

const prismaClientSingleton = () => {
  return new PrismaClient({
    adapter,
    omit: camposPrivadosPrisma,
    log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['query', 'warn', 'error'],
  })
}

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

const db = globalThis.prisma ?? prismaClientSingleton()

export default db

if (process.env.NODE_ENV !== 'production') globalThis.prisma = db
