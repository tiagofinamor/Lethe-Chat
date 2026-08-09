import "dotenv/config";
import express from "express";
import session from "express-session";
import http from "node:http";
import type { Request, Response, NextFunction } from "express";

import { redisClient, connectRedis } from "./config/redis.js";
import { RedisStore } from "connect-redis";

import { env } from "./config/env.js";
import userRouter from "./routes/user.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();
const server = http.createServer(app);
const PORT = env.PORT;
export const cookieConfig = {
    secure: env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as "lax",
    maxAge: 1000 * 60 * 60,
};

app.use(
    express.json({
        limit: "10kb",
    }),
);

//handle invalid json
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (
        err instanceof SyntaxError &&
        "type" in err &&
        err.type === "entity.parse.failed"
    ) {
        return res.status(400).json({ error: "Invalid JSON payload" });
    }
    next(err);
});

await connectRedis();

app.use(
    session({
        store: new RedisStore({ client: redisClient }),
        secret: env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: cookieConfig,
    }),
);

app.get("/", (req: Request, res: Response, next: NextFunction) => {
    res.send("hello world!");
});

app.use("/api/users", userRouter);

app.use("/api/auth", authRouter);

app.use("/api/test-error", () => {
    throw new Error("test");
})

app.use(errorHandler);

server.listen(PORT);
