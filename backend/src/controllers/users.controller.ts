import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import { redisCreateUser, redisDeleteUser, redisSetTTL } from "../services/user.service.js";

import { userSchema } from "../models/user.model.js";
import { cookieConfig } from "../session.js";
import { createSession } from "../services/session.service.js";

export async function createUserController(req: Request, res: Response, next: NextFunction) {
    try {
        const {username, password} = userSchema.parse(req.body);
        const hashedPassword = await bcrypt.hash(password, 10);
        //TODO: add rollback incase createuser succeeds and the rest fails
        await redisCreateUser(username, hashedPassword);
        await createSession(req, username);
        await redisSetTTL(username);
        console.log("User created in database!");
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
    console.log("delete route: username: ");
    if (!username) {
        //catches only strange cases since this function only gets called in a protected route
        throw new Error("An error occurred");
    }

    try {
        await redisDeleteUser(username);
        console.log("delete route: ran redis delete user.")
        req.session.destroy((err) => {
            if (err) next(err);
            res.clearCookie("connect.sid", cookieConfig);
            res.status(204).send();
        });
    } catch (err) {
        next(err);
    }
}
