"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { ChatView } from "@/components/chat/ChatView";

export default function ChatPage() {
    const { status, username } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (status === "unauthenticated") {
            router.replace("/signup");
        }
    }, [status, router]);

    if (status !== "authenticated" || !username) {
        return <p className="boot">Loading…</p>;
    }

    return <ChatView username={username} />;
}
