export interface PainelTab {
  id: string;
  url: string;
  label: string;
  pinned?: boolean;
}

export interface PainelTabsState {
  tabs: PainelTab[];
  activeId: string;
}

export const HOME_URL = "/PainelAlpha";
export const HOME_LABEL = "IAlpha";
export const HOME_TAB_ID = "tab-home";

const STORAGE_KEY_PREFIX = "painel_alpha_tabs_v2_user";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPainelUrl(url: string): boolean {
  return url === HOME_URL || url.startsWith(`${HOME_URL}/`);
}

function isStoredTab(value: unknown): value is PainelTab {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&
    typeof value.url === "string" &&
    isPainelUrl(value.url) &&
    typeof value.label === "string" &&
    value.label.trim().length > 0
  );
}

export function getTabsStorageKey(userId: number): string {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error("userId inválido para persistência das abas");
  }

  return `${STORAGE_KEY_PREFIX}_${userId}`;
}

/** Mantém a home canônica, fixa e sempre na primeira posição. */
export function ensurePinnedHome(tabs: PainelTab[]): PainelTab[] {
  const home = tabs.find((tab) => tab.url === HOME_URL);
  const normalizedHome: PainelTab = {
    id: HOME_TAB_ID,
    url: HOME_URL,
    label: HOME_LABEL,
    pinned: true,
  };

  const remainingTabs = tabs.filter(
    (tab) => tab !== home && tab.url !== HOME_URL && tab.id !== HOME_TAB_ID,
  );

  return [normalizedHome, ...remainingTabs.map((tab) => ({ ...tab, pinned: false }))];
}

export function normalizeStoredTabs(value: unknown): PainelTab[] {
  if (!Array.isArray(value)) return ensurePinnedHome([]);

  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const validTabs: PainelTab[] = [];

  for (const candidate of value) {
    if (!isStoredTab(candidate)) continue;

    const isHome = candidate.url === HOME_URL;
    const id = isHome ? HOME_TAB_ID : candidate.id.trim();
    const url = candidate.url;

    if (seenIds.has(id) || seenUrls.has(url)) continue;

    seenIds.add(id);
    seenUrls.add(url);
    validTabs.push({
      id,
      url,
      label: isHome ? HOME_LABEL : candidate.label.trim(),
      pinned: isHome,
    });
  }

  return ensurePinnedHome(validTabs);
}

export function parseStoredTabsState(rawValue: string | null): PainelTabsState | null {
  if (!rawValue) return null;

  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (!isRecord(parsed) || !Array.isArray(parsed.tabs)) return null;

    const tabs = normalizeStoredTabs(parsed.tabs);
    const requestedActiveId = typeof parsed.activeId === "string" ? parsed.activeId : "";
    const activeId = tabs.some((tab) => tab.id === requestedActiveId)
      ? requestedActiveId
      : tabs[0].id;

    return { tabs, activeId };
  } catch {
    return null;
  }
}
