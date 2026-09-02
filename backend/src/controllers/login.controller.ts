import type { Request, Response, NextFunction } from "express";
import {
    authenticate,
    clearOldConnections,
    logoutUser,
} from "../services/auth.service.js";
import { userSchema } from "../models/user.model.js";
import { createSession } from "../services/session.service.js";
import { cookieConfig } from "../session.js";

export async function loginController(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const { username, password } = userSchema.parse(req.body);
        await authenticate(username, password);
        await clearOldConnections(username, req.sessionID); //temporary for MVP
        await createSession(req, username);

        res.status(200).json({ message: "Authenticated" });
    } catch (err) {
        next(err);
    }
}

export async function logoutController(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const username = req.session.userId;
        if (!username) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        await logoutUser(username, req.sessionID);
        req.session.destroy((err) => {
            if (err) {
                return next(err);
            }
            res.clearCookie("connect.sid", cookieConfig);
            res.status(200).json({ message: "Logged out" });
        });
    } catch (err) {
        next(err);
    }
}
