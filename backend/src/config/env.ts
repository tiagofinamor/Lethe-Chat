import {z} from "zod";

const envSchema = z.object({
    PORT: z.coerce.number(),
    NODE_ENV: z.enum(["development", "production", "test"]),
    REDIS_URL: z.url(),
    SESSION_SECRET: z.string().min(32),
    USER_TTL_SECONDS: z.coerce.number().default(3600)
});

export const env = envSchema.parse(process.env);