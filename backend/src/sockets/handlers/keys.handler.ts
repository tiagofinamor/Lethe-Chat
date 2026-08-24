import { getKey, registerKey } from "../../services/keys.service.js";
import type { AppSocket } from "../index.js";
import { socketAsyncHandler } from "../utils/socketAsyncHandler.js";

export function handlePublicKeys(socket: AppSocket) {
    socket.on(
        "public-key:register",
        socketAsyncHandler(socket, "public-key:error", async (payload) => {
            await registerKey(socket.data.username, payload.publicKey);
        }),
    );

    socket.on(
        "public-key:get",
        socketAsyncHandler(socket, "public-key:error", async (payload) => {
            const key = await getKey(payload.username);
            if (key === null) {
                socket.emit("public-key:response", {
                    username: payload.username,
                    publicKey: null,
                });
                return;
            }
            socket.emit("public-key:response", {
                username: payload.username,
                publicKey: key,
            });
        }),
    );
}
