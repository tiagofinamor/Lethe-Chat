import type { Server, Socket } from "socket.io";
import { sendMessage } from "../../services/messages.service.js";
import { messageSchema } from "../../models/message.model.js";

export function messageHandler(io: Server, socket: Socket) {
    socket.on("message:send", async (payload) => {
        try {
            const { to, cipherText } = messageSchema.parse(payload);
            await sendMessage(io, to, socket.data.username, cipherText);
        } catch (err) {
            console.error("Failed to send message:", err);
            socket.emit("message:error", { error: "Failed to send message" });
        }
    });
}
