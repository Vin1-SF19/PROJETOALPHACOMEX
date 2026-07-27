/**
 * Regras fixas do PainelAlpha injetadas em todo prompt de implementação gerado pela IA
 * do Alpha Blueprint — extraídas do CLAUDE.md do projeto. Mantém sincronizado manualmente
 * se as regras absolutas do CLAUDE.md mudarem (não há import automático porque o CLAUDE.md
 * não é um módulo TypeScript).
 */
export const REGRAS_PAINEL_ALPHA = `
## Contexto do projeto (PainelAlpha)

Este prompt é para implementar uma feature dentro do PainelAlpha, um sistema de gestão interno já existente. Stack real do projeto:

- Framework: Next.js 16 + App Router, React 19
- Auth: Next-Auth v5 (usar \`auth()\`, nunca reimplementar JWT)
- Estilização: Tailwind CSS v4 (tokens via \`@theme {}\` no CSS, sem tailwind.config.js)
- Componentes: shadcn/ui + Radix UI já configurado
- Banco: Prisma + SQLite/LibSQL via Turso (NÃO PostgreSQL)
- Estado global: Zustand v5
- Real-time: Pusher
- Upload: UploadThing/Vercel Blob conforme o que já estiver configurado no projeto
- Animações: Framer Motion

## Regras absolutas a seguir

- NUNCA use \`<img>\` — sempre \`next/image\`
- NUNCA use \`useEffect\` para fetch — use Server Components ou React Query
- NUNCA use \`any\` no TypeScript
- NUNCA crie componente sem verificar se já existe algo equivalente no projeto
- NUNCA hardcode segredos — sempre \`process.env\`
- SEMPRE valide inputs com Zod antes de processar
- SEMPRE verifique sessão com \`auth()\` em rotas/actions protegidas
- SEMPRE valide ownership (o dado pertence a quem está pedindo) no servidor, nunca confiando em ID vindo do cliente
- Antes de criar um módulo novo, verificar o registry central de módulos do painel (menu/permissões) e registrar a nova feature lá

## Fluxo de implementação recomendado

1. Mapear o código existente antes de implementar (evitar duplicar o que já existe)
2. Implementar backend (Server Actions com Zod + auth + ownership)
3. Implementar frontend (Server Components por padrão, Client Component só quando precisar de interação)
4. Validar com typecheck, lint e build antes de considerar concluído
5. Testar o fluxo completo antes de finalizar
`.trim();

export function montarCabecalhoPrompt(tituloProjeto: string): string {
  return `# Prompt de implementação — ${tituloProjeto}\n\nGerado a partir do Alpha Blueprint (Painel Alpha) com base na especificação e no canvas visual do projeto.\n`;
}
