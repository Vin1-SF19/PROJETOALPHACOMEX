import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env", quiet: true });
loadDotenv({ path: ".env.local", override: true, quiet: true });

const command = process.argv[2] ?? "doctor";
const option = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const emit = (payload, code = 0) => {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  process.exitCode = code;
};
const readSecretFromStdin = async () => {
  if (process.stdin.isTTY) throw new Error("PASSWORD_STDIN_REQUIRED");
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  const value = Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
  if (!value || value.length > 512) throw new Error("INVALID_PASSWORD_STDIN");
  return value;
};

try {
  const { readSmbRuntimeConfig } = await import("../src/lib/alpha-explorer/smb/config.ts");
  const { issueSmbTicket } = await import("../src/lib/alpha-explorer/smb/ticket.ts");
  const settings = readSmbRuntimeConfig();
  const configuredOrigin = settings.runtime === "production" ? settings.productionOrigin : settings.stageOrigin;
  const origin = option("origin") ?? configuredOrigin;
  const userId = Number(option("user-id") ?? "0");
  const actorUserId = Number(option("actor-user-id") ?? "0");
  const targetUserId = Number(option("target-user-id") ?? "0");

  if (command === "doctor") {
    emit({
      ok: settings.enabled,
      command,
      code: settings.enabled ? 0 : 1,
      checks: {
        enabled: settings.enabled,
        enrollmentEnabled: settings.enrollmentEnabled,
        writeEnabled: settings.writeEnabled,
        gatewayTls: settings.gatewayUrl.startsWith("https://") || settings.gatewayUrl.startsWith("http://127.0.0.1:"),
        runtimeAuthorityIsolated: Boolean(settings.issuer && settings.keyId && settings.secret),
        originMatchesRuntime: origin === configuredOrigin,
        originSeparation: settings.productionOrigin !== settings.stageOrigin,
      },
      timestamp: new Date().toISOString(),
    }, settings.enabled ? 0 : 1);
  } else {
    const administrative = command.startsWith("admin-");
    if (administrative) {
      if (!Number.isSafeInteger(actorUserId) || actorUserId <= 0) throw new Error("INVALID_ACTOR_USER_ID");
      if (!Number.isSafeInteger(targetUserId) || targetUserId <= 0) throw new Error("INVALID_TARGET_USER_ID");
    } else if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("INVALID_USER_ID");
    const gatewayCall = async (scope, resource, pathname, init = {}, constraints = {}) => {
      const ticket = issueSmbTicket({
        config: settings,
        userId: administrative ? targetUserId : userId,
        actorUserId: administrative ? actorUserId : undefined,
        origin,
        scope,
        resource,
        ...constraints,
      });
      const response = await fetch(new URL(pathname, ticket.gatewayUrl), {
        ...init,
        headers: { authorization: `Bearer ${ticket.token}`, origin, "content-type": "application/json", ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(10_000),
      });
      const body = await response.json().catch(() => ({ ok: false, code: "INVALID_GATEWAY_RESPONSE" }));
      if (!response.ok) throw new Error(typeof body.code === "string" ? body.code : "GATEWAY_REQUEST_FAILED");
      return body;
    };

    if (command === "admin-status") {
      const data = await gatewayCall("credential:status", "root", "/v1/admin/credentials/status");
      emit({
        ok: true,
        command,
        targetUserId,
        data: {
          linked: data.linked === true,
          principal: typeof data.principal === "string" ? data.principal : null,
          credentialVersion: Number.isSafeInteger(data.credentialVersion) ? data.credentialVersion : 0,
          supportId: typeof data.supportId === "string" ? data.supportId : undefined,
        },
        timestamp: new Date().toISOString(),
      });
    } else if (command === "admin-enroll" || command === "admin-rotate") {
      const execute = process.argv.includes("--execute");
      const principal = option("principal")?.trim() ?? "";
      if (!principal || principal.length > 128) throw new Error("INVALID_QNAP_PRINCIPAL");
      const confirmation = command === "admin-enroll" ? "alpha-explorer-smb-admin-enroll" : "alpha-explorer-smb-admin-rotate";
      if (!execute) {
        emit({ ok: true, command, dryRun: true, targetUserId, planned: command, timestamp: new Date().toISOString() });
      } else {
        if (option("confirm") !== confirmation) throw new Error("CONFIRMATION_REQUIRED");
        const password = await readSecretFromStdin();
        const scope = command === "admin-enroll" ? "credential:enroll" : "credential:rotate";
        const pathname = command === "admin-enroll" ? "/v1/admin/credentials/enroll" : "/v1/admin/credentials/rotate";
        const data = await gatewayCall(scope, "root", pathname, {
          method: "POST",
          body: JSON.stringify({ principal, password }),
        });
        emit({ ok: true, command, targetUserId, data, timestamp: new Date().toISOString() });
      }
    } else if (command === "admin-unlink") {
      const execute = process.argv.includes("--execute");
      if (!execute) {
        emit({ ok: true, command, dryRun: true, targetUserId, planned: command, timestamp: new Date().toISOString() });
      } else {
        if (option("confirm") !== "alpha-explorer-smb-admin-unlink") throw new Error("CONFIRMATION_REQUIRED");
        const data = await gatewayCall("credential:unlink", "root", "/v1/admin/credentials", {
          method: "DELETE",
          body: JSON.stringify({ confirm: true }),
        });
        emit({ ok: true, command, targetUserId, data, timestamp: new Date().toISOString() });
      }
    } else if (command === "health") {
      emit({ ok: true, command, data: await gatewayCall("health", "root", "/v1/health"), timestamp: new Date().toISOString() });
    } else if (command === "identity") {
      const data = await gatewayCall("link_status", "root", "/v1/link");
      emit({ ok: true, command, linked: data.linked === true, timestamp: new Date().toISOString() });
    } else if (command === "list") {
      const handle = option("handle") ?? "root";
      const limit = Number(option("limit") ?? "100");
      const offset = Number(option("offset") ?? "0");
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200 || !Number.isSafeInteger(offset) || offset < 0 || offset > 2_000) throw new Error("INVALID_PAGINATION");
      const path = `/v1/items?handle=${encodeURIComponent(handle)}&limit=${limit}&offset=${offset}`;
      emit({ ok: true, command, data: await gatewayCall("list", handle, path), timestamp: new Date().toISOString() });
    } else if (command === "trash-list") {
      const limit = Number(option("limit") ?? "100");
      const offset = Number(option("offset") ?? "0");
      if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200 || !Number.isSafeInteger(offset) || offset < 0) throw new Error("INVALID_PAGINATION");
      const path = `/v1/trash?limit=${limit}&offset=${offset}`;
      emit({ ok: true, command, data: await gatewayCall("trash_list", "root", path), timestamp: new Date().toISOString() });
    } else if (command === "reconcile") {
      const execute = process.argv.includes("--execute");
      if (execute && option("confirm") !== "alpha-explorer-smb-reconcile") throw new Error("CONFIRMATION_REQUIRED");
      const data = await gatewayCall("upload_reconcile", "root", "/v1/uploads/reconcile", {
        method: "POST", body: JSON.stringify({ execute }),
      });
      emit({ ok: true, command, dryRun: !execute, data, timestamp: new Date().toISOString() });
    } else {
      throw new Error("UNKNOWN_COMMAND");
    }
  }
} catch (error) {
  emit({
    ok: false, command, code: 2,
    checks: { cli: { ok: false, errorCode: error instanceof Error ? error.message : "CLI_FAILED" } },
    timestamp: new Date().toISOString(),
  }, 2);
}
