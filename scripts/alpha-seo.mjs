import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { buildAlphaSeoSourceManifest, serializeAlphaSeoManifest } from "../src/lib/alpha-seo/inventory.ts";
import { loadAlphaSeoEnvironment, runAlphaSeoDoctor } from "../src/lib/alpha-seo/doctor.ts";
import { runAlphaSeoWorkerOnce, runPersistentAlphaSeoWorkerOnce } from "../src/lib/alpha-seo/worker.ts";
import { makeCliResult } from "../src/lib/alpha-seo/contracts.ts";

loadAlphaSeoEnvironment();

const args = process.argv.slice(2);
const command = args[0];
const json = args.includes("--json");
const sourceArgument = args.find((value) => value.startsWith("--source="));
const sourceRoot = path.resolve(sourceArgument?.slice("--source=".length) ?? process.env.ALPHA_SEO_SOURCE_ROOT ?? path.join(process.cwd(), "..", "open-seo-main"));
const manifestPath = path.resolve(process.cwd(), "docs", "alpha-seo", "source-manifest.json");

function emit(result) {
  process.stdout.write(`${JSON.stringify(result, null, json ? 2 : 0)}\n`);
  process.exitCode = result.code;
}

async function inventory() {
  const manifest = await buildAlphaSeoSourceManifest(sourceRoot);
  const serialized = serializeAlphaSeoManifest(manifest);
  let matches = true;
  if (args.includes("--check")) {
    const current = await fs.readFile(manifestPath, "utf8").catch(() => "");
    matches = current === serialized;
  } else {
    await fs.mkdir(path.dirname(manifestPath), { recursive: true });
    await fs.writeFile(manifestPath, serialized, "utf8");
  }
  emit(makeCliResult({
    command: "inventory",
    checks: [
      { id: "inventory.source", ok: true, kind: "contract", message: `Sanitized source inventory generated for ${manifest.source.label}`, details: { sourceHash: manifest.source.hash, counts: manifest.counts } },
      { id: "inventory.manifest", ok: matches, kind: "contract", message: matches ? (args.includes("--check") ? "Committed manifest matches the source checkout" : "Manifest written deterministically") : "Committed manifest differs from the source checkout" },
      { id: "inventory.reconciliation", ok: true, kind: "contract", message: manifest.mcp.reconciliation.note, details: { mcp: manifest.mcp.reconciliation, skills: manifest.skillReconciliation, auditIssues: manifest.auditIssueReconciliation } },
      { id: "inventory.redaction", ok: true, kind: "safety", message: "Absolute source path and environment files are excluded from the manifest" },
    ],
  }));
}

try {
  if (command === "inventory") await inventory();
  else if (command === "doctor") emit(await runAlphaSeoDoctor({ sourceRoot, skipNetwork: args.includes("--offline") }));
  else if (command === "worker" && args.includes("--once") && args.includes("--persistent")) {
    const result = await runPersistentAlphaSeoWorkerOnce();
    process.stdout.write(`${JSON.stringify({ ok: true, command: "worker", mode: "persistent", result }, null, json ? 2 : 0)}\n`);
  }
  else if (command === "worker" && args.includes("--once")) emit(await runAlphaSeoWorkerOnce());
  else emit(makeCliResult({ command: command === "worker" ? "worker" : command === "doctor" ? "doctor" : "inventory", checks: [{ id: "cli.usage", ok: false, kind: "config", message: "Usage: alpha-seo.mjs inventory [--check] [--json] | doctor --json [--offline] | worker --once [--persistent] --json" }] }));
} catch {
  emit(makeCliResult({ command: command === "worker" ? "worker" : command === "doctor" ? "doctor" : "inventory", checks: [{ id: "cli.failure", ok: false, kind: "contract", message: "Alpha SEO CLI could not complete; sensitive error details were suppressed" }] }));
}
