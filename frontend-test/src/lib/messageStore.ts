"use client";

/**
 * Client-side persistence for chat messages.
 *
 * The backend has no message-history endpoint, so conversations only live in
 * this browser. We keep the most recent messages in localStorage (keyed by
 * username so accounts never leak into each other) so a logout/login within
 * the TTL window re-renders the same conversation.
 *
 * The TTL is controlled by `NEXT_PUBLIC_MESSAGE_TTL_HOURS` (default 1 hour).
 * Messages older than the TTL are dropped when the store is loaded; the store
 * is re-written on every change, so an active session keeps its history.
 */

export interface StoredChatMessage {
    id: string;
    peer: string;
    direction: "incoming" | "outgoing";
    text: string;
    cipherText?: string;
    nonce?: string;
    senderUsername?: string;
    receivedAt: number;
}

const KEY_PREFIX = "chit-chatx.messages.";

/** TTL in hours from NEXT_PUBLIC_MESSAGE_TTL_HOURS (default 1). */
export function messageTtlHours(): number {
    const parsed = Number(process.env.NEXT_PUBLIC_MESSAGE_TTL_HOURS);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/** Loads the user's stored messages, dropping any that have expired. */
export function loadStoredMessages(username: string): StoredChatMessage[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = window.localStorage.getItem(KEY_PREFIX + username);
        if (!raw) return [];
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const cutoff = Date.now() - messageTtlHours() * 60 * 60 * 1000;
        return (parsed as StoredChatMessage[]).filter(
            (m) =>
                typeof m?.receivedAt === "number" && m.receivedAt >= cutoff,
        );
    } catch {
        // Corrupt or unreadable payload — treat as empty.
        return [];
    }
}

/** Persists the user's messages (best-effort: quota/availability failures are ignored). */
export function saveMessages(
    username: string,
    messages: StoredChatMessage[],
): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(
            KEY_PREFIX + username,
            JSON.stringify(messages),
        );
    } catch {
        // Storage full or unavailable — persistence is best-effort.
    }
}
