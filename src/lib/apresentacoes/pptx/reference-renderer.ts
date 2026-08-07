import { access, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import JSZip from "jszip";

export interface PptxReferenceSlide {
  slideNumber: number;
  png: Buffer;
}

export type PptxReferenceRenderResult =
  | { ok: true; renderer: "powerpoint"; slides: PptxReferenceSlide[] }
  | { ok: false; renderer: null; reason: string };

const POWERPOINT_PATHS = [
  "C:\\Program Files\\Microsoft Office\\root\\Office16\\POWERPNT.EXE",
  "C:\\Program Files (x86)\\Microsoft Office\\root\\Office16\\POWERPNT.EXE",
];

async function firstAccessible(paths: string[]): Promise<string | null> {
  for (const candidate of paths) {
    try {
      await access(candidate, constants.F_OK);
      return candidate;
    } catch {
      // tenta o próximo renderer conhecido
    }
  }
  return null;
}

function runProcess(command: string, args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Renderer de referência excedeu ${timeoutMs} ms.`));
    }, timeoutMs);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `Renderer encerrou com código ${code ?? "desconhecido"}.`));
    });
  });
}

/** Render independente do parser Alpha Motion. No Windows usa o próprio PowerPoint via COM. */
export async function renderizarReferenciaPptx(
  buffer: Buffer,
  canvas: { width: number; height: number },
  timeoutMs = 45_000,
): Promise<PptxReferenceRenderResult> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const relationshipFiles = Object.values(zip.files).filter((entry) => !entry.dir && entry.name.toLowerCase().endsWith(".rels"));
    for (const entry of relationshipFiles) {
      const xml = await entry.async("text");
      if (/TargetMode\s*=\s*["']External["']/i.test(xml)) {
        return { ok: false, renderer: null, reason: "Render independente bloqueado: o pacote contém relacionamento externo." };
      }
    }
  } catch {
    return { ok: false, renderer: null, reason: "Render independente bloqueado: pacote PPTX inválido." };
  }
  if (process.platform !== "win32") {
    return { ok: false, renderer: null, reason: "Nenhum renderer PPTX independente está configurado neste servidor." };
  }
  const powerPoint = await firstAccessible(POWERPOINT_PATHS);
  if (!powerPoint) {
    return { ok: false, renderer: null, reason: "Microsoft PowerPoint/LibreOffice não está disponível no servidor." };
  }

  const workDir = await mkdtemp(path.join(tmpdir(), "alpha-pptx-reference-"));
  const inputPath = path.join(workDir, "source.pptx");
  const outputDir = path.join(workDir, "reference");
  const scriptPath = path.join(process.cwd(), "scripts", "render-pptx-reference.ps1");
  try {
    await writeFile(inputPath, buffer);
    await runProcess("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
      "-File", scriptPath,
      "-InputPath", inputPath,
      "-OutputDirectory", outputDir,
      "-Width", String(Math.round(canvas.width)),
      "-Height", String(Math.round(canvas.height)),
    ], timeoutMs);
    const files = (await readdir(outputDir))
      .map((name) => ({ name, slideNumber: Number(name.match(/^slide-(\d+)\.png$/i)?.[1]) }))
      .filter((file) => Number.isFinite(file.slideNumber))
      .sort((a, b) => a.slideNumber - b.slideNumber);
    if (!files.length) return { ok: false, renderer: null, reason: "O renderer não gerou imagens de referência." };
    const slides = await Promise.all(files.map(async (file) => ({
      slideNumber: file.slideNumber,
      png: await readFile(path.join(outputDir, file.name)),
    })));
    return { ok: true, renderer: "powerpoint", slides };
  } catch (error) {
    return { ok: false, renderer: null, reason: error instanceof Error ? error.message : String(error) };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
