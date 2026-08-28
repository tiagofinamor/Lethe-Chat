import express from "express";
import type { Request, Response, NextFunction } from "express";
import { sessionMiddleware } from "./session.js";
import userRouter from "./routes/user.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { friendsRouter } from "./routes/friends.routes.js";
import { requestsRouter } from "./routes/requests.routes.js";
import { pinoHttp } from "pino-http";
import { logger } from "./config/logger.js";
import { healthRouter } from "./routes/health.routes.js";
import { httpDuration, registry } from "./config/metrics.js";
import { ttlRouter } from "./routes/ttl.routes.js";
import { createRateLimiters } from "./config/rate-limiter.js";
import { env } from "./config/env.js";

export function buildApp() {
    const app = express();
    app.set("trust proxy", 1);

    const allowedOrigins = new Set(env.CORS_ORIGINS);

    const {  globalLimiter, userCreationLimiter } = createRateLimiters();

    app.use(pinoHttp({ logger }));

    app.use((req: Request, res: Response, next: NextFunction) => {
        const origin = req.headers.origin;
        if (origin && allowedOrigins.has(origin)) {
            res.setHeader("Access-Control-Allow-Origin", origin);
            res.setHeader("Access-Control-Allow-Credentials", "true");
            res.setHeader(
                "Access-Control-Allow-Methods",
                "GET,POST,PUT,DELETE,OPTIONS",
            );
            res.setHeader(
                "Access-Control-Allow-Headers",
                "Content-Type, Authorization",
            );
        }

        if (req.method === "OPTIONS") {
            res.sendStatus(204);
            return;
        }

        next();
    });

    app.use(
        express.json({
            limit: "10kb",
        }),
    );

    //handles invalid json
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

    app.use(sessionMiddleware);
    app.use(globalLimiter);

    app.get("/", (req: Request, res: Response, next: NextFunction) => {
        res.send("hello world!");
    });

    app.use((req: Request, res: Response, next: NextFunction) => {
        const end = httpDuration.startTimer();
        res.on("finish", () => {
            end({
                method: req.method,
                route: req.route?.path ?? req.path,
                status: res.statusCode,
            });
        });
        next();
    });

    app.use("/api/users", userCreationLimiter, userRouter);

    app.use("/api/auth", authRouter);

    app.use("/api/friends", friendsRouter);
    app.use("/api/requests", requestsRouter);
    app.use("/api/ttl", ttlRouter);

    app.use("/health", healthRouter);
    app.use("/metrics", async (req: Request, res: Response) => {
        res.set("Content-Type", registry.contentType);
        res.send(await registry.metrics());
    });

    app.use(errorHandler);
    return app;
}
