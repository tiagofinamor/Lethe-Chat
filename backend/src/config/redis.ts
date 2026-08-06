import { createClient, type RedisClientType } from "redis";
import {env} from "./env.js";

export const redisClient: RedisClientType = createClient({
    url: env.REDIS_URL
});

redisClient.on("error", (err: Error) => {
    console.log("Redis error: ", err);
});

export async function connectRedis() {
    try {
        await redisClient.connect();
        console.log("Connected to Redis successfully!");
    } catch (err) {
        console.log("Redis execution error: ", err);
    }
}