import { config } from "dotenv";

config({ path: ".env", quiet: true });
config({ path: ".env.local", override: true, quiet: true });

const command = process.argv[2] ?? "doctor";

function option(name) {
  return process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
}

try {
  let result;
  if (command === "doctor") {
    const { runStorageDoctor } = await import("../src/lib/storage/doctor.ts");
    result = await runStorageDoctor();
  } else if (command === "inventory") {
    const { runStorageInventory } = await import("../src/lib/storage/inventory.ts");
    result = runStorageInventory();
  } else if (command === "poc") {
    const { parseStorageSize, runStoragePoc } = await import("../src/lib/storage/poc.ts");
    const provider = option("provider") ?? "auto";
    if (!["auto", "quobjects", "vercel-blob"].includes(provider)) throw new Error("INVALID_PROVIDER");
    result = await runStoragePoc({
      execute: process.argv.includes("--execute"),
      confirm: option("confirm") ?? "",
      provider,
      size: parseStorageSize(option("size") ?? "10MiB"),
      file: option("file"),
      evidenceFile: option("evidence"),
    });
  } else {
    result = {
      ok: false,
      command: "inventory",
      code: 2,
      checks: { cli: { ok: false, errorCode: "UNKNOWN_COMMAND" } },
      timestamp: new Date().toISOString(),
    };
  }
  console.info(JSON.stringify(result));
  process.exitCode = result.code;
} catch {
  console.info(JSON.stringify({
    ok: false,
    command: ["doctor", "inventory", "poc"].includes(command) ? command : "inventory",
    code: 2,
    checks: { cli: { ok: false, errorCode: "CLI_FAILED" } },
    timestamp: new Date().toISOString(),
  }));
  process.exitCode = 2;
}
