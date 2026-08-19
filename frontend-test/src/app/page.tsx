"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
    const { status } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (status === "authenticated") {
            router.replace("/chat");
        } else if (status === "unauthenticated") {
            router.replace("/signup");
        }
    }, [status, router]);

    return <p className="boot">Loading…</p>;
}
