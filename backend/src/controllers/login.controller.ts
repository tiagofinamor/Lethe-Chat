import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../services/auth.service.js";
import { userSchema } from "../models/user.model.js";
import { ZodError } from "zod";

export async function loginController(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const { username, password } = userSchema.parse(req.body);
        console.log("username and password",username, password)
        await authenticate(username, password);
        req.session.userId = username;
        res.status(200).json({ message: "Authenticated" });
    } catch (err) {
        if (err instanceof ZodError) {
            console.error("Request error");
            return res.status(400).json({ message: "Bad request" });
        }
        next(err);
    }
}
