"use client";

import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./types";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

/**
 * Returns the app-wide Socket.IO client. Connect is explicit (autoConnect is
 * false) so the auth provider controls when the session probe happens.
 *
 * Same-origin by default: the custom server proxies `/socket.io` to the
 * backend, so the session cookie is attached to the handshake automatically.
 */
export function getSocket(): AppSocket {
    if (!socket) {
        socket = io({
            autoConnect: false,
            withCredentials: true,
            reconnection: true,
        });
    }
    return socket;
}

/** Tears the socket down entirely (used on sign-out). */
export function destroySocket(): void {
    socket?.removeAllListeners();
    socket?.disconnect();
    socket = null;
}
