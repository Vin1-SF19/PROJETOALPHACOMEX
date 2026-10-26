"use client";

import { SessaoIndisponivel } from "@/components/auth/SessaoIndisponivel";

/** A production Server Component error may be opaque; confirm session, never infer logout. */
export default function PainelError({ reset }: { error: Error; reset: () => void }) {
  return <SessaoIndisponivel automatico={false} onRecovered={reset} />;
}
