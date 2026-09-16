import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { CHATBOT_NAVIGATION, CHATBOT_ROUTE_COUNT } from "@/components/ChatBotAlpha/shell/navigation";

function filesIn(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => { const path = join(directory, name); return statSync(path).isDirectory() ? filesIn(path) : [path]; });
}

describe("ChatBot Alpha frontend architecture", () => {
  it("declara exatamente as dez seções nativas", () => {
    expect(CHATBOT_ROUTE_COUNT).toBe(10);
    expect(CHATBOT_NAVIGATION.flatMap((group) => group.items.map((item) => item.label))).toEqual(["Dashboard", "Inbox", "Contatos", "Fluxos", "Agentes IA", "Sequências", "Campanhas", "Templates", "Integrações", "Configurações"]);
  });

  it("não importa backend legado, referência externa ou transportes de rede", () => {
    const roots = ["src/app/PainelAlpha/ChatBotAlpha", "src/components/ChatBotAlpha/shell", "src/components/ChatBotAlpha/shared", "src/components/ChatBotAlpha/inbox", "src/components/ChatBotAlpha/flows", "src/components/ChatBotAlpha/dashboard", "src/components/ChatBotAlpha/contatos", "src/components/ChatBotAlpha/agentes", "src/components/ChatBotAlpha/campanhas", "src/components/ChatBotAlpha/sequencias", "src/components/ChatBotAlpha/templates", "src/components/ChatBotAlpha/integracoes", "src/components/ChatBotAlpha/configuracoes", "src/services/chatbot", "src/store/useChatbotStore.ts", "src/mocks/chatbot"];
    const source = roots.flatMap((root) => statSync(root).isDirectory() ? filesIn(root) : [root]).filter((file) => /\.(ts|tsx)$/.test(file)).map((file) => readFileSync(file, "utf8")).join("\n");
    expect(source).not.toMatch(/actions\/ChatBotAlpha|chatbot-alpha\/chat-api|ChatbotX-main/);
    expect(source).not.toMatch(/\bfetch\s*\(|new\s+(WebSocket|EventSource)\s*\(|pusher-js/);
    expect(source).not.toMatch(/getSnapshot\s*\(/);
  });

  it("mantém filtros operacionais, drawers acessíveis e criação real de fluxo local", () => {
    const inbox = readFileSync("src/components/ChatBotAlpha/inbox/InboxWorkspace.tsx", "utf8") + readFileSync("src/components/ChatBotAlpha/inbox/ConversationList.tsx", "utf8");
    const shell = readFileSync("src/components/ChatBotAlpha/shell/ChatbotShell.tsx", "utf8");
    const flows = readFileSync("src/components/ChatBotAlpha/flows/FlowsWorkspace.tsx", "utf8");
    const agents = readFileSync("src/components/ChatBotAlpha/agentes/AgentsWorkspace.tsx", "utf8");
    expect(inbox).toContain("Filtrar por canal");
    expect(inbox).toContain("Ordenar conversas");
    expect(inbox).toContain("SheetContent");
    expect(shell).toContain("SheetContent");
    expect(flows).toContain("flow-local-");
    expect(agents).toContain("flowIds");
  });

  it("usa RHF/Zod e propaga bloqueio de mutações nos workspaces editáveis", () => {
    const files = ["agentes/AgentsWorkspace.tsx", "contatos/ContactsWorkspace.tsx", "campanhas/CampaignsWorkspace.tsx", "sequencias/SequencesWorkspace.tsx", "templates/TemplatesWorkspace.tsx", "configuracoes/SettingsWorkspace.tsx"];
    for (const file of files) {
      const source = readFileSync(join("src/components/ChatBotAlpha", file), "utf8");
      expect(source).toContain("zodResolver");
      expect(source).toContain("useForm");
      expect(source).toContain("aria-invalid");
      expect(source).not.toContain("FormData");
      expect(source).not.toContain("form action=");
      expect(source).toContain("isBusy");
      expect(source).toContain("disabled={isBusy}");
    }
    const integrations = readFileSync("src/components/ChatBotAlpha/integracoes/IntegrationsWorkspace.tsx", "utf8");
    expect(integrations).toContain("isBusy");
    expect(integrations).toContain("disabled={isBusy}");
  });
});
