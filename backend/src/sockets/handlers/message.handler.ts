import { sendMessage } from "../../services/messages.service.js";
import { messageSchema } from "../../models/message.model.js";
import type { AppServer, AppSocket } from "../index.js";

export function handleMessages(io: AppServer, socket: AppSocket) {
    socket.on("message:send", async (payload) => {
        try {
            const { to, encryptedPayload } = messageSchema.parse(payload);
            console.log(payload);
            await sendMessage({
                io,
                to,
                from: socket.data.username,
                encryptedPayload,
            });
        } catch (err) {
            console.error("Failed to send message:", err);
            socket.emit("message:error", { error: "Failed to send message" });
        }
    });
}
