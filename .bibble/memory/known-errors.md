# KNOWN ERRORS — Erros Conhecidos e Fixes

> Consultado por: Forge e todos os agentes antes de debugar
> Adicionar SEMPRE após resolver um erro novo.

---

## Template de entrada

```
### [Erro resumido]
**Sintoma:** [o que aparece no terminal/browser]
**Causa:** [por que acontece]
**Fix:** [como resolver]
**Contexto:** [quando esse erro ocorre]
**Adicionado em:** [data]
```

---

## Erros Catalogados

### InfoSimples CPF — data_nascimento formato errado
**Sintoma:** Consulta CPF retorna erro "CPF não encontrado" mesmo com dados corretos.
**Causa:** `<input type="date">` envia `YYYY-MM-DD`; InfoSimples `receita-federal/cpf` exige `DD/MM/YYYY`.
**Fix:** Converter no servidor antes de chamar a API: `[d,m,y] = iso.split('-')` → `${d}/${m}/${y}` (implementado em `paraFormatoInfoSimples()` em `/api/ConsultaCpf/route.ts`).
**Contexto:** Qualquer campo de data HTML que seja enviado para a InfoSimples.
**Adicionado em:** 2026-06-17

### pdf-parse v2 — `.default` is not a function
**Sintoma:** `TypeError: pdfParse is not a function` ao ler PDF; erro silenciado em catch → IA não lê o PDF.
**Causa:** pdf-parse v2 (`^2.x`) mudou a API. v1 exportava função; v2 exporta `{ PDFParse }` (classe). `(await import("pdf-parse")).default` é `undefined`.
**Fix:** `const { PDFParse } = await import("pdf-parse"); const p = new PDFParse({ data: buffer, verbosity: 0 }); const r = await p.getText(); await p.destroy();` — texto em `r.text`. (Centralizado em `src/lib/bibble/tika.ts` como fallback.)
**Contexto:** Qualquer uso de pdf-parse no projeto.
**Adicionado em:** 2026-06-19

### fetch body com Buffer/Uint8Array — TS2769 BodyInit
**Sintoma:** `TS2769: No overload matches this call. Type 'Buffer'/'Uint8Array' is not assignable to type 'BodyInit'`.
**Causa:** tsconfig com `target: ES2017` + lib `dom` não reconhece `Buffer`/`Uint8Array` como `BodyInit` no `fetch`.
**Fix:** passar `ArrayBuffer`: `body: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer`.
**Contexto:** Enviar binário (PUT/POST) via fetch no server-side.
**Adicionado em:** 2026-06-19

### Prisma update P2025 em rotas idempotentes (heartbeat)
**Sintoma:** `PrismaClientKnownRequestError P2025: No record was found for an update` em log recorrente.
**Causa:** `.update()` lança quando o `where` não acha registro. Ex.: sessão JWT válida com email de usuário já removido/renomeado.
**Fix:** usar `.updateMany()` (retorna `count: 0` sem lançar); tratar `count === 0` como caso não-erro (404 silencioso, sem console.error).
**Contexto:** Updates idempotentes onde "registro não existe" não deve ser erro de servidor.
**Adicionado em:** 2026-06-19
