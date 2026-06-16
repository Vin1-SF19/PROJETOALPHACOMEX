import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "bibble-falas.md");
    const content = await fs.readFile(filePath, "utf-8");

    // Parse linhas no formato: - mood: happy | fala: Texto aqui
    const lines = content.split("\n").filter((l) => l.trim().startsWith("- mood:"));
    const falas = lines
      .map((line) => {
        const moodMatch = line.match(/mood:\s*(\w[\w-]*)/);
        const falaMatch = line.match(/fala:\s*(.+)$/);
        return {
          mood: moodMatch?.[1] ?? "relaxando",
          fala: falaMatch?.[1]?.trim() ?? "",
        };
      })
      .filter((f) => f.fala);

    return NextResponse.json({ falas });
  } catch {
    return NextResponse.json({ falas: [] });
  }
}
