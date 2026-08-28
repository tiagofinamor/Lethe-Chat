"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import type { ChatMessage } from "@/hooks/useChat";
import { usernameSchema } from "@/lib/validation";

interface SidebarProps {
    username: string;
    friends: string[];
    incomingRequests: string[];
    outgoingRequests: string[];
    activePeer: string | null;
    onOpenChat: (peer: string) => void;
    onSendRequest: (to: string) => void;
    onAcceptRequest: (from: string) => void;
    onDeclineRequest: (from: string) => void;
    onSignOut: () => void;
    lastMessageFor: (peer: string) => ChatMessage | undefined;
}

interface FormMessage {
    text: string;
    tone: "ok" | "error";
}

export function Sidebar({
    username,
    friends,
    incomingRequests,
    outgoingRequests,
    activePeer,
    onOpenChat,
    onSendRequest,
    onAcceptRequest,
    onDeclineRequest,
    onSignOut,
    lastMessageFor,
}: SidebarProps) {
    const [newFriend, setNewFriend] = useState("");
    const [formMessage, setFormMessage] = useState<FormMessage | null>(null);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        const parsed = usernameSchema.safeParse(newFriend);
        if (!parsed.success) {
            setFormMessage({
                text: "Use 4–12 characters: letters, numbers, _ or -",
                tone: "error",
            });
            return;
        }
        const to = parsed.data;
        if (to === username) {
            setFormMessage({
                text: "You can't send a request to yourself",
                tone: "error",
            });
            return;
        }
        if (friends.includes(to)) {
            setFormMessage({
                text: `You're already friends with @${to}`,
                tone: "error",
            });
            return;
        }
        if (outgoingRequests.includes(to)) {
            setFormMessage({
                text: `A request to @${to} is already pending`,
                tone: "error",
            });
            return;
        }
        if (incomingRequests.includes(to)) {
            setFormMessage({
                text: `@${to} already sent you a request — accept it below`,
                tone: "error",
            });
            return;
        }
        // No optimistic success message here: the Pending section below is
        // the truthful confirmation (it appears on submit and is reverted
        // server-side on failure via friend:error), so a stale "sent" claim
        // can't sit next to an error banner.
        onSendRequest(to);
        setFormMessage(null);
        setNewFriend("");
    };

    return (
        <aside className="sidebar">
            <header className="sidebar-header">
                <Image
                    className="brand-logo"
                    src="/logo.svg"
                    alt="Lethe Chat"
                    width={200}
                    height={64}
                />
                <p className="signed-in">@{username}</p>
            </header>

            <form className="add-friend-form" onSubmit={handleSubmit}>
                <input
                    value={newFriend}
                    onChange={(e) => setNewFriend(e.target.value)}
                    placeholder="Send request to @username"
                    aria-label="Send a friend request"
                    autoComplete="off"
                />
                <button type="submit" className="btn btn-primary">
                    Request
                </button>
            </form>
            {formMessage && (
                <p
                    className={`form-message ${formMessage.tone}`}
                    role={formMessage.tone === "error" ? "alert" : "status"}
                >
                    {formMessage.text}
                </p>
            )}

            <div className="sidebar-scroll">
                {incomingRequests.length > 0 && (
                    <section
                        className="sidebar-section"
                        aria-label="Incoming friend requests"
                    >
                        <h2 className="sidebar-section-title">
                            Requests
                            <span className="badge">{incomingRequests.length}</span>
                        </h2>
                        {incomingRequests.map((from) => (
                            <div className="request-item" key={from}>
                                <span className="request-name">@{from}</span>
                                <div className="request-actions">
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={() => onAcceptRequest(from)}
                                    >
                                        Accept
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-ghost"
                                        onClick={() => onDeclineRequest(from)}
                                    >
                                        Decline
                                    </button>
                                </div>
                            </div>
                        ))}
                    </section>
                )}

                {outgoingRequests.length > 0 && (
                    <section
                        className="sidebar-section"
                        aria-label="Pending friend requests"
                    >
                        <h2 className="sidebar-section-title">Pending</h2>
                        {outgoingRequests.map((to) => (
                            <div className="request-item" key={to}>
                                <span className="request-name">@{to}</span>
                                <span className="pending-label">
                                    Request sent
                                </span>
                            </div>
                        ))}
                    </section>
                )}

                <nav className="sidebar-section" aria-label="Friends">
                    <h2 className="sidebar-section-title">Friends</h2>
                    {friends.length === 0 && (
                        <p className="sidebar-note">
                            No friends yet. Use the box above to send someone a
                            friend request — you can only chat once they accept.
                        </p>
                    )}
                    {friends.map((friend) => {
                        const last = lastMessageFor(friend);
                        return (
                            <button
                                type="button"
                                key={friend}
                                className={`friend-item ${friend === activePeer ? "active" : ""}`}
                                onClick={() => onOpenChat(friend)}
                            >
                                <span className="friend-name">@{friend}</span>
                                <span className="friend-preview">
                                    {last ? last.text : "No messages yet"}
                                </span>
                            </button>
                        );
                    })}
                </nav>
            </div>

            <footer className="sidebar-footer">
                <button
                    type="button"
                    className="btn btn-danger"
                    onClick={onSignOut}
                >
                    Sign out
                </button>
            </footer>
        </aside>
    );
}
