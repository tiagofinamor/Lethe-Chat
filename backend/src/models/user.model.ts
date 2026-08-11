import z from "zod";

export const usernameSchema = z
    .string()
    .trim()
    .regex(
        /^[a-zA-Z0-9_-]+$/,
        "Only letters, numbers, underscores, and hyphens allowed",
    )
    .min(4)
    .max(12);

export const userSchema = z.object({
    username: usernameSchema,
    password: z.string().min(8),
});