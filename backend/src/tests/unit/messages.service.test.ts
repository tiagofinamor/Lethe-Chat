import { describe, expect, it, vi, beforeEach } from "vitest";
import {
    sendMessage,
    sendMsgToInbox,
    type SendMessagePayload,
} from "../../services/messages.service.js";
import { redisClient } from "../../config/redis.js";
import { UserDoesNotExistError } from "../../errors/AppError.js";
import type { AppServer, EncryptedPayload } from "../../sockets/index.js";

const mockMulti = {
    rPush: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
};

vi.mock("../../config/redis.js", () => ({
    redisClient: {
        ttl: vi.fn(),
        multi: vi.fn(() => mockMulti),
    },
}));

vi.mock("../../config/metrics.js", () => ({
    messageDeliveryDuration: {
        startTimer: vi.fn(() => vi.fn()),
    },
}));

describe("sendMsgToInbox", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const samplePayload: SendMessagePayload = {
        from: "alice",
        encryptedPayload: {
            cipherText: "secret",
            nonce: "12345678901234567890123456789012",
        },
        sentAt: new Date(),
    };

    it("throws UserDoesNotExistError if retrieved receiver ttl is negative or zero", async () => {
        vi.mocked(redisClient.ttl).mockResolvedValueOnce(-2);
        await expect(sendMsgToInbox("bob", samplePayload)).rejects.toThrow(UserDoesNotExistError);

        vi.mocked(redisClient.ttl).mockResolvedValueOnce(0);
        await expect(sendMsgToInbox("bob", samplePayload)).rejects.toThrow(UserDoesNotExistError);
    });

    it("queues message payload into inbox list with TTL (happy path)", async () => {
        vi.mocked(redisClient.ttl).mockResolvedValue(1800);

        await expect(sendMsgToInbox("bob", samplePayload)).resolves.not.toThrow();

        expect(redisClient.multi).toHaveBeenCalled();
        expect(mockMulti.rPush).toHaveBeenCalledWith(expect.stringContaining("bob"), JSON.stringify(samplePayload));
        expect(mockMulti.expire).toHaveBeenCalledWith(expect.stringContaining("bob"), 1800);
        expect(mockMulti.exec).toHaveBeenCalled();
    });
});

describe("sendMessage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const sampleEncryptedPayload: EncryptedPayload = {
        cipherText: "secret",
        nonce: "12345678901234567890123456789012",
    };

    it("delivers message directly when recipient acknowledges with ok status (happy path)", async () => {
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
            to: "bob",
            from: "alice",
            encryptedPayload: sampleEncryptedPayload,
        });

        expect(emitWithAckMock).toHaveBeenCalledWith("message:incoming", expect.objectContaining({
            from: "alice",
            encryptedPayload: sampleEncryptedPayload,
        }));
        expect(redisClient.multi).not.toHaveBeenCalled();
    });

    it("falls back to inbox when recipient ack status is not ok (happy path)", async () => {
        vi.mocked(redisClient.ttl).mockResolvedValue(3600);
        const emitWithAckMock = vi.fn().mockResolvedValue([{ status: "error" }]);
        const mockIo = {
            timeout: vi.fn().mockReturnValue({
                to: vi.fn().mockReturnValue({
                    emitWithAck: emitWithAckMock,
                }),
            }),
        } as unknown as AppServer;

        await sendMessage({
            io: mockIo,
            to: "bob",
            from: "alice",
            encryptedPayload: sampleEncryptedPayload,
        });

        expect(redisClient.multi).toHaveBeenCalled();
        expect(mockMulti.rPush).toHaveBeenCalled();
    });
});
