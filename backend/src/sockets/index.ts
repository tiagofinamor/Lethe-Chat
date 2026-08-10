import type { Server as HttpServer } from "http";
import type { RequestHandler, Request, Response, NextFunction } from "express";
import { Server, Socket } from "socket.io";
import { sessionMiddleware } from "../session.js";
import type { SocketData } from "../types/socket.js";

//to define later
interface ClientToServerEvents {}
interface ServerToClientEvents {}
interface InterServerEvents {}

const wrap =
    (middleware: RequestHandler) =>
    (socket: Socket, next: (err?: any) => void) => {
        middleware(
            socket.request as Request,
            {} as Response,
            next as NextFunction,
        );
    };

export function createSocketServer(httpServer: HttpServer) {
    const io = new Server<
        ClientToServerEvents,
        ServerToClientEvents,
        InterServerEvents,
        SocketData
    >(httpServer);
    io.use(wrap(sessionMiddleware));

    io.use((socket, next) => {
        const userId = socket.request.session?.userId;
        if (!userId) {
            return next(new Error("Unauthorized")); //TODO: create custom error
        }
        socket.data.username = userId;
        next();
    });
    return io;
}
