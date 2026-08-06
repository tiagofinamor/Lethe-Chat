import {z} from "zod";

const envSchema = z.object({
    PORT: z.coerce.number(),
    NODE_ENV: z.enum(["development", "production", "test"]),
    REDIS_URL: z.url(),
    SESSION_SECRET: z.string().min(32)
});

export const env = envSchema.parse(process.env);