"use client";

import { useAuth } from "@/hooks/useAuth";
import { useChat } from "@/hooks/useChat";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";
import { Sidebar } from "./Sidebar";

export function ChatView({ username }: { username: string }) {
    const { signOut } = useAuth();
    const {
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
    } = useChat(username);

    // On mobile the sidebar and the chat pane are mutually exclusive; having
    // an active conversation switches the shell into "chat" mode (the back
    // button in the chat header clears it and returns to the sidebar).
    const chatOpen = activePeer !== null;
    // Chats can only be opened from the friends list, but guard anyway so a
    // stale activePeer can never unlock the composer for a non-friend.
    const isActiveFriend = activePeer !== null && friends.includes(activePeer);

    return (
        <div className={`chat-shell ${chatOpen ? "chat-open" : ""}`}>
            <Sidebar
                username={username}
                friends={friends}
                incomingRequests={incomingRequests}
                outgoingRequests={outgoingRequests}
                activePeer={activePeer}
                onOpenChat={openChat}
                onSendRequest={sendFriendRequest}
                onAcceptRequest={acceptRequest}
                onDeclineRequest={declineRequest}
                onSignOut={signOut}
                lastMessageFor={lastMessageFor}
            />

            <main className="main">
                {error && (
                    <div className="banner" role="alert">
                        <span>{error}</span>
                        <button type="button" onClick={clearError}>
                            Dismiss
                        </button>
                    </div>
                )}

                {isActiveFriend && activePeer ? (
                    <>
                        <header className="chat-header">
                            <button
                                type="button"
                                className="back-btn"
                                onClick={() => openChat(null)}
                                aria-label="Back to friends"
                            >
                                ‹
                            </button>
                            <span className="peer">@{activePeer}</span>
                        </header>
                        <MessageList messages={conversationMessages} />
                        <Composer peer={activePeer} onSend={send} />
                    </>
                ) : (
                    <div className="empty-state">
                        <h2>Select a friend</h2>
                        <p>
                            Send someone a friend request from the sidebar —
                            once they accept, you can start chatting here.
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}
