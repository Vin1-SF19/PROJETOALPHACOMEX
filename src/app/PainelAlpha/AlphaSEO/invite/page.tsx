import { InviteAcceptClient } from "@/components/AlphaSEO/projects/InviteAcceptClient";

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  return <main className="px-4 py-12"><InviteAcceptClient token={token} /></main>;
}
