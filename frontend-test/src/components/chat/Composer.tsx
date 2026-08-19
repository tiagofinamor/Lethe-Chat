"use client";

import { useState, type FormEvent } from "react";

interface ComposerProps {
    peer: string;
    onSend: (to: string, text: string) => void;
}

export function Composer({ peer, onSend }: ComposerProps) {
    const [text, setText] = useState("");

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const trimmed = text.trim();
        if (!trimmed) return;
        onSend(peer, trimmed);
        setText("");
    };

    return (
        <form className="composer" onSubmit={handleSubmit}>
            <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Message @${peer}`}
                aria-label={`Message ${peer}`}
            />
            <button
                type="submit"
                className="btn btn-primary"
                disabled={!text.trim()}
            >
                Send
            </button>
        </form>
    );
}
