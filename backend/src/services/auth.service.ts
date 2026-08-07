import { redisClient } from "../config/redis.js";

export async function redisCreateUser(username: string, hashedPassword: string) {
    try {
        await redisClient.hSet(`user:${username}`, {password: hashedPassword});
    } catch (err) {
        throw new Error(`Failed to create user in database: ${(err as Error).message}`);
    }
    
}