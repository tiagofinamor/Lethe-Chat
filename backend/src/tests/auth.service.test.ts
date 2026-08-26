import { describe, expect, it, vi } from "vitest";
import { redisClient } from "../config/redis.js";
import { beforeEach } from "node:test";
import { authenticate, clearOldConnections } from "../services/auth.service.js";
import { AuthError } from "../errors/AppError.js";
import bcrypt from "bcrypt";

vi.mock("../config/env.js", () => ({
    env: {
        PORT: 3000,
        NODE_ENV: "test",
        REDIS_URL: "redis://localhost:6379",
        SESSION_SECRET: "x".repeat(32),
        USER_TTL_SECONDS: 3600,
    },
}));

vi.mock("../config/redis.js", async () => ({
    redisClient: {
        hGet: vi.fn(),
        exists: vi.fn(),
        sPop: vi.fn(),
        del: vi.fn(),
        sAdd: vi.fn(),
    },
}));

vi.mock("bcrypt", async () => ({
    default: {
        compare: vi.fn(),
    },
}));

describe("authenticate", () => {
    beforeEach(vi.clearAllMocks);

    it("throws AuthError if user doenst exist", async () => {
        vi.mocked(redisClient.hGet).mockReturnValue(Promise.resolve(null));
        await expect(authenticate("", "")).rejects.toThrow(AuthError);
    });

    it("does not throw an error if the user exists and password is right", async () => {
        const mockReturnedPassword = "non null value";
        vi.mocked(redisClient.hGet).mockReturnValue(
            Promise.resolve(mockReturnedPassword),
        );
        vi.mocked(bcrypt.compare as () => Promise<boolean>).mockReturnValue(
            Promise.resolve(true),
        );
        await expect(
            authenticate("", mockReturnedPassword),
        ).resolves.not.toThrow();
    });

    it("throws AuthError if entered password is wrong", async () => {
        vi.mocked(redisClient.hGet).mockReturnValue(Promise.resolve(""));
        vi.mocked(bcrypt.compare as () => Promise<boolean>).mockReturnValue(
            Promise.resolve(false),
        );

        await expect(authenticate("", "")).rejects.toThrow(AuthError);
    });
});

describe("clearOldConnections", () => {
    beforeEach(vi.clearAllMocks);

    it("returns early if there's no old session", async () => {
        vi.mocked(redisClient.exists).mockReturnValue(Promise.resolve(0));
        await expect(clearOldConnections("", "")).resolves.not.toBeDefined();
        await expect(redisClient.sPop).not.toHaveBeenCalled();
    });

    it("stops execution and returns the session to redis if same device requests another session", async () => {
        const sameSessionId = "someId";
        vi.mocked(redisClient.exists).mockReturnValue(Promise.resolve(1));
        vi.mocked(redisClient.sPop).mockReturnValue(
            Promise.resolve(sameSessionId),
        );
        await expect(
            clearOldConnections("", sameSessionId),
        ).resolves.not.toBeDefined();
        await expect(redisClient.sAdd).toHaveBeenCalled();
    });
});
