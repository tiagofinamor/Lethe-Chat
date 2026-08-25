import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import {
    redisCreateUser,
    redisDeleteUser,
    redisSetTTL,
} from "../services/user.service.js";

import { userSchema } from "../models/user.model.js";
import { cookieConfig } from "../session.js";
import { createSession } from "../services/session.service.js";
import { InvariantError } from "../errors/InvariantError.js";

export async function createUserController(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const { username, password } = userSchema.parse(req.body);
        const hashedPassword = await bcrypt.hash(password, 10);
        //TODO: add rollback incase createuser succeeds and the rest fails
        await redisCreateUser(username, hashedPassword);
        await createSession(req, username);
        await redisSetTTL(username);
        return res.status(201).json({ message: "User created" });
    } catch (err) {
        next(err);
    }
}

export async function deleteUserController(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    const username = req.session.userId;
    if (!username) {
        //catches only strange cases since this function only gets called in a protected route
        throw new InvariantError(
            "User without a session tried to call delete endpoint",
            500,
        );
    }

    try {
        await redisDeleteUser(username);
        req.session.destroy((err) => {
            if (err) return next(err);
            res.clearCookie("connect.sid", cookieConfig);
            res.status(204).send();
        });
    } catch (err) {
        next(err);
    }
}
