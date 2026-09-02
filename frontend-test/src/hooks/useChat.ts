"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSocket } from "@/lib/socket";
import { loadStoredMessages, saveMessages } from "@/lib/messageStore";
import { api, ApiError } from "@/lib/api";
import { MAX_MESSAGE_LENGTH } from "@/lib/validation";
import type { AckResult, IncomingMessagePayload } from "@/lib/types";
import {
    generateKeyPair,
    encryptMessage,
    decryptMessage,
    getStoredKeyPair,
    storeKeyPair,
    type KeyPair,
} from "@/lib/crypto";

export interface ChatMessage {
    id: string;
    /** The other party's username. */
    peer: string;
    direction: "incoming" | "outgoing";
    /** Plaintext after decryption (for outgoing, this is the original user input). */
    text: string;
    /** Encrypted payload (stored for display/debugging purposes). */
    cipherText?: string;
    nonce?: string;
    /** Sender's username (used for decryption of incoming messages). */
    senderUsername?: string;
    receivedAt: number;
    /**
     * For outgoing messages: undefined = waiting for server ack, true = server
     * acknowledged receipt. If the server reports an error, the message is
     * removed entirely, so there is no explicit "failed" state here.
     */
    acked?: boolean;
}

let idCounter = 0;
const createId = () =>
    `${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

/**
 * A friend action we just performed optimistically. The backend sends no ack
 * for friend events — only a generic `friend:error` on failure — so we track
 * the most recent op and revert it when an error arrives, matching the error
 * wording ("send" vs "accept") to decide which op failed.
 */
interface FriendOp {
    kind: "request" | "accept";
    username: string;
}

/**
 * The backend drains the offline-message queue on every connection. If that
 * drain fails (e.g. our ack times out), it emits the generic `error` event
 * with this exact message and leaves the queue intact — so we reconnect to
 * trigger a fresh drain. Bounded so a persistently failing drain can't loop
 * forever.
 */
const INBOX_DRAIN_ERROR_MESSAGE = "Failed to drain inbox.";
const MAX_INBOX_DRAIN_RETRIES = 3;
const INBOX_RETRY_DELAY_MS = 800;
/** Failures only count toward the retry budget within this window. */
const INBOX_RETRY_BUDGET_RESET_MS = 15_000;

/**
 * When a drain's ack is lost after the client already processed the messages,
 * the retry reconnect re-delivers the same queued messages. This window
 * dedupes identical (peer, cipherText) inbox deliveries; live deliveries are
 * never deduped.
 */
const INCOMING_DEDUPE_WINDOW_MS = 30_000;

/** Convert a server `sentAt` (ISO string or epoch-like) to a number. */
function toTimestamp(sentAt?: string): number {
    if (!sentAt) return Date.now();
    const t = new Date(sentAt).getTime();
    return Number.isFinite(t) ? t : Date.now();
}

export function useChat(username: string) {
    const socket = getSocket();
    // Hydrate from the client-side store (TTL-bounded) so a logout/login
    // within the TTL re-renders the previous conversation.
    const [messages, setMessages] = useState<ChatMessage[]>(() =>
        loadStoredMessages(username),
    );
    /** Users we are friends with (only they can be chatted with). */
    const [friends, setFriends] = useState<string[]>([]);
    /** Requests others sent us, awaiting our accept/decline. */
    const [incomingRequests, setIncomingRequests] = useState<string[]>([]);
    /**
     * Requests we sent that haven't been answered yet. The backend never
     * confirms a request was recorded (no `friend:sent` event), so this is
     * optimistic and gets corrected when `friend:accepted` / `friend:rejected`
     * arrive (or a `friend:error` arrives and we revert it).
     */
    const [outgoingRequests, setOutgoingRequests] = useState<string[]>([]);
    const [activePeer, setActivePeer] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    /** Local keypair for E2E encryption. Generated on login, stored in localStorage. */
    const keyPairRef = useRef<KeyPair | null>(null);
    /** Cache of friend public keys retrieved from the backend. */
    const publicKeysCacheRef = useRef<Map<string, string>>(new Map());

    // Refs mirroring state, so the friends-fetch handler below can compute
    // merge / auto-open decisions without stale closures (and without side
    // effects inside state updaters).
    const messagesRef = useRef(messages);
    const friendsRef = useRef(friends);
    const activePeerRef = useRef(activePeer);
    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);
    useEffect(() => {
        friendsRef.current = friends;
    }, [friends]);
    useEffect(() => {
        activePeerRef.current = activePeer;
    }, [activePeer]);

    const lastOpRef = useRef<FriendOp | null>(null);
    const recentIncomingRef = useRef<Map<string, number>>(new Map());

    /** Function to fetch public keys (set up in the socket effect). */
    const fetchPublicKeyRef = useRef<(username: string) => Promise<string>>(
        () => Promise.reject(new Error("Socket not initialized")),
    );

    /** True once GET /api/friends has succeeded on this mount. */
    const friendsLoadedRef = useRef(false);
    /**
     * Auto-opening is a one-shot convenience: after it fires (or after the
     * user manually opens/closes a chat), we never steal focus again.
     */
    const autoOpenedRef = useRef(false);

    /**
     * "Automatically loads your previous conversation": among the known
     * friends, open the one with the most recently stored message. Uses refs
     * so it can be called from anywhere without stale closures. An explicit
     * `friendList` may be passed when the caller already has a fresh list
     * (the friends ref only syncs on the next render).
     */
    const attemptAutoOpen = useCallback((friendList?: string[]) => {
        if (autoOpenedRef.current) return;
        if (activePeerRef.current !== null) return;
        let best: string | null = null;
        let bestAt = -1;
        for (const friend of friendList ?? friendsRef.current) {
            const last = [...messagesRef.current]
                .reverse()
                .find((m) => m.peer === friend);
            if (last && last.receivedAt > bestAt) {
                bestAt = last.receivedAt;
                best = friend;
            }
        }
        if (best) {
            autoOpenedRef.current = true;
            setActivePeer(best);
        }
    }, []);

    // Persist messages whenever they change, so they survive logout/login.
    useEffect(() => {
        saveMessages(username, messages);
    }, [username, messages]);

    // Initialize or restore keypair on login. Generate a new one if not stored locally,
    // then register the public key with the backend.
    useEffect(() => {
        let cancelled = false;

        const initializeKeyPair = async () => {
            try {
                // Try to restore from localStorage first
                let keypair = getStoredKeyPair(username);

                // Generate new keypair if not found
                if (!keypair) {
                    keypair = generateKeyPair();
                    storeKeyPair(username, keypair);
                }

                keyPairRef.current = keypair;

                // Register public key with the backend
                socket.emit("public-key:register", { publicKey: keypair.publicKey });
            } catch (err: unknown) {
                if (cancelled) return;
                console.error("Failed to initialize keypair:", err);
                setError("Failed to initialize encryption. Please reload the page.");
            }
        };

        initializeKeyPair();
        return () => {
            cancelled = true;
        };
    }, [username, socket]);

    // Restore friends AND incoming requests from the backend on login.
    // Friendships live in Redis, so this is the only source that survives a
    // logout — socket events alone would leave the list empty until the other
    // side acts again. Socket events may add friends concurrently, so merge,
    // don't replace.
    useEffect(() => {
        let cancelled = false;

        const loadFriendsAndRequests = async () => {
            try {
                const [{ friends: serverFriends }, { requests: serverRequests }] =
                    await Promise.all([api.getFriends(), api.getRequests()]);

                if (cancelled) return;
                friendsLoadedRef.current = true;

                // Merge friends (don't replace — socket events may have arrived
                // concurrently).
                const mergedFriends = Array.from(
                    new Set([...friendsRef.current, ...serverFriends]),
                );
                setFriends(mergedFriends);
                friendsRef.current = mergedFriends;

                // Merge incoming requests (server is authoritative on login;
                // socket events may add more concurrently).
                setIncomingRequests((prev) =>
                    Array.from(new Set([...prev, ...serverRequests])),
                );

                attemptAutoOpen(mergedFriends);
            } catch (err: unknown) {
                if (cancelled) return;
                // 401 means the session died — useAuth's socket probe handles
                // the logout; don't pile an error banner on top of it.
                if (err instanceof ApiError && err.status === 401) return;
                setError(
                    "Couldn't load your friends from the server. Reload the page to try again.",
                );
            }
        };

        loadFriendsAndRequests();
        return () => {
            cancelled = true;
        };
    }, [username, attemptAutoOpen]);

    // The friends fetch and the inbox drain race: on a fresh login the queued
    // messages may be added to the store *after* the fetch resolved (and the
    // auto-open found nothing). Re-attempt once per message change — the
    // one-shot guard in attemptAutoOpen keeps this from stealing focus later.
    useEffect(() => {
        if (friendsLoadedRef.current) attemptAutoOpen();
    }, [messages, attemptAutoOpen]);

    useEffect(() => {
        /**
         * Fetch a public key from cache or backend.
         * Returns a Promise that resolves when the key is available.
         */
        const fetchPublicKey = (username: string): Promise<string> => {
            return new Promise((resolve, reject) => {
                const cachedKey = publicKeysCacheRef.current.get(username);
                if (cachedKey) {
                    resolve(cachedKey);
                    return;
                }

                socket.emit("public-key:get", { username });
                let timeoutHandle: NodeJS.Timeout | null = null;

                const handleKeyResponse = (response: {
                    username: string;
                    publicKey: string | null;
                }) => {
                    if (response.username !== username) return;

                    if (timeoutHandle) clearTimeout(timeoutHandle);
                    socket.off("public-key:response", handleKeyResponse);

                    if (response.publicKey === null) {
                        reject(new Error(`No public key available for ${username}`));
                        return;
                    }
                    publicKeysCacheRef.current.set(username, response.publicKey);
                    resolve(response.publicKey);
                };

                socket.on("public-key:response", handleKeyResponse);

                timeoutHandle = setTimeout(() => {
                    socket.off("public-key:response", handleKeyResponse);
                    reject(new Error(`Timeout fetching public key for ${username}`));
                }, 5000);
            });
        };

        // Store for use in other callbacks
        fetchPublicKeyRef.current = fetchPublicKey;

        /**
         * Helper to decrypt an incoming message asynchronously.
         * Fetches the sender's public key from cache or backend if needed.
         */
        const decryptIncomingMessage = (
            senderUsername: string,
            cipherText: string,
            nonce: string,
            onSuccess: (plaintext: string) => void,
            onError: (err: Error) => void,
        ) => {
            const decryptWithKey = (senderPublicKey: string) => {
                try {
                    if (!keyPairRef.current) {
                        throw new Error("Keypair not initialized");
                    }
                    const plaintext = decryptMessage(
                        cipherText,
                        nonce,
                        senderPublicKey,
                        keyPairRef.current.secretKey,
                    );
                    onSuccess(plaintext);
                } catch (err) {
                    onError(err instanceof Error ? err : new Error(String(err)));
                }
            };

            fetchPublicKey(senderUsername)
                .then(decryptWithKey)
                .catch(onError);
        };

        const addIncomingMessage = (
            peer: string,
            text: string,
            cipherText?: string,
            nonce?: string,
            sentAt?: string,
        ) => {
            setMessages((prev) => [
                ...prev,
                {
                    id: createId(),
                    peer,
                    direction: "incoming",
                    text,
                    cipherText,
                    nonce,
                    senderUsername: peer,
                    receivedAt: toTimestamp(sentAt),
                },
            ]);
        };

        const handleMessageIncoming = (
            payload: IncomingMessagePayload,
            ack: (result: AckResult) => void,
        ) => {
            // Decrypt the message
            decryptIncomingMessage(
                payload.from,
                payload.encryptedPayload.cipherText,
                payload.encryptedPayload.nonce,
                (plaintext) => {
                    addIncomingMessage(
                        payload.from,
                        plaintext,
                        payload.encryptedPayload.cipherText,
                        payload.encryptedPayload.nonce,
                        payload.sentAt,
                    );
                },
                () => {
                    setError(
                        `Failed to decrypt message from ${payload.from}. You may not have their public key.`,
                    );
                },
            );

            // Ack promptly: the backend waits up to 5s and treats a timeout
            // as "recipient offline", then queues the message for later.
            ack({ status: "ok" });
        };

        // Returns true when this exact delivery was seen recently — guards
        // against the retry reconnect re-delivering a queue we already
        // processed (see INCOMING_DEDUPE_WINDOW_MS).
        const isDuplicateIncoming = (
            peer: string,
            cipherText: string,
        ): boolean => {
            const key = `${peer}\u0000${cipherText}`;
            const now = Date.now();
            const map = recentIncomingRef.current;
            for (const [k, seenAt] of map) {
                if (now - seenAt > INCOMING_DEDUPE_WINDOW_MS) {
                    map.delete(k);
                }
            }
            if (map.has(key)) return true;
            map.set(key, now);
            return false;
        };

        const handleInboxIncoming = (
            payload: IncomingMessagePayload[],
            ack: (result: AckResult) => void,
        ) => {
            // Offline messages queued in Redis while we were disconnected.
            for (const message of payload) {
                if (isDuplicateIncoming(message.from, message.encryptedPayload.cipherText)) {
                    continue;
                }
                decryptIncomingMessage(
                    message.from,
                    message.encryptedPayload.cipherText,
                    message.encryptedPayload.nonce,
                    (plaintext) => {
                        addIncomingMessage(
                            message.from,
                            plaintext,
                            message.encryptedPayload.cipherText,
                            message.encryptedPayload.nonce,
                            message.sentAt,
                        );
                    },
                    () => {
                        console.error(`Failed to decrypt message from ${message.from}`);
                    },
                );
            }
            // Acking "ok" makes the backend delete the queue.
            ack({ status: "ok" });
        };

        const handleMessageError = (payload: { error: string }) => {
            setError(payload.error);
        };

        const handleFriendIncoming = (payload: { from: string }) => {
            setIncomingRequests((prev) =>
                prev.includes(payload.from) ? prev : [...prev, payload.from],
            );
        };

        const handleFriendAccepted = (payload: { by: string }) => {
            // Someone accepted a request we sent. (When *we* accept, the
            // backend never tells us — acceptRequest() handles that side
            // optimistically.)
            setFriends((prev) =>
                prev.includes(payload.by) ? prev : [...prev, payload.by],
            );
            setOutgoingRequests((prev) =>
                prev.filter((r) => r !== payload.by),
            );
            setIncomingRequests((prev) =>
                prev.filter((r) => r !== payload.by),
            );
            if (lastOpRef.current?.username === payload.by) {
                lastOpRef.current = null;
            }
        };

        const handleFriendRejected = (payload: { by: string }) => {
            setOutgoingRequests((prev) =>
                prev.filter((r) => r !== payload.by),
            );
            if (lastOpRef.current?.username === payload.by) {
                lastOpRef.current = null;
            }
        };

        const handleFriendError = (payload: { error: string }) => {
            setError(payload.error);
            const op = lastOpRef.current;
            if (!op) return;
            const err = payload.error.toLowerCase();
            const matches =
                op.kind === "accept"
                    ? err.includes("accept")
                    : err.includes("send") ||
                      err.includes("does not exist") ||
                      err.includes("not found");
            if (!matches) return;
            // Best-effort revert of the optimistic change.
            if (op.kind === "accept") {
                setFriends((prev) => prev.filter((f) => f !== op.username));
                setIncomingRequests((prev) =>
                    prev.includes(op.username)
                        ? prev
                        : [...prev, op.username],
                );
            } else {
                setOutgoingRequests((prev) =>
                    prev.filter((r) => r !== op.username),
                );
            }
            lastOpRef.current = null;
        };

        const handlePublicKeyError = (payload: { error: string }) => {
            setError(payload.error);
            keyPairRef.current = null;
        };

        // --- Inbox drain failure: retry by reconnecting ---
        let inboxDrainFailures = 0;
        let lastInboxDrainErrorAt = 0;
        let retryTimer: ReturnType<typeof setTimeout> | null = null;

        const handleServerError = (payload: { message: string }) => {
            if (payload?.message !== INBOX_DRAIN_ERROR_MESSAGE) return;
            const now = Date.now();
            if (now - lastInboxDrainErrorAt > INBOX_RETRY_BUDGET_RESET_MS) {
                inboxDrainFailures = 0;
            }
            lastInboxDrainErrorAt = now;
            if (inboxDrainFailures >= MAX_INBOX_DRAIN_RETRIES) {
                setError(
                    "Couldn't load offline messages after several attempts. Reload the page to try again.",
                );
                return;
            }
            inboxDrainFailures += 1;
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = setTimeout(() => {
                socket.disconnect();
                socket.connect();
            }, INBOX_RETRY_DELAY_MS);
        };

        socket.on("message:incoming", handleMessageIncoming);
        socket.on("inbox:incoming", handleInboxIncoming);
        socket.on("message:error", handleMessageError);
        socket.on("error", handleServerError);
        socket.on("friend:incoming", handleFriendIncoming);
        socket.on("friend:accepted", handleFriendAccepted);
        socket.on("friend:rejected", handleFriendRejected);
        socket.on("friend:error", handleFriendError);
        socket.on("public-key:error", handlePublicKeyError);
        socket.emit("inbox:ready");
        return () => {
            socket.off("message:incoming", handleMessageIncoming);
            socket.off("inbox:incoming", handleInboxIncoming);
            socket.off("message:error", handleMessageError);
            socket.off("error", handleServerError);
            socket.off("friend:incoming", handleFriendIncoming);
            socket.off("friend:accepted", handleFriendAccepted);
            socket.off("friend:rejected", handleFriendRejected);
            socket.off("friend:error", handleFriendError);
            socket.off("public-key:error", handlePublicKeyError);
            if (retryTimer) clearTimeout(retryTimer);
        };
    }, [socket]);

    const sendFriendRequest = useCallback(
        (to: string) => {
            setOutgoingRequests((prev) =>
                prev.includes(to) ? prev : [...prev, to],
            );
            lastOpRef.current = { kind: "request", username: to };
            socket.emit("friend:request", { to });
        },
        [socket],
    );

    const acceptRequest = useCallback(
        (from: string) => {
            // The backend emits `friend:accepted` only to the requester,
            // never back to us, so adding the friend optimistically is the
            // only way the UI reflects the accept.
            setIncomingRequests((prev) => prev.filter((r) => r !== from));
            setFriends((prev) =>
                prev.includes(from) ? prev : [...prev, from],
            );
            lastOpRef.current = { kind: "accept", username: from };
            socket.emit("friend:accept", { from });
        },
        [socket],
    );

    const declineRequest = useCallback(
        (from: string) => {
            setIncomingRequests((prev) => prev.filter((r) => r !== from));
            // NOTE: the backend declares `friend:decline` in its socket
            // contract but has no handler for it yet, so this emit is a
            // no-op server-side. We still remove the request locally so the
            // UI matches the user's intent; see README.
            socket.emit("friend:decline", { from });
        },
        [socket],
    );

    const openChat = useCallback((peer: string | null) => {
        // A manual open (or back) takes control: never auto-open over the
        // user again on this mount.
        autoOpenedRef.current = true;
        setActivePeer(peer);
    }, []);

    const send = useCallback(
        (to: string, plaintext: string) => {
            if (plaintext.length > MAX_MESSAGE_LENGTH) {
                setError(
                    `Messages must be ${MAX_MESSAGE_LENGTH.toLocaleString()} characters or fewer.`,
                );
                return;
            }
            // Encrypt the message before sending
            if (!keyPairRef.current) {
                setError("Encryption keys not initialized");
                return;
            }

            const sendEncrypted = (recipientPublicKey: string) => {
                try {
                    const { cipherText, nonce } = encryptMessage(
                        plaintext,
                        recipientPublicKey,
                        keyPairRef.current!.secretKey,
                    );

                    // Render the outgoing message optimistically with plaintext.
                    // The backend's `message:send` handler never invokes its ack callback
                    // (it only emits `message:error` on failure and never echoes to the
                    // sender), so waiting for the ack would mean your own messages
                    // never appear in the conversation.
                    const id = createId();
                    setMessages((prev) => [
                        ...prev,
                        {
                            id,
                            peer: to,
                            direction: "outgoing",
                            text: plaintext,
                            cipherText,
                            nonce,
                            receivedAt: Date.now(),
                        },
                    ]);

                    socket.emit(
                        "message:send",
                        {
                            to,
                            encryptedPayload: { cipherText, nonce },
                        },
                        (ack) => {
                            if (ack?.status === "ok") {
                                // Server confirmed receipt — mark the message as acknowledged.
                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === id ? { ...m, acked: true } : m,
                                    ),
                                );
                            } else if (ack?.status === "error") {
                                // Send failed — drop the optimistic message so a send
                                // error doesn't leave a phantom message behind.
                                setMessages((prev) =>
                                    prev.filter((m) => m.id !== id),
                                );
                                setError("Failed to send message");
                            }
                        },
                    );
                } catch (err) {
                    setError(
                        `Failed to encrypt message: ${err instanceof Error ? err.message : String(err)}`,
                    );
                }
            };

            fetchPublicKeyRef.current(to)
                .then(sendEncrypted)
                .catch((err) => {
                    setError(err instanceof Error ? err.message : String(err));
                });
        },
        [socket],
    );

    const clearError = useCallback(() => setError(null), []);

    // Keep the account's keypair across logout/login so the cryptographic
    // identity remains stable. Only clear the in-memory cache; do not delete
    // the persisted keypair from localStorage on a username change.
    useEffect(() => {
        const cache = publicKeysCacheRef.current;
        return () => {
            keyPairRef.current = null;
            cache.clear();
        };
    }, [username]);

    const conversationMessages = useMemo(
        () =>
            activePeer
                ? messages.filter((m) => m.peer === activePeer)
                : [],
        [activePeer, messages],
    );

    const lastMessageFor = useCallback(
        (peer: string) =>
            [...messages].reverse().find((m) => m.peer === peer),
        [messages],
    );

    return {
        friends,
        incomingRequests,
        outgoingRequests,
        activePeer,
        openChat,
        conversationMessages,
        send,
        lastMessageFor,
        sendFriendRequest,
        acceptRequest,
        declineRequest,
        error,
        clearError,
    };
}
