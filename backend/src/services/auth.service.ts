import { redisClient } from "../config/redis.js";
import { UserAlreadyExistsError } from "../errors/AppError.js";

export async function redisCreateUser(
    username: string,
    hashedPassword: string,
) {
    try {
        if (await userExists(username)) {
            throw new UserAlreadyExistsError(username)
        }
        await redisClient.hSet(`user:${username}`, {
            password: hashedPassword,
        });
    } catch (err) {
        throw new Error(
            `Failed to create user in database: ${(err as Error).message}`,
        );
    }
}

async function userExists(username: string) {
    const userExists: number = await redisClient.EXISTS(`user:${username}`);
    return userExists === 1;
}
