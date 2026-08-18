import { redisKeys } from "../config/redis-keys.js";
import { redisClient } from "../config/redis.js";
import { UserDoesNotExistError } from "../errors/AppError.js";

export async function getUserFriends(username: string) {
    const userExists = await redisClient.exists(redisKeys.user(username));
    if (!userExists) {
        throw new UserDoesNotExistError(username);
    }
    return await redisClient.sMembers(redisKeys.friends(username));
}