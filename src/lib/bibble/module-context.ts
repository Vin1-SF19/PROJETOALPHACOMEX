import { MODULOS_REGISTRY, podeVisualizarModulo } from '@/lib/modulos-registry';

export type BibbleModuleContext = { moduleKey: string; route: string; entityId?: string };

export function validateBibbleModuleContext(value: unknown, permissions: string[], role: string): BibbleModuleContext | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.activeUrl === 'string') {
    const candidate = raw.activeUrl === '/PainelAlpha' && typeof raw.lastOperationalUrl === 'string'
      ? raw.lastOperationalUrl : raw.activeUrl;
    if (candidate === '/PainelAlpha') return { moduleKey: 'ialpha', route: candidate };
    const item = MODULOS_REGISTRY.find(module => candidate === module.href || candidate.startsWith(`${module.href}/`));
    if (!item || !podeVisualizarModulo(item, { permissoes: permissions, role })) return null;
    return { moduleKey: item.id, route: item.href };
  }
  if (typeof raw.moduleKey !== 'string' || typeof raw.route !== 'string') return null;
  if (raw.moduleKey === 'ialpha' && raw.route === '/PainelAlpha') return { moduleKey: 'ialpha', route: '/PainelAlpha' };
  const registryItem = MODULOS_REGISTRY.find(item => item.id === raw.moduleKey && item.href === raw.route);
  if (!registryItem || !podeVisualizarModulo(registryItem, { permissoes: permissions, role })) return null;
  const entityId = typeof raw.entityId === 'string' && /^[\w-]{1,64}$/.test(raw.entityId) ? raw.entityId : undefined;
  return { moduleKey: registryItem.id, route: registryItem.href, entityId };
}
