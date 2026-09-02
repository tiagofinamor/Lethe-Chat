import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    getKey,
    getKeyHistory,
    registerKey,
} from "../../services/keys.service.js";
import { redisClient } from "../../config/redis.js";

vi.mock("../../config/redis.js", () => ({
    redisClient: {
        hGet: vi.fn(),
        hSet: vi.fn(),
    },
}));

describe("keys.service", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(redisClient.hSet).mockResolvedValue(1);
    });

    it("creates the canonical key and initializes its history", async () => {
        vi.mocked(redisClient.hGet).mockResolvedValueOnce(null);

        await expect(registerKey("alice", "key-a")).resolves.toBe("created");

        expect(redisClient.hSet).toHaveBeenCalledWith("user:alice", {
            publicKey: "key-a",
            publicKeyHistory: JSON.stringify(["key-a"]),
        });
    });

    it("accepts an idempotent registration of the canonical key", async () => {
        vi.mocked(redisClient.hGet).mockResolvedValueOnce("key-a");

        await expect(registerKey("alice", "key-a")).resolves.toBe("unchanged");

        expect(redisClient.hSet).not.toHaveBeenCalled();
    });

    it("rejects a different key without replacing the canonical key", async () => {
        vi.mocked(redisClient.hGet)
            .mockResolvedValueOnce("key-a")
            .mockResolvedValueOnce(JSON.stringify(["key-a"]));

        await expect(registerKey("alice", "key-b")).resolves.toBe("conflict");

        expect(redisClient.hSet).toHaveBeenCalledWith("user:alice", {
            publicKeyHistory: JSON.stringify(["key-a"]),
        });
    });

    it("rotates explicitly while retaining the previous key in history", async () => {
        vi.mocked(redisClient.hGet)
            .mockResolvedValueOnce("key-a")
            .mockResolvedValueOnce(JSON.stringify(["key-a"]));

        await expect(registerKey("alice", "key-b", true)).resolves.toBe("rotated");

        expect(redisClient.hSet).toHaveBeenCalledWith("user:alice", {
            publicKey: "key-b",
            publicKeyHistory: JSON.stringify(["key-a"]),
        });
    });

    it("returns an empty history for missing or malformed Redis data", async () => {
        vi.mocked(redisClient.hGet).mockResolvedValueOnce(null);
        await expect(getKeyHistory("alice")).resolves.toEqual([]);

        vi.mocked(redisClient.hGet).mockResolvedValueOnce("{not-json");
        await expect(getKeyHistory("alice")).resolves.toEqual([]);
    });

    it("returns the canonical public key", async () => {
        vi.mocked(redisClient.hGet).mockResolvedValueOnce("key-a");

        await expect(getKey("alice")).resolves.toBe("key-a");
        expect(redisClient.hGet).toHaveBeenCalledWith("user:alice", "publicKey");
    });
});
