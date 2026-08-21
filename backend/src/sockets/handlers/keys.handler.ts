import { getKey, registerKey } from "../../services/keys.service.js";
import type { AppSocket } from "../index.js";

export function handlePublicKeys(socket: AppSocket) {
    //TODO: implement error handling
    socket.on("public-key:register", async (payload) => {
        await registerKey(socket.data.username, payload.publicKey);
    });

    socket.on("public-key:get", async (payload) => {
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
    });
}
