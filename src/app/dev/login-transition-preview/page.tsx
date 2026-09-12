import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LoginTransitionPreview } from "@/components/login/LoginTransitionPreview";

export const metadata: Metadata = {
  title: "Preview da transição | Painel Alpha",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function LoginTransitionPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return <LoginTransitionPreview />;
}
