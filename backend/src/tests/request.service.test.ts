import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendRequest, acceptRequest, rejectRequest } from "../services/request.service.js";
import { redisClient } from "../config/redis.js";
import { RequestNotFoundError, SelfRequestError, UserDoesNotExistError } from "../errors/AppError.js";
import type { AppServer } from "../sockets/index.js";

vi.mock("../config/redis.js", () => ({
    redisClient: {
        ttl: vi.fn(),
        multi: vi.fn(),
        sIsMember: vi.fn(),
    },
}));

describe("sendRequest", () => {
    beforeEach(() => vi.clearAllMocks());

    it("throws SelfRequestError when sending to yourself", async () => {
        await expect(
            sendRequest({ io: {} as any, from: "alice", to: "alice" }),
        ).rejects.toThrow(SelfRequestError);
    });

    it("throws UserDoesNotExistError when recipient's key has no TTL (-2)", async () => {
        vi.mocked(redisClient.ttl).mockResolvedValue(-2);
        await expect(
            sendRequest({ io: {} as any, from: "alice", to: "bob" }),
        ).rejects.toThrow(UserDoesNotExistError);
    });
});

describe("acceptRequest and rejectRequest", async () => {
    beforeEach(() => vi.clearAllMocks());

    it("throws RequestNotFoundError if target request doens't exist", async () => {
        vi.mocked(redisClient.sIsMember).mockResolvedValue(0);
        await expect(
            acceptRequest({
                io: {} as AppServer,
                from: "",
                userAccepting: "",
            }),
        ).rejects.toThrow(RequestNotFoundError);
        await expect(
            rejectRequest({
                io: {} as AppServer,
                from: "",
                userRejecting: "",
            }),
        ).rejects.toThrow(RequestNotFoundError);
    });

});

