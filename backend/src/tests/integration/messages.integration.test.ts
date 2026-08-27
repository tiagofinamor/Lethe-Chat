import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { redisClient } from "../../config/redis.js";
import {
    sendMessage,
    sendMsgToInbox,
    ACK_TIMEOUT_MILLISECONDS,
    type SendMessagePayload,
} from "../../services/messages.service.js";
import { UserDoesNotExistError } from "../../errors/AppError.js";
import { redisKeys } from "../../config/redis-keys.js";
import type { AppServer, EncryptedPayload } from "../../sockets/index.js";

vi.mock("../../config/env.js", () => ({
    env: {
        PORT: 3000,
        NODE_ENV: "test",
        REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
        SESSION_SECRET: "x".repeat(32),
        USER_TTL_SECONDS: 3600,
    },
}));

describe("messages.service integration tests", () => {
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

    const sampleEncryptedPayload: EncryptedPayload = {
        cipherText: "encrypted_hello_world",
        nonce: "12345678901234567890123456789012",
    };

    describe("sendMsgToInbox", () => {
        it("throws UserDoesNotExistError when receiver has no TTL or does not exist in Redis", async () => {
            const payload: SendMessagePayload = {
                from: "msg_alice_1",
                encryptedPayload: sampleEncryptedPayload,
                sentAt: new Date(),
            };

            await expect(sendMsgToInbox("msg_ghost_receiver", payload)).rejects.toThrow(
                UserDoesNotExistError,
            );
        });

        it("queues message into Redis inbox list and sets TTL to match receiver remaining TTL", async () => {
            const receiver = "msg_bob_inbox1";
            const ttlSeconds = 1800;

            await redisClient.hSet(redisKeys.user(receiver), { password: "hashedPassword" });
            await redisClient.expire(redisKeys.user(receiver), ttlSeconds);

            const payload: SendMessagePayload = {
                from: "msg_alice_1",
                encryptedPayload: sampleEncryptedPayload,
                sentAt: new Date(),
            };

            try {
                await sendMsgToInbox(receiver, payload);

                const inboxItems = await redisClient.lRange(redisKeys.inbox(receiver), 0, -1);
                expect(inboxItems).toHaveLength(1);

                const parsedPayload = JSON.parse(inboxItems[0]!);
                expect(parsedPayload.from).toBe("msg_alice_1");
                expect(parsedPayload.encryptedPayload).toEqual(sampleEncryptedPayload);

                const inboxTtl = await redisClient.ttl(redisKeys.inbox(receiver));
                expect(inboxTtl).toBeGreaterThan(0);
                expect(inboxTtl).toBeLessThanOrEqual(ttlSeconds);
            } finally {
                await redisClient.del([redisKeys.user(receiver), redisKeys.inbox(receiver)]);
            }
        });

        it("queues multiple messages in FIFO order in Redis list", async () => {
            const receiver = "msg_bob_inbox2";
            await redisClient.hSet(redisKeys.user(receiver), { password: "hashedPassword" });
            await redisClient.expire(redisKeys.user(receiver), 3600);

            const payload1: SendMessagePayload = {
                from: "msg_alice_1",
                encryptedPayload: { cipherText: "msg1", nonce: sampleEncryptedPayload.nonce },
                sentAt: new Date(),
            };
            const payload2: SendMessagePayload = {
                from: "msg_charlie_1",
                encryptedPayload: { cipherText: "msg2", nonce: sampleEncryptedPayload.nonce },
                sentAt: new Date(),
            };

            try {
                await sendMsgToInbox(receiver, payload1);
                await sendMsgToInbox(receiver, payload2);

                const inboxItems = await redisClient.lRange(redisKeys.inbox(receiver), 0, -1);
                expect(inboxItems).toHaveLength(2);
                expect(JSON.parse(inboxItems[0]!).encryptedPayload.cipherText).toBe("msg1");
                expect(JSON.parse(inboxItems[1]!).encryptedPayload.cipherText).toBe("msg2");
            } finally {
                await redisClient.del([redisKeys.user(receiver), redisKeys.inbox(receiver)]);
            }
        });
    });

    describe("sendMessage", () => {
        it("delivers directly over websocket when recipient acknowledges with ok status", async () => {
            const receiver = "msg_bob_online";
            const emitWithAckMock = vi.fn().mockResolvedValue([{ status: "ok" }]);
            const mockIo = {
                timeout: vi.fn().mockReturnValue({
                    to: vi.fn().mockReturnValue({
                        emitWithAck: emitWithAckMock,
                    }),
                }),
            } as unknown as AppServer;

            await sendMessage({
                io: mockIo,
                to: receiver,
                from: "msg_alice_1",
                encryptedPayload: sampleEncryptedPayload,
            });

            expect(mockIo.timeout).toHaveBeenCalledWith(ACK_TIMEOUT_MILLISECONDS);
            expect(emitWithAckMock).toHaveBeenCalledWith(
                "message:incoming",
                expect.objectContaining({
                    from: "msg_alice_1",
                    encryptedPayload: sampleEncryptedPayload,
                }),
            );

            const inboxLength = await redisClient.lLen(redisKeys.inbox(receiver));
            expect(inboxLength).toBe(0);
        });

        it("falls back to queuing message into Redis inbox when recipient acknowledges with error status", async () => {
            const receiver = "msg_bob_errorack";
            await redisClient.hSet(redisKeys.user(receiver), { password: "hashedPassword" });
            await redisClient.expire(redisKeys.user(receiver), 3600);

            const emitWithAckMock = vi.fn().mockResolvedValue([{ status: "error" }]);
            const mockIo = {
                timeout: vi.fn().mockReturnValue({
                    to: vi.fn().mockReturnValue({
                        emitWithAck: emitWithAckMock,
                    }),
                }),
            } as unknown as AppServer;

            try {
                await sendMessage({
                    io: mockIo,
                    to: receiver,
                    from: "msg_alice_1",
                    encryptedPayload: sampleEncryptedPayload,
                });

                const inboxItems = await redisClient.lRange(redisKeys.inbox(receiver), 0, -1);
                expect(inboxItems).toHaveLength(1);
                const queued = JSON.parse(inboxItems[0]!);
                expect(queued.from).toBe("msg_alice_1");
            } finally {
                await redisClient.del([redisKeys.user(receiver), redisKeys.inbox(receiver)]);
            }
        });

        it("falls back to queuing message into Redis inbox when recipient is offline (no connections in room)", async () => {
            const receiver = "msg_bob_offline";
            await redisClient.hSet(redisKeys.user(receiver), { password: "hashedPassword" });
            await redisClient.expire(redisKeys.user(receiver), 3600);

            const emitWithAckMock = vi.fn().mockResolvedValue([]);
            const mockIo = {
                timeout: vi.fn().mockReturnValue({
                    to: vi.fn().mockReturnValue({
                        emitWithAck: emitWithAckMock,
                    }),
                }),
            } as unknown as AppServer;

            try {
                await sendMessage({
                    io: mockIo,
                    to: receiver,
                    from: "msg_alice_1",
                    encryptedPayload: sampleEncryptedPayload,
                });

                const inboxItems = await redisClient.lRange(redisKeys.inbox(receiver), 0, -1);
                expect(inboxItems).toHaveLength(1);
            } finally {
                await redisClient.del([redisKeys.user(receiver), redisKeys.inbox(receiver)]);
            }
        });

        it("rethrows error when socket emit fails unexpectedly", async () => {
            const mockIo = {
                timeout: vi.fn().mockReturnValue({
                    to: vi.fn().mockReturnValue({
                        emitWithAck: vi.fn().mockRejectedValue(new Error("Socket connection closed")),
                    }),
                }),
            } as unknown as AppServer;

            await expect(
                sendMessage({
                    io: mockIo,
                    to: "msg_bob_socketerr",
                    from: "msg_alice_1",
                    encryptedPayload: sampleEncryptedPayload,
                }),
            ).rejects.toThrow("Socket connection closed");
        });
    });
});
