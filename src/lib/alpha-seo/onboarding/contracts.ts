import { z } from "zod";

export const alphaSeoOnboardingContextSchema = z.object({
  projectId: z.string().trim().min(1).optional(),
});

export const alphaSeoOnboardingAnswersSchema =
  alphaSeoOnboardingContextSchema.extend({
    interestedFeatures: z
      .array(z.string().trim().min(1).max(80))
      .max(30)
      .optional(),
    workFor: z.string().trim().max(120).optional(),
    clientWebsiteCount: z.string().trim().max(80).optional(),
    foundVia: z.string().trim().max(120).optional(),
    mcpSetupIntent: z.enum(["yes", "no"]).optional(),
    completed: z.boolean().optional(),
  });

export const alphaSeoOnboardingSiteSchema = z.object({
  projectId: z.string().trim().min(1),
  domain: z.string().trim().min(1).max(2048),
  locationCode: z.number().int().positive(),
  locationName: z.string().trim().max(200).nullable().optional(),
  languageCode: z.string().trim().min(2).max(8).optional(),
  market: z.string().trim().regex(/^[A-Za-z]{2}$/).optional(),
});
