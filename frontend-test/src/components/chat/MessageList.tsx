"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/hooks/useChat";
import { MessageBubble } from "./MessageBubble";

export function MessageList({ messages }: { messages: ChatMessage[] }) {
    const endRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ block: "end" });
    }, [messages.length]);

    return (
        <div
            className="messages"
            role="log"
            aria-live="polite"
            aria-label="Messages"
        >
            {messages.length === 0 && (
                <div className="empty-state">
                    <p>No messages yet. Say hello!</p>
                </div>
            )}
            {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={endRef} />
        </div>
    );
}
