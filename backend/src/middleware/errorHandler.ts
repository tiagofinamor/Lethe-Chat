import { ZodError } from "zod";
import { AppError } from "../errors/AppError.js";
import type { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger.js";
import { InvariantError } from "../errors/InvariantError.js";

export function errorHandler(
    err: unknown,
    req: Request,
    res: Response,
    next: NextFunction,
) {
    if (err instanceof ZodError) {
        logger.warn(
            {
                err,
                username: req.session.userId ? req.session.userId : undefined,
            },
            err.message,
        );
        return res.status(400).json({ error: "Invalid request data" });
    }

    if (err instanceof AppError) {
        logger.warn(
            {
                err,
                username: req.session.userId ? req.session.userId : undefined,
            },
            err.message,
        );
        return res.status(err.statusCode).json({ error: err.message });
    }

    if (err instanceof InvariantError) {
        logger.error({ err, ...err.context }, err.message);
        return res
            .status(err.statusCode)
            .json({ error: "something went wrong." });
    }

    logger.error({
        err,
        username: req.session.userId ? req.session.userId : undefined,
        path: req.path,
    });
    return res.status(500).json({ error: "Internal server error" });
}
