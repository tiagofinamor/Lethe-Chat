import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../services/auth.service.js";
import { userSchema } from "../models/user.model.js";
import { createSession } from "../services/session.service.js";

export async function loginController(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const { username, password } = userSchema.parse(req.body);
        await authenticate(username, password);
        await createSession(req, username);

        res.status(200).json({ message: "Authenticated" });
    } catch (err) {
        next(err);
    }
}
