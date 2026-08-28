"use client";

import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./types";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const socketUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.BACKEND_URL ?? undefined;

let socket: AppSocket | null = null;

/**
 * Returns the app-wide Socket.IO client. Connect is explicit (autoConnect is
 * false) so the auth provider controls when the session probe happens.
 *
 * If a backend URL is configured, the socket connects directly to that origin;
 * otherwise it falls back to same-origin `/socket.io` for local custom-server
 * development, so the session cookie is attached to the handshake automatically.
 */
export function getSocket(): AppSocket {
    if (!socket) {
        socket = io(socketUrl ?? undefined, {
            autoConnect: false,
            withCredentials: true,
            reconnection: true,
            transports: ["websocket", "polling"],
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
