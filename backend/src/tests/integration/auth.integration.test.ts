import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { redisClient } from "../../config/redis.js";
import { authenticate, clearOldConnections } from "../../services/auth.service.js";
import { AuthError } from "../../errors/AppError.js";
import { redisKeys } from "../../config/redis-keys.js";
import { userRoom } from "../../sockets/rooms.js";
import bcrypt from "bcrypt";

vi.mock("../../config/env.js", () => ({
    env: {
        PORT: 3000,
        NODE_ENV: "test",
        REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
        SESSION_SECRET: "x".repeat(32),
        USER_TTL_SECONDS: 3600,
    },
}));

const mockFetchSockets = vi.fn();
vi.mock("../../sockets/index.js", () => ({
    getIo: () => ({
        in: (room: string) => ({
            fetchSockets: () => mockFetchSockets(room),
        }),
    }),
}));

describe("auth.service integration tests", () => {
    beforeAll(async () => {
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }
    });

    afterAll(async () => {
        if (redisClient.isOpen) {
            await redisClient.quit();
        }
    });

    describe("authenticate", () => {
        it("authenticates successfully when user exists in Redis and password matches", async () => {
            const username = "auth_user_valid";
            const plainPassword = "securePassword123";
            const hashedPassword = await bcrypt.hash(plainPassword, 10);

            await redisClient.hSet(redisKeys.user(username), {
                password: hashedPassword,
            });

            try {
                await expect(authenticate(username, plainPassword)).resolves.not.toThrow();
            } finally {
                await redisClient.del(redisKeys.user(username));
            }
        });

        it("throws AuthError when user does not exist in Redis", async () => {
            await expect(authenticate("auth_user_ghost", "password123")).rejects.toThrow(AuthError);
        });

        it("throws AuthError when password does not match", async () => {
            const username = "auth_user_wrongpass";
            const hashedPassword = await bcrypt.hash("correctPassword", 10);

            await redisClient.hSet(redisKeys.user(username), {
                password: hashedPassword,
            });

            try {
                await expect(authenticate(username, "wrongPassword")).rejects.toThrow(AuthError);
            } finally {
                await redisClient.del(redisKeys.user(username));
            }
        });
    });

    describe("clearOldConnections", () => {
        it("returns early if the user has no existing sessions", async () => {
            const username = "auth_user_nosessions";
            mockFetchSockets.mockReset();

            await clearOldConnections(username, "new_session_123");

            expect(mockFetchSockets).not.toHaveBeenCalled();
            const sessionCount = await redisClient.exists(redisKeys.sessions(username));
            expect(sessionCount).toBe(0);
        });

        it("re-adds session and does not disconnect if same device / session requests another session", async () => {
            const username = "auth_user_samedevice";
            const sessionId = "session_device_1";
            mockFetchSockets.mockReset();

            await redisClient.sAdd(redisKeys.sessions(username), sessionId);

            try {
                await clearOldConnections(username, sessionId);

                expect(mockFetchSockets).not.toHaveBeenCalled();
                const sessions = await redisClient.sMembers(redisKeys.sessions(username));
                expect(sessions).toContain(sessionId);
            } finally {
                await redisClient.del(redisKeys.sessions(username));
            }
        });

        it("deletes old session from Redis and disconnects old sockets when a new session is started", async () => {
            const username = "auth_user_multidevice";
            const oldSessionId = "auth_old_sess_abc";
            const newSessionId = "auth_new_sess_xyz";
            mockFetchSockets.mockReset();

            await redisClient.sAdd(redisKeys.sessions(username), oldSessionId);
            await redisClient.set(`sess:${oldSessionId}`, JSON.stringify({ userId: username }));

            const mockOldSocket = {
                id: "socket_old_1",
                disconnect: vi.fn(),
            };
            mockFetchSockets.mockResolvedValue([mockOldSocket]);

            try {
                await clearOldConnections(username, newSessionId);

                const oldSessionExists = await redisClient.exists(`sess:${oldSessionId}`);
                expect(oldSessionExists).toBe(0);

                expect(mockFetchSockets).toHaveBeenCalledWith(userRoom(username));
                expect(mockOldSocket.disconnect).toHaveBeenCalledWith(true);
            } finally {
                await redisClient.del([`sess:${oldSessionId}`, redisKeys.sessions(username)]);
            }
        });
    });
});
