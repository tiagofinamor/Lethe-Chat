import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    redisCreateUser,
    userExists,
    redisSetTTL,
    redisDeleteUser,
} from "../../services/user.service.js";
import { UserAlreadyExistsError } from "../../errors/AppError.js";
import { redisClient } from "../../config/redis.js";

const mockMulti = {
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
};

vi.mock("../../config/env.js", () => ({
    env: {
        PORT: 3000,
        NODE_ENV: "test",
        REDIS_URL: "redis://localhost:6379",
        SESSION_SECRET: "x".repeat(32),
        USER_TTL_SECONDS: 3600,
    },
}));

vi.mock("../../config/redis.js", () => ({
    redisClient: {
        EXISTS: vi.fn(),
        exists: vi.fn(),
        hSet: vi.fn(),
        multi: vi.fn(() => mockMulti),
        sMembers: vi.fn(),
        del: vi.fn(),
    },
}));

describe("userExists", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns true when user key exists in Redis (happy path)", async () => {
        vi.mocked(redisClient.EXISTS).mockResolvedValue(1);
        const result = await userExists("alice");
        expect(result).toBe(true);
    });

    it("returns false when user key does not exist in Redis (happy path)", async () => {
        vi.mocked(redisClient.EXISTS).mockResolvedValue(0);
        const result = await userExists("nonexistent");
        expect(result).toBe(false);
    });
});

describe("redisCreateUser", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("throws UserAlreadyExistsError if user tries to create account with a registered username", async () => {
        vi.mocked(redisClient.EXISTS).mockResolvedValue(1);

        await expect(redisCreateUser("alice", "hashed_pass")).rejects.toThrow(
            UserAlreadyExistsError,
        );
    });

    it("creates user in Redis when username is available (happy path)", async () => {
        vi.mocked(redisClient.EXISTS).mockResolvedValue(0);
        vi.mocked(redisClient.hSet).mockResolvedValue(1);

        await expect(redisCreateUser("alice", "hashed_pass")).resolves.not.toThrow();

        expect(redisClient.hSet).toHaveBeenCalledWith(
            expect.stringContaining("alice"),
            { password: "hashed_pass" },
        );
    });
});

describe("redisSetTTL", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("sets TTL on user and sessions keys in Redis (happy path)", async () => {
        await redisSetTTL("alice");

        expect(redisClient.multi).toHaveBeenCalled();
        expect(mockMulti.expire).toHaveBeenCalledTimes(2);
        expect(mockMulti.exec).toHaveBeenCalled();
    });
});

describe("redisDeleteUser", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("deletes user sessions, keys, friend requests, and friends (happy path)", async () => {
        vi.mocked(redisClient.sMembers).mockResolvedValue(["sess_1"]);
        vi.mocked(redisClient.exists).mockResolvedValue(1);

        await redisDeleteUser("alice");

        expect(redisClient.del).toHaveBeenCalledWith(["sess:sess_1"]);
        expect(redisClient.del).toHaveBeenCalledWith(expect.stringContaining("alice"));
    });
});
