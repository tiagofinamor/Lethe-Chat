"use client";

/**
 * Typed fetch helpers for the backend's HTTP endpoints. All requests go to
 * same-origin `/api/*` paths, which the custom server proxies to the backend,
 * so the session cookie is sent automatically.
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
    const res = await fetch(path, {
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

    signup: (username: string, password: string) =>
        request<ApiMessageResponse>("/api/users", {
            method: "POST",
            body: JSON.stringify({ username, password }),
        }),

    /** The current user's friends (Redis-backed on the server). */
    getFriends: () => request<{ friends: string[] }>("/api/friends"),

    /**
     * Incoming friend requests awaiting accept/decline.
     *
     * The backend controller does `res.json(JSON.stringify(array))`, which
     * double-encodes: Express's `res.json` wraps the already-stringified
     * array in quotes, so the HTTP body is a JSON string containing a JSON
     * array. We double-parse to recover the actual `string[]`.
     */
    getRequests: async (): Promise<{ requests: string[] }> => {
        const raw = await request<string>("/api/requests");
        // If the raw response is a string, it's the double-encoded case.
        if (typeof raw === "string") {
            try {
                const parsed: unknown = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    return { requests: parsed as string[] };
                }
            } catch {
                // Fall through — treat as empty.
            }
            return { requests: [] };
        }
        // If it's already an object with a requests array, use it directly.
        if (
            typeof raw === "object" &&
            raw !== null &&
            "requests" in raw &&
            Array.isArray((raw as { requests: unknown }).requests)
        ) {
            return raw as { requests: string[] };
        }
        return { requests: [] };
    },
};
