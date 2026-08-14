import { sendMessage } from "../../services/messages.service.js";
import { messageSchema } from "../../models/message.model.js";
import type { AppServer, AppSocket } from "../index.js";

export function messageHandler(io: AppServer, socket: AppSocket) {
    socket.on("message:send", async (payload) => {
        try {
            const { to, cipherText } = messageSchema.parse(payload);
            await sendMessage({io, to, from: socket.data.username, cipherText});
        } catch (err) {
            console.error("Failed to send message:", err);
            socket.emit("message:error", { error: "Failed to send message" });
        }
    });
}
