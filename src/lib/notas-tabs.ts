export interface NotaTab {
  id: string;
  noteId: string;
  title: string;
  pinned?: boolean;
}

export interface NotasTabsState {
  tabs: NotaTab[];
  activeId: string | null;
}

const STORAGE_KEY_PREFIX = "painel_alpha_notas_tabs_v1_user";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStoredNotaTab(value: unknown): value is NotaTab {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&
    typeof value.noteId === "string" &&
    value.noteId.trim().length > 0 &&
    typeof value.title === "string"
  );
}

export function getNotasTabsStorageKey(userId: number): string {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error("userId inválido para persistência das abas de notas");
  }

  return `${STORAGE_KEY_PREFIX}_${userId}`;
}

export function normalizeStoredNotaTabs(value: unknown): NotaTab[] {
  if (!Array.isArray(value)) return [];

  const seenIds = new Set<string>();
  const seenNoteIds = new Set<string>();
  const validTabs: NotaTab[] = [];

  for (const candidate of value) {
    if (!isStoredNotaTab(candidate)) continue;
    if (seenIds.has(candidate.id) || seenNoteIds.has(candidate.noteId)) continue;

    seenIds.add(candidate.id);
    seenNoteIds.add(candidate.noteId);
    validTabs.push({
      id: candidate.id,
      noteId: candidate.noteId,
      title: candidate.title.trim() || "Sem título",
      pinned: candidate.pinned === true,
    });
  }

  return validTabs;
}

export function parseStoredNotasTabsState(rawValue: string | null): NotasTabsState | null {
  if (!rawValue) return null;

  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (!isRecord(parsed) || !Array.isArray(parsed.tabs)) return null;

    const tabs = normalizeStoredNotaTabs(parsed.tabs);
    const requestedActiveId = typeof parsed.activeId === "string" ? parsed.activeId : null;
    const activeId = tabs.some((tab) => tab.id === requestedActiveId) ? requestedActiveId : null;

    return { tabs, activeId };
  } catch {
    return null;
  }
}
