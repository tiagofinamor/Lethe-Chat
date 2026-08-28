import type { Server as HttpServer } from "http";
import type { RequestHandler, Request, Response, NextFunction } from "express";
import { Server, Socket } from "socket.io";
import { sessionMiddleware } from "../session.js";
import type { SocketData } from "../types/socket.js";
import { handleMessages } from "./handlers/message.handler.js";
import { handleRequests } from "./handlers/request.handler.js";
import { userRoom } from "./rooms.js";
import { handleInbox } from "./handlers/inbox.handler.js";
import { handlePublicKeys } from "./handlers/keys.handler.js";
import { InboxDrainError, MalformedMsgInboxError } from "../errors/AppError.js";
import { logger } from "../config/logger.js";
import { InvariantError } from "../errors/InvariantError.js";
import { env } from "../config/env.js";

type AckFunction = (result: { status: "ok" | "error" }) => void;

export type EncryptedPayload = {
    cipherText: string;
    nonce: string;
};

interface ClientToServerEvents {
    "message:send": (
        payload: { to: string; encryptedPayload: EncryptedPayload },
        callback: AckFunction,
    ) => void;
    "friend:request": (payload: { to: string }) => void;
    "friend:accept": (payload: { from: string }) => void;
    "friend:decline": (payload: { from: string }) => void;
    "public-key:register": (payload: { publicKey: string }) => void;
    "public-key:get": (payload: { username: string }) => void;
}
interface ServerToClientEvents {
    "message:incoming": (
        payload: { from: string; encryptedPayload: EncryptedPayload },
        callback: AckFunction,
    ) => void;
    "inbox:incoming": (
        payload: { from: string; encryptedPayload: EncryptedPayload }[],
        callback: AckFunction,
    ) => void;
    "message:error": (payload: { error: string }) => void;
    "friend:incoming": (payload: { from: string }) => void;
    "friend:accepted": (payload: { by: string }) => void;
    "friend:rejected": (paylaod: { by: string }) => void;
    "friend:error": (payload: { error: string }) => void;
    error: (payload: { message: string }) => void;
    "public-key:response": (payload: {
        username: string;
        publicKey: string | null;
    }) => void;
    "public-key:error": (payload: { error: string }) => void;
}
interface InterServerEvents {}

export type AppServer = Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>;

export type AppSocket = Socket<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
>;

const wrap =
    (middleware: RequestHandler) =>
    (socket: AppSocket, next: (err?: any) => void) => {
        middleware(
            socket.request as Request,
            {} as Response,
            next as NextFunction,
        );
    };

let io: AppServer;

export function createSocketServer(httpServer: HttpServer) {
    const allowedOrigins = new Set(env.CORS_ORIGINS);

    io = new Server<
        ClientToServerEvents,
        ServerToClientEvents,
        InterServerEvents,
        SocketData
    >(httpServer, {
        cors: {
            origin: (origin, callback) => {
                if (!origin || allowedOrigins.has(origin)) {
                    callback(null, true);
                    return;
                }
                callback(new Error("Origin not allowed"), false);
            },
            credentials: true,
            methods: ["GET", "POST"],
        },
    });
    io.use(wrap(sessionMiddleware));

    io.use((socket: AppSocket, next) => {
        const userId = socket.request.session?.userId;
        if (!userId) {
            return next(
                new InvariantError(
                    "User connected to websocket without a session.",
                    500,
                ),
            );
        }
        socket.data.username = userId;
        next();
    });

    io.on("connection", async (socket: AppSocket) => {
        socket.join(userRoom(socket.data.username));
        handlePublicKeys(socket);
        handleMessages(io, socket);
        handleRequests(io, socket);

        try {
            await handleInbox(socket);
        } catch (err) {
            if (
                err instanceof InboxDrainError ||
                err instanceof MalformedMsgInboxError
            ) {
                socket.emit("message:error", { error: err.message });
                logger.warn(
                    {
                        err,
                        username: socket.data.username,
                        event: "inbox:error",
                    },
                    err.message,
                );
            } else {
                socket.emit("message:error", {
                    error: "An unexpected error occurred.",
                });
                logger.error({
                    err,
                    username: socket.data.username,
                    event: "inbox:error",
                }, err instanceof Error ? err.message : "Unknown error");
            }
        }
    });

    return io;
}

export function getIo() {
    if (!io) {
        logger.fatal("IO server was not initialized");
        throw new Error("IO server instance not initialized.");
    }
    return io;
}
