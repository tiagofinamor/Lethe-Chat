import {
    acceptRequest,
    rejectRequest,
    sendRequest,
} from "../../services/request.service.js";
import type { AppServer, AppSocket } from "../index.js";
import { socketAsyncHandler } from "../utils/socketAsyncHandler.js";

export function handleRequests(io: AppServer, socket: AppSocket) {
    socket.on(
        "friend:request",
        socketAsyncHandler(socket, "friend:error", async (payload) => {
            const { to } = payload;
            await sendRequest({ io, to, from: socket.data.username });
        }),
    );

    socket.on(
        "friend:accept",
        socketAsyncHandler(socket, "friend:error", async (payload) => {
            const { from } = payload;
            await acceptRequest({
                io,
                from,
                userAccepting: socket.data.username,
            });
        }),
    );

    socket.on(
        "friend:decline",
        socketAsyncHandler(socket, "friend:error", async (payload) => {
            const { from } = payload;
            await rejectRequest({
                io,
                from,
                userRejecting: socket.data.username,
            });
        }),
    );
}
