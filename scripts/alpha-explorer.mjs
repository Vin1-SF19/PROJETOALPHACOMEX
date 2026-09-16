import { config } from "dotenv";

config({ path: ".env", quiet: true });
config({ path: ".env.local", override: true, quiet: true });

const command = process.argv[2] ?? "doctor";
const option = (name) => process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const integerOption = (name) => {
  const parsed = Number(option(name));
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`INVALID_${name.toUpperCase()}`);
  return parsed;
};

try {
  const cli = await import("../src/lib/alpha-explorer/cli.ts");
  let output;
  if (command === "doctor") {
    output = await cli.runExplorerDoctor();
  } else if (command === "permissions") {
    output = await cli.runExplorerPermissions({
      userId: integerOption("user-id"),
      path: option("path") ?? "",
      capability: cli.parseExplorerCapability(option("capability") ?? "list"),
    });
  } else if (command === "acl-set") {
    const subjectType = option("subject-type") ?? "";
    if (!["USER", "ROLE", "CARGO"].includes(subjectType)) throw new Error("INVALID_SUBJECT_TYPE");
    const capabilities = (option("capabilities") ?? "").split(",").filter(Boolean).map(cli.parseExplorerCapability);
    if (capabilities.length === 0) throw new Error("INVALID_CAPABILITIES");
    output = await cli.runExplorerAclSet({
      userId: integerOption("user-id"),
      subjectType,
      subjectId: option("subject-id") ?? "",
      prefix: option("prefix") ?? "",
      capabilities,
      execute: process.argv.includes("--execute"),
      confirm: option("confirm"),
    });
  } else if (command === "list") {
    output = await cli.runExplorerList({
      userId: integerOption("user-id"),
      prefix: option("prefix") ?? "",
      continuationToken: option("cursor"),
      limit: option("limit") ? integerOption("limit") : undefined,
    });
  } else if (command === "reconcile") {
    output = await cli.runExplorerReconcile({
      userId: integerOption("user-id"),
      prefix: option("prefix") ?? "",
      execute: process.argv.includes("--execute"),
      confirm: option("confirm"),
    });
  } else if (command === "smoke") {
    const { parseStorageSize, runStoragePoc } = await import("../src/lib/storage/poc.ts");
    const provider = option("provider") ?? "auto";
    if (!["auto", "quobjects", "vercel-blob"].includes(provider)) throw new Error("INVALID_PROVIDER");
    output = await runStoragePoc({
      execute: process.argv.includes("--execute"),
      confirm: option("confirm") ?? "",
      provider,
      size: parseStorageSize(option("size") ?? "10MiB"),
      evidenceFile: option("evidence"),
    });
  } else {
    throw new Error("UNKNOWN_COMMAND");
  }
  console.info(JSON.stringify(output));
  process.exitCode = output.code;
} catch (error) {
  console.info(JSON.stringify({
    ok: false,
    command,
    code: 2,
    checks: { cli: { ok: false, errorCode: error instanceof Error ? error.message : "CLI_FAILED" } },
    timestamp: new Date().toISOString(),
  }));
  process.exitCode = 2;
}
