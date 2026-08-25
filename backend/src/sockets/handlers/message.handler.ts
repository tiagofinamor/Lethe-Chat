import { sendMessage } from "../../services/messages.service.js";
import { messageSchema } from "../../models/message.model.js";
import type { AppServer, AppSocket } from "../index.js";
import { socketAsyncHandler } from "../utils/socketAsyncHandler.js";

export function handleMessages(io: AppServer, socket: AppSocket) {
    socket.on(
        "message:send",
        socketAsyncHandler(socket, "message:error", async (payload, ack) => {
            const { to, encryptedPayload } = messageSchema.parse(payload);
            await sendMessage({
                io,
                to,
                from: socket.data.username,
                encryptedPayload,
            });
            ack({ status: "ok" });
        }),
    );
}
