import { redisClient } from "../config/redis.js";
import { AuthError } from "../errors/AppError.js";
import bcrypt from "bcrypt";

export async function authenticate(username: string, password: string) {
    const rightPassword = await redisClient.hGet(
        `user:${username}`,
        "password",
    );
    if (!rightPassword) {
        //catch cases where user doesnt exist
        throw new AuthError();
    }
    const doMatch = await bcrypt.compare(password, rightPassword);
    if (!doMatch) {
        throw new AuthError();
    }
}
