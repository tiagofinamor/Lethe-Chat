import type { Request } from "express";
import { redisClient } from "../config/redis.js";
import { redisKeys } from "../config/redis-keys.js";

export async function createSession(req: Request, username: string) {
    req.session.userId = username;
    await redisClient.sAdd(redisKeys.sessions(username), req.sessionID);
}
