import type { AppServer } from "../sockets/index.js";
import { userRoom } from "../sockets/rooms.js";

const TIMEOUT_MILLISECONDS = 5000;

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
    try {
        //TODO: check if room is empty to properly handle all cases
        const result = await io
            .timeout(TIMEOUT_MILLISECONDS)
            .to(userRoom(to))
            .emitWithAck("message:incoming", payload);
    } catch (err) {
        //TODO: persist messages for offline recipients and flush on reconnect
        //TODO: improve error handling distinguishing different error types
    }
}
