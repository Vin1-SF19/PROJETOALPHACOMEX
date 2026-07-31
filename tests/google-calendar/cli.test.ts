import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("Agenda Alpha CLI", () => {
  it("doctor não imprime valores de segredos", async () => {
    const env = {
      ...process.env,
      GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL:
        "service@test.iam.gserviceaccount.com",
      GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY:
        "-----BEGIN PRIVATE KEY-----\\nSUPER_SECRET\\n-----END PRIVATE KEY-----",
      AGENDA_ALPHA_DISTRIBUTED_LOCK_ENABLED: "false",
      AGENDA_ALPHA_QUEUE_ENABLED: "false",
      AGENDA_ALPHA_PUSH_ENABLED: "false",
    };
    const { stdout } = await execFileAsync(
      process.execPath,
      ["node_modules/tsx/dist/cli.mjs", "scripts/calendar-alpha-doctor.mjs"],
      { cwd: process.cwd(), env },
    );

    expect(stdout).toContain('"secretsPrinted": false');
    expect(stdout).not.toContain("SUPER_SECRET");
  });

  it("não devolve argumento bruto nos erros das CLIs", async () => {
    const secretArgument = "--token=SUPER_SECRET_VALUE";
    try {
      await execFileAsync(
        process.execPath,
        [
          "node_modules/tsx/dist/cli.mjs",
          "scripts/calendar-alpha-worker.mjs",
          secretArgument,
        ],
        { cwd: process.cwd(), env: process.env },
      );
      throw new Error("CLI deveria rejeitar o argumento");
    } catch (error) {
      const output =
        typeof error === "object" && error !== null && "stderr" in error
          ? String(error.stderr)
          : String(error);
      expect(output).toContain("INVALID_ARGUMENT");
      expect(output).not.toContain("SUPER_SECRET_VALUE");
    }
  });
});
