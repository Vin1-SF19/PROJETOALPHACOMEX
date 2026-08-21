import { z } from "zod";

const projectNameSchema = z.string().trim().min(1).max(120);
const domainSchema = z.string().trim().max(255).nullable().optional();

export const alphaSeoProjectCreateSchema = z.object({
  name: projectNameSchema,
  domain: domainSchema,
  locationCode: z.number().int().positive().default(2840),
  locationName: z.string().trim().max(120).nullable().optional(),
  languageCode: z.string().trim().min(2).max(8).default("pt"),
  market: z.string().trim().min(2).max(8).default("BR"),
});

export const alphaSeoProjectUpdateSchema = alphaSeoProjectCreateSchema.partial().extend({
  projectId: z.string().min(1),
});

export const alphaSeoProjectListSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(30),
  archived: z.boolean().default(false),
  search: z.string().trim().max(120).optional(),
});

export const alphaSeoMemberRoleSchema = z.enum(["EDITOR", "VIEWER"]);
export const alphaSeoProjectIdSchema = z.object({ projectId: z.string().min(1) });
export const alphaSeoMemberUpdateSchema = alphaSeoProjectIdSchema.extend({
  memberUserId: z.number().int().positive(),
  role: alphaSeoMemberRoleSchema,
});
export const alphaSeoMemberRemoveSchema = alphaSeoProjectIdSchema.extend({
  memberUserId: z.number().int().positive(),
});
export const alphaSeoOwnershipTransferSchema = alphaSeoProjectIdSchema.extend({
  newOwnerUserId: z.number().int().positive(),
  previousOwnerRole: alphaSeoMemberRoleSchema.default("EDITOR"),
});
export const alphaSeoInviteCreateSchema = alphaSeoProjectIdSchema.extend({
  email: z.string().trim().email().max(254),
  role: alphaSeoMemberRoleSchema,
  expiresInHours: z.number().int().min(1).max(24 * 14).default(72),
});
export const alphaSeoInviteAcceptSchema = z.object({ token: z.string().min(32).max(512) });
export const alphaSeoInviteRevokeSchema = alphaSeoProjectIdSchema.extend({
  invitationId: z.string().min(1),
});

export type AlphaSeoProjectCreateInput = z.infer<typeof alphaSeoProjectCreateSchema>;
export type AlphaSeoProjectUpdateInput = z.infer<typeof alphaSeoProjectUpdateSchema>;
