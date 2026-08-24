import path from "node:path";

export function isSensitiveRoadmapPath(value: string): boolean {
  const normalized = value.replaceAll("\\", "/").toLocaleLowerCase("en-US");
  const base = normalized.split("/").filter(Boolean).at(-1) ?? "";
  const extension = path.posix.extname(base);
  return (
    base === ".env" ||
    base.startsWith(".env.") ||
    [".npmrc", ".pypirc", ".netrc"].includes(base) ||
    /^(?:secrets?|credentials?|service-account).*\.json$/i.test(base) ||
    /^(?:id_rsa|id_dsa|id_ecdsa|id_ed25519)$/i.test(base) ||
    [
      ".db",
      ".sqlite",
      ".sqlite3",
      ".pem",
      ".key",
      ".p12",
      ".pfx",
      ".jks",
      ".keystore",
    ].includes(extension)
  );
}

