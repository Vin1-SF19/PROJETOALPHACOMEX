import { describe, expect, it } from 'vitest';
import { readFile } from 'fs/promises';

describe('Onyx fail-closed security boundaries', () => {
  it('never falls back to an admin or service PAT for user requests', async () => {
    const token = await readFile('src/lib/onyx/user-token.ts', 'utf8');
    const client = await readFile('src/lib/onyx/client.ts', 'utf8');
    expect(token).not.toContain('getAdminOnyxToken');
    expect(client).not.toMatch(/userToken\?\.trim\(\) \|\| API_KEY/);
    expect(client).toContain('Boolean(ONYX_BASE && userToken?.trim())');
  });

  it('validates agent and session ownership and rejects Onyx attachments', async () => {
    const chat = await readFile('src/app/api/onyx/chat/route.ts', 'utf8');
    expect(chat).toContain('userCanUseAgent(agentId');
    expect(chat).toContain('ownedPainelSession.onyxSessionId !== onyxSessionId');
    expect(chat).toContain('remoteAgentId !== agentId');
    expect(chat).toContain('Sessão local obrigatória');
    expect(chat).toContain('Anexos em agentes Onyx estão desabilitados');
    expect(chat).not.toContain('send({ type: "text", text: obj.reasoning })');
  });

  it('fails closed for arbitrary Onyx file ids', async () => {
    const file = await readFile('src/app/api/onyx/file/[fileId]/route.ts', 'utf8');
    expect(file).toContain('Arquivos Onyx indisponíveis sem prova de ownership');
    expect(file).not.toContain('getChatFile(');
  });
});
