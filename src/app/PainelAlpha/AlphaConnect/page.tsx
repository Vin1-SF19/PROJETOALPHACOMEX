import db from "@/lib/prisma";
import { auth } from "../../../../auth";
import { redirect } from "next/navigation";
import { getTema } from "@/lib/temas";
import RadarFiscalClient from "./RadarFiscalClient";
import { isAdminRole } from "@/lib/roles";
import type { RadarFiscalItem } from "./types";

export const dynamic = "force-dynamic";

export default async function RadarFiscalPage() {
    const session = await auth();
    if (!isAdminRole(session?.user?.role) && session?.user?.usuario !== "Marcelo") redirect("/");

    const style = getTema(session?.user?.tema_interface || "blue");
    const consultas = await db.$queryRaw<RadarFiscalItem[]>`SELECT * FROM radar_fiscal ORDER BY id DESC`;

    return (
        <RadarFiscalClient initialDados={consultas} style={style} />
    );
}
