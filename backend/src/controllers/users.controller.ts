import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { redisCreateUser } from "../services/user.service.js";

import { userSchema } from "../models/user.model.js";
import { UserAlreadyExistsError } from "../errors/AppError.js";
import { ZodError } from "zod";

export async function createUserController(req: Request, res: Response) {
    try {
        const body = userSchema.parse(req.body);
        const hashedPassword = await bcrypt.hash(body.password, 10);
        await redisCreateUser(body.username, hashedPassword);
        console.log("User created in database!");
        return res.status(201).json({ message: "User created" });
    } catch (err) {
        if (err instanceof Error) {
            console.error("Signup failed:", err.message);
        }
        if (err instanceof ZodError) {
            console.error("Request error");
            return res.status(400).json({ message: "Bad request" });
        }
        if (err instanceof UserAlreadyExistsError) {
            return res.status(err.statusCode).json({ message: err.message });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
}