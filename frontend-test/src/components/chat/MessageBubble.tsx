"use client";

import type { ChatMessage } from "@/hooks/useChat";

function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function MessageBubble({ message }: { message: ChatMessage }) {
    return (
        <div
            className={`message ${message.direction === "outgoing" ? "outgoing" : ""}`}
        >
            <span>{message.text}</span>
            <span className="meta">
                {formatTime(message.receivedAt)}
                {message.direction === "outgoing" && (
                    <span
                        className={`ack-dot ${message.acked ? "ack-dot--ok" : "ack-dot--pending"}`}
                        aria-label={message.acked ? "Delivered" : "Sending…"}
                        title={message.acked ? "Delivered" : "Sending…"}
                    />
                )}
            </span>
        </div>
    );
}
