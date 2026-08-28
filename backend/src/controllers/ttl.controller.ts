import type { Request, Response } from "express";
import { getUserTtl } from "../services/ttl.service.js";

export async function getTtlController(req: Request, res: Response) {
    const username = req.session.userId;
    if (!username) {
        //should never throw since route is protected.
        throw new Error("Session error: session information is missing.");
    }

    const ttlSeconds = await getUserTtl(username);
    res.status(200).json({ ttlSeconds });
}