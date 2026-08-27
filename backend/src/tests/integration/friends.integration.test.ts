import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { redisClient } from "../../config/redis.js";
import { getUserFriends } from "../../services/friends.service.js";
import { UserDoesNotExistError } from "../../errors/AppError.js";
import { redisKeys } from "../../config/redis-keys.js";

vi.mock("../../config/env.js", () => ({
    env: {
        PORT: 3000,
        NODE_ENV: "test",
        REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
        SESSION_SECRET: "x".repeat(32),
        USER_TTL_SECONDS: 3600,
    },
}));

describe("friends.service integration tests", () => {
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

    describe("getUserFriends", () => {
        it("throws UserDoesNotExistError when requested user does not exist in Redis", async () => {
            await expect(getUserFriends("friends_ghost_user")).rejects.toThrow(
                UserDoesNotExistError,
            );
        });

        it("returns an empty array when user exists but has no friends", async () => {
            const username = "friends_alice_nofriends";
            await redisClient.hSet(redisKeys.user(username), {
                password: "hashedPassword",
            });

            try {
                const friends = await getUserFriends(username);
                expect(friends).toEqual([]);
            } finally {
                await redisClient.del(redisKeys.user(username));
            }
        });

        it("returns the list of friends when user has friends in Redis", async () => {
            const username = "friends_alice_withfriends";
            const friend1 = "friends_bob";
            const friend2 = "friends_charlie";

            await redisClient.hSet(redisKeys.user(username), {
                password: "hashedPassword",
            });
            await redisClient.sAdd(redisKeys.friends(username), [friend1, friend2]);

            try {
                const friends = await getUserFriends(username);
                expect(friends).toHaveLength(2);
                expect(friends).toContain(friend1);
                expect(friends).toContain(friend2);
            } finally {
                await redisClient.del([redisKeys.user(username), redisKeys.friends(username)]);
            }
        });
    });
});
