import { ZodError } from "zod";
import { AppError } from "../errors/AppError.js";
import type { Request, Response, NextFunction } from "express";

export function errorHandler(
    err: unknown,
    req: Request,
    res: Response,
    next: NextFunction,
) {
    if (err instanceof ZodError) {
        return res.status(400).json({ error: "Invalid request data" });
    }

    if (err instanceof AppError) {
        return res.status(err.statusCode).json({ error: err.message });
    }

    // Anything else: unexpected — log internally
    console.error("Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
}
