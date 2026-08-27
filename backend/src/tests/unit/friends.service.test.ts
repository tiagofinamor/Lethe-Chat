import { beforeEach, describe, expect, it, vi } from "vitest";
import { redisClient } from "../../config/redis.js";
import { getUserFriends } from "../../services/friends.service.js";
import { UserDoesNotExistError } from "../../errors/AppError.js";

vi.mock("../../config/redis.js", () => ({
    redisClient: {
        exists: vi.fn(),
        sMembers: vi.fn(),
    },
}));

describe("getUserFriends", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("throws UserDoesNotExistError if searched friend does not exist", async () => {
        vi.mocked(redisClient.exists).mockResolvedValue(0);
        await expect(getUserFriends("nonexistent_user")).rejects.toThrow(UserDoesNotExistError);
    });

    it("returns friends list when user exists (happy path)", async () => {
        const expectedFriends = ["bob", "charlie"];
        vi.mocked(redisClient.exists).mockResolvedValue(1);
        vi.mocked(redisClient.sMembers).mockResolvedValue(expectedFriends);

        const friends = await getUserFriends("alice");
        expect(friends).toEqual(expectedFriends);
        expect(redisClient.sMembers).toHaveBeenCalled();
    });

    it("returns empty array when user exists but has no friends (happy path)", async () => {
        vi.mocked(redisClient.exists).mockResolvedValue(1);
        vi.mocked(redisClient.sMembers).mockResolvedValue([]);

        const friends = await getUserFriends("alice");
        expect(friends).toEqual([]);
    });
});
