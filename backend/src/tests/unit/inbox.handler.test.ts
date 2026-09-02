import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleInbox } from "../../sockets/handlers/inbox.handler.js";
import { redisClient } from "../../config/redis.js";
import { InboxDrainError, MalformedMsgInboxError } from "../../errors/AppError.js";
import type { AppSocket } from "../../sockets/index.js";

vi.mock("../../config/redis.js", () => ({
    redisClient: {
        lRange: vi.fn(),
        del: vi.fn(),
    },
}));

describe("handleInbox", () => {
    const emitWithAck = vi.fn();
    const socket = {
        data: { username: "bob" },
        timeout: vi.fn(() => ({ emitWithAck })),
    } as unknown as AppSocket;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(redisClient.lRange).mockResolvedValue([]);
        vi.mocked(redisClient.del).mockResolvedValue(1);
    });

    it("does nothing when the inbox is empty", async () => {
        await handleInbox(socket);

        expect(emitWithAck).not.toHaveBeenCalled();
        expect(redisClient.del).not.toHaveBeenCalled();
    });

    it("emits queued messages and deletes the inbox after an ok acknowledgement", async () => {
        const queuedMessage = {
            from: "alice",
            encryptedPayload: {
                cipherText: "ciphertext",
                nonce: "nonce",
            },
        };
        vi.mocked(redisClient.lRange).mockResolvedValue([
            JSON.stringify(queuedMessage),
        ]);
        emitWithAck.mockResolvedValue({ status: "ok" });

        await handleInbox(socket);

        expect(emitWithAck).toHaveBeenCalledWith("inbox:incoming", [
            queuedMessage,
        ]);
        expect(redisClient.del).toHaveBeenCalledWith("inbox:bob");
    });

    it("keeps the inbox when the client acknowledges with an error", async () => {
        vi.mocked(redisClient.lRange).mockResolvedValue([
            JSON.stringify({ from: "alice" }),
        ]);
        emitWithAck.mockResolvedValue({ status: "error" });

        await expect(handleInbox(socket)).resolves.toBeUndefined();
        expect(redisClient.del).not.toHaveBeenCalled();
    });

    it("keeps the inbox and throws when the acknowledgement times out", async () => {
        vi.mocked(redisClient.lRange).mockResolvedValue([
            JSON.stringify({ from: "alice" }),
        ]);
        emitWithAck.mockRejectedValue(new Error("operation timed out"));

        await expect(handleInbox(socket)).rejects.toBeInstanceOf(InboxDrainError);
        expect(redisClient.del).not.toHaveBeenCalled();
    });

    it("rejects malformed queued messages without attempting delivery", async () => {
        vi.mocked(redisClient.lRange).mockResolvedValue(["not-json"]);

        await expect(handleInbox(socket)).rejects.toBeInstanceOf(
            MalformedMsgInboxError,
        );
        expect(emitWithAck).not.toHaveBeenCalled();
        expect(redisClient.del).not.toHaveBeenCalled();
    });
});
