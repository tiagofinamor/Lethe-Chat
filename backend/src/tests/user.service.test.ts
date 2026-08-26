import { beforeEach, describe, expect, it, vi } from "vitest";
import { redisCreateUser } from "../services/user.service.js";
import { UserAlreadyExistsError } from "../errors/AppError.js";
import { redisClient } from "../config/redis.js";

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
        EXISTS: vi.fn(),
    }
}))

describe("redisCreateUser", () => {
    beforeEach(vi.clearAllMocks);

    it("throws UserAlreadyExistsError if user tries to create account with a registered username", async () => {
        vi.mocked(redisClient.EXISTS).mockReturnValue(Promise.resolve(1));

        await expect(redisCreateUser("", "")).rejects.toThrow(
            UserAlreadyExistsError,
        );
    });
});
