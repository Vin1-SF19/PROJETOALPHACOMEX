import { z } from "zod";

export const INVENTORY_TAG_KINDS = ["ETIQUETA", "KIT_MODELO"] as const;
export const INVENTORY_KIT_ACTIVE_STATUSES = ["RASCUNHO", "INCOMPLETO", "COMPLETO", "EM_USO"] as const;
export const INVENTORY_KIT_COMPONENT_ACTIVE_STATUSES = ["SELECIONADO", "EM_USO"] as const;

const idSchema = z.string().trim().min(1).max(100);
const optionalIdSchema = z.union([idSchema, z.literal(""), z.null(), z.undefined()]).transform((value) => value || null);
const colorSchema = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Informe uma cor hexadecimal válida.");

export const tagRequirementInputSchema = z.object({
  id: idSchema.optional(),
  produtoId: idSchema,
  quantityRequired: z.coerce.number().int().positive().max(10_000),
  required: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
  observacao: z.string().trim().max(500).nullable().optional(),
});

export const saveInventoryTagSchema = z.object({
  id: idSchema.optional(),
  version: z.coerce.number().int().positive().optional(),
  kind: z.enum(INVENTORY_TAG_KINDS),
  nome: z.string().trim().min(2).max(100),
  descricao: z.string().trim().max(800).nullable().optional(),
  cor: colorSchema.default("#2563eb"),
  icone: z.string().trim().max(50).nullable().optional(),
  categoriaId: optionalIdSchema,
  produtoIds: z.array(idSchema).max(500).default([]),
  requirements: z.array(tagRequirementInputSchema).max(100).default([]),
}).superRefine((data, context) => {
  if (data.kind === "ETIQUETA" && data.requirements.length > 0) {
    context.addIssue({ code: "custom", path: ["requirements"], message: "Etiquetas simples não possuem requisitos de kit." });
  }
  if (data.kind === "KIT_MODELO" && data.produtoIds.length > 0) {
    context.addIssue({ code: "custom", path: ["produtoIds"], message: "Modelos de kit usam requisitos, não vínculos de etiqueta." });
  }
  const productIds = data.kind === "KIT_MODELO" ? data.requirements.map((item) => item.produtoId) : data.produtoIds;
  if (new Set(productIds).size !== productIds.length) {
    context.addIssue({ code: "custom", message: "O mesmo item não pode aparecer duas vezes na composição." });
  }
});

export const createInventoryKitSchema = z.object({
  tagId: idSchema,
  code: z.string().trim().min(3).max(80).regex(/^[A-Za-z0-9._-]+$/, "Use apenas letras, números, ponto, hífen ou sublinhado.").optional(),
  observacao: z.string().trim().max(800).nullable().optional(),
});

export const kitComponentInputSchema = z.object({
  requirementId: idSchema,
  produtoId: idSchema,
  assetId: optionalIdSchema,
  quantity: z.coerce.number().int().positive().max(10_000),
});

export const saveInventoryKitComponentsSchema = z.object({
  kitInstanceId: idSchema,
  version: z.coerce.number().int().positive(),
  components: z.array(kitComponentInputSchema).max(500),
});

export const deliverInventoryKitSchema = z.object({
  kitInstanceId: idSchema,
  version: z.coerce.number().int().positive(),
  responsibleUserId: z.coerce.number().int().positive(),
  locationId: optionalIdSchema,
  observacao: z.string().trim().max(800).nullable().optional(),
  idempotencyKey: z.string().trim().min(8).max(160),
});

export const returnInventoryKitSchema = z.object({
  kitInstanceId: idSchema,
  version: z.coerce.number().int().positive(),
  idempotencyKey: z.string().trim().min(8).max(160),
  lines: z.array(z.object({
    kitComponentId: idSchema,
    quantity: z.coerce.number().int().positive().max(10_000),
    condition: z.enum(["BOM", "COM_AVARIA", "NECESSITA_MANUTENCAO", "DANIFICADO"]),
    destinationLocationId: optionalIdSchema,
    observacao: z.string().trim().max(500).nullable().optional(),
  })).min(1).max(500),
}).superRefine((data, context) => {
  const componentIds = data.lines.map((line) => line.kitComponentId);
  if (new Set(componentIds).size !== componentIds.length) {
    context.addIssue({ code: "custom", path: ["lines"], message: "Cada componente pode aparecer uma vez por devolução." });
  }
});

export interface KitRequirementForValidation {
  id: string;
  produtoId: string;
  productName: string;
  quantityRequired: number;
  required: boolean;
  sortOrder: number;
}

export interface KitComponentForValidation {
  requirementId: string;
  produtoId: string;
  quantity: number;
  status?: string;
}

export interface KitSelectionRequirement {
  id: string;
  produtoId: string;
  productName: string;
  trackingMode: string;
  quantityRequired: number;
}

export interface KitRequirementValidation extends KitRequirementForValidation {
  selectedQuantity: number;
  fulfilledQuantity: number;
  missingQuantity: number;
  fulfilled: boolean;
}

export interface KitValidationResult {
  status: "KIT_COMPLETO" | "KIT_INCOMPLETO";
  complete: boolean;
  percentage: number;
  requiredFulfilled: number;
  requiredTotal: number;
  missing: Array<{ requirementId: string; produtoId: string; productName: string; quantity: number }>;
  requirements: KitRequirementValidation[];
  unmatchedComponentCount: number;
}

export interface InventoryKitCatalogProduct {
  id: string;
  nome: string;
  descricao: string | null;
  marca: string | null;
  modelo: string | null;
  imagem: string | null;
  quantidade: number;
  trackingMode: string;
  unidade: string;
  assets: Array<{
    id: string;
    patrimonio: string | null;
    serial: string | null;
    codigoInterno: string | null;
    status: string;
  }>;
}

export function availableQuantityForKit(product: InventoryKitCatalogProduct | undefined): number {
  if (!product) return 0;
  return product.trackingMode === "INDIVIDUAL"
    ? product.assets.filter((asset) => asset.status === "DISPONIVEL").length
    : Math.max(0, product.quantidade);
}

export function inventoryKitAvailability(tag: InventoryTagKitView, products: readonly InventoryKitCatalogProduct[]) {
  const productById = new Map(products.map((product) => [product.id, product]));
  const requirements = tag.requirements.map((requirement) => {
    const product = productById.get(requirement.produtoId) ?? requirement.produto;
    const available = availableQuantityForKit(product);
    const kitsPossible = Math.floor(available / requirement.quantityRequired);
    return { ...requirement, product, available, kitsPossible, missingForOne: Math.max(0, requirement.quantityRequired - available) };
  });
  const required = requirements.filter((requirement) => requirement.required);
  const hasUnavailableRequired = required.some((requirement) => requirement.available === 0);
  const hasLowRequired = required.some((requirement) => requirement.kitsPossible <= 1);
  const completeKitsPossible = required.length ? Math.min(...required.map((requirement) => requirement.kitsPossible)) : 0;
  return {
    requirements,
    completeKitsPossible,
    alert: hasUnavailableRequired ? "CRITICAL" as const : hasLowRequired ? "WARNING" as const : "OK" as const,
  };
}

export interface InventoryTagKitView {
  id: string;
  kind: (typeof INVENTORY_TAG_KINDS)[number];
  nome: string;
  descricao: string | null;
  cor: string;
  icone: string | null;
  categoriaId: string | null;
  categoria: { id: string; nome: string } | null;
  version: number;
  itemTags: Array<{ produto: { id: string; nome: string } }>;
  requirements: Array<{
    id: string;
    produtoId: string;
    quantityRequired: number;
    required: boolean;
    sortOrder: number;
    observacao: string | null;
    produto: InventoryKitCatalogProduct;
  }>;
  kitInstances: Array<{
    id: string;
    code: string;
    status: string;
    requiredQuantityCache: number;
    fulfilledQuantityCache: number;
    version: number;
  }>;
}

export interface InventoryKitsPanelData {
  tags: InventoryTagKitView[];
  products: InventoryKitCatalogProduct[];
  collaborators: Array<{ id: number; nome: string }>;
  locations: Array<{ id: string; nome: string }>;
  nextTagCursor: string | null;
}

const NON_FULFILLING_COMPONENT_STATUSES = new Set(["DEVOLVIDO", "NAO_DEVOLVIDO", "DANIFICADO", "BAIXADO"]);

export function normalizeInventoryTagName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}

export function inventoryKitCode(tagName: string, now = new Date(), uniqueSuffix = crypto.randomUUID().slice(0, 6)): string {
  const slug = normalizeInventoryTagName(tagName)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24)
    .toUpperCase() || "KIT";
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `${slug}-${date}-${uniqueSuffix.toUpperCase()}`;
}

export function validateInventoryKit(
  requirements: readonly KitRequirementForValidation[],
  components: readonly KitComponentForValidation[],
): KitValidationResult {
  const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  const selectedByRequirement = new Map<string, number>();
  let unmatchedComponentCount = 0;

  for (const component of components) {
    const requirement = requirementById.get(component.requirementId);
    if (
      !requirement ||
      requirement.produtoId !== component.produtoId ||
      component.quantity <= 0 ||
      NON_FULFILLING_COMPONENT_STATUSES.has(component.status ?? "SELECIONADO")
    ) {
      unmatchedComponentCount += 1;
      continue;
    }
    selectedByRequirement.set(
      requirement.id,
      (selectedByRequirement.get(requirement.id) ?? 0) + component.quantity,
    );
  }

  const validatedRequirements = [...requirements]
    .sort((left, right) => left.sortOrder - right.sortOrder || left.productName.localeCompare(right.productName, "pt-BR"))
    .map((requirement) => {
      const selectedQuantity = selectedByRequirement.get(requirement.id) ?? 0;
      const fulfilledQuantity = Math.min(selectedQuantity, requirement.quantityRequired);
      const missingQuantity = Math.max(0, requirement.quantityRequired - selectedQuantity);
      return { ...requirement, selectedQuantity, fulfilledQuantity, missingQuantity, fulfilled: missingQuantity === 0 };
    });

  const requiredRequirements = validatedRequirements.filter((requirement) => requirement.required);
  const requiredTotal = requiredRequirements.reduce((total, requirement) => total + requirement.quantityRequired, 0);
  const requiredFulfilled = requiredRequirements.reduce((total, requirement) => total + requirement.fulfilledQuantity, 0);
  const complete = requiredTotal > 0 && requiredFulfilled === requiredTotal;

  return {
    status: complete ? "KIT_COMPLETO" : "KIT_INCOMPLETO",
    complete,
    percentage: requiredTotal === 0 ? 0 : Math.round((requiredFulfilled / requiredTotal) * 100),
    requiredFulfilled,
    requiredTotal,
    missing: requiredRequirements
      .filter((requirement) => requirement.missingQuantity > 0)
      .map((requirement) => ({
        requirementId: requirement.id,
        produtoId: requirement.produtoId,
        productName: requirement.productName,
        quantity: requirement.missingQuantity,
      })),
    requirements: validatedRequirements,
    unmatchedComponentCount,
  };
}

export function validateKitSelectionShape(
  requirements: readonly KitSelectionRequirement[],
  components: ReadonlyArray<{ requirementId: string; produtoId: string; assetId?: string | null; quantity: number }>,
): { valid: true } | { valid: false; error: string } {
  const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  const quantities = new Map<string, number>();
  const assetIds = new Set<string>();
  for (const component of components) {
    const requirement = requirementById.get(component.requirementId);
    if (!requirement || requirement.produtoId !== component.produtoId) {
      return { valid: false, error: "Um componente não corresponde aos requisitos atuais do modelo." };
    }
    quantities.set(requirement.id, (quantities.get(requirement.id) ?? 0) + component.quantity);
    if (component.assetId) {
      if (component.quantity !== 1) return { valid: false, error: "Cada patrimônio individual deve ser selecionado com quantidade 1." };
      if (assetIds.has(component.assetId)) return { valid: false, error: "O mesmo patrimônio foi selecionado mais de uma vez." };
      assetIds.add(component.assetId);
    } else if (requirement.trackingMode === "INDIVIDUAL") {
      return { valid: false, error: `${requirement.productName} exige a seleção de um patrimônio individual.` };
    }
  }
  for (const [requirementId, quantity] of quantities) {
    const requirement = requirementById.get(requirementId)!;
    if (quantity > requirement.quantityRequired) {
      return { valid: false, error: `${requirement.productName} excede a quantidade prevista no modelo.` };
    }
  }
  return { valid: true };
}

export function kitStatusAfterReturn(
  components: ReadonlyArray<{ usagePolicy: string; quantity: number; returnedQuantity: number }>,
): "DEVOLVIDO" | "DEVOLUCAO_PENDENTE" {
  const returnables = components.filter((component) => component.usagePolicy !== "CONSUMIVEL");
  return returnables.length > 0 && returnables.every((component) => component.returnedQuantity === component.quantity)
    ? "DEVOLVIDO"
    : "DEVOLUCAO_PENDENTE";
}
