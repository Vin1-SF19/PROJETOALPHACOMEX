import { auth } from '../../../../auth'
import { redirect } from 'next/navigation'
import db from '@/lib/prisma'
import DocsAlphaClient from './DocsAlphaClient'
import type { Documento } from './_types'

export const dynamic = 'force-dynamic'

export default async function PaginaDocumentos() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const rows = await db.documentos.findMany({
    where: {
      OR: [{ status: "ATIVO" }, { status: null }],
    },
    orderBy: { id: 'desc' },
  })

  const documentos: Documento[] = rows.map(doc => ({
    id: doc.id,
    titulo: doc.titulo,
    data_criacao: doc.data_criacao.toISOString(),
    url: doc.url,
    setor: doc.setor,
    PastaArquivos: doc.PastaArquivos ?? '',
    tipo: doc.tipo,
    criado_por: doc.criado_por ?? 'SISTEMA',
    protecao: doc.protecao ?? 'ATIVO',
    ordem_manual: doc.ordem_manual ?? 0,
    status: doc.status ?? 'ATIVO',
  }))

  return <DocsAlphaClient documentosIniciais={documentos} />
}
