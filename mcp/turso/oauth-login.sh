#!/usr/bin/env bash
set -euo pipefail

CLIENT_ID="turso-mcp"
HOST_IP="192.168.35.149"
PORT=19876
REDIRECT_URI="http://${HOST_IP}:${PORT}/callback"
AUTHORIZE_URL="https://app.turso.tech/oauth/mcp/authorize"
TOKEN_URL="https://api.turso.tech/v1/oauth/token"
MCP_URL="https://mcp.turso.ai/mcp"

echo "=== Turso MCP OAuth Login ==="
echo ""

# Generate PKCE
VERIFIER=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
CHALLENGE=$(python3 -c "
import hashlib, base64, sys
v = '$VERIFIER'
print(base64.urlsafe_b64encode(hashlib.sha256(v.encode()).digest()).rstrip(b'=').decode())
")
STATE=$(python3 -c "import secrets; print(secrets.token_urlsafe(16))")

echo "PKCE verifier: $VERIFIER"
echo "PKCE challenge: $CHALLENGE"
echo "State: $STATE"
echo "Redirect URI: $REDIRECT_URI"
echo ""

# Start callback listener on 0.0.0.0 so other machines can reach it
echo "Starting callback listener on ${HOST_IP}:${PORT}..."
python3 -c "
import http.server, urllib.parse, sys, json

class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/callback':
            params = urllib.parse.parse_qs(parsed.query)
            code = params.get('code', [None])[0]
            state = params.get('state', [None])[0]
            error = params.get('error', [None])[0]
            if error:
                print(f'ERROR: {error}', file=sys.stderr)
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'OAuth error received. You can close this tab.')
                sys.exit(1)
            if state != '$STATE':
                print(f'STATE MISMATCH: expected \$STATE, got {state}', file=sys.stderr)
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'State mismatch. You can close this tab.')
                sys.exit(1)
            if code:
                with open('/tmp/turso_oauth_code.txt', 'w') as f:
                    f.write(code)
                print(f'CODE_RECEIVED: {code}', flush=True)
                self.send_response(200)
                self.send_header('Content-Type', 'text/html')
                self.end_headers()
                self.wfile.write(b'<html><body><h2>Turso MCP: Login successful!</h2><p>You can close this tab.</p></body></html>')
            else:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'Missing code parameter.')
        else:
            self.send_response(404)
            self.end_headers()
    def log_message(self, format, *args):
        pass

server = http.server.HTTPServer(('0.0.0.0', $PORT), Handler)
print('LISTENING on 0.0.0.0:$PORT', flush=True)
server.handle_request()
" &
LISTENER_PID=$!
sleep 1

# Build authorize URL
ENC_REDIRECT=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${REDIRECT_URI}', safe=''))")
AUTH_URL="${AUTHORIZE_URL}?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${ENC_REDIRECT}&code_challenge=${CHALLENGE}&code_challenge_method=S256&state=${STATE}"

echo ""
echo "=== AUTH URL ==="
echo "$AUTH_URL"
echo ""
echo "Abra este link no browser (na outra maquina) para fazer login na Turso:"
echo ""
echo "Aguardando callback em ${HOST_IP}:${PORT} (timeout 180s)..."
echo ""

# Wait for callback
for i in $(seq 1 180); do
    if [ -f /tmp/turso_oauth_code.txt ]; then
        break
    fi
    sleep 1
done

kill $LISTENER_PID 2>/dev/null || true

if [ ! -f /tmp/turso_oauth_code.txt ]; then
    echo "ERRO: Timeout aguardando callback OAuth."
    exit 1
fi

CODE=$(cat /tmp/turso_oauth_code.txt)
rm -f /tmp/turso_oauth_code.txt

echo ""
echo "=== Exchanging code for token ==="
TOKEN_RESPONSE=$(curl -s -X POST "$TOKEN_URL" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -d "grant_type=authorization_code&code=${CODE}&redirect_uri=${REDIRECT_URI}&client_id=${CLIENT_ID}&code_verifier=${VERIFIER}")

echo "$TOKEN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$TOKEN_RESPONSE"

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ]; then
    echo "ERRO: Nao obtive access_token."
    exit 1
fi

echo ""
echo "=== Testando MCP com token ==="
MCP_RESPONSE=$(curl -s -X POST "$MCP_URL" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"opencode","version":"1.0"}}}')

echo "$MCP_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$MCP_RESPONSE"

echo ""
echo "=== Listando tools ==="
TOOLS_RESPONSE=$(curl -s -X POST "$MCP_URL" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}')

echo "$TOOLS_RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
tools = d.get('result', {}).get('tools', [])
for t in tools:
    desc = t.get('description', '')[:80]
    print(f'  {t[\"name\"]}: {desc}')
" 2>/dev/null || echo "$TOOLS_RESPONSE"

echo ""
echo "=== Salvando token para uso futuro ==="
mkdir -p /home/ialpha/.config/turso-mcp
cat > /home/ialpha/.config/turso-mcp/token.json <<EOF
{
  "access_token": "${ACCESS_TOKEN}",
  "token_type": "$(echo "$TOKEN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token_type','Bearer'))" 2>/dev/null)",
  "expires_in": $(echo "$TOKEN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('expires_in',3600))" 2>/dev/null),
  "obtained_at": "$(date -Iseconds)"
}
EOF
chmod 600 /home/ialpha/.config/turso-mcp/token.json
echo "Token salvo em /home/ialpha/.config/turso-mcp/token.json"
echo ""
echo "=== CONCLUIDO ==="
