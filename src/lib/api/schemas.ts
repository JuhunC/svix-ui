import { z } from "zod";

/** Shared request validation for endpoint routes (admin + consumer portal). */

export const CreateEndpoint = z.object({
  url: z.string().url(),
  description: z.string().optional(),
  filterTypes: z.array(z.string().min(1)).optional(),
  channels: z.array(z.string().min(1)).optional(),
  disabled: z.boolean().optional(),
  rateLimit: z.number().int().positive().optional(),
  secret: z.string().optional(),
});

export const UpdateEndpoint = z.object({
  url: z.string().url().optional(),
  description: z.string().optional(),
  disabled: z.boolean().optional(),
  filterTypes: z.array(z.string().min(1)).nullable().optional(),
  channels: z.array(z.string().min(1)).nullable().optional(),
  rateLimit: z.number().int().positive().nullable().optional(),
});

export const HeadersBody = z.object({
  headers: z.record(z.string(), z.string()),
});

export const RecoverBody = z.object({ since: z.string().min(1) });

export const SendExample = z.object({ eventType: z.string().min(1) });

export const TransformationBody = z.object({
  enabled: z.boolean().optional(),
  code: z.string().nullable().optional(),
});
