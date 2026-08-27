import { expect, it, vi } from "vitest";
import { socketAsyncHandler } from "../../sockets/utils/socketAsyncHandler.js";
import { RequestNotFoundError } from "../../errors/AppError.js";
import type { AppSocket } from "../../sockets/index.js";

vi.mock("../../config/env.js", () => ({
    env: {
        PORT: 3000,
        NODE_ENV: "test",
        REDIS_URL: "redis://localhost:6379",
        SESSION_SECRET: "x".repeat(32),
        USER_TTL_SECONDS: 3600,
    },
}));

vi.mock("../../config/logger.js", () => ({
    logger: {
        warn: vi.fn(),
    },
}));

it("catches AppError and emits the error event with its message", async () => {
    const mockSocket = { data: { username: "alice" }, emit: vi.fn() };
    const wrapped = socketAsyncHandler(
        mockSocket as unknown as AppSocket,
        "message:error",
        async () => {
            throw new RequestNotFoundError("bob");
        },
    );

    await wrapped();
    expect(mockSocket.emit).toHaveBeenCalledWith("message:error", {
        error: expect.any(String),
    });
});
