import { createClient, type RedisClientType } from "redis";
import { env } from "./env.js";
import { logger } from "./logger.js";

export const redisClient: RedisClientType = createClient({
    url: env.REDIS_URL,
});

export const subscriberClient = redisClient.duplicate();

const logRedisError = (err: Error) => {
    logger.error({ err }, "Redis client error");
};

redisClient.on("error", logRedisError);
subscriberClient.on("error", logRedisError);

export async function connectRedis() {
    try {
        await Promise.all([redisClient.connect(), subscriberClient.connect()]);
        console.log("Connected to Redis successfully!");
    } catch (err) {
        logger.fatal(err);
    }
}
