import type { TimelineEvent, TimelineResponse } from './types';
import { extractCrmEvents } from './extractors/crm';
import { extractCsNpsEvents } from './extractors/cs-nps';
import { extractComissoesEvents } from './extractors/comissoes';
import { isAdminRole } from '@/lib/roles';
import { usuarioEhDiretoriaBpm } from '@/lib/bpm/boas-vindas';

interface ModulePermission {
  module: string;
  permission: string | null;
  allowedRoles?: string[];
}

const MODULE_PERMISSIONS: ModulePermission[] = [
  { module: 'crm', permission: 'crm' },
  { module: 'cs-nps', permission: 'Cliente' },
  { module: 'comissoes', permission: 'comissoes', allowedRoles: ['Admin', 'CEO', 'TI', 'FINANCEIRO'] },
];

function hasModuleAccess(
  mod: ModulePermission,
  permissoes: string[],
  role?: string | null,
): boolean {
  if (isAdminRole(role)) return true;
  if (mod.allowedRoles?.some((r) => r.toLowerCase() === (role ?? '').toLowerCase())) return true;
  if (mod.permission) return permissoes.includes(mod.permission);
  return true;
}

export async function aggregateClientEvents(
  clientId: number,
  permissoes: string[],
  role: string | null | undefined,
  userId: number,
): Promise<TimelineResponse> {
  const isAdminOrDiretoria = isAdminRole(role) || usuarioEhDiretoriaBpm(role);

  const extractors: Record<string, () => Promise<TimelineEvent[]>> = {
    crm: () => extractCrmEvents(clientId, { userId, isAdminOrDiretoria }),
    'cs-nps': () => extractCsNpsEvents(clientId),
    comissoes: () => extractComissoesEvents(clientId),
  };

  const allowedModules = MODULE_PERMISSIONS.filter((m) => hasModuleAccess(m, permissoes, role));

  const results = await Promise.allSettled(
    allowedModules.map((m) => extractors[m.module]()),
  );

  const allEvents: TimelineEvent[] = [];
  const contributingModules: string[] = [];

  results.forEach((result, i) => {
    const mod = allowedModules[i];
    if (result.status === 'fulfilled' && result.value.length > 0) {
      allEvents.push(...result.value);
      contributingModules.push(mod.module);
    }
  });

  allEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return {
    events: allEvents,
    total: allEvents.length,
    modules: contributingModules,
  };
}
