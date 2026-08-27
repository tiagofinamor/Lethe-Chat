import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    sendRequest,
    acceptRequest,
    rejectRequest,
    getRequests,
} from "../../services/request.service.js";
import { redisClient } from "../../config/redis.js";
import {
    RequestNotFoundError,
    SelfRequestError,
    UserDoesNotExistError,
} from "../../errors/AppError.js";
import { InvariantError } from "../../errors/InvariantError.js";
import type { AppServer } from "../../sockets/index.js";

const mockMulti = {
    sAdd: vi.fn().mockReturnThis(),
    sRem: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
};

vi.mock("../../config/redis.js", () => ({
    redisClient: {
        ttl: vi.fn(),
        multi: vi.fn(() => mockMulti),
        sIsMember: vi.fn(),
        sRem: vi.fn(),
        sMembers: vi.fn(),
    },
}));

describe("sendRequest", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createMockIo = () => {
        const emitMock = vi.fn();
        const toMock = vi.fn().mockReturnValue({ emit: emitMock });
        const io = { to: toMock } as unknown as AppServer;
        return { io, toMock, emitMock };
    };

    it("throws SelfRequestError when sending to yourself", async () => {
        const { io } = createMockIo();
        await expect(
            sendRequest({ io, from: "alice", to: "alice" }),
        ).rejects.toThrow(SelfRequestError);
    });

    it("throws UserDoesNotExistError when recipient's key has no TTL (-2)", async () => {
        const { io } = createMockIo();
        vi.mocked(redisClient.ttl).mockResolvedValue(-2);
        await expect(
            sendRequest({ io, from: "alice", to: "bob" }),
        ).rejects.toThrow(UserDoesNotExistError);
    });

    it("throws InvariantError when recipient has TTL of -1", async () => {
        const { io } = createMockIo();
        vi.mocked(redisClient.ttl).mockResolvedValue(-1);
        await expect(
            sendRequest({ io, from: "alice", to: "bob" }),
        ).rejects.toThrow(InvariantError);
    });

    it("saves friend request in Redis and emits friend:incoming (happy path)", async () => {
        const { io, emitMock } = createMockIo();
        vi.mocked(redisClient.ttl).mockResolvedValue(3600);

        await sendRequest({ io, from: "alice", to: "bob" });

        expect(redisClient.multi).toHaveBeenCalled();
        expect(mockMulti.sAdd).toHaveBeenCalledWith(expect.stringContaining("bob"), "alice");
        expect(mockMulti.expire).toHaveBeenCalledWith(expect.stringContaining("bob"), 3600);
        expect(mockMulti.exec).toHaveBeenCalled();
        expect(emitMock).toHaveBeenCalledWith("friend:incoming", { from: "alice" });
    });
});

describe("acceptRequest", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createMockIo = () => {
        const emitMock = vi.fn();
        const toMock = vi.fn().mockReturnValue({ emit: emitMock });
        const io = { to: toMock } as unknown as AppServer;
        return { io, toMock, emitMock };
    };

    it("throws RequestNotFoundError if target request doesn't exist", async () => {
        const { io } = createMockIo();
        vi.mocked(redisClient.sIsMember).mockResolvedValue(0);
        await expect(
            acceptRequest({
                io,
                from: "alice",
                userAccepting: "bob",
            }),
        ).rejects.toThrow(RequestNotFoundError);
    });

    it("accepts request, removes pending request, adds mutual friendship, and emits friend:accepted (happy path)", async () => {
        const { io, emitMock } = createMockIo();
        vi.mocked(redisClient.sIsMember).mockResolvedValue(1);
        vi.mocked(redisClient.ttl).mockResolvedValue(3600);

        await acceptRequest({
            io,
            from: "alice",
            userAccepting: "bob",
        });

        expect(redisClient.multi).toHaveBeenCalled();
        expect(mockMulti.sRem).toHaveBeenCalledWith(expect.stringContaining("bob"), "alice");
        expect(mockMulti.sAdd).toHaveBeenCalledWith(expect.stringContaining("bob"), "alice");
        expect(mockMulti.sAdd).toHaveBeenCalledWith(expect.stringContaining("alice"), "bob");
        expect(mockMulti.exec).toHaveBeenCalled();
        expect(emitMock).toHaveBeenCalledWith("friend:accepted", { by: "bob" });
    });
});

describe("rejectRequest", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createMockIo = () => {
        const emitMock = vi.fn();
        const toMock = vi.fn().mockReturnValue({ emit: emitMock });
        const io = { to: toMock } as unknown as AppServer;
        return { io, toMock, emitMock };
    };

    it("throws RequestNotFoundError if target request doesn't exist", async () => {
        const { io } = createMockIo();
        vi.mocked(redisClient.sIsMember).mockResolvedValue(0);
        await expect(
            rejectRequest({
                io,
                from: "alice",
                userRejecting: "bob",
            }),
        ).rejects.toThrow(RequestNotFoundError);
    });

    it("removes pending request and emits friend:rejected (happy path)", async () => {
        const { io, emitMock } = createMockIo();
        vi.mocked(redisClient.sIsMember).mockResolvedValue(1);

        await rejectRequest({
            io,
            from: "alice",
            userRejecting: "bob",
        });

        expect(redisClient.sRem).toHaveBeenCalledWith(expect.stringContaining("bob"), "alice");
        expect(emitMock).toHaveBeenCalledWith("friend:rejected", { by: "bob" });
    });
});

describe("getRequests", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("retrieves incoming requests for a user (happy path)", async () => {
        const incomingRequests = ["alice", "charlie"];
        vi.mocked(redisClient.sMembers).mockResolvedValue(incomingRequests);

        const result = await getRequests("bob");
        expect(result).toEqual(incomingRequests);
        expect(redisClient.sMembers).toHaveBeenCalledWith(expect.stringContaining("bob"));
    });
});
