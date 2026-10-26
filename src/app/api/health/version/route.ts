import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  const deployedCommitSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  const trustedEnvironment = process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL === "1" && process.env.VERCEL_TARGET_ENV === "staging";
  if (!trustedEnvironment ||
      !deployedCommitSha || !/^[a-f0-9]{40}$/.test(deployedCommitSha)) {
    return NextResponse.json({ status: "unavailable" }, { status: 503, headers: noStore });
  }

  return NextResponse.json(
    { status: "ok", deployedCommitSha },
    { headers: noStore },
  );
}
