import { loadChatbotAlphaEnvironment, runChatbotAlphaDoctor } from "../src/lib/chatbot-alpha/doctor.ts";
import { CHATBOT_ALPHA_CAPABILITIES, makeCliResult } from "../src/lib/chatbot-alpha/contracts.ts";
import {
  isChatbotxConfigured,
  listarConversas,
  listarMensagens,
  enviarMensagem,
  identificadorPorId,
} from "../src/lib/chatbot-alpha/chat-api.ts";
import { randomUUID } from "node:crypto";

loadChatbotAlphaEnvironment();

const args = process.argv.slice(2);
const command = args[0];
const json = args.includes("--json");

function flagValue(name) {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
}

function emit(result) {
  process.stdout.write(`${JSON.stringify(result, null, json ? 2 : 0)}\n`);
  process.exitCode = result.code;
}

async function doctor() {
  emit(await runChatbotAlphaDoctor());
}

async function capabilities() {
  const result = makeCliResult({
    command: "capabilities",
    checks: [
      {
        id: "capabilities.list",
        ok: true,
        kind: "contract",
        message: `${CHATBOT_ALPHA_CAPABILITIES.length} capabilities registered`,
        details: {
          available: CHATBOT_ALPHA_CAPABILITIES.filter((c) => c.status === "AVAILABLE").length,
          notConfigured: CHATBOT_ALPHA_CAPABILITIES.filter((c) => c.status === "NOT_CONFIGURED").length,
          pendingReference: CHATBOT_ALPHA_CAPABILITIES.filter((c) => c.status === "PENDING_REFERENCE").length,
        },
      },
    ],
    capabilities: CHATBOT_ALPHA_CAPABILITIES,
  });
  emit(result);
}

function requireConfig() {
  if (isChatbotxConfigured()) return null;
  return makeCliResult({
    command: "doctor",
    checks: [
      {
        id: "config.chatbotx-api",
        ok: false,
        kind: "config",
        message: "CHATBOTX_API_URL e CHATBOTX_API_KEY não configurados; CHATBOTX_API_TOKEN é aceito somente como fallback legado",
      },
    ],
  });
}

async function listConversations() {
  const notConfigured = requireConfig();
  if (notConfigured) return emit(notConfigured);

  const correlationId = randomUUID();
  const resultado = await listarConversas(
    { keyword: flagValue("--keyword"), page: flagValue("--page") ? Number(flagValue("--page")) : undefined },
    correlationId,
  );
  emit(
    makeCliResult({
      command: "list",
      checks: [
        {
          id: "chat.conversations",
          ok: resultado.success,
          kind: "contract",
          message: resultado.success
            ? `${resultado.data.data.length} conversas retornadas`
            : resultado.error,
          details: resultado.success ? { pageCount: resultado.data.pageCount, totalCount: resultado.data.totalCount, totalCountCapped: resultado.data.totalCountCapped, data: resultado.data.data } : { correlationId },
        },
      ],
    }),
  );
}

async function listMessages() {
  const notConfigured = requireConfig();
  if (notConfigured) return emit(notConfigured);

  const contactId = flagValue("--contact-id");
  if (!contactId) {
    return emit(
      makeCliResult({
        command: "list",
        checks: [{ id: "cli.usage", ok: false, kind: "config", message: "Uso: list-messages --contact-id <id> [--cursor <cursor>]" }],
      }),
    );
  }

  const correlationId = randomUUID();
  const resultado = await listarMensagens(
    { contatoIdentifier: identificadorPorId(contactId), cursor: flagValue("--cursor") },
    correlationId,
  );
  emit(
    makeCliResult({
      command: "list",
      checks: [
        {
          id: "chat.messages",
          ok: resultado.success,
          kind: "contract",
          message: resultado.success
            ? `${resultado.data.data.length} mensagens retornadas`
            : resultado.error,
          details: resultado.success ? { nextCursor: resultado.data.nextCursor, data: resultado.data.data } : { correlationId },
        },
      ],
    }),
  );
}

async function sendMessage() {
  const notConfigured = requireConfig();
  if (notConfigured) return emit(notConfigured);

  const contactId = flagValue("--contact-id");
  const text = flagValue("--text");
  if (!contactId || !text) {
    return emit(
      makeCliResult({
        command: "doctor",
        checks: [{ id: "cli.usage", ok: false, kind: "config", message: "Uso: send-message --contact-id <id> --text <mensagem>" }],
      }),
    );
  }

  const correlationId = randomUUID();
  const resultado = await enviarMensagem({ contatoIdentifier: identificadorPorId(contactId), text }, correlationId);
  emit(
    makeCliResult({
      command: "doctor",
      checks: [
        {
          id: "chat.messages.send",
          ok: resultado.success,
          kind: "contract",
          message: resultado.success ? "Mensagem enviada (204)" : resultado.error,
          details: { correlationId },
        },
      ],
    }),
  );
}

try {
  if (command === "doctor") await doctor();
  else if (command === "capabilities") await capabilities();
  else if (command === "list") await capabilities();
  else if (command === "list-conversations") await listConversations();
  else if (command === "list-messages") await listMessages();
  else if (command === "send-message") await sendMessage();
  else
    emit(
      makeCliResult({
        command: "doctor",
        checks: [
          {
            id: "cli.usage",
            ok: false,
            kind: "config",
            message:
              "Usage: chatbot-alpha.mjs doctor|capabilities|list|list-conversations [--keyword <k>] [--page <n>]|list-messages --contact-id <id> [--cursor <c>]|send-message --contact-id <id> --text <msg> [--json]",
          },
        ],
      }),
    );
} catch {
  emit(
    makeCliResult({
      command: command === "capabilities" || command === "list" ? "capabilities" : "doctor",
      checks: [
        {
          id: "cli.failure",
          ok: false,
          kind: "contract",
          message: "ChatBot Alpha CLI could not complete; sensitive error details were suppressed",
        },
      ],
    }),
  );
}
