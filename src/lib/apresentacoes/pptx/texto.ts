import { resolverCorOoxml, type ColorResolverContext } from "./color-resolver";
import type { PptxParagraph, PptxRunStyle, PptxTextBody, PptxTextRun } from "./modelo-intermediario";
import { comoArray, type NoXml } from "./xml-utils";

const DEFAULT_MARGINS_EMU = { leftEmu: 91440, rightEmu: 91440, topEmu: 45720, bottomEmu: 45720 };

function numberAttr(node: NoXml | undefined, name: string): number | undefined {
  const value = Number(node?.[`@_${name}`]);
  return Number.isFinite(value) ? value : undefined;
}

function boolAttr(node: NoXml | undefined, name: string): boolean | undefined {
  const value = node?.[`@_${name}`];
  if (value === undefined) return undefined;
  return value === true || value === 1 || value === "1" || value === "true";
}

function mapAlignment(value: unknown): PptxParagraph["alignment"] {
  if (value === "ctr") return "center";
  if (value === "r") return "right";
  if (value === "just" || value === "dist" || value === "thaiDist") return "justify";
  if (value === "l") return "left";
  return undefined;
}

function textValue(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (node && typeof node === "object" && "#text" in node) return String((node as { "#text": unknown })["#text"] ?? "");
  return "";
}

function styleFromRun(runProperties: NoXml | undefined, context: ColorResolverContext): PptxRunStyle {
  const size = numberAttr(runProperties, "sz");
  const kern = numberAttr(runProperties, "kern");
  const spacing = numberAttr(runProperties, "spc");
  const baseline = numberAttr(runProperties, "baseline");
  const typeface = runProperties?.["a:latin"]?.["@_typeface"];
  const hyperlinkId = runProperties?.["a:hlinkClick"]?.["@_r:id"];
  return {
    ...(typeof typeface === "string" && typeface.trim() ? { fontFamily: typeface.trim() } : {}),
    ...(size !== undefined ? { fontSizePt: size / 100 } : {}),
    ...(boolAttr(runProperties, "b") !== undefined ? { bold: boolAttr(runProperties, "b") } : {}),
    ...(boolAttr(runProperties, "i") !== undefined ? { italic: boolAttr(runProperties, "i") } : {}),
    ...(typeof runProperties?.["@_u"] === "string" ? { underline: runProperties["@_u"] } : {}),
    ...(typeof runProperties?.["@_strike"] === "string" ? { strike: runProperties["@_strike"] } : {}),
    ...(baseline !== undefined ? { baseline } : {}),
    ...(kern !== undefined ? { kerningPt: kern / 100 } : {}),
    ...(spacing !== undefined ? { tracking: spacing / 100 } : {}),
    ...(typeof runProperties?.["@_cap"] === "string" ? { caps: runProperties["@_cap"] } : {}),
    ...(typeof hyperlinkId === "string" ? { hyperlink: hyperlinkId } : {}),
    ...(resolverCorOoxml(runProperties?.["a:solidFill"], context)
      ? { color: resolverCorOoxml(runProperties?.["a:solidFill"], context)! }
      : {}),
  };
}

function mergeStyle(base: PptxRunStyle, direct: PptxRunStyle): PptxRunStyle {
  return { ...base, ...direct };
}

function paragraphFromNode(node: NoXml, context: ColorResolverContext, inheritedTextBodies: NoXml[], rawParagraph?: string): PptxParagraph {
  const directPPr = node?.["a:pPr"] ?? {};
  const level = numberAttr(directPPr, "lvl") ?? 0;
  const levelKey = `a:lvl${Math.max(1, Math.min(9, level + 1))}pPr`;
  const inheritedParagraphProperties = inheritedTextBodies.reduce<NoXml>((merged, body) => {
    const listStyle = body?.["a:lstStyle"]?.[levelKey] ?? {};
    const paragraphStyle = comoArray<NoXml>(body?.["a:p"])[0]?.["a:pPr"] ?? {};
    return { ...merged, ...listStyle, ...paragraphStyle };
  }, {});
  const pPr = { ...inheritedParagraphProperties, ...directPPr };
  const inheritedRunStyle = inheritedTextBodies.reduce<PptxRunStyle>((merged, body) => {
    const listRun = body?.["a:lstStyle"]?.[levelKey]?.["a:defRPr"];
    const paragraphRun = comoArray<NoXml>(body?.["a:p"])[0]?.["a:pPr"]?.["a:defRPr"];
    return mergeStyle(mergeStyle(merged, styleFromRun(listRun, context)), styleFromRun(paragraphRun, context));
  }, {});
  const defaultRunStyle = mergeStyle(inheritedRunStyle, styleFromRun(pPr?.["a:defRPr"], context));
  const runs: PptxTextRun[] = [];
  const runQueue = [...comoArray<NoXml>(node?.["a:r"])];
  const fieldQueue = [...comoArray<NoXml>(node?.["a:fld"])];
  const breakQueue = [...comoArray<NoXml>(node?.["a:br"])];
  const addRun = (child: NoXml | undefined) => {
    if (child) runs.push({ text: textValue(child?.["a:t"]), style: mergeStyle(defaultRunStyle, styleFromRun(child?.["a:rPr"], context)) });
  };
  if (rawParagraph) {
    const tokens = rawParagraph.match(/<a:(?:r|fld)\b[\s\S]*?<\/a:(?:r|fld)>|<a:br\b[^>]*(?:\/>|>[\s\S]*?<\/a:br>)/g) ?? [];
    for (const token of tokens) {
      if (token.startsWith("<a:r")) addRun(runQueue.shift());
      else if (token.startsWith("<a:fld")) addRun(fieldQueue.shift());
      else if (token.startsWith("<a:br")) {
        breakQueue.shift();
        runs.push({ text: "\n", style: defaultRunStyle });
      }
    }
  } else {
    for (const child of runQueue) addRun(child);
    for (const field of fieldQueue) addRun(field);
    for (let index = 0; index < breakQueue.length; index += 1) runs.push({ text: "\n", style: defaultRunStyle });
  }
  if (runs.length === 0 && node?.["a:endParaRPr"]) runs.push({ text: "", style: mergeStyle(defaultRunStyle, styleFromRun(node["a:endParaRPr"], context)) });

  const tabs = comoArray<NoXml>(pPr?.["a:tabLst"]?.["a:tab"])
    .map((tab) => numberAttr(tab, "pos"))
    .filter((value): value is number => value !== undefined);
  const bullet = pPr?.["a:buChar"]?.["@_char"];
  const autoNumber = pPr?.["a:buAutoNum"];
  return {
    runs,
    ...(mapAlignment(pPr?.["@_algn"]) ? { alignment: mapAlignment(pPr?.["@_algn"]) } : {}),
    ...(numberAttr(pPr, "lvl") !== undefined ? { level: numberAttr(pPr, "lvl") } : {}),
    ...(numberAttr(pPr, "marL") !== undefined ? { marginLeftEmu: numberAttr(pPr, "marL") } : {}),
    ...(numberAttr(pPr, "indent") !== undefined ? { indentEmu: numberAttr(pPr, "indent") } : {}),
    ...(numberAttr(pPr?.["a:lnSpc"]?.["a:spcPct"], "val") !== undefined ? { lineSpacing: numberAttr(pPr["a:lnSpc"]["a:spcPct"], "val")! / 1000 } : {}),
    ...(numberAttr(pPr?.["a:spcBef"]?.["a:spcPts"], "val") !== undefined ? { spaceBefore: numberAttr(pPr["a:spcBef"]["a:spcPts"], "val")! / 100 } : {}),
    ...(numberAttr(pPr?.["a:spcAft"]?.["a:spcPts"], "val") !== undefined ? { spaceAfter: numberAttr(pPr["a:spcAft"]["a:spcPts"], "val")! / 100 } : {}),
    ...(typeof bullet === "string" ? { bullet } : {}),
    ...(typeof autoNumber?.["@_type"] === "string" ? {
      numbering: {
        type: autoNumber["@_type"],
        ...(numberAttr(autoNumber, "startAt") !== undefined ? { startAt: numberAttr(autoNumber, "startAt") } : {}),
      },
    } : {}),
    ...(tabs.length ? { tabs } : {}),
  };
}

export function extrairTextBody(txBody: NoXml | undefined, context: ColorResolverContext, inheritedTextBodies: NoXml[] = [], rawXml?: string): PptxTextBody | null {
  if (!txBody) return null;
  const bodyPr = txBody["a:bodyPr"] ?? {};
  const rawParagraphs = rawXml?.match(/<a:p(?:\s[^>]*)?>[\s\S]*?<\/a:p>/g) ?? [];
  let paragraphs = comoArray<NoXml>(txBody["a:p"]).map((paragraph, index) => paragraphFromNode(paragraph, context, inheritedTextBodies, rawParagraphs[index]));
  const normalAutofit = bodyPr["a:normAutofit"];
  const fontScale = normalAutofit ? (numberAttr(normalAutofit, "fontScale") ?? 100000) / 100000 : 1;
  const lineSpacingReduction = normalAutofit ? (numberAttr(normalAutofit, "lnSpcReduction") ?? 0) / 1000 : 0;
  if (normalAutofit && (fontScale !== 1 || lineSpacingReduction > 0)) {
    paragraphs = paragraphs.map((paragraph) => ({
      ...paragraph,
      ...(paragraph.lineSpacing !== undefined ? { lineSpacing: Math.max(1, paragraph.lineSpacing - lineSpacingReduction) } : {}),
      runs: paragraph.runs.map((run) => ({
        ...run,
        style: {
          ...run.style,
          ...(run.style.fontSizePt !== undefined ? { fontSizePt: run.style.fontSizePt * fontScale } : {}),
        },
      })),
    }));
  }
  const autofit: PptxTextBody["autofit"] = bodyPr["a:spAutoFit"] !== undefined ? "shape"
    : bodyPr["a:normAutofit"] !== undefined ? "normal" : "none";
  return {
    paragraphs,
    margins: {
      leftEmu: numberAttr(bodyPr, "lIns") ?? DEFAULT_MARGINS_EMU.leftEmu,
      rightEmu: numberAttr(bodyPr, "rIns") ?? DEFAULT_MARGINS_EMU.rightEmu,
      topEmu: numberAttr(bodyPr, "tIns") ?? DEFAULT_MARGINS_EMU.topEmu,
      bottomEmu: numberAttr(bodyPr, "bIns") ?? DEFAULT_MARGINS_EMU.bottomEmu,
    },
    ...(typeof bodyPr["@_anchor"] === "string" ? { anchor: bodyPr["@_anchor"] } : {}),
    ...(typeof bodyPr["@_vert"] === "string" ? { vertical: bodyPr["@_vert"] } : {}),
    ...(typeof bodyPr["@_wrap"] === "string" ? { wrap: bodyPr["@_wrap"] } : {}),
    columns: Math.max(1, numberAttr(bodyPr, "numCol") ?? 1),
    autofit,
  };
}

export function textoPlano(body: PptxTextBody): string {
  return body.paragraphs.map((paragraph) => paragraph.runs.map((run) => run.text).join("")).join("\n");
}

export function textoTemConteudoVisual(body: PptxTextBody): boolean {
  return textoPlano(body).replace(/\u00A0/g, " ").trim().length > 0;
}

export interface FontSubstitution {
  original: string;
  substitute: string;
  available: boolean;
}

const FONT_SUBSTITUTIONS: Record<string, string> = {
  "sf pro display": "Inter",
  "sf pro display heavy": "Inter",
  "open sans 1": "Open Sans",
  "open sans 2": "Open Sans",
};

export function pilhaCssDaFonte(original: string | null | undefined): string | undefined {
  if (!original?.trim()) return undefined;
  const sanitized = original.replace(/["']/g, "").trim();
  const substitute = FONT_SUBSTITUTIONS[sanitized.toLowerCase()] ?? "Arial";
  return `"${sanitized}", "${substitute}", sans-serif`;
}

export async function resolverFontesNoDocumento(fonts: string[]): Promise<FontSubstitution[]> {
  if (typeof document === "undefined" || !document.fonts) {
    return fonts.map((original) => ({ original, substitute: FONT_SUBSTITUTIONS[original.toLowerCase()] ?? "Arial", available: false }));
  }
  // `document.fonts.ready` só aguarda fontes que o navegador já decidiu carregar. Como a
  // prévia ainda não montou os textos neste ponto, @font-face como Montserrat/Open Sans podia
  // continuar ocioso e `check()` retornava falso apesar do WOFF2 existir no aplicativo.
  await Promise.all(fonts.map(async (original) => {
    const limpa = original.replace(/["']/g, "").trim();
    if (!limpa) return;
    await document.fonts.load(`16px "${limpa}"`, "Alpha Motion").catch(() => []);
  }));
  await document.fonts.ready;
  return fonts.map((original) => {
    const available = document.fonts.check(`16px "${original.replace(/"/g, "")}"`);
    return { original, substitute: available ? original : FONT_SUBSTITUTIONS[original.toLowerCase()] ?? "Arial", available };
  });
}
