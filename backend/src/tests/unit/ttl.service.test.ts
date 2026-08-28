import { beforeEach, describe, expect, it, vi } from "vitest";
import { redisClient } from "../../config/redis.js";
import { getUserTtl } from "../../services/ttl.service.js";
import { InvariantError } from "../../errors/InvariantError.js";
import { UserDoesNotExistError } from "../../errors/AppError.js";

vi.mock("../../config/redis.js", () => ({
    redisClient: {
        ttl: vi.fn(),
    },
}));

describe("getUserTtl", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns the remaining TTL in seconds", async () => {
        vi.mocked(redisClient.ttl).mockResolvedValue(1800);

        await expect(getUserTtl("alice")).resolves.toBe(1800);
    });

    it("throws when the user key does not exist", async () => {
        vi.mocked(redisClient.ttl).mockResolvedValue(-2);

        await expect(getUserTtl("ghost")).rejects.toThrow(UserDoesNotExistError);
    });

    it("throws when the user key has no TTL", async () => {
        vi.mocked(redisClient.ttl).mockResolvedValue(-1);

        await expect(getUserTtl("alice")).rejects.toThrow(InvariantError);
    });
});
