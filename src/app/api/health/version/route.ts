import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  const deployedCommitSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (process.env.VERCEL_ENV !== "production" ||
      !deployedCommitSha || !/^[a-f0-9]{40}$/.test(deployedCommitSha)) {
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers: noStore });
  }

  return NextResponse.json(
    { status: "ok", deployedCommitSha },
    { headers: noStore },
  );
}
