import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

const VERSION = 1;

function key(): Buffer {
  const raw = process.env.ALPHA_SEO_GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!raw)
    throw new Error("ALPHA_SEO_GOOGLE_TOKEN_ENCRYPTION_KEY_NOT_CONFIGURED");
  const decoded = /^[A-Za-z0-9+/]{43}=$/.test(raw)
    ? Buffer.from(raw, "base64")
    : Buffer.from(raw, "utf8");
  if (decoded.length !== 32)
    throw new Error("ALPHA_SEO_GOOGLE_TOKEN_ENCRYPTION_KEY_INVALID");
  return decoded;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function encryptSecret(
  value: string,
  purpose: string,
): { ciphertext: string; keyVersion: number } {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(`alpha-seo:${purpose}:v${VERSION}`, "utf8"));
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: [
      VERSION,
      iv.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      encrypted.toString("base64url"),
    ].join("."),
    keyVersion: VERSION,
  };
}

export function decryptSecret(ciphertext: string, purpose: string): string {
  const [versionRaw, ivRaw, tagRaw, dataRaw] = ciphertext.split(".");
  if (Number(versionRaw) !== VERSION || !ivRaw || !tagRaw || !dataRaw)
    throw new Error("ALPHA_SEO_CIPHERTEXT_INVALID");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(ivRaw, "base64url"),
  );
  decipher.setAAD(Buffer.from(`alpha-seo:${purpose}:v${VERSION}`, "utf8"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString("base64url");
  return {
    verifier,
    challenge: createHash("sha256").update(verifier).digest("base64url"),
  };
}

export function redactGoogleError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "Google request failed";
  return message
    .replace(
      /(access_token|refresh_token|id_token|code|client_secret)=[^&\s]+/gi,
      "$1=[REDACTED]",
    )
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED]")
    .slice(0, 500);
}
