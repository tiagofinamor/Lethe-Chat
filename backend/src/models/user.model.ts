import z from "zod";

export const userSchema = z.object({
    username: z
        .string()
        .trim()
        .regex(
            /^[a-zA-Z0-9_-]+$/,
            "Only letters, numbers, underscores, and hyphens allowed",
        )
        .min(4)
        .max(12),
    password: z.string().min(8),
});