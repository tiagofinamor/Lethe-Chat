import { beforeEach, describe, expect, it, vi } from "vitest";
import { redisClient } from "../config/redis.js";
import { getUserFriends } from "../services/friends.service.js";
import { UserDoesNotExistError } from "../errors/AppError.js";

vi.mock("../config/redis.js", async () => ({
    redisClient: {
        exists: vi.fn(),
    },
}));

describe("getUserFriends", () => {
    beforeEach(() => vi.clearAllMocks);
    it("throws UserDoesNotExistError if searched friend does not exist", async () => {
        vi.mocked(redisClient.exists).mockReturnValue(Promise.resolve(0));
        await expect(getUserFriends("")).rejects.toThrow(UserDoesNotExistError);
    });
});
