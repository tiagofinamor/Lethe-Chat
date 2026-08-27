import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { redisClient } from "../../config/redis.js";
import {
    sendRequest,
    acceptRequest,
    rejectRequest,
    getRequests,
} from "../../services/request.service.js";
import {
    RequestNotFoundError,
    SelfRequestError,
    UserDoesNotExistError,
} from "../../errors/AppError.js";
import { InvariantError } from "../../errors/InvariantError.js";
import { redisKeys } from "../../config/redis-keys.js";
import { userRoom } from "../../sockets/rooms.js";
import type { AppServer } from "../../sockets/index.js";

vi.mock("../../config/env.js", () => ({
    env: {
        PORT: 3000,
        NODE_ENV: "test",
        REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
        SESSION_SECRET: "x".repeat(32),
        USER_TTL_SECONDS: 3600,
    },
}));

describe("request.service integration tests", () => {
    beforeAll(async () => {
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }
    });

    afterAll(async () => {
        if (redisClient.isOpen) {
            await redisClient.quit();
        }
    });

    const createMockIo = () => {
        const emitMock = vi.fn();
        const toMock = vi.fn().mockReturnValue({ emit: emitMock });
        const io = { to: toMock } as unknown as AppServer;
        return { io, toMock, emitMock };
    };

    describe("sendRequest", () => {
        it("throws SelfRequestError when sender and recipient are the same", async () => {
            const { io } = createMockIo();
            await expect(
                sendRequest({ io, from: "req_alice_self", to: "req_alice_self" }),
            ).rejects.toThrow(SelfRequestError);
        });

        it("throws UserDoesNotExistError when recipient does not exist in Redis", async () => {
            const { io } = createMockIo();
            await expect(
                sendRequest({ io, from: "req_alice_1", to: "req_ghost_recipient" }),
            ).rejects.toThrow(UserDoesNotExistError);
        });

        it("throws InvariantError when recipient exists but has no TTL set (-1)", async () => {
            const { io } = createMockIo();
            const recipient = "req_bob_nottl";
            await redisClient.hSet(redisKeys.user(recipient), { password: "hashedPassword" });

            try {
                await expect(
                    sendRequest({ io, from: "req_alice_1", to: recipient }),
                ).rejects.toThrow(InvariantError);
            } finally {
                await redisClient.del(redisKeys.user(recipient));
            }
        });

        it("successfully adds request to Redis and emits friend:incoming event", async () => {
            const { io, toMock, emitMock } = createMockIo();
            const recipient = "req_bob_validreq";
            const sender = "req_alice_validreq";
            const ttlSeconds = 1800;

            await redisClient.hSet(redisKeys.user(recipient), { password: "hashedPassword" });
            await redisClient.expire(redisKeys.user(recipient), ttlSeconds);

            try {
                await sendRequest({ io, from: sender, to: recipient });

                const requests = await redisClient.sMembers(redisKeys.requests(recipient));
                expect(requests).toContain(sender);

                const requestsTtl = await redisClient.ttl(redisKeys.requests(recipient));
                expect(requestsTtl).toBeGreaterThan(0);
                expect(requestsTtl).toBeLessThanOrEqual(ttlSeconds);

                expect(toMock).toHaveBeenCalledWith(userRoom(recipient));
                expect(emitMock).toHaveBeenCalledWith("friend:incoming", { from: sender });
            } finally {
                await redisClient.del([redisKeys.user(recipient), redisKeys.requests(recipient)]);
            }
        });
    });

    describe("acceptRequest", () => {
        it("throws RequestNotFoundError if target request is not pending in Redis", async () => {
            const { io } = createMockIo();
            await expect(
                acceptRequest({
                    io,
                    from: "req_alice_noreq",
                    userAccepting: "req_bob_noreq",
                }),
            ).rejects.toThrow(RequestNotFoundError);
        });

        it("removes request, adds mutual friendship in Redis, sets TTLs, and emits friend:accepted", async () => {
            const { io, toMock, emitMock } = createMockIo();
            const sender = "req_alice_accept";
            const accepter = "req_bob_accept";

            await redisClient.hSet(redisKeys.user(sender), { password: "pass" });
            await redisClient.expire(redisKeys.user(sender), 3600);

            await redisClient.hSet(redisKeys.user(accepter), { password: "pass" });
            await redisClient.expire(redisKeys.user(accepter), 3600);

            await redisClient.sAdd(redisKeys.requests(accepter), sender);

            try {
                await acceptRequest({
                    io,
                    from: sender,
                    userAccepting: accepter,
                });

                const remainingRequests = await redisClient.sMembers(redisKeys.requests(accepter));
                expect(remainingRequests).not.toContain(sender);

                const accepterFriends = await redisClient.sMembers(redisKeys.friends(accepter));
                expect(accepterFriends).toContain(sender);

                const senderFriends = await redisClient.sMembers(redisKeys.friends(sender));
                expect(senderFriends).toContain(accepter);

                const accepterFriendsTtl = await redisClient.ttl(redisKeys.friends(accepter));
                const senderFriendsTtl = await redisClient.ttl(redisKeys.friends(sender));
                expect(accepterFriendsTtl).toBeGreaterThan(0);
                expect(senderFriendsTtl).toBeGreaterThan(0);

                expect(toMock).toHaveBeenCalledWith(userRoom(sender));
                expect(emitMock).toHaveBeenCalledWith("friend:accepted", { by: accepter });
            } finally {
                await redisClient.del([
                    redisKeys.user(sender),
                    redisKeys.user(accepter),
                    redisKeys.requests(accepter),
                    redisKeys.friends(accepter),
                    redisKeys.friends(sender),
                ]);
            }
        });
    });

    describe("rejectRequest", () => {
        it("throws RequestNotFoundError if target request is not in Redis", async () => {
            const { io } = createMockIo();
            await expect(
                rejectRequest({
                    io,
                    from: "req_alice_noreject",
                    userRejecting: "req_bob_noreject",
                }),
            ).rejects.toThrow(RequestNotFoundError);
        });

        it("removes request from Redis and emits friend:rejected without creating friends", async () => {
            const { io, toMock, emitMock } = createMockIo();
            const sender = "req_alice_reject";
            const rejecter = "req_bob_reject";

            await redisClient.sAdd(redisKeys.requests(rejecter), sender);

            try {
                await rejectRequest({
                    io,
                    from: sender,
                    userRejecting: rejecter,
                });

                const remainingRequests = await redisClient.sMembers(redisKeys.requests(rejecter));
                expect(remainingRequests).not.toContain(sender);

                const rejecterFriends = await redisClient.exists(redisKeys.friends(rejecter));
                expect(rejecterFriends).toBe(0);

                expect(toMock).toHaveBeenCalledWith(userRoom(sender));
                expect(emitMock).toHaveBeenCalledWith("friend:rejected", { by: rejecter });
            } finally {
                await redisClient.del([redisKeys.requests(rejecter), redisKeys.friends(rejecter)]);
            }
        });
    });

    describe("getRequests", () => {
        it("returns an empty array when there are no requests", async () => {
            const requests = await getRequests("req_alice_norequests");
            expect(requests).toEqual([]);
        });

        it("returns all incoming request usernames for the user", async () => {
            const username = "req_bob_getrequests";
            const req1 = "req_alice_sender1";
            const req2 = "req_charlie_sender2";

            await redisClient.sAdd(redisKeys.requests(username), [req1, req2]);

            try {
                const requests = await getRequests(username);
                expect(requests).toHaveLength(2);
                expect(requests).toContain(req1);
                expect(requests).toContain(req2);
            } finally {
                await redisClient.del(redisKeys.requests(username));
            }
        });
    });
});
