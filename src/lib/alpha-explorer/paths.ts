const MAX_PATH_LENGTH = 2_048;
const MAX_SEGMENT_LENGTH = 255;
const MAX_DECODE_PASSES = 3;

export class ExplorerPathError extends Error {
  readonly code = "INVALID_PATH";

  constructor(message: string) {
    super(message);
    this.name = "ExplorerPathError";
  }
}
function decodePath(raw: string): string {
  let decoded = raw;
  for (let pass = 0; pass < MAX_DECODE_PASSES; pass += 1) {
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      throw new ExplorerPathError("Path contains invalid percent encoding");
    }
    if (next === decoded) return decoded;
    decoded = next;
  }

  if (/%[0-9a-f]{2}/i.test(decoded)) {
    throw new ExplorerPathError("Path encoding is too deeply nested");
  }
  return decoded;
}

function normalizeSegment(segment: string): string {
  const normalized = segment.normalize("NFC").trim();
  if (!normalized || normalized === "." || normalized === "..") {
    throw new ExplorerPathError("Path contains an invalid segment");
  }
  if (normalized.endsWith(".") || normalized.length > MAX_SEGMENT_LENGTH) {
    throw new ExplorerPathError("Path segment is not portable");
  }
  if (/[/\\\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new ExplorerPathError("Path segment contains a forbidden character");
  }
  return normalized;
}

/** Returns a relative, NFC-normalized logical path without leading/trailing slash. */
export function normalizeLogicalPath(input: string): string {
  if (typeof input !== "string") throw new ExplorerPathError("Path must be a string");
  const decoded = decodePath(input.trim());
  if (decoded.length > MAX_PATH_LENGTH) throw new ExplorerPathError("Path is too long");

  const unix = decoded.replaceAll("\\", "/");
  const rawSegments = unix.split("/").filter((segment) => segment.trim().length > 0);
  return rawSegments.map(normalizeSegment).join("/");
}

export function normalizeFolderPrefix(input: string): string {
  const path = normalizeLogicalPath(input);
  return path ? `${path}/` : "";
}

export function isPathWithinPrefix(pathInput: string, prefixInput: string): boolean {
  const path = normalizeLogicalPath(pathInput);
  const prefix = normalizeLogicalPath(prefixInput);
  return prefix === "" || path === prefix || path.startsWith(`${prefix}/`);
}

export function joinLogicalPath(baseInput: string, childInput: string): string {
  const base = normalizeLogicalPath(baseInput);
  const child = normalizeLogicalPath(childInput);
  if (!child) throw new ExplorerPathError("Child path is required");
  return normalizeLogicalPath(base ? `${base}/${child}` : child);
}

export function logicalParent(pathInput: string): string | null {
  const path = normalizeLogicalPath(pathInput);
  if (!path) return null;
  const separator = path.lastIndexOf("/");
  return separator === -1 ? "" : path.slice(0, separator);
}
