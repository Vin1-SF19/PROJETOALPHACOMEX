import { NextResponse } from "next/server";
import db from "@/lib/prisma";
import { auth } from "../../../../auth";
import { isAdminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  
  if (!session?.user?.id) return NextResponse.json({ nenhum: true });

  const userId = Number(session.user.id);
  const isAdmin = isAdminRole(session.user.role);

  try {
    const ultimaMensagem = await db.mensagensChamado.findFirst({
      where: {
        
        autorId: { not: userId },
        
        
        chamado: {
            status: { in: ["Aberto", "Em_Andamento"] },
            
            ...(!isAdmin && { usuarioId: userId })
        },

        ...(isAdmin 
          ? { lida_admin: false } 
          : { lida_usuario: false }
        ),
      },
      include: {
        autor: { select: { nome: true } },
        chamado: { select: { titulo: true, id: true, status: true } }
      },
      orderBy: { createdAt: 'desc' } 
    });

    if (!ultimaMensagem) return NextResponse.json({ nenhum: true });

    return NextResponse.json(ultimaMensagem);
  } catch (error) {
    return NextResponse.json({ nenhum: true });
  }
}
