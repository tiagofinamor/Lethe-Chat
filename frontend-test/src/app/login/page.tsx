"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
    const { status } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (status === "authenticated") {
            router.replace("/chat");
        }
    }, [status, router]);

    if (status === "loading") {
        return <p className="boot">Loading…</p>;
    }

    return <LoginForm />;
}
