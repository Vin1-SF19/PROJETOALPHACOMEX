const CRM_HOME = '/PainelAlpha/AlphaCRM';

export function getCrmBackDestination(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, '') || CRM_HOME;
  if (path === CRM_HOME) return null;
  if (path.startsWith(`${CRM_HOME}/admin/`)) return `${CRM_HOME}/admin`;
  return CRM_HOME;
}
