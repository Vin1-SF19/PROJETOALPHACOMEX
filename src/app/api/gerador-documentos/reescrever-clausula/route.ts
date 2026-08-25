import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isAdminRole } from '@/lib/roles'
import { reescreverClausulaSchema, PERMISSAO_MODULO } from '@/lib/gerador-documentos/validacao'
import { reescreverClausula } from '@/lib/gerador-documentos/reescrita-ia'

export async function POST(request: NextRequest) {
  // Auth
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 })
  }

  const role = (session.user as any).role as string | null
  const permissoes: string[] = (session.user as any).permissoes ?? []

  if (!isAdminRole(role) && !permissoes.includes(PERMISSAO_MODULO)) {
    return NextResponse.json({ success: false, error: 'Permissão negada' }, { status: 403 })
  }

  // Parse body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = reescreverClausulaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const resultado = await reescreverClausula(parsed.data)

  if (!resultado.success) {
    const status = resultado.code === 'NOT_FOUND' || resultado.code === 'CLAUSULA_NOT_FOUND' ? 404 : 502
    return NextResponse.json(resultado, { status })
  }

  return NextResponse.json(resultado)
}
