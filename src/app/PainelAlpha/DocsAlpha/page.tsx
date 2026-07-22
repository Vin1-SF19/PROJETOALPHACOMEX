import { auth } from '../../../../auth'
import { redirect } from 'next/navigation'
import db from '@/lib/prisma'
import DocsAlphaClient from './DocsAlphaClient'
import type { Documento } from './_types'

export const dynamic = 'force-dynamic'

export default async function PaginaDocumentos() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const usuarioId = Number((session.user as { id?: string | number }).id ?? 0)

  const [rows, confirmacoes] = await Promise.all([
    db.documentos.findMany({
      where: {
        OR: [{ status: "ATIVO" }, { status: null }],
      },
      orderBy: { id: 'desc' },
    }),
    usuarioId
      ? db.confirmacaoLeituraDocumento.findMany({
          where: { usuarioId },
          select: { documentoId: true },
        })
      : Promise.resolve([]),
  ])

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

  const documentosConfirmadosIniciais = confirmacoes.map(c => c.documentoId)

  return (
    <DocsAlphaClient
      documentosIniciais={documentos}
      documentosConfirmadosIniciais={documentosConfirmadosIniciais}
    />
  )
}
