import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { redisClient } from "../../config/redis.js";
import { redisKeys } from "../../config/redis-keys.js";
import { getUserTtl } from "../../services/ttl.service.js";
import { UserDoesNotExistError } from "../../errors/AppError.js";

vi.mock("../../config/env.js", () => ({
    env: {
        PORT: 3000,
        NODE_ENV: "test",
        REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
        SESSION_SECRET: "x".repeat(32),
        USER_TTL_SECONDS: 3600,
    },
}));

describe("ttl.service integration tests", () => {
    beforeAll(async () => {
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }
    });

    afterAll(async () => {
        if (redisClient.isOpen) {
            await redisClient.quit();
        }
    });

    it("returns the remaining TTL for an existing user", async () => {
        const username = "ttl_user_existing";
        const expectedTtl = 120;

        await redisClient.hSet(redisKeys.user(username), {
            password: "hashedPassword",
        });
        await redisClient.expire(redisKeys.user(username), expectedTtl);

        try {
            const ttl = await getUserTtl(username);

            expect(ttl).toBeGreaterThan(0);
            expect(ttl).toBeLessThanOrEqual(expectedTtl);
        } finally {
            await redisClient.del(redisKeys.user(username));
        }
    });

    it("throws when the user does not exist", async () => {
        await expect(getUserTtl("ttl_user_missing")).rejects.toThrow(
            UserDoesNotExistError,
        );
    });
});
