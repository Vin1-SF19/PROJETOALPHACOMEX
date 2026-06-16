---
name: bibble-restricao-paginais
description: Bibble aparece apenas em páginas do PainelAlpha para evitar distrações
metadata:
  type: project
  component: Bibble
  path: src/components/Bibble.tsx
---

O Bibble (assistente IA do PainelAlpha) está configurado para aparecer apenas em páginas com rotas que começam com `/PainelAlpha`. Isso evita que ele apareça em outras áreas do sistema, como o `/dashboard`.

**Por que:** O Bibble foi inicialmente configurado para aparecer apenas para usuários admin, mas isso não era ideal - ele é parte central do PainelAlpha e não de uso geral da plataforma.

**Como aplicar:** A restrição está implementada em `src/components/Bibble.tsx` (linha ~108):

```typescript
// Guard: só aparece em páginas do PainelAlpha (outra área para o dashboard)
const isPainelAlpha = pathname.startsWith("/PainelAlpha");
if (!isPainelAlpha) return null;
```

O Bibble agora aparece em `/PainelAlpha/*` e não é restrito por role de usuário, já que é um componente do PainelAlpha em si, não uma ferramenta administrativa geral.

See also: [[contexto-extra-bibble]]
