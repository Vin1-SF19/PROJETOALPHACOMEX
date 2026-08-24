export const NOVO_MODULO_CONSTRAINTS =
  "Este objetivo cria um MÓDULO NOVO do PainelAlpha (não é ajuste em módulo existente). " +
  "Antes de qualquer implementação, a squad deve seguir a checklist obrigatória de registro de módulo: " +
  "(1) adicionar 1 entrada em MODULOS_REGISTRY (src/lib/modulos-registry.ts) — id, label, href, iconName, category, permission; " +
  "(2) confirmar que o ícone escolhido existe em ICON_MAP (src/components/layout/GlobalSidebar.tsx), importando se necessário; " +
  "(3) só depois criar a rota em src/app/PainelAlpha/[NomeDoModulo]/page.tsx, actions e componentes. " +
  "MODULOS_REGISTRY é a fonte única — não usar os 3 arrays manuais antigos (obsoletos). " +
  "A fase de documentação (Qwen) deve detalhar o propósito do módulo, dados que ele vai manipular e quem deve ter acesso, antes de qualquer fase de execução escrever código.";

export function isNovoModuloObjective(constraints: string | null | undefined): boolean {
  return constraints?.includes(NOVO_MODULO_CONSTRAINTS) ?? false;
}
