import type { Request, Response } from "express";
import { redisClient } from "../config/redis.js";
export async function healthController(req: Request, res: Response) {
    try {
        await redisClient.ping();
    } catch (err) {
        return res.status(503).json({ message: "Db connection failed." });
    }
    res.status(200).json({ message: "ok" });
}
