"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { MAX_MESSAGE_LENGTH } from "@/lib/validation";

interface ComposerProps {
    peer: string;
    onSend: (to: string, text: string) => void;
}

const EMOJIS_PER_PAGE = 40;

export function Composer({ peer, onSend }: ComposerProps) {
    const [text, setText] = useState("");
    const [emojiOpen, setEmojiOpen] = useState(false);
    const [emojis, setEmojis] = useState<string[]>([]);
    const [emojiPage, setEmojiPage] = useState(0);
    const [emojiLoadError, setEmojiLoadError] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const emojiControlRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!emojiOpen) return;

        const closeOnOutsideClick = (event: MouseEvent) => {
            if (
                emojiControlRef.current &&
                !emojiControlRef.current.contains(event.target as Node)
            ) {
                setEmojiOpen(false);
            }
        };

        document.addEventListener("mousedown", closeOnOutsideClick);
        return () => {
            document.removeEventListener("mousedown", closeOnOutsideClick);
        };
    }, [emojiOpen]);

    useEffect(() => {
        if (!emojiOpen || emojis.length > 0 || emojiLoadError) return;

        let cancelled = false;
        const loadEmojis = async () => {
            try {
                const response = await fetch("/emojis.txt");
                if (!response.ok) {
                    throw new Error(`Emoji catalog request failed (${response.status})`);
                }
                const catalog = (await response.text())
                    .split(/\r?\n/)
                    .map((emoji) => emoji.trim())
                    .filter(Boolean);
                if (!cancelled) setEmojis(catalog);
            } catch {
                if (!cancelled) setEmojiLoadError(true);
            }
        };

        void loadEmojis();
        return () => {
            cancelled = true;
        };
    }, [emojiOpen, emojis.length, emojiLoadError]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const trimmed = text.trim().slice(0, MAX_MESSAGE_LENGTH);
        if (!trimmed) return;
        onSend(peer, trimmed);
        setText("");
    };

    const addEmoji = (emoji: string) => {
        const input = inputRef.current;
        const start = input?.selectionStart ?? text.length;
        const end = input?.selectionEnd ?? text.length;
        const nextText =
            text.slice(0, start) + emoji + text.slice(end);
        if (nextText.length > MAX_MESSAGE_LENGTH) return;

        setText(nextText);
        requestAnimationFrame(() => {
            inputRef.current?.focus();
            const cursor = start + emoji.length;
            inputRef.current?.setSelectionRange(cursor, cursor);
        });
    };

    const pageCount = Math.ceil(emojis.length / EMOJIS_PER_PAGE);
    const pageEmojis = emojis.slice(
        emojiPage * EMOJIS_PER_PAGE,
        (emojiPage + 1) * EMOJIS_PER_PAGE,
    );

    return (
        <form
            className="composer"
            onSubmit={handleSubmit}
            onKeyDown={(e) => {
                if (e.key === "Escape") setEmojiOpen(false);
            }}
        >
            <div className="emoji-control" ref={emojiControlRef}>
                {emojiOpen && (
                    <div
                        id="emoji-picker"
                        className="emoji-picker"
                        role="dialog"
                        aria-label="Emoji picker"
                    >
                        {emojiLoadError ? (
                            <p className="emoji-status">
                                Unable to load emojis.
                            </p>
                        ) : emojis.length === 0 ? (
                            <p className="emoji-status">Loading emojis…</p>
                        ) : (
                            <>
                                <div className="emoji-grid">
                                    {pageEmojis.map((emoji, index) => (
                                        <button
                                            key={`${emoji}-${index}`}
                                            type="button"
                                            className="emoji-option"
                                            onClick={() => addEmoji(emoji)}
                                            aria-label={`Insert ${emoji}`}
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                                <div className="emoji-page-controls">
                                    <button
                                        type="button"
                                        className="emoji-page-button"
                                        onClick={() =>
                                            setEmojiPage((page) => Math.max(0, page - 1))
                                        }
                                        disabled={emojiPage === 0}
                                        aria-label="Previous emoji page"
                                    >
                                        ‹
                                    </button>
                                    <span>
                                        {emojiPage + 1} / {pageCount}
                                    </span>
                                    <button
                                        type="button"
                                        className="emoji-page-button"
                                        onClick={() =>
                                            setEmojiPage((page) =>
                                                Math.min(pageCount - 1, page + 1),
                                            )
                                        }
                                        disabled={emojiPage >= pageCount - 1}
                                        aria-label="Next emoji page"
                                    >
                                        ›
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
                <button
                    type="button"
                    className="emoji-toggle"
                    onClick={() => setEmojiOpen((open) => !open)}
                    aria-label="Open emoji picker"
                    aria-expanded={emojiOpen}
                    aria-controls="emoji-picker"
                >
                    😊
                </button>
            </div>
            <input
                ref={inputRef}
                value={text}
                onChange={(e) =>
                    setText(e.target.value.slice(0, MAX_MESSAGE_LENGTH))
                }
                placeholder={`Message @${peer}`}
                aria-label={`Message ${peer}`}
                maxLength={MAX_MESSAGE_LENGTH}
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
