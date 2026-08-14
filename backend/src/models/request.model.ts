import { z } from "zod";

export const requestSchema = z.object({
  to: z.string().min(1),
});

export const respondSchema = z.object({
  from: z.string().min(1),
});