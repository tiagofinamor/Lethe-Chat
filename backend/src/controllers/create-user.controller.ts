import z from "zod";
import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { redisCreateUser } from "../services/auth.service.js";

const userSchema = z.object({
    username: z
        .string()
        .trim()
        .regex(
            /^[a-zA-Z0-9_-]+$/,
            "Only letters, numbers, underscores, and hyphens allowed",
        )
        .min(4)
        .max(12),
    password: z.string().min(8),
});

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
        return res.status(500).json({ message: "Internal server error" });
    }
}
