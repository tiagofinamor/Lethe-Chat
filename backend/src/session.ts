import session from "express-session";
import { env } from "./config/env.js";
import { RedisStore } from "connect-redis";
import { redisClient } from "./config/redis.js";

export const cookieConfig = {
    secure: env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: env.USER_TTL_SECONDS * 1000,
};

export const sessionMiddleware = session({
    store: new RedisStore({ client: redisClient }),
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: cookieConfig,
});