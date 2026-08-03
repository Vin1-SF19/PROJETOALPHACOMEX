import { auth } from "../../../../../auth";
import { redirect, notFound } from "next/navigation";
import { getHoleriteById } from "@/actions/Holerites";
import HoleriteDetalheClient from "./HoleriteDetalheClient";
import { isAdminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

const ROLES_GESTAO = ["FINANCEIRO"];

interface Props {
  params: Promise<{ id: string }>;
}

export default async function HoleriteDetalhePage({ params }: Props) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isInteger(idNum) || idNum <= 0) notFound();

  const res = await getHoleriteById(idNum);
  if (!res.success) notFound();

  const user = session.user as { id: string; role: string };
  const isGestao = isAdminRole(user.role) || ROLES_GESTAO.includes(user.role);

  return (
    <HoleriteDetalheClient
      holerite={res.data}
      isGestao={isGestao}
    />
  );
}
