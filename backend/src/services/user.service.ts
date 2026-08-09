import { env } from "../config/env.js";
import { redisClient } from "../config/redis.js";
import { UserAlreadyExistsError } from "../errors/AppError.js";

export async function redisCreateUser(
    username: string,
    hashedPassword: string,
) {
    try {
        if (await userExists(username)) {
            throw new UserAlreadyExistsError(username);
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

export async function redisSetTTL(username: string) {
    await redisClient
        .multi()
        .expire(`user:${username}`, env.USER_TTL_SECONDS)
        .expire(`user:${username}:sessions`, env.USER_TTL_SECONDS)
        .exec();
}

export async function redisDeleteUser(username: string) {
    //this could throw an error if somehow someone manages to send a request to /delete without a session
    const sessions = await redisClient.sMembers(`user:${username}:sessions`);
    console.log("user service: got the members");
    const sessionKeys = sessions.map((id) => `sess:${id}`);

    //these delete operations are naturally idempotent.
    await redisClient.del(sessionKeys);
    await redisClient.del(`user:${username}:sessions`);
    await redisClient.del(`user:${username}`);
}

async function userExists(username: string) {
    const userExists: number = await redisClient.EXISTS(`user:${username}`);
    return userExists === 1;
}
