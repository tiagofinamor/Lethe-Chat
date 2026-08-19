import { z } from "zod";

/**
 * Mirrors backend/src/models/user.model.ts so the UI validates before
 * submitting and can show the same rules the server enforces.
 */
export const usernameSchema = z
    .string()
    .trim()
    .regex(
        /^[a-zA-Z0-9_-]+$/,
        "Only letters, numbers, underscores, and hyphens allowed",
    )
    .min(4, "Username must be at least 4 characters")
    .max(12, "Username must be at most 12 characters");

export const credentialsSchema = z.object({
    username: usernameSchema,
    password: z
        .string()
        .min(8, "Password must be at least 8 characters"),
});

export type Credentials = z.infer<typeof credentialsSchema>;
