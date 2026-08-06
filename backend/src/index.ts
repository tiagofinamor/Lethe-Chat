import "dotenv/config";
import express from "express";
import session from "express-session";
import http from "node:http";
import type { Request, Response, NextFunction } from "express";

import { redisClient, connectRedis} from "./config/redis.js";
import { RedisStore } from "connect-redis";

import { env } from "./config/env.js";

const app = express();
const server = http.createServer(app);
const PORT = env.PORT;

await connectRedis();

app.use(session({
    store: new RedisStore({client: redisClient}),
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {secure: env.NODE_ENV === "production", httpOnly: true}
}))

app.get("/", (req: Request, res: Response, next: NextFunction) => {
    res.send("hello world!");
});

server.listen(PORT);
