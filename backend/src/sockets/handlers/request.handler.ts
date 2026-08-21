import { acceptRequest, sendRequest } from "../../services/request.service.js";
import type { AppServer, AppSocket } from "../index.js";

export function handleRequests(io: AppServer, socket: AppSocket) {
    socket.on("friend:request", async (payload) => {
        try {
            const { to } = payload;
            await sendRequest({ io, to, from: socket.data.username });
        } catch (err) {
            console.error("Failed to send friend request.");
            socket.emit("friend:error", { error: "Failed to send request." });
        }
    });

    socket.on("friend:accept", async (payload) => {
        try {
            const { from } = payload;
            await acceptRequest({
                io,
                from,
                userAccepting: socket.data.username,
            });
        } catch (err) {
            console.error("Failed to accept request.");
            socket.emit("friend:error", { error: "Failed to accept request." });
        }
    });
}
