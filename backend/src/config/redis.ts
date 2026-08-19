import { createClient, type RedisClientType } from "redis";
import { env } from "./env.js";

export const redisClient: RedisClientType = createClient({
    url: env.REDIS_URL,
});

export const subscriberClient = redisClient.duplicate();

redisClient.on("error", (err: Error) => {
    console.log("Redis error: ", err);
});

export async function connectRedis() {
    try {
        await Promise.all([redisClient.connect(), subscriberClient.connect()]);
        await redisClient.configSet("notify-keyspace-events", "Ex");
        console.log("Connected to Redis successfully!");
    } catch (err) {
        console.log("Redis execution error: ", err);
    }
}
