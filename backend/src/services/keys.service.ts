import { redisKeys } from "../config/redis-keys.js";
import { redisClient } from "../config/redis.js";

const MAX_KEY_HISTORY = 5;

function parseKeyHistory(rawHistory: string | null): string[] {
    if (!rawHistory) return [];

    try {
        const parsed = JSON.parse(rawHistory);
        return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
    } catch {
        return [];
    }
}

function appendKeyHistory(existingHistory: string[], newKey: string): string[] {
    const history = existingHistory.filter((key) => key && key !== newKey);
    history.push(newKey);
    return history.slice(-MAX_KEY_HISTORY);
}

export async function registerKey(
    username: string,
    key: string,
    replace = false,
): Promise<"created" | "unchanged" | "conflict" | "rotated"> {
    const userKey = redisKeys.user(username);
    const currentKey = await redisClient.hGet(userKey, "publicKey");

    if (!currentKey) {
        await redisClient.hSet(userKey, {
            publicKey: key,
            publicKeyHistory: JSON.stringify([key]),
        });
        return "created";
    }

    if (currentKey === key) {
        return "unchanged";
    }

    const previousKeys = appendKeyHistory(
        parseKeyHistory(await redisClient.hGet(userKey, "publicKeyHistory")),
        currentKey,
    );

    if (!replace) {
        await redisClient.hSet(userKey, {
            publicKeyHistory: JSON.stringify(previousKeys),
        });
        return "conflict";
    }

    await redisClient.hSet(userKey, {
        publicKey: key,
        publicKeyHistory: JSON.stringify(previousKeys),
    });

    return "rotated";
}

export async function getKey(username: string) {
    return await redisClient.hGet(redisKeys.user(username), "publicKey");
}

export async function getKeyHistory(username: string): Promise<string[]> {
    const history = await redisClient.hGet(redisKeys.user(username), "publicKeyHistory");
    return parseKeyHistory(history);
}