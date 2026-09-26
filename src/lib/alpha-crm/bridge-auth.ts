import { timingSafeEqual } from "node:crypto";

export function authorizeAlphaBridge(header: string | null): boolean {
  const expected = process.env.ALPHA_BRIDGE_TOKEN;
  if (!expected || expected.length < 32 || !header?.startsWith("Bearer ")) return false;
  const received = Buffer.from(header.slice(7), "utf8");
  const secret = Buffer.from(expected, "utf8");
  return received.length === secret.length && timingSafeEqual(received, secret);
}
