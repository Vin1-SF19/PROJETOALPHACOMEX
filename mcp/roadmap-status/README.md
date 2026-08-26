# roadmap-status-mcp

MCP server local e fino: expõe o quadro de status de produção do Roadmap Alpha
(PainelAlpha) para uso no Claude Code (e futuramente Codex), via chamadas
HTTP autenticadas contra `/api/roadmap/production/*` no próprio painel.

Não roda dentro do processo Next.js — é um processo Node separado, iniciado
localmente pelo cliente MCP (Claude Code).

## Configurar

1. `npm install && npm run build`
2. Gerar uma API key de produção do Roadmap (`RoadmapApiKey`) com scopes
   `roadmap:read` e `roadmap:write` — via tela de administração do painel
   (a implementar) ou diretamente no banco por um administrador.
3. Copiar `.env.example` para `.env` e preencher `ROADMAP_MCP_BASE_URL` e
   `ROADMAP_MCP_TOKEN`.

## Registrar no Claude Code

Adicionar em `.mcp.json` na raiz do projeto (não commitar o token real):

```json
{
  "mcpServers": {
    "roadmap-status": {
      "command": "node",
      "args": ["mcp/roadmap-status/dist/index.js"],
      "env": {
        "ROADMAP_MCP_BASE_URL": "https://SEU-DOMINIO/api/roadmap/production",
        "ROADMAP_MCP_TOKEN": "roadmap_key_..."
      }
    }
  }
}
```

Ou via CLI:

```bash
claude mcp add roadmap-status -- node mcp/roadmap-status/dist/index.js
```

(nesse caso, definir `ROADMAP_MCP_BASE_URL`/`ROADMAP_MCP_TOKEN` no ambiente
antes de abrir o Claude Code, ou usar `.env` local lido por um wrapper.)

## Ferramentas expostas

- `roadmap_listar_fila`
- `roadmap_ver_fase`
- `roadmap_marcar_fase_iniciada`
- `roadmap_marcar_fase_concluida`
- `roadmap_marcar_fase_falhou`
- `roadmap_perguntar`
- `roadmap_registrar_nota`
- `roadmap_ver_historico`
- `roadmap_criar_run`
