import type { Server as HttpServer } from "http";
import type { RequestHandler, Request, Response, NextFunction } from "express";
import { Server, Socket } from "socket.io";
import { sessionMiddleware } from "../session.js";
import type { SocketData } from "../types/socket.js";
import { messageHandler } from "./handlers/message.handler.js";


type AckFunction = (result: {status: "ok" | "error"}) => void;

interface ClientToServerEvents {
    "message:send": (payload: { to: string; cipherText: string }, callback: AckFunction) => void;
    "friend:request": (payload: { to: string }) => void;
    "friend:accept": (payload: { from: string }) => void;
    "friend:decline": (payload: { from: string }) => void;
}
interface ServerToClientEvents {
    "message:incoming": (payload: { from: string; cipherText: string }, callback: AckFunction) => void;
    "message:error": (payload: { error: string }) => void;
    "friend:incoming": (payload: { from: string }) => void;
    "friend:accepted": (payload: { by: string }) => void;
    "friend:rejected": (paylaod: { by: string }) => void;
    "friend:error": (payload: { error: string }) => void;
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
    io = new Server<
        ClientToServerEvents,
        ServerToClientEvents,
        InterServerEvents,
        SocketData
    >(httpServer);
    io.use(wrap(sessionMiddleware));

    io.use((socket: AppSocket, next) => {
        const userId = socket.request.session?.userId;
        if (!userId) {
            return next(new Error("Unauthorized")); //TODO: create custom error
        }
        socket.data.username = userId;
        next();
    });

    io.on("connection", (socket: AppSocket) => {
        socket.join(`user:${socket.data.username}`);
        messageHandler(io, socket);
    });

    return io;
}

export function getIo() {
    if (!io) {
        throw new Error("Socket instance not initialized.");
    }
    return io;
}
