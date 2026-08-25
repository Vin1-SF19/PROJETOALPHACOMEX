import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isAdminRole } from '@/lib/roles'
import { PERMISSAO_MODULO } from '@/lib/gerador-documentos/validacao'
import { obterDocumentoPorToken } from '@/lib/gerador-documentos/geracao'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // Auth — a tela de conferência exige sessão
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 })
  }

  const role = (session.user as any).role as string | null
  const permissoes: string[] = (session.user as any).permissoes ?? []

  if (!isAdminRole(role) && !permissoes.includes(PERMISSAO_MODULO)) {
    return NextResponse.json({ success: false, error: 'Permissão negada' }, { status: 403 })
  }

  const { token } = await params

  const resultado = await obterDocumentoPorToken(token)

  if (!resultado.success) {
    return NextResponse.json(resultado, { status: 404 })
  }

  return NextResponse.json(resultado)
}
