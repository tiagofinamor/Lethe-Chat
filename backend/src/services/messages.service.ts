import { messageDeliveryDuration } from "../config/metrics.js";
import { redisKeys } from "../config/redis-keys.js";
import { redisClient } from "../config/redis.js";
import type { AppServer, EncryptedPayload } from "../sockets/index.js";
import { userRoom } from "../sockets/rooms.js";

export const ACK_TIMEOUT_MILLISECONDS = 5000;

type SendMessageArgs = {
    io: AppServer;
    to: string;
    from: string;
    encryptedPayload: EncryptedPayload;
};

type SendMessagePayload = {
    from: string;
    encryptedPayload: EncryptedPayload;
    sentAt: Date;
};

export async function sendMessage({
    io,
    to,
    from,
    encryptedPayload,
}: SendMessageArgs) {
    const payload: SendMessagePayload = {
        from,
        encryptedPayload,
        sentAt: new Date(),
    };
    const endTimer = messageDeliveryDuration.startTimer();
    let delivered = false;

    try {
        const result = await io
            .timeout(ACK_TIMEOUT_MILLISECONDS)
            .to(userRoom(to))
            .emitWithAck("message:incoming", payload);

        const messageStatus = result[0]?.status; //assumes a single connection
        delivered = messageStatus === "ok";
    } catch (err) {
        //gets caught by socketAsyncHandler
        throw err;
    } finally {
        endTimer({ outcome: delivered ? "delivered" : "queued" });
    }


    if (!delivered) {
        await sendMsgToInbox(to, payload);
    }
}

async function sendMsgToInbox(to: string, payload: SendMessagePayload) {
    const remainingReceiverTTL = await redisClient.ttl(redisKeys.user(to));
    await redisClient
        .multi()
        .rPush(redisKeys.inbox(to), JSON.stringify(payload))
        .expire(redisKeys.inbox(to), remainingReceiverTTL)
        .exec();
}
