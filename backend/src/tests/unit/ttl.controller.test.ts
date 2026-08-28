import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { getTtlController } from "../../controllers/ttl.controller.js";
import { getUserTtl } from "../../services/ttl.service.js";

vi.mock("../../services/ttl.service.js", () => ({
    getUserTtl: vi.fn(),
}));

describe("getTtlController", () => {
    it("returns the authenticated user's remaining TTL", async () => {
        vi.mocked(getUserTtl).mockResolvedValue(1800);
        const response = {
            json: vi.fn(),
            status: vi.fn(),
        };
        response.status.mockReturnValue(response);
        const request = { session: { userId: "alice" } };

        await getTtlController(request as Request, response as unknown as Response);

        expect(getUserTtl).toHaveBeenCalledWith("alice");
        expect(response.status).toHaveBeenCalledWith(200);
        expect(response.json).toHaveBeenCalledWith({ ttlSeconds: 1800 });
    });
});
