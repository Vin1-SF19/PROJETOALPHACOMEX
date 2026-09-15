import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { acquireBibbleLease } from "@/lib/bibble/admission-control";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const lease = acquireBibbleLease(`upload:${session.user.id}`);
  if (!lease) return NextResponse.json({ error: "Upload em processamento; tente novamente" }, { status: 429 });
  try {
    return NextResponse.json(
      { error: "Uploads temporariamente indisponíveis até a ativação do storage privado" },
      { status: 503 },
    );
  } finally {
    lease.release();
  }
}
