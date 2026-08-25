import { logger } from "../../config/logger.js";
import { socketEventDuration } from "../../config/metrics.js";
import { AppError } from "../../errors/AppError.js";
import type { AppSocket } from "../index.js";

type ErrorEvent = "friend:error" | "message:error" | "public-key:error";

export function socketAsyncHandler<Args extends unknown[]>(
    socket: AppSocket,
    errorEvent: ErrorEvent,
    fn: (...args: Args) => Promise<void>,
) {
    return async (...args: Args) => {
        const end = socketEventDuration.startTimer({ event: errorEvent });
        try {
            await fn(...args);
            end({ status: "ok" });
        } catch (err) {
            if (err instanceof AppError) {
                socket.emit(errorEvent, { error: err.message });
                end({ status: "error" });
                logger.warn(
                    { err, username: socket.data.username, event: errorEvent },
                    err.message,
                );
            } else {
                socket.emit(errorEvent, { error: "Something went wrong." });
                end({ status: "error" });
                logger.error(
                    {
                        err,
                        username: socket.data.username,
                        event: errorEvent,
                    },
                    err instanceof Error ? err.message : "Unknown error",
                );
            }
        }
    };
}
