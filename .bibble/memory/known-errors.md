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
