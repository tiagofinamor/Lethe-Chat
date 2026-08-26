import { describe, expect, it, vi } from "vitest";
import {
    sendMsgToInbox,
    type SendMessagePayload,
} from "../services/messages.service.js";
import { beforeEach } from "node:test";
import { redisClient } from "../config/redis.js";
import { UserDoesNotExistError } from "../errors/AppError.js";

vi.mock("../config/redis.js", () => ({
    redisClient: {
        ttl: vi.fn(),
    },
}));

describe("sendMsgToInbox", () => {
    beforeEach(() => vi.resetAllMocks);

    it("throws UserDoesNotExistError if retrieved receiver ttl is negative or zero", async () => {
        vi.mocked(redisClient.ttl).mockImplementation(() => Promise.resolve(0));
        vi.mocked(redisClient.ttl).mockReturnValueOnce(Promise.resolve(-2));

        //runs once with a mock ttl of -2, then with a ttl of 0
        await expect(
            sendMsgToInbox("", {} as SendMessagePayload),
        ).rejects.toThrow(UserDoesNotExistError);
        await expect(
            sendMsgToInbox("", {} as SendMessagePayload),
        ).rejects.toThrow(UserDoesNotExistError);
    });
});
