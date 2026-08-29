import { describe, expect, it, vi, afterAll } from "vitest";
import { redisClient, subscriberClient, connectRedis } from "../../config/redis.js";
import { logger } from "../../config/logger.js";

vi.mock("../../config/env.js", () => ({
    env: {
        PORT: 3000,
        NODE_ENV: "test",
        REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
        SESSION_SECRET: "x".repeat(32),
        USER_TTL_SECONDS: 3600,
    },
}));

describe("redis client setup integration tests", () => {
    afterAll(async () => {
        if (redisClient.isOpen) {
            await redisClient.quit();
        }
        if (subscriberClient.isOpen) {
            await subscriberClient.quit();
        }
    });

    it("exports redisClient and subscriberClient instances", () => {
        expect(redisClient).toBeDefined();
        expect(subscriberClient).toBeDefined();
        expect(typeof redisClient.connect).toBe("function");
        expect(typeof subscriberClient.connect).toBe("function");
    });

    it("connects redisClient and subscriberClient without changing keyspace notifications", async () => {
        await connectRedis();

        expect(redisClient.isOpen).toBe(true);
        expect(subscriberClient.isOpen).toBe(true);
    });

    it("executes basic Redis commands through connected redisClient", async () => {
        if (!redisClient.isOpen) {
            await connectRedis();
        }

        const testKey = "test:redis:ping_unique_123";
        try {
            await redisClient.set(testKey, "pong");
            const val = await redisClient.get(testKey);
            expect(val).toBe("pong");
        } finally {
            await redisClient.del(testKey);
        }

        const exists = await redisClient.exists(testKey);
        expect(exists).toBe(0);
    });

    it("logs fatal error when redisClient emits an error event", async () => {
        const loggerFatalSpy = vi.spyOn(logger, "fatal").mockImplementation(() => logger);
        const testError = new Error("Simulated Redis client connection error");

        redisClient.emit("error", testError);

        expect(loggerFatalSpy).toHaveBeenCalledWith(testError);
        loggerFatalSpy.mockRestore();
    });

    it("catches and logs error with logger.fatal if connectRedis fails", async () => {
        const loggerFatalSpy = vi.spyOn(logger, "fatal").mockImplementation(() => logger);
        const connectSpy = vi.spyOn(redisClient, "connect").mockRejectedValueOnce(new Error("Connection refused"));

        await connectRedis();

        expect(loggerFatalSpy).toHaveBeenCalledWith(expect.any(Error));
        loggerFatalSpy.mockRestore();
        connectSpy.mockRestore();
    });
});
