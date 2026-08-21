import { listAlphaSeoProjects } from "@/lib/alpha-seo/projects/service";
import { ProjectsClient } from "@/components/AlphaSEO/projects/ProjectsClient";
import { AlphaSeoShell } from "@/components/AlphaSEO/AlphaSeoShell";
import { auth } from "../../../../auth";
import db from "@/lib/prisma";
import { getTema } from "@/lib/temas";

export default async function Page() {
  const [data, archived] = await Promise.all([
    listAlphaSeoProjects({ limit: 100 }),
    listAlphaSeoProjects({ limit: 100, archived: true }),
  ]);
  const session = await auth();
  const user = await db.usuarios.findUnique({ where: { id: Number(session?.user?.id) }, select: { tema_interface: true } });
  return <AlphaSeoShell accent={getTema(user?.tema_interface ?? "blue").accent}><ProjectsClient initialProjects={data.rows} initialArchived={archived.rows} /></AlphaSeoShell>;
}
