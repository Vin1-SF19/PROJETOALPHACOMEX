import db from "@/lib/prisma";
import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import { getTema } from "@/lib/temas";
import { LayoutGrid } from "lucide-react";
import { BotoesHeader } from "@/components/Colaboradores/BotoesHeader";
import { GradeAgentes } from "./GradeAgentes/GradeAgentes";
import { isAdminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function ColaboradoresPage() {
    const session = await auth();
    
    if (!isAdminRole(session?.user?.role)) redirect("/");

    const style = getTema((session?.user as any)?.tema_interface || "blue");

    const recursosVault = await db.$queryRaw`
        SELECT 
            vr.*, 
            sc.nome as sistema_nome, 
            sc.icone, 
            sc.link 
        FROM vault_recursos vr
        JOIN sistemas_core sc ON vr.sistema_id = sc.id
    ` as any[];

    const usuariosReais = await db.usuarios.findMany({
        select: {
            id: true,
            nome: true,
            role: true,
            cargo: true,
            data_contratacao: true,
            status: true,
            tema_interface: true,
            email: true
        }
    });

    const colaboradoresExternos = await db.$queryRaw`SELECT * FROM colaboradores_core` as any[];
    const sistemas = await db.$queryRaw`SELECT * FROM sistemas_core` as any[];

    const todosColaboradores = [
        ...usuariosReais.map(u => ({ ...u, tipo: 'Usuario' })),
        ...colaboradoresExternos.map(c => ({
            id: `ext-${c.id}`,
            nome: c.nome,
            role: c.setor,
            cargo: c.cargo,
            data_contratacao: c.data_contratacao,
            status: c.status,
            tema_interface: "blue",
            tipo: 'Agente',
            email: null
        }))
    ].sort((a, b) => a.nome.localeCompare(b.nome));

    return (
        <main className="min-h-screen bg-[#020617] p-8 text-white relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-[600px] h-[600px] ${style.glow} opacity-5 blur-[150px]`} />

            <div className="max-w-7xl mx-auto relative z-10">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div>
                        <h1 className="text-4xl font-black uppercase italic tracking-tighter flex items-center gap-4">
                            <LayoutGrid className={style.text} size={40} /> Gerenciador de <span className={style.text}>Senhas</span>
                        </h1>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2">Gestão de Identidade e Recursos</p>
                    </div>

                    <BotoesHeader style={style} />
                </header>

                <GradeAgentes 
                    colaboradores={todosColaboradores} 
                    sistemas={sistemas} 
                    recursos={recursosVault} 
                />
            </div>
        </main>
    );
}
