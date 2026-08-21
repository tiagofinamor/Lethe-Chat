import { redisKeys } from "../config/redis-keys.js";
import { redisClient } from "../config/redis.js";

export async function registerKey(username: string, key: string) {
    await redisClient.hSet(redisKeys.user(username), "publicKey", key);
}

export async function getKey(username: string) {
    return await redisClient.hGet(redisKeys.user(username), "publicKey");
}