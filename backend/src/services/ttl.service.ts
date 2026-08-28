import { redisKeys } from "../config/redis-keys.js";
import { redisClient } from "../config/redis.js";
import { UserDoesNotExistError } from "../errors/AppError.js";
import { InvariantError } from "../errors/InvariantError.js";

export async function getUserTtl(username: string) {
    const userTtlSeconds = await redisClient.ttl(redisKeys.user(username));
    if (userTtlSeconds === -2) {
        throw new UserDoesNotExistError(username);
    }
    if (userTtlSeconds === -1) {
        throw new InvariantError("User has no set ttl", 500);
    }

    return userTtlSeconds;
}