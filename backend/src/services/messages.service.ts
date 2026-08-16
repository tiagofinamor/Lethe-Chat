import { redisKeys } from "../config/redis-keys.js";
import { redisClient } from "../config/redis.js";
import type { AppServer } from "../sockets/index.js";
import { userRoom } from "../sockets/rooms.js";

export const ACK_TIMEOUT_MILLISECONDS = 5000;

type SendMessageArgs = {
    io: AppServer;
    to: string;
    from: string;
    cipherText: string;
};

export async function sendMessage({
    io,
    to,
    from,
    cipherText,
}: SendMessageArgs) {
    const payload = { from, cipherText };
    let delivered = false;

    try {
        //TODO: deal with edge case where the user can start a chat while draining his inbox
        //which would cause the messages to arrive out of order
        
        const result = await io
            .timeout(ACK_TIMEOUT_MILLISECONDS)
            .to(userRoom(to))
            .emitWithAck("message:incoming", payload);

        const messageStatus = result[0]?.status; //assumes a single connection
        delivered = messageStatus === "ok";
    } catch (err) {
        console.error("Failed to deliver the message", err);
    }

    if (!delivered) {
        await sendMsgToInbox(to, payload);
    }
}

async function sendMsgToInbox(
    to: string,
    payload: { from: string; cipherText: string },
) {
    const remainingReceiverTTL = await redisClient.ttl(redisKeys.user(to));
    await redisClient
        .multi()
        .rPush(redisKeys.inbox(to), JSON.stringify(payload))
        .expire(redisKeys.inbox(to), remainingReceiverTTL)
        .exec();
}
