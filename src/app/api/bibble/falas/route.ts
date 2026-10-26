import { mapearIndisponibilidadeAuth } from "@/lib/auth/indisponibilidade";
import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { BIBBLE_STATIC_FALAS } from "@/lib/bibble/persona";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ falas: BIBBLE_STATIC_FALAS });

  } catch (authError) {
    const unavailable = mapearIndisponibilidadeAuth(authError);
    if (unavailable) return unavailable;
    throw authError;
  }
}
