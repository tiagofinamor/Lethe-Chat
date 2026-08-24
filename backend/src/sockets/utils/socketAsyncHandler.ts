import { AppError } from "../../errors/AppError.js";
import type { AppSocket } from "../index.js";

type ErrorEvent = "friend:error" | "message:error" | "public-key:error";

export function socketAsyncHandler<Args extends unknown[]>(
    socket: AppSocket,
    errorEvent: ErrorEvent,
    fn: (...args: Args) => Promise<void>,
) {
    return async (...args: Args) => {
        try {
            await fn(...args);
        } catch (err) {
            if (err instanceof AppError) {
                socket.emit(errorEvent, { error: err.message });
            } else {
                console.error("Unexpected error: ", err);
                socket.emit(errorEvent, { error: "Something went wrong." });
            }
        }
    };
}
