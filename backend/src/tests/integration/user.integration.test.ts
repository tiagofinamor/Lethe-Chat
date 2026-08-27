import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { redisClient } from "../../config/redis.js";
import {
    redisCreateUser,
    redisSetTTL,
    redisDeleteUser,
    userExists,
} from "../../services/user.service.js";
import { UserAlreadyExistsError } from "../../errors/AppError.js";
import { redisKeys } from "../../config/redis-keys.js";

const TEST_USER_TTL_SECONDS = 3600;

vi.mock("../../config/env.js", () => ({
    env: {
        PORT: 3000,
        NODE_ENV: "test",
        REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
        SESSION_SECRET: "x".repeat(32),
        USER_TTL_SECONDS: 3600,
    },
}));

describe("user.service integration tests", () => {
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

    describe("userExists", () => {
        it("returns false when user does not exist in Redis", async () => {
            const exists = await userExists("usr_ghost_user");
            expect(exists).toBe(false);
        });

        it("returns true when user exists in Redis", async () => {
            const username = "usr_alice_exists";
            await redisClient.hSet(redisKeys.user(username), {
                password: "hashedPassword123",
            });

            try {
                const exists = await userExists(username);
                expect(exists).toBe(true);
            } finally {
                await redisClient.del(redisKeys.user(username));
            }
        });
    });

    describe("redisCreateUser", () => {
        it("creates user in Redis with hashed password", async () => {
            const username = "usr_alice_create";
            const hashedPassword = "hashedPassword123";

            try {
                await redisCreateUser(username, hashedPassword);

                const exists = await userExists(username);
                expect(exists).toBe(true);

                const savedPassword = await redisClient.hGet(
                    redisKeys.user(username),
                    "password",
                );
                expect(savedPassword).toBe(hashedPassword);
            } finally {
                await redisClient.del(redisKeys.user(username));
            }
        });

        it("throws UserAlreadyExistsError when creating a user that already exists in Redis", async () => {
            const username = "usr_duplicate_user";
            await redisClient.hSet(redisKeys.user(username), {
                password: "existingPassword",
            });

            try {
                await expect(
                    redisCreateUser(username, "newPassword"),
                ).rejects.toThrow(UserAlreadyExistsError);
            } finally {
                await redisClient.del(redisKeys.user(username));
            }
        });
    });

    describe("redisSetTTL", () => {
        it("sets TTL on user hash and user sessions in Redis", async () => {
            const username = "usr_alice_setttl";
            await redisClient.hSet(redisKeys.user(username), {
                password: "password123",
            });
            await redisClient.sAdd(
                redisKeys.sessions(username),
                "session_id_123",
            );

            try {
                await redisSetTTL(username);

                const userTtl = await redisClient.ttl(redisKeys.user(username));
                const sessionsTtl = await redisClient.ttl(
                    redisKeys.sessions(username),
                );

                expect(userTtl).toBeGreaterThan(0);
                expect(userTtl).toBeLessThanOrEqual(TEST_USER_TTL_SECONDS);

                expect(sessionsTtl).toBeGreaterThan(0);
                expect(sessionsTtl).toBeLessThanOrEqual(TEST_USER_TTL_SECONDS);
            } finally {
                await redisClient.del([redisKeys.user(username), redisKeys.sessions(username)]);
            }
        });
    });

    describe("redisDeleteUser", () => {
        it("deletes user hash, sessions, session keys, friend requests, and friends from Redis", async () => {
            const username = "usr_alice_delete";
            const sessionId1 = "usr_sess_1";
            const sessionId2 = "usr_sess_2";

            await redisClient.hSet(redisKeys.user(username), { password: "password" });
            await redisClient.sAdd(redisKeys.sessions(username), [sessionId1, sessionId2]);
            await redisClient.set(`sess:${sessionId1}`, "sessionData1");
            await redisClient.set(`sess:${sessionId2}`, "sessionData2");
            await redisClient.sAdd(redisKeys.requests(username), ["usr_bob"]);
            await redisClient.sAdd(redisKeys.friends(username), ["usr_charlie"]);

            await redisDeleteUser(username);

            expect(await redisClient.exists(redisKeys.user(username))).toBe(0);
            expect(await redisClient.exists(redisKeys.sessions(username))).toBe(0);
            expect(await redisClient.exists(`sess:${sessionId1}`)).toBe(0);
            expect(await redisClient.exists(`sess:${sessionId2}`)).toBe(0);
            expect(await redisClient.exists(redisKeys.requests(username))).toBe(0);
            expect(await redisClient.exists(redisKeys.friends(username))).toBe(0);
        });

        it("deletes user with session when user has no requests or friends", async () => {
            const username = "usr_single_session_user";
            const sessionId = "sess_single";
            await redisClient.hSet(redisKeys.user(username), { password: "password" });
            await redisClient.sAdd(redisKeys.sessions(username), sessionId);
            await redisClient.set(`sess:${sessionId}`, "data");

            await expect(redisDeleteUser(username)).resolves.not.toThrow();

            expect(await redisClient.exists(redisKeys.user(username))).toBe(0);
            expect(await redisClient.exists(redisKeys.sessions(username))).toBe(0);
            expect(await redisClient.exists(`sess:${sessionId}`)).toBe(0);
        });
    });
});
