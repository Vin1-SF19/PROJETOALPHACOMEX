# Story: Voz local do Bibble com Chatterbox Multilingual V3

## Status

Ready for Review — implementação e motor TTS validados; smoke autenticado da UI pendente.

## Story

**Como** usuário do Bibble,
**quero** ouvir as respostas do assistente em uma voz própria gerada localmente,
**para** conversar por texto ou áudio sem depender de TTS pago e sem comprometer o chat existente.

## Contexto e diagnóstico confirmado

- Em staging atrás do Cloudflare Tunnel, o proxy rejeitava o botão **Ouvir** com `403 INVALID_ORIGIN`: `request.url` continha a origem interna do Next.js, enquanto `Origin` continha a origem pública do navegador.
- A guarda same-origin agora compara a origem parseada com a autoridade pública do header `Host`, seguindo o padrão dos guards HTTP do projeto. `Host` ausente/inválido, `Origin` ausente/divergente e `Sec-Fetch-Site` cross-site continuam fail-closed; `x-forwarded-host` não é usado como autoridade.
- Após o guard, o `503` persistia por uma segunda causa independente: a base raiz normalizada por `URL` mantinha `pathname="/"`; concatenar esse valor com `/health` ou `/v1/speech` produzia `//health`/`//v1/speech`, interpretado por `new URL()` como troca de autoridade para os hosts `health`/`v1`. O proxy agora monta o pathname em uma cópia da URL configurada, preserva bases com subpath, rejeita caminhos capazes de trocar autoridade e verifica que a origem final não mudou.
- O Painel Alpha é Next.js 16/React 19; o chat é montado por `src/app/PainelAlpha/page.tsx` e `BibbleChatLayout`.
- `/api/bibble/chat` autentica, valida e transmite respostas por SSE; `completion.ts` conversa com o provedor configurado sem participação do TTS.
- `BibbleSession`/`BibbleMessage` persistem sessão, papel, conteúdo e horário; áudio não exige nova mensagem nem alteração de schema.
- `BotaoMicrofone` já grava com `MediaRecorder`, usa `/api/onyx/voice/transcribe` e faz fallback STT nativo. Esse fluxo foi preservado.
- `vozUsadaRef` já distinguia transcrição da entrada corrente; o fluxo foi adaptado para `inputType` transitório, sem persistir autoplay no histórico.
- `BotaoFalarMensagem` e `useVoiceStatus` já ofereciam TTS Onyx/Web Speech. A integração foi direcionada ao proxy Bibble local.
- `BibbleMessageBubble` já renderizava o botão na própria resposta; nenhuma mensagem de áudio separada foi criada.
- O frontend usa rotas server-side, portanto o navegador não acessa `127.0.0.1:8787`.
- Em 2026-09-16, `/home/ialpha/services/bibble-voice/voices/bibble.wav` existe e teve seu uso autorizado.
- A RTX 4090 permanece ocupada pelo LLM; para preservar Ollama e sua VRAM, o runtime foi explicitamente configurado com `TTS_DEVICE=cpu` e 8 threads.
- O serviço usa ambiente exclusivo Python 3.11.15; o modo CPU foi validado sem alocação adicional de VRAM.
- A unidade systemd aplica limites operacionais de CPU, memória e processos; em repouso o serviço retorna a aproximadamente 45 MiB de RAM.

## Acceptance Criteria

### A. Microserviço, modelo e recursos

- [x] **AC1.** FastAPI roda separado do Next.js em `/home/ialpha/services/bibble-voice`, dentro de ambiente Python 3.11 exclusivo.
- [x] **AC2.** O serviço escuta somente em `127.0.0.1:8787` e expõe `GET /health`, `POST /v1/speech`, `POST /v1/model/unload` e `GET /v1/model/status`.
- [x] **AC3.** A implementação usa `ChatterboxMultilingualTTS`, snapshot local Multilingual 0.1.7 com T3 V3 e idioma `pt`; o device é explícito (`cpu` ou `cuda`), sem troca silenciosa de device ou voz.
- [x] **AC4.** O boot não carrega o modelo; estado inclui modelo, horários de carga/último uso e indicador de loading protegidos por lock.
- [x] **AC5.** Geração é serializada, fila é limitada e chamadas concorrentes não disparam múltiplos carregamentos ou gerações do motor.
- [x] **AC6.** Com `bibble.wav` autorizado, geração real, cache, unload/restart e reload foram comprovados em CPU; em CUDA, a rotina também executa `torch.cuda.empty_cache()`.

### B. Cache, limites, segurança e operação

- [x] **AC7.** Cache WAV usa SHA-256 de texto, voz, idioma e configuração, com TTL, limite de bytes, gravação atômica e cache hit sem GPU.
- [x] **AC8.** Textos têm limite de 2.500 caracteres e divisão por parágrafos/sentenças/pontuação, sem cortar palavras arbitrariamente.
- [x] **AC8a.** Datas standalone válidas em `dd/mm/aaaa` ou `dd-mm-aaaa` são expandidas para cardinal natural pt-BR depois da sanitização e antes do cache/split; formatos inválidos, ISO e tokens de path/query/e-mail/código/ID/versão permanecem inalterados.
- [x] **AC9.** Payload, voz e idioma são validados; HTML é reduzido a texto; caminhos arbitrários e conteúdo executável não são aceitos.
- [x] **AC10.** Timeout, fila cheia, falta da referência e recursos insuficientes retornam erros controlados; stack trace e conteúdo integral não chegam ao cliente/log.
- [x] **AC11.** Health/status informam device, CUDA, referência, snapshot, modelo, idle, fila e cache sem dados sensíveis.
- [x] **AC12.** `bibble-voice.service` roda como `ialpha`, inicia no boot, reinicia em falha, aplica limites operacionais e mantém o modelo descarregado no startup.
- [x] **AC13.** README e scripts documentam instalação, healthcheck, teste isolado, logs, restart/stop/start, troca autorizada da voz, GPU e limpeza do cache.

### C. Proxy e experiência no Painel Alpha

- [x] **AC14.** `POST /api/bibble/voice` autentica, limita/valida a requisição e chama `BIBBLE_VOICE_URL` server-side com token opcional, sem segredo no frontend.
- [x] **AC15.** Texto enviado produz resposta textual e botão de voz, sem autoplay; o áudio é associado à mesma mensagem.
- [x] **AC16.** Áudio enviado usa o STT existente e marca somente a nova resposta correspondente para solicitar/reproduzir TTS automaticamente.
- [x] **AC17.** Autoplay nunca ocorre ao abrir, atualizar, restaurar histórico ou receber resposta originada de texto; bloqueio do navegador deixa o botão pronto sem erro técnico.
- [x] **AC18.** Botão possui estados idle/loading/ready/playing/paused/error, deduplica solicitação e permite pause/replay.
- [x] **AC19.** Gerenciador global interrompe a reprodução anterior, revoga object URLs e impede dois áudios simultâneos.
- [ ] **AC20.** Fluxos texto e áudio estão comprovados por smoke autenticado da UI; indisponibilidade do TTS mantém o chat textual funcional e não afeta IA/STT/Ollama.

## Tasks / Subtasks

- [x] Mapear chat, STT, TTS legado, endpoints, streaming, persistência e origem por voz (AC15–AC20).
- [x] Criar serviço FastAPI isolado e configuração validada (AC1–AC3).
- [x] Implementar lazy load, locks, fila, seleção explícita de device, limites de recursos e unload ocioso (AC4–AC6).
- [x] Implementar cache, segmentação, sanitização, limites, timeouts e logs seguros (AC7–AC11).
- [x] Normalizar datas brasileiras standalone antes do cache e da segmentação, com validação de calendário, isolamento lexical, idempotência e convergência dos separadores (AC8a).
- [x] Instalar e habilitar unidade systemd sem carregar modelo no boot (AC12).
- [x] Criar documentação, healthcheck, download verificado e teste isolado (AC13).
- [x] Implementar proxy autenticado e cliente server-side resiliente (AC14).
- [x] Integrar estado de áudio, preferências leves, autoplay contextual e reprodução exclusiva (AC15–AC19).
- [x] Executar gates estáticos e testes automatizados disponíveis.
- [x] Fornecer `voices/bibble.wav` cuja utilização esteja autorizada.
- [x] Configurar runtime CPU com 8 threads e validar TTS/cache/unload/restart/reload sem interferir na VRAM ou no Ollama (AC6).
- [ ] Executar smoke autenticado da UI para texto, áudio, autoplay, reprodução exclusiva e fail-safe (AC20).
- [ ] Configurar `BIBBLE_VOICE_TOKEN` apenas se a topologia de deploy exigir acesso server-to-server remoto.

## Constraints

- Nenhuma alteração de banco, schema, migration ou dados; Vault não é acionado porque não há mudança estrutural.
- Não alterar lógica, provedor ou modelo de IA; não reiniciar, reconfigurar nem remover Ollama ou seus modelos.
- Não alterar o STT/transcrição existente e não recriar o chat.
- Não alterar drivers NVIDIA/CUDA e não instalar dependências Python globalmente.
- Não usar ElevenLabs, OpenAI/Google/Azure TTS ou qualquer serviço externo de geração.
- Não abrir a porta 8787 para a internet, hardcodear IP/token nem usar variável `NEXT_PUBLIC_*` para segredos.
- Não sintetizar sem referência autorizada e não baixar/inventar/substituir a voz do Bibble.

## Evidências e resultados

- `systemctl`: unidade instalada em `/etc/systemd/system/bibble-voice.service`, `enabled` e `active`, executando como `ialpha` em loopback, `TTS_DEVICE=cpu`, 8 threads e limites de recursos.
- `GET /health` e status: serviço saudável, referência configurada, V3 resolvido como `multilingual-0.1.7:v3` e modelo fora da memória no boot/repouso.
- Geração real em português: cache MISS concluído em 27,16s; saída WAV PCM16 mono 24 kHz válida.
- Segunda geração idêntica: cache HIT concluído em 0,01s, sem nova inferência.
- Unload/restart: modelo descarregado e RAM retornou de pico aproximado de 7,1 GiB para cerca de 45 MiB em repouso.
- Reload após unload/restart: novo cache MISS/inferência concluído em 23,42s.
- `nvidia-smi`: VRAM permaneceu invariável durante carga, geração, unload e reload em CPU.
- Health do llama/Ollama permaneceu OK após os testes, sem reinício, remoção ou reconfiguração.
- Python `compileall`: PASS para app e scripts do microserviço.
- Vitest focal: 28/28 testes aprovados em `voice-client.test.ts` e `voice-proxy.test.ts`.
- Regressão do proxy em staging: cobertura adicionada para URL interna + `Host`/`Origin` públicos, divergência Host/Origin, Origin ausente e `Sec-Fetch-Site: cross-site`.
- Regressão do upstream: cobertura adicionada para URLs exatas de health/model/speech com base raiz e base com subpath, além da rejeição de endpoint com autoridade (`//host`).
- Pytest do serviço: 26/26 testes aprovados; depois do gate, o venv de produção foi ressincronizado ao `requirements.lock` sem dependências exclusivas de desenvolvimento.
- Regressão de pronúncia de datas: suíte final com 64/64 testes aprovados, incluindo anos `0001..9999`, regra gregoriana de séculos, inválidas byte-a-byte, Unicode de contexto, entrada longa, concorrência, múltiplas datas, pontuação, isolamento lexical, ISO, idempotência, texto entregue ao modelo e convergência slash/hífen para cache hit.
- Smoke de produção da normalização: serviço reiniciado e saudável; `18/09/2026` gerou WAV real HTTP 200 (`audio/wav`, RIFF/WAVE) em cache MISS e `18-09-2026` retornou o mesmo áudio/identidade em cache HIT. A rota pública do Painel respondeu 401 sem sessão, confirmando existência e proteção, sem regressão para 404.
- Forge focal: Vitest 28/28, ESLint direcionado e build aprovados (o build aprovado precede a correção pontual de resolução; a correção foi revalidada por Vitest e ESLint focais).
- Gates globais preservam débitos externos ao escopo: `npm run lint` falha no baseline do repositório; `npm run typecheck` encerra por falta de memória e, com heap de 8 GB, reporta somente erros fora desta entrega; `npm test` registra 20 falhas fora do escopo.
- UI: o smoke autenticado ainda não foi registrado; AC20 permanece aberto sem inferir resultado.

## Quality Gates

- [x] Diagnóstico incremental e preservação de STT/IA/Ollama/banco.
- [x] Serviço inicia saudável com referência autorizada e sem modelo residente em repouso.
- [x] Contratos TypeScript do cliente/proxy cobertos por 28 testes focais.
- [x] Código Python compila; configuração e bind foram validados no processo real.
- [x] Testes Python do serviço aprovados: 26/26; venv de produção novamente alinhado ao lock sem dependências dev.
- [x] Testes da normalização de datas aprovados no Python 3.11 do serviço: 64/64 em `tests/test_core.py`; ferramentas de desenvolvimento foram executadas isoladamente, sem alterar o venv de produção.
- [x] Smoke de produção aprovado: serviço healthy, WAV real HTTP 200 e equivalência slash/hífen comprovada por cache MISS/HIT e identidade binária.
- [x] TTS real, cache MISS/HIT, unload/restart, reload, RAM, VRAM invariável e health do llama validados.
- [x] Forge focal aprovado no conjunto acumulado: 28/28 testes e ESLint direcionado; o build PASS registrado precede a correção pontual de resolução.
- [ ] Gates globais não estão verdes por baseline externo: lint falha, typecheck exige heap ampliado e ainda reporta erros fora do escopo, e testes globais mantêm 20 falhas externas.
- [ ] Smoke autenticado da UI e fail-safe no navegador.

## Completion Notes

- Implementação de serviço, proxy, UI, segurança, cache, lazy load, fila, systemd e documentação concluída.
- O serviço está operacional em CPU com a referência autorizada, gera WAV PCM16 mono 24 kHz e não disputa VRAM com o LLM.
- Lazy load, cache, unload/restart, reload e liberação de RAM foram comprovados com inferências reais.
- Datas brasileiras standalone válidas agora chegam ao modelo por extenso em pt-BR; a normalização precede cache e split, é idempotente e faz slash/hífen equivalentes reutilizarem o mesmo WAV.
- As validações focais passaram: suíte Python final 64/64, Vitest 28/28 e ESLint direcionado; o build aprovado registrado precede a correção pontual de resolução. Isso não equivale a aprovação dos gates globais, que mantêm os baselines externos descritos acima.
- O chat, STT, IA, Ollama e banco foram preservados; o health do llama permaneceu OK.
- O único critério funcional pendente é o smoke autenticado da UI (AC20); os gates globais permanecem vermelhos pelo baseline externo. O token remoto é condicional à topologia e não deve ser criado se loopback for suficiente.
- O `403` causado pela comparação de `Origin` com a URL interna atrás do Cloudflare Tunnel foi corrigido no guard do proxy; o smoke autenticado permanece pendente e AC20 continua aberto.
- O `503` subsequente foi rastreado à resolução de endpoint com `//` na base raiz e corrigido sem flexibilizar as validações SSRF; health/model/speech agora preservam exatamente a origem configurada.

## File List

### Painel Alpha — criados

- `src/app/api/bibble/voice/route.ts`
- `src/components/BibbleChatHome/bibble-audio-manager.ts`
- `src/lib/bibble/voice-admission.ts`
- `src/lib/bibble/voice-client.ts`
- `src/lib/bibble/voice-preferences.ts`
- `src/lib/bibble/voice-service.ts`
- `tests/bibble/voice-client.test.ts`
- `tests/bibble/voice-proxy.test.ts`
- `docs/stories/story-bibble-voz-local-chatterbox.md`

### Painel Alpha — modificados

- `.env.example`
- `src/components/BibbleChatHome/BibbleChatLayout.tsx`
- `src/components/BibbleChatHome/BibbleChatWindow.tsx`
- `src/components/BibbleChatHome/BibbleMessageBubble.tsx`
- `src/components/BibbleChatHome/BibbleMessageList.tsx`
- `src/components/BibbleChatHome/BibbleSettingsPanel.tsx`
- `src/components/BibbleChatHome/BotaoFalarMensagem.tsx`
- `src/components/BibbleChatHome/useVoiceStatus.ts`

### Serviço local — criados/instalados

- `/home/ialpha/services/bibble-voice/{.env,.env.example,.gitignore,README.md,requirements.txt,requirements.lock,requirements-dev.txt,bibble-voice.service}`
- `/home/ialpha/services/bibble-voice/app/{__init__.py,cache.py,config.py,engine.py,main.py,schemas.py}`
- `/home/ialpha/services/bibble-voice/app/text_normalization.py`
- `/home/ialpha/services/bibble-voice/scripts/{download_model.py,healthcheck.sh,install.sh,test_voice.py}`
- `/home/ialpha/services/bibble-voice/tests/test_core.py`
- `/home/ialpha/services/bibble-voice/voices/bibble.wav` (referência autorizada)
- `/home/ialpha/services/bibble-voice/voices/README.md`
- `/home/ialpha/services/bibble-voice/cache/.gitkeep`
- `/home/ialpha/services/bibble-voice/logs/.gitkeep`
- `/home/ialpha/services/bibble-voice/models/README.md`
- `/home/ialpha/services/bibble-voice/models/chatterbox-v3/` (snapshot local V3 e manifesto SHA-256)
- `/etc/systemd/system/bibble-voice.service`

### Serviço local — modificados no bugfix de datas

- `/home/ialpha/services/bibble-voice/app/engine.py`
- `/home/ialpha/services/bibble-voice/tests/test_core.py`
- `/home/ialpha/services/bibble-voice/README.md`

## Change Log

| Data | Versão | Descrição | Autor |
|---|---:|---|---|
| 2026-09-15 | 1.0 | Story e baseline inicial | River (SM) |
| 2026-09-15 | 1.1 | Estado real, evidências, gates, pendências e File List finais | River (SM) |
| 2026-09-16 | 1.2 | Runtime CPU, referência autorizada, TTS/cache/unload/reload e gates validados | River (SM) |
| 2026-09-16 | 1.3 | Guarda same-origin compatível com autoridade pública atrás do Cloudflare Tunnel e testes de regressão | Echo (Backend) |
| 2026-09-16 | 1.4 | Evidências do Forge separadas entre validação focal aprovada e baselines globais externos | Echo (Backend) |
| 2026-09-16 | 1.5 | Resolução segura dos endpoints TTS para base raiz/subpath, eliminando troca involuntária de host e cobrindo regressão | Echo (Backend) |
| 2026-09-18 | 1.6 | Normalização segura de datas brasileiras antes de cache/split, cardinais pt-BR, isolamento lexical e regressão 57/57 | Echo (Backend) |
| 2026-09-18 | 1.7 | QA final 64/64 e smoke de produção com WAV real, rota protegida e convergência de cache slash/hífen | Bibble |
