import { subscriberClient } from "../config/redis.js";
import { usernameSchema } from "../models/user.model.js";
import { getIo } from "./index.js";
import { userRoom } from "./rooms.js";

export async function listenForUserExpiry() {
    await subscriberClient.subscribe(
        "__keyevent@0__:expired",
        async (expiredKey) => {
            const splitKey = expiredKey.split(":");
            try {
                if (splitKey[0] === "user" && splitKey.length === 2) {
                    //true if it's the username key
                    const io = getIo();
                    const username = usernameSchema.parse(splitKey[1]);
                    io.in(userRoom(username)).disconnectSockets();
                }
            } catch (err) {
                console.error("Failed to disconnect user socket.");
            }
        },
    );
}
