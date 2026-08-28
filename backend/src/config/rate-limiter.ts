import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redisClient } from "./redis.js";

export function createRateLimiters() {
    const redisStore = new RedisStore({
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
    });

    const userCreationLimiter = rateLimit({
        windowMs: 60 * 60 * 1000,
        limit: 5,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        store: redisStore,
        message: {
            error: "Too many accounts created from this IP. Try again in an hour.",
        },
    });

    const globalLimiter = rateLimit({
        windowMs: 60 * 1000,
        limit: 60,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { error: "Too many requests, please try again later. " },
    });

    return { globalLimiter, userCreationLimiter };
}
