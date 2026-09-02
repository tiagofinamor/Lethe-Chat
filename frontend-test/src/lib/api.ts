"use client";

const backendOrigin =
    process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.BACKEND_URL ?? "";

function toApiUrl(path: string): string {
    if (!backendOrigin) {
        return path;
    }
    return new URL(path, `${backendOrigin.replace(/\/$/, "")}/`).toString();
}

/**
 * Typed fetch helpers for the backend's HTTP endpoints. If a backend URL is
 * configured, requests are sent directly to that origin; otherwise they fall
 * back to same-origin `/api/*` paths for local custom-server development.
 */

export class ApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
    ) {
        super(message);
        this.name = "ApiError";
    }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(toApiUrl(path), {
        ...init,
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...init?.headers,
        },
    });

    if (!res.ok) {
        let message = `Request failed (${res.status})`;
        try {
            const body: unknown = await res.json();
            if (
                typeof body === "object" &&
                body !== null &&
                "error" in body &&
                typeof body.error === "string"
            ) {
                message = body.error;
            }
        } catch {
            // Non-JSON error body — keep the generic message.
        }
        throw new ApiError(message, res.status);
    }

    if (res.status === 204) {
        return undefined as T;
    }
    return (await res.json()) as T;
}

interface ApiMessageResponse {
    message: string;
}

export const api = {
    login: (username: string, password: string) =>
        request<ApiMessageResponse>("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ username, password }),
        }),

    logout: () =>
        request<ApiMessageResponse>("/api/auth/logout", {
            method: "POST",
        }),

    signup: (username: string, password: string) =>
        request<ApiMessageResponse>("/api/users", {
            method: "POST",
            body: JSON.stringify({ username, password }),
        }),

    /** The current user's friends (Redis-backed on the server). */
    getFriends: () => request<{ friends: string[] }>("/api/friends"),

    /** Incoming friend requests awaiting accept/decline. */
    getRequests: () => request<{ requests: string[] }>("/api/requests"),

    /** Remaining lifetime of the authenticated user's account in seconds. */
    getTtl: () => request<{ ttlSeconds: number }>("/api/ttl"),
};
