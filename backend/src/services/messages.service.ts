import type { Server } from "socket.io";

const TIMEOUT_MILLISECONDS = 5000;

export async function sendMessage(
    io: Server,
    to: string,
    from: string,
    cipherText: string,
) {
    const payload = { from, cipherText };
    try {
        //TODO: check if room is empty to properly handle all cases 
        const result = await io
            .timeout(TIMEOUT_MILLISECONDS)
            .to(`user:${to}`)
            .emitWithAck("message:incoming", payload);
    } catch (err) {
        //TODO: persist messages for offline recipients and flush on reconnect
        //TODO: improve error handling distinguishing different error types
    }
}
