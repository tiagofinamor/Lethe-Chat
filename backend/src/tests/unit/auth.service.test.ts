import { describe, expect, it, vi, beforeEach } from "vitest";
import { redisClient } from "../../config/redis.js";
import { authenticate, clearOldConnections } from "../../services/auth.service.js";
import { AuthError } from "../../errors/AppError.js";
import bcrypt from "bcrypt";

vi.mock("../../config/env.js", () => ({
    env: {
        PORT: 3000,
        NODE_ENV: "test",
        REDIS_URL: "redis://localhost:6379",
        SESSION_SECRET: "x".repeat(32),
        USER_TTL_SECONDS: 3600,
    },
}));

vi.mock("../../config/redis.js", () => ({
    redisClient: {
        hGet: vi.fn(),
        exists: vi.fn(),
        sPop: vi.fn(),
        del: vi.fn(),
        sAdd: vi.fn(),
    },
}));

vi.mock("bcrypt", () => ({
    default: {
        compare: vi.fn(),
    },
}));

const mockFetchSockets = vi.fn();
vi.mock("../../sockets/index.js", () => ({
    getIo: () => ({
        in: () => ({
            fetchSockets: mockFetchSockets,
        }),
    }),
}));

describe("authenticate", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("throws AuthError if user doesn't exist", async () => {
        vi.mocked(redisClient.hGet).mockResolvedValue(null);
        await expect(authenticate("alice", "password123")).rejects.toThrow(AuthError);
    });

    it("does not throw an error if the user exists and password is correct (happy path)", async () => {
        const storedHash = "hashed_password";
        vi.mocked(redisClient.hGet).mockResolvedValue(storedHash);
        vi.mocked(bcrypt.compare as () => Promise<boolean>).mockResolvedValue(true);

        await expect(authenticate("alice", "correctPassword")).resolves.not.toThrow();
    });

    it("throws AuthError if entered password is wrong", async () => {
        vi.mocked(redisClient.hGet).mockResolvedValue("hashed_password");
        vi.mocked(bcrypt.compare as () => Promise<boolean>).mockResolvedValue(false);

        await expect(authenticate("alice", "wrongPassword")).rejects.toThrow(AuthError);
    });
});

describe("clearOldConnections", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns early if there's no old session", async () => {
        vi.mocked(redisClient.exists).mockResolvedValue(0);
        await expect(clearOldConnections("alice", "sess_new")).resolves.toBeUndefined();
        expect(redisClient.sPop).not.toHaveBeenCalled();
    });

    it("stops execution and returns the session to redis if same device requests another session", async () => {
        const sameSessionId = "sess_same";
        vi.mocked(redisClient.exists).mockResolvedValue(1);
        vi.mocked(redisClient.sPop).mockResolvedValue(sameSessionId);

        await expect(clearOldConnections("alice", sameSessionId)).resolves.toBeUndefined();
        expect(redisClient.sAdd).toHaveBeenCalled();
        expect(redisClient.del).not.toHaveBeenCalled();
    });

    it("deletes old session and disconnects existing sockets when a new session is established (happy path)", async () => {
        const oldSessionId = "sess_old";
        const newSessionId = "sess_new";
        const mockSocket = { disconnect: vi.fn() };

        vi.mocked(redisClient.exists).mockResolvedValue(1);
        vi.mocked(redisClient.sPop).mockResolvedValue(oldSessionId);
        mockFetchSockets.mockResolvedValue([mockSocket]);

        await clearOldConnections("alice", newSessionId);

        expect(redisClient.del).toHaveBeenCalledWith(`sess:${oldSessionId}`);
        expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });
});
