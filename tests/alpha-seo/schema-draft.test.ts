import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const DRAFT_PATH = path.resolve(
  ROOT,
  "docs/alpha-seo/alpha-seo-schema-draft.prisma",
);
const RUNTIME_SCHEMA_PATH = path.resolve(ROOT, "prisma/schema.prisma");
const SQL_CANDIDATE_PATH = path.resolve(
  ROOT,
  "docs/alpha-seo/alpha-seo-migration-candidate.sql",
);
const HISTORICAL_BASELINE_SHA256 =
  "402cf0930bb4299871dc2f0d343e380e92c26f5303b5c52839b54dbf19ae8da0";

async function loadSchemas() {
  const [draft, runtime] = await Promise.all([
    readFile(DRAFT_PATH, "utf8"),
    readFile(RUNTIME_SCHEMA_PATH, "utf8"),
  ]);
  return { draft, runtime };
}

function alphaSeoModels(draft: string) {
  return [...draft.matchAll(/^model\s+(AlphaSeo\w+)\s*\{/gm)].map(
    (match) => match[1],
  );
}

function modelNames(schema: string) {
  return [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((match) => match[1]);
}

function modelBlock(schema: string, modelName: string) {
  const match = schema.match(
    new RegExp(`^model\\s+${modelName}\\s*\\{[\\s\\S]*?^\\}`, "m"),
  );
  expect(match, `missing model ${modelName}`).not.toBeNull();
  return match![0];
}

function alphaSeoSection(draft: string) {
  const marker =
    "// Alpha SEO — CANDIDATO ISOLADO, AINDA NÃO PROMOVIDO AO SCHEMA DE RUNTIME";
  const offset = draft.indexOf(marker);
  expect(offset).toBeGreaterThanOrEqual(0);
  return draft.slice(offset);
}

describe("Alpha SEO Prisma promotion", () => {
  it("keeps the immutable candidate tied to the audited pre-change baseline", async () => {
    const { draft } = await loadSchemas();
    const draftSha256 = createHash("sha256").update(draft).digest("hex");

    expect(draft).toContain("CANDIDATO ISOLADO");
    expect(draft).toContain(`// ${HISTORICAL_BASELINE_SHA256}`);
    expect(draftSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(draft).toContain(
      'output   = "../../node_modules/.alpha-seo-draft-client"',
    );
    expect(draft).toContain('url      = env("ALPHA_SEO_DRAFT_DATABASE_URL")');
    expect(draft).toContain("model RoadmapWorkspace {");
    expect(draft).toContain("model usuarios {");
    expect(draft).not.toContain("model AlphaSeoDraftUser {");
  });

  it("preserves every non-AlphaSEO candidate model after runtime promotion", async () => {
    const { draft, runtime } = await loadSchemas();
    const runtimeModels = modelNames(runtime)
      .filter((name) => !name.startsWith("AlphaSeo"))
      .sort();
    const candidateBaseModels = modelNames(draft)
      .filter((name) => !name.startsWith("AlphaSeo"))
      .sort();

    expect(candidateBaseModels).toEqual(runtimeModels);
  });

  it("promotes all 44 Alpha SEO models to runtime without contract drift", async () => {
    const { draft, runtime } = await loadSchemas();
    const draftModels = alphaSeoModels(draft).sort();
    const runtimeModels = alphaSeoModels(runtime).sort();

    expect(runtimeModels).toEqual(draftModels);
    expect(runtimeModels).toHaveLength(44);
    for (const modelName of draftModels) {
      expect(modelBlock(runtime, modelName)).toBe(modelBlock(draft, modelName));
    }
    expect(runtime).toContain('engineType = "client"');
    expect(runtime).toContain('url      = env("DATABASE_URL")');
    expect(runtime).not.toContain("CANDIDATO ISOLADO");
  });

  it("contains the complete normalized Alpha SEO persistence surface", async () => {
    const { draft } = await loadSchemas();
    const models = alphaSeoModels(draft);
    const required = [
      "AlphaSeoProject",
      "AlphaSeoProjectMember",
      "AlphaSeoProjectInvitation",
      "AlphaSeoUserOnboarding",
      "AlphaSeoProjectActivation",
      "AlphaSeoSavedKeyword",
      "AlphaSeoSavedKeywordTag",
      "AlphaSeoSavedKeywordTagAssignment",
      "AlphaSeoKeywordMetric",
      "AlphaSeoRankConfig",
      "AlphaSeoRankKeyword",
      "AlphaSeoRankRun",
      "AlphaSeoRankSnapshot",
      "AlphaSeoSiteAudit",
      "AlphaSeoAuditPage",
      "AlphaSeoAuditIssue",
      "AlphaSeoAuditLighthouse",
      "AlphaSeoGoogleOAuthGrant",
      "AlphaSeoGscConnection",
      "AlphaSeoGa4Connection",
      "AlphaSeoProjectContextSection",
      "AlphaSeoProjectCompetitor",
      "AlphaSeoProjectKeyPage",
      "AlphaSeoProjectResearchLog",
      "AlphaSeoSamSession",
      "AlphaSeoBacklinkSnapshot",
      "AlphaSeoApiKey",
      "AlphaSeoMcpOAuthClient",
      "AlphaSeoMcpOAuthGrant",
      "AlphaSeoMcpAuthorizationCode",
      "AlphaSeoMcpAccessToken",
      "AlphaSeoMcpRefreshToken",
    ];

    expect(models).toHaveLength(44);
    expect(new Set(models).size).toBe(models.length);
    expect(models).toEqual(expect.arrayContaining(required));
  });

  it("uses usuarios Int foreign keys and exposes reverse relations", async () => {
    const { draft } = await loadSchemas();
    const alpha = alphaSeoSection(draft);

    expect(draft).toContain("alphaSeoProjetosPropriedade");
    expect(draft).toContain("alphaSeoMembresias");
    expect(draft).toContain("alphaSeoGoogleOAuthGrants");
    expect(alpha).toMatch(/ownerId\s+Int/);
    expect(alpha).toMatch(
      /owner\s+usuarios\s+@relation\("AlphaSeoProjectOwner"/,
    );
    expect(alpha).toMatch(/userId\s+Int/);
    expect(alpha).not.toContain("AlphaSeoDraftUser");
  });

  it("stores secrets only as hashes or authenticated ciphertext", async () => {
    const { draft } = await loadSchemas();
    const alpha = alphaSeoSection(draft);

    expect(alpha).toContain("codeVerifierCiphertext");
    expect(alpha).toContain("accessTokenCiphertext");
    expect(alpha).toContain("refreshTokenCiphertext");
    expect(alpha).toContain("clientSecretHash");
    expect(alpha).toContain("keyHash");
    expect(alpha).toContain("tokenHash");
    expect(alpha).not.toMatch(/\bcodeVerifierHash\b/);
    expect(alpha).not.toMatch(
      /^\s*(accessToken|refreshToken|clientSecret|codeVerifier|apiKey)\s+String[?]?\s*$/gm,
    );
  });

  it("keeps canonical lists and provider payloads as Prisma Json, not JSON strings", async () => {
    const { draft } = await loadSchemas();
    const alpha = alphaSeoSection(draft);

    expect(alpha).toMatch(/interestedFeatures\s+Json/);
    expect(alpha).toMatch(/seeds\s+Json/);
    expect(alpha).toMatch(/monthlySearches\s+Json\?/);
    expect(alpha).toMatch(/serpFeatures\s+Json\?/);
    expect(alpha).toMatch(/redirectUris\s+Json/);
    expect(alpha).not.toMatch(/^\s*\w+Json\s+String[?]?/gm);
    expect(alpha).not.toContain("keywordsJson");
    expect(alpha).not.toContain("messagesJson");
    expect(alpha).not.toContain("competitorsJson");
  });

  it("uses integer minor units for every monetary Alpha SEO field", async () => {
    const { draft } = await loadSchemas();
    const alpha = alphaSeoSection(draft);
    const monetaryFloat =
      /^\s*\w*(?:cpc|usd|cent|amount|cost|price|valor)\w*\s+Float[?]?/gim;

    expect(alpha).not.toMatch(monetaryFloat);
    expect(alpha).toMatch(/cpcMicros\s+Int\?/);
    expect(alpha).toMatch(/estimatedMicrosUsd\s+Int/);
    expect(alpha).toMatch(/actualMicrosUsd\s+Int\?/);
  });

  it("separates Google grants, GSC selection, GA4 selection and full MCP OAuth lifecycle", async () => {
    const { draft } = await loadSchemas();
    const alpha = alphaSeoSection(draft);

    expect(alpha).toContain("model AlphaSeoGoogleOAuthGrant {");
    expect(alpha).toContain("model AlphaSeoGscConnection {");
    expect(alpha).toContain("model AlphaSeoGa4Connection {");
    expect(alpha).toContain("model AlphaSeoMcpOAuthClient {");
    expect(alpha).toContain("model AlphaSeoMcpOAuthGrant {");
    expect(alpha).toContain("model AlphaSeoMcpAuthorizationCode {");
    expect(alpha).toContain("model AlphaSeoMcpAccessToken {");
    expect(alpha).toContain("model AlphaSeoMcpRefreshToken {");
    expect(alpha).toContain("codeChallengeMethod");
    expect(alpha).toContain("tokenFamilyId");
  });

  it("keeps the SQL candidate additive, isolated and complete", async () => {
    const sql = await readFile(SQL_CANDIDATE_PATH, "utf8");
    const tables = [...sql.matchAll(/^CREATE TABLE "([^"]+)"/gm)].map(
      (match) => match[1],
    );
    const indexes = [
      ...sql.matchAll(/^CREATE (?:UNIQUE )?INDEX "([^"]+)"/gm),
    ].map((match) => match[1]);
    const references = [...sql.matchAll(/REFERENCES "([^"]+)"/g)].map(
      (match) => match[1],
    );

    expect(tables).toHaveLength(44);
    expect(indexes).toHaveLength(110);
    expect(tables.every((name) => name.startsWith("AlphaSeo"))).toBe(true);
    expect(indexes.every((name) => name.startsWith("AlphaSeo"))).toBe(true);
    expect(
      references.every(
        (name) => name === "usuarios" || name.startsWith("AlphaSeo"),
      ),
    ).toBe(true);
    expect(sql).not.toMatch(
      /^(?:ALTER|DROP|INSERT|UPDATE|DELETE|REPLACE|TRUNCATE|PRAGMA)\b/gm,
    );
    expect(sql).not.toContain("RoadmapWorkspace");
    expect(sql.match(/^WHERE /gm)).toHaveLength(5);
    expect(sql).toContain("AlphaSeoRankRun_one_inflight_per_config_key");
    expect(sql).toContain(
      "AlphaSeoProjectInvitation_one_pending_per_email_key",
    );
    expect(sql).toContain("AlphaSeoMcpOAuthGrant_one_active_consent_key");
  });
});
