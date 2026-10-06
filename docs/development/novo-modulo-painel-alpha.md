# Implementação de novo módulo no Painel Alpha

Guia prático para implementar um novo módulo dentro de `src/app/PainelAlpha/`.

Use este guia quando precisar criar uma nova área funcional do painel, por exemplo:

- `src/app/PainelAlpha/Exemplo/`
- `src/actions/exemplo.ts`
- `src/lib/exemplo/`
- `src/components/Exemplo/`
- registro em `src/lib/modulos-registry.ts`

## Regras obrigatórias

Antes de escrever código:

1. Leia `CLAUDE.md`.
2. Ative/verifique o skill `bibble-squad/bibble` conforme exigido pelo projeto.
3. Leia `AGENTS.md`.
4. Siga a Constitution em `.aiox-core/constitution.md`.
5. Priorize `CLI First -> Observability Second -> UI Third`.
6. Não invente requisitos fora dos artefatos existentes.
7. Se houver mudança de banco, migration, seed, backfill, índice, constraint, relacionamento ou operação em massa, ative o agente `Vault` e siga a política de backup do `AGENTS.md`.

## Stack

- Next.js 16
- React 19
- TypeScript strict
- Tailwind v4
- Prisma 6
- Turso/LibSQL
- Vitest
- ESLint

## Comandos principais

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

Build completo:

```bash
npm run build
```

O build executa:

```bash
prisma generate
npm run build:player
NODE_OPTIONS=--max-old-space-size=3072 next build --webpack
```

## Estrutura recomendada

Para um módulo chamado `Exemplo`:

```text
src/app/PainelAlpha/Exemplo/page.tsx
src/app/PainelAlpha/Exemplo/layout.tsx
src/app/PainelAlpha/Exemplo/ExemploClient.tsx
src/actions/exemplo.ts
src/lib/exemplo/
src/components/Exemplo/
```

Padrão observado no CheckList:

```text
src/app/PainelAlpha/CheckList/page.tsx
src/app/PainelAlpha/CheckList/layout.tsx
src/app/PainelAlpha/CheckList/ListaChecklist.tsx
src/actions/checklist.ts
src/lib/checklist/items.ts
src/lib/checklist/modelos.ts
src/components/Checklist/
```

## Fluxo padrão de uma página de módulo

### 1. `page.tsx`

A página deve ser server component.

Padrão esperado:

```tsx
import { auth } from "auth";
import { redirect } from "next/navigation";
import { getEmpresasChecklist, getPastasChecklist } from "@/actions/checklist";
import ListaChecklist from "./ListaChecklist";

export default async function CheckListPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  const [empresas, pastas] = await Promise.all([
    getEmpresasChecklist(),
    getPastasChecklist(),
  ]);

  return (
    <ListaChecklist
      empresas={empresas}
      pastas={pastas}
      role={session.user.role}
    />
  );
}
```

Regras:

- Não faça fetch direto no client.
- Use server actions ou server components para dados iniciais.
- Valide sessão antes de renderizar conteúdo sensível.
- Prefira `Promise.all` quando as consultas forem independentes.

### 2. `layout.tsx`

Use layout para:

- fundo visual do módulo;
- wrappers específicos;
- carregamento de tema;
- validação de sessão;
- recursos compartilhados apenas daquele módulo.

Exemplo simples:

```tsx
import { auth } from "auth";
import { redirect } from "next/navigation";
import { getTema } from "@/lib/temas";
import ChecklistBackground from "@/components/Checklist/ChecklistBackground";

export default async function CheckListLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  const tema = await getTema(session.user.id);

  return (
    <ChecklistBackground tema={tema}>
      {children}
    </ChecklistBackground>
  );
}
```

### 3. Client component

O client component deve receber dados serializáveis.

Padrão:

```tsx
"use client";

import { useState } from "react";
import { criarItem, atualizarItem } from "@/actions/exemplo";

type ExemploClientProps = {
  itens: ItemExemplo[];
  role: string;
};

export default function ExemploClient({ itens, role }: ExemploClientProps) {
  const [carregando, setCarregando] = useState(false);

  async function handleSalvar(payload: PayloadExemplo) {
    setCarregando(true);
    await atualizarItem(payload);
    setCarregando(false);
  }

  return null;
}
```

Regras:

- Client component não deve importar Prisma.
- Client component não deve importar `auth()` diretamente se puder receber dados prontos.
- Ações mutadoras devem vir de `src/actions/`.
- Use `useActionState` para formulários com estado de erro/sucesso.
- Evite `fetch` manual para ações internas; prefira server actions.

## Server actions

Padrão de `src/actions/exemplo.ts`:

```ts
"use server";

import { auth } from "auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

const schema = z.object({
  id: z.number().int().positive(),
  nome: z.string().min(1).max(180),
});

export async function criarExemplo(input: unknown) {
  const session = await auth();

  if (!session?.user) {
    return { ok: false as const, erro: "Sessão inválida." };
  }

  const dados = schema.parse(input);

  await prisma.exemplo.create({
    data: {
      nome: dados.nome,
      criadoPor: session.user.id,
    },
  });

  revalidatePath("/PainelAlpha/Exemplo");

  return { ok: true as const };
}
```

Regras:

- Toda action exposta ao client deve começar com `"use server"`.
- Valide sessão.
- Valide payload com Zod.
- Use `revalidatePath` quando a ação alterar dados exibidos por server components.
- Retorne objetos previsíveis:

```ts
type ResultadoAcao =
  | { ok: true; dados?: unknown }
  | { ok: false; erro: string };
```

- Nunca retorne objetos Prisma diretamente para o client.
- Nunca exponha `sub`, `permissoes`, `authSessionVersion`, tokens ou credenciais.

## Permissões

### Roles

Arquivo principal:

```text
src/lib/roles.ts
```

Funções importantes:

```ts
normalizeRole(role)
isAdminRole(role)
isParceirosAdminRole(role)
isSameRole(left, right)
```

Regras:

- Compare roles sempre com `normalizeRole`.
- Admin: `Admin`, `CEO`, `TI`.
- Parceiros admin: `Admin`, `CEO`, `TI`, `LIDERCOMERCIAL`.
- Não use comparação case-sensitive direta de strings.

### Permissões de módulo

Arquivo principal:

```text
src/lib/permissions/effective.ts
```

Função:

```ts
readEffectiveModulePermissions(userId)
```

Comportamento:

- Admin recebe todas as permissões conhecidas.
- Não admin usa `setorPermissao` pelo role.
- Se não houver `setorPermissao`, usa fallback `usuarios.permissoes`.
- Aplica overrides:
  - `ADD`
  - `REMOVE`

### Registro de módulo

Arquivo principal:

```text
src/lib/modulos-registry.ts
```

Exemplo de entrada:

```ts
{
  id: "exemplo",
  label: "Exemplo",
  href: "/PainelAlpha/Exemplo",
  iconName: "Square",
  category: "operacional",
  permission: "exemplo",
  desc: "Módulo de exemplo.",
  tag: "Exemplo",
  color: "from-sky-600/20",
  grupo: "documentos",
}
```

Regras:

- `id` deve ser estável.
- `href` deve apontar para a rota real.
- `permission` deve ser a chave usada em permissões de módulo.
- Se o módulo for restrito a roles, use `allowedRoles`.
- Se for somente admin, use `adminOnly: true`.
- Se houver alias de permissão, use `permissionAliases`.
- Se o módulo não deve aparecer no menu, use `hidden: true`.

## Banco de dados

Arquivos principais:

```text
prisma/schema.prisma
src/lib/prisma.ts
```

Regras:

- O banco usa Prisma com provider `sqlite` e runtime Turso/LibSQL.
- O singleton Prisma está em `src/lib/prisma.ts`.
- Não instancie Prisma manualmente em componentes.
- Não importe Prisma em client components.
- Use sempre o singleton `prisma` do projeto.

### Segurança de banco

Mudanças estruturais exigem:

1. Ativação do agente `Vault`.
2. Explicação clara do impacto.
3. Plano de rollback.
4. Backup completo e verificável.
5. Confirmação explícita do usuário.

Backup:

- Backup `pre-change` deve existir e ter no máximo 48 horas.
- Backup diário roda às `02:00 America/Sao_Paulo`.
- Backups diários com mais de 7 dias só podem ser removidos após novo backup validado.
- Nunca versionar dumps, tokens ou dados reais no Git.

## Autenticação

Arquivos principais:

```text
auth.ts
middleware.ts
src/lib/auth/acesso-painel.ts
src/lib/roles.ts
```

Regras:

- Middleware usa token do NextAuth.
- Sessão bloqueada deve ter `acessoBloqueado: true`.
- Usuário precisa estar `ATIVO` para acessar o painel.
- `/` redireciona para `/PainelAlpha`.
- Role `TV` é redirecionada para `/PainelAlpha/Metas`.
- Se o usuário perder acesso, o layout do painel deve redirecionar para `/?acesso=bloqueado`.

## Tema

Padrão:

```ts
import { getTema } from "@/lib/temas";
```

Regras:

- Tema é carregado por usuário.
- Layouts podem aplicar fundo específico do módulo.
- Client components podem consumir tema via props ou contexto existente.
- Não crie novo sistema de tema sem necessidade.

## Componentes

Diretório recomendado:

```text
src/components/<Area>/
```

Exemplos:

```text
src/components/Checklist/
src/components/Exemplo/
```

Regras:

- Componentes reutilizáveis ficam em `src/components/`.
- Componentes específicos de uma página podem ficar dentro de `src/app/PainelAlpha/<Modulo>/`.
- Mantenha separação:
  - UI pura em componentes;
  - regras de negócio em `src/lib/`;
  - mutações em `src/actions/`;
  - dados iniciais em server components.

## Testes

Use Vitest.

Padrão de teste para lógica pura:

```text
src/lib/exemplo/__tests__/exemplo.test.ts
```

Padrão de teste para ações:

```text
src/actions/__tests__/exemplo.test.ts
```

Regras:

- Teste primeiro `src/lib/`.
- Teste actions mockando Prisma e `auth`.
- Teste regras de permissão quando a lógica depender de role/permissoes.
- Rode:

```bash
npm test
```

## Qualidade

Antes de concluir:

```bash
npm run typecheck
npm run lint
npm test
```

Para build:

```bash
npm run build
```

Checklist final:

- [ ] Rota criada em `src/app/PainelAlpha/<Modulo>/`.
- [ ] `page.tsx` é server component.
- [ ] Sessão validada.
- [ ] Client component recebe dados serializáveis.
- [ ] Ações mutadoras estão em `src/actions/`.
- [ ] Payload validado com Zod.
- [ ] `revalidatePath` usado quando necessário.
- [ ] Módulo registrado em `src/lib/modulos-registry.ts`.
- [ ] Permissão definida e usada.
- [ ] Roles comparados com `normalizeRole`.
- [ ] Nenhum Prisma importado no client.
- [ ] Nenhum segredo exposto.
- [ ] `typecheck` passou.
- [ ] `lint` passou.
- [ ] `test` passou.
- [ ] Se mudou banco, `Vault` e backup foram tratados.
- [ ] Story/checklist atualizado, se houver story.

## Erros comuns

- Importar `prisma` em client component.
- Usar `auth()` dentro de client component.
- Comparar role com `=== "admin"` sem normalizar.
- Criar permissão nova sem registrar em `MODULOS_REGISTRY`.
- Esquecer `revalidatePath` após mutação.
- Retornar objeto Prisma bruto para o client.
- Criar página sem layout/fundo quando o módulo exige contexto visual.
- Fazer mutação com `fetch` manual quando server action já existe.
- Ignorar `AGENTS.md` e `CLAUDE.md`.
- Executar migration sem `Vault` e backup.

## Modelo mínimo de novo módulo

### Rota

```text
src/app/PainelAlpha/Exemplo/page.tsx
```

```tsx
import { auth } from "auth";
import { redirect } from "next/navigation";
import { listarItensExemplo } from "@/actions/exemplo";
import ExemploClient from "./ExemploClient";

export default async function ExemploPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/");
  }

  const itens = await listarItensExemplo();

  return (
    <ExemploClient
      itens={itens}
      role={session.user.role}
    />
  );
}
```

### Action

```text
src/actions/exemplo.ts
```

```ts
"use server";

import { auth } from "auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function listarItensExemplo() {
  const session = await auth();

  if (!session?.user) {
    return [];
  }

  const itens = await prisma.exemplo.findMany({
    orderBy: { id: "desc" },
  });

  return itens.map((item) => ({
    id: item.id,
    nome: item.nome,
    criadoEm: item.criadoEm,
  }));
}

export async function criarItemExemplo(input: unknown) {
  const session = await auth();

  if (!session?.user) {
    return { ok: false as const, erro: "Sessão inválida." };
  }

  const schema = z.object({
    nome: z.string().min(1).max(180),
  });

  const dados = schema.parse(input);

  await prisma.exemplo.create({
    data: {
      nome: dados.nome,
      criadoPor: session.user.id,
    },
  });

  revalidatePath("/PainelAlpha/Exemplo");

  return { ok: true as const };
}
```

### Registro

```text
src/lib/modulos-registry.ts
```

```ts
{
  id: "exemplo",
  label: "Exemplo",
  href: "/PainelAlpha/Exemplo",
  iconName: "Square",
  category: "operacional",
  permission: "exemplo",
  desc: "Módulo de exemplo.",
  tag: "Exemplo",
  color: "from-sky-600/20",
  grupo: "documentos",
}
```

## Referências úteis

- `src/app/PainelAlpha/CheckList/page.tsx`
- `src/app/PainelAlpha/CheckList/layout.tsx`
- `src/app/PainelAlpha/CheckList/ListaChecklist.tsx`
- `src/actions/checklist.ts`
- `src/lib/checklist/items.ts`
- `src/lib/checklist/modelos.ts`
- `src/components/Checklist/`
- `src/lib/modulos-registry.ts`
- `src/lib/roles.ts`
- `src/lib/permissions/effective.ts`
- `src/lib/auth/acesso-painel.ts`
- `src/lib/prisma.ts`
- `prisma/schema.prisma`
- `middleware.ts`
- `CLAUDE.md`
- `AGENTS.md`
