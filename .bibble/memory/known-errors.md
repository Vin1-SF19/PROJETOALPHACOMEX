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

---

## Consulta CPF InfoSimples retorna code 606/607 (nunca traz dados)
**Sintoma:** `/api/ConsultaCpf` responde erro; log mostra `code: 606` ("campo obrigatório ausente") ou `code: 607` ("data de nascimento inválida"). No browser pode logar "404 Not Found" enganosamente.
**Causa:** dois detalhes da API InfoSimples (receita-federal/cpf): (1) o campo da data chama-se **`birthdate`**, NÃO `data_nascimento`; (2) o formato exigido é **AAAA-MM-DD** (ISO), NÃO DD/MM/AAAA. O `<input type="date">` já manda AAAA-MM-DD.
**Fix:** enviar `birthdate` no formato AAAA-MM-DD (não inverter). Testado: `2003-10-25`=code 200 ✓, `25/10/2003`=607 ✗. Bônus: rota retornava `status:404` em erro de consulta (browser logava como rota inexistente) → usar 422.
**Contexto:** Vale para PainelAlpha (`src/app/api/ConsultaCpf/route.ts`) e portal AlphaParceiros (`lib/consultaActions.ts`).
**Adicionado em:** 2026-06-23

---

## "db.<model> is undefined" / action falha com catch silencioso após adicionar model novo
**Sintoma:** action retorna erro genérico sem log; teste direto mostra `Cannot read properties of undefined (reading 'create')` em `db.<novoModel>`.
**Causa:** Prisma Client em execução está STALE — o dev server subiu com o client gerado ANTES do model novo existir no schema. O model existe no schema e nos tipos, mas o runtime client não.
**Fix:** `npx prisma generate` + **REINICIAR o dev server** (Turbopack não recarrega o client). No Windows o generate dá EPERM na DLL se o node estiver rodando — parar node antes. SEMPRE logar o erro real no catch (`console.error`), nunca catch vazio.
**Adicionado em:** 2026-06-23

---

## Filtro de string PT-BR com acento nunca casa (includes retorna sempre false)
**Sintoma:** função que classifica por nome de serviço/status retorna `false` para tudo, mesmo com o termo presente. Ex.: `s.includes("revisao")` falha em "Revisão RADAR".
**Causa:** normalização com `.replace(/[^a-z0-9]/g, "")` REMOVE os caracteres acentuados junto com a pontuação — "revisão"→"reviso", "habilitação"→"habilitao". O termo de busca sem acento nunca casa.
**Fix:** remover acentos com `.normalize("NFD").replace(/[̀-ͯ]/g, "")` ANTES de qualquer filtro/lowercase. Nunca usar `[^a-z0-9]` para "limpar" string PT-BR sem antes tirar diacríticos.
**Bônus:** IDs de contrato/cliente são cuid (STRING tipo `cmpfxcy81...`), não Int — em UPDATE manual via SQL, sempre passar como arg parametrizado/aspas, nunca interpolar cru.
**Adicionado em:** 2026-06-23
