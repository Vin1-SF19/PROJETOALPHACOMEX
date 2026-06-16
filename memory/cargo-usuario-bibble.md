---
name: cargo-usuario-bibble
description: Exibição do cargo do usuário na tela inicial do Bibble
metadata:
  type: project
---

## Contexto

O Bibble (chatbot da IA) exibia apenas o nome do usuário na tela inicial, sem mostrar seu cargo ou função dentro do aplicativo. Para melhorar a experiência e contextualizar as interações, foi implementada a exibição do cargo do usuário (role) quando disponível.

## Implementação

### Fluxo de dados:

1. **BibbleChatLayout.tsx** (line 411)
   - Recebe o `role` do estado do sistema
   - Passa para o `BibbleChatWindow` como prop `role={role}`

2. **BibbleChatWindow.tsx** (linha 11)
   - Adiciona o prop `role?: string` na interface
   - Recebe e repassa para o `BibbleEmptyState`

3. **BibbleEmptyState.tsx** (linha 8, linha 36-37, linhas 86-95)
   - Adiciona `role?: string` na interface
   - Exibe o cargo entre aspas, exceto se for `admin` ou `marketing` (que são papéis de sistema)
   - Formato: `"Olá, {nome} {cargo}."`

### Regras de negócio:

- `admin` → não exibido (cargo do sistema)
- `marketing` → não exibido (cargo do sistema)  
- Outros roles (ex: `Consultor`) → exibido formatado com espaço ao lado do nome

## Resultado visual:

Tela inicial do Bibble agora mostra:
```
Olá, Joao Silva Consultor.
No que posso te ajudar hoje?
```

Quando o usuário não tem role definido:
```
Olá, João Silva.
No que posso te ajudar hoje?
```

## Como aplicar:

- Certifique-se de que a sessão do usuário tem o `role` preenchido no contexto atualizado do Bibble
- Se precisar incluir outros roles em vez de exibi-los, ajuste a lógica de filtragem em **BibbleEmptyState.tsx** linha 95
