import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import { redisCreateUser, redisDeleteUser } from "../services/user.service.js";

import { userSchema } from "../models/user.model.js";
import { cookieConfig } from "../index.js";

export async function createUserController(req: Request, res: Response, next: NextFunction) {
    try {
        const body = userSchema.parse(req.body);
        const hashedPassword = await bcrypt.hash(body.password, 10);
        await redisCreateUser(body.username, hashedPassword);
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
