import {
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { FileKind } from "./visual";

const ICONS: Record<FileKind, LucideIcon> = {
  folder: Folder,
  pdf: FileText,
  sheet: FileSpreadsheet,
  word: FileText,
  slides: FileText,
  image: FileImage,
  video: FileVideo,
  audio: FileText,
  archive: FileArchive,
  code: FileCode,
  text: FileText,
  other: File,
};

const COLORS: Record<FileKind, string> = {
  folder: "text-amber-300",
  pdf: "text-red-400",
  sheet: "text-emerald-400",
  word: "text-blue-400",
  slides: "text-orange-400",
  image: "text-violet-400",
  video: "text-fuchsia-400",
  audio: "text-cyan-400",
  archive: "text-yellow-500",
  code: "text-teal-300",
  text: "text-slate-400",
  other: "text-slate-400",
};

interface FileIconProps {
  kind: FileKind;
  className?: string;
}

export function FileIcon({ kind, className }: FileIconProps) {
  const Icon = ICONS[kind] ?? File;
  return <Icon aria-hidden className={cn("shrink-0", COLORS[kind] ?? COLORS.other, className)} />;
}
