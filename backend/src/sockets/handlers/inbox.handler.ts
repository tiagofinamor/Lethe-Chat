import { redisKeys } from "../../config/redis-keys.js";
import { redisClient } from "../../config/redis.js";
import { ACK_TIMEOUT_MILLISECONDS } from "../../services/messages.service.js";
import type { AppSocket } from "../index.js";

export async function inboxHandler(socket: AppSocket) {
    const messages = await redisClient.lRange(
        redisKeys.inbox(socket.data.username),
        0,
        -1,
    );
    if (messages.length > 0) {
        const messagesParsed = messages.map((message) => JSON.parse(message));
        const result = await socket
            .timeout(ACK_TIMEOUT_MILLISECONDS)
            .emitWithAck("inbox:incoming", messagesParsed);
        if (result.status === "ok") {
            await redisClient.del(redisKeys.inbox(socket.data.username));
        }
    }
}
