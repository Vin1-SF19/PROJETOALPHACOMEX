import { notFound } from "next/navigation";
import db from "@/lib/prisma";
import { requireAlphaSeoProjectAccess } from "@/lib/alpha-seo/project-access";
import { AlphaSeoShell } from "@/components/AlphaSEO/AlphaSeoShell";
import { getTema } from "@/lib/temas";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const access = await requireAlphaSeoProjectAccess({ projectId, action: "seo:read" });
  const [project, user, projects] = await Promise.all([
    db.alphaSeoProject.findUnique({ where: { id: projectId }, select: { name: true } }),
    db.usuarios.findUnique({ where: { id: access.userId }, select: { tema_interface: true } }),
    db.alphaSeoProject.findMany({ where: { status: "ACTIVE", OR: [{ ownerId: access.userId }, { members: { some: { userId: access.userId, active: true } } }] }, select: { id: true, name: true }, orderBy: { updatedAt: "desc" }, take: 100 }),
  ]);
  if (!project) notFound();
  return <AlphaSeoShell accent={getTema(user?.tema_interface ?? "blue").accent} projectId={projectId} projectName={project.name} projects={projects}>{children}</AlphaSeoShell>;
}
