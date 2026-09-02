/**
 * Type-level mirror of the backend's Socket.IO contract
 * (see backend/src/sockets/index.ts and backend/src/sockets/handlers/*).
 * Keep in sync with the backend.
 */

export interface SendMessagePayload {
    to: string;
    encryptedPayload: {
        cipherText: string;
        nonce: string;
    };
}

export interface IncomingMessagePayload {
    from: string;
    encryptedPayload: {
        cipherText: string;
        nonce: string;
    };
    /** Server-side timestamp (ISO string when deserialized from JSON). */
    sentAt?: string;
}

/** Payload of the `inbox:incoming` event: all queued messages, oldest first. */
export type InboxMessagePayload = IncomingMessagePayload[];

export interface AckResult {
    status: "ok" | "error";
}

export interface ErrorPayload {
    error: string;
}

export interface FriendRequestPayload {
    to: string;
}

/** Payload of `friend:accept` / `friend:decline`: the user who sent the request. */
export interface FriendResponsePayload {
    from: string;
}

export interface FriendIncomingPayload {
    from: string;
}

/** Someone accepted a request we sent; `by` is the user who accepted. */
export interface FriendAcceptedPayload {
    by: string;
}

/** Someone rejected a request we sent; `by` is the user who rejected. */
export interface FriendRejectedPayload {
    by: string;
}

/** Generic server error event, e.g. `{ message: "Failed to drain inbox." }`. */
export interface ServerErrorPayload {
    message: string;
}

export interface PublicKeyRequestPayload {
    username: string;
}

export interface PublicKeyResponsePayload {
    username: string;
    publicKey: string | null;
}

export interface ServerToClientEvents {
    "message:incoming": (
        payload: IncomingMessagePayload,
        ack: (result: AckResult) => void,
    ) => void;
    "inbox:incoming": (
        payload: InboxMessagePayload,
        ack: (result: AckResult) => void,
    ) => void;
    "message:error": (payload: ErrorPayload) => void;
    "error": (payload: ServerErrorPayload) => void;
    "friend:incoming": (payload: FriendIncomingPayload) => void;
    "friend:accepted": (payload: FriendAcceptedPayload) => void;
    "friend:rejected": (payload: FriendRejectedPayload) => void;
    "friend:error": (payload: ErrorPayload) => void;
    "public-key:response": (payload: PublicKeyResponsePayload) => void;
    "public-key:error": (payload: ErrorPayload) => void;
}

export interface ClientToServerEvents {
    "message:send": (
        payload: SendMessagePayload,
        ack: (result: AckResult) => void,
    ) => void;
    "friend:request": (payload: FriendRequestPayload) => void;
    "friend:accept": (payload: FriendResponsePayload) => void;
    "friend:decline": (payload: FriendResponsePayload) => void;
    "inbox:ready": () => void;
    "public-key:register": (payload: { publicKey: string }) => void;
    "public-key:get": (payload: PublicKeyRequestPayload) => void;
}
