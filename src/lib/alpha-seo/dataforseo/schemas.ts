import { z } from "zod";

export const dataForSeoTaskSchema = z.object({
  id: z.string().optional(),
  status_code: z.number().int(),
  status_message: z.string().optional(),
  cost: z.number().nonnegative().optional(),
  path: z.array(z.string()).optional(),
  result_count: z.number().int().nonnegative().nullable().optional(),
  result: z.array(z.unknown()).nullable().optional(),
}).passthrough();

export const dataForSeoEnvelopeSchema = z.object({
  status_code: z.number().int(),
  status_message: z.string().optional(),
  tasks: z.array(dataForSeoTaskSchema).optional(),
}).passthrough();

export type DataForSeoTask = z.infer<typeof dataForSeoTaskSchema>;

export const dataForSeoScopeSchema = z.enum(["exact_url", "subfolder", "domain", "subdomains"]);
export type DataForSeoScope = z.infer<typeof dataForSeoScopeSchema>;
