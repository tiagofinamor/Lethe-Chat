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

export const app = express();

app.use(pinoHttp({ logger }));

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

app.use("/api/users", userRouter);

app.use("/api/auth", authRouter);

app.use("/api/friends", friendsRouter);
app.use("/api/requests", requestsRouter);

app.use("/health", healthRouter);
app.use("/metrics", async (req: Request, res: Response) => {
    res.set("Content-Type", registry.contentType);
    res.send(await registry.metrics());
});

app.use("/api/test-error", () => {
    throw new Error("test");
});

app.use(errorHandler);
