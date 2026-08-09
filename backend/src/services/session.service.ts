import type { Request } from "express";
import { redisClient } from "../config/redis.js";

export async function createSession(req: Request, username: string) {
    req.session.userId = username;
    await redisClient.sAdd(`user:${username}:sessions`, req.sessionID);
}
