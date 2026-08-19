import express from "express";
import type { Request, Response, NextFunction } from "express";
import { sessionMiddleware } from "./session.js";
import userRouter from "./routes/user.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { friendsRouter } from "./routes/friends.routes.js";
import { requestsRouter } from "./routes/requests.routes.js";

export const app = express();

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

app.use("/api/users", userRouter);

app.use("/api/auth", authRouter);

app.use("/api/friends", friendsRouter);
app.use("/api/requests", requestsRouter);

app.use("/api/test-error", () => {
    throw new Error("test");
});

app.use(errorHandler);
