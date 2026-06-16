---
name: contexto-extra-bibble
description: Bibble recebe contexto adicional via contexto global para mensagens
metadata:
  type: project
  component: Bibble
  path: src/context/BibbleContext.tsx
---

O Bibble usa um contexto React para receber informações adicionais sobre a página atual e dados selecionados. Isso permite que o Bibble tenha contexto do que o usuário está analisando no momento.

**Por que:** O Bibble precisa de contexto para responder de forma relevante sobre o que o usuário está vendo, como tabelas, dados específicos, etc.

**Como aplicar:** O contexto é gerenciado em `src/context/BibbleContext.tsx`:

```typescript
export interface BibbleContextData {
  paginaAtual?: string;
  dadosSelecionados?: Record<string, unknown>;
  [key: string]: unknown;
}
```

Os componentes filhos devem chamar `setContextoExtra({ paginaAtual: '/PainelAlpha/Marketing', dadosSelecionados: { projetoId: 123 } })` para fornecer contexto ao Bibble.

See also: [[bibble-restricao-paginais]]
