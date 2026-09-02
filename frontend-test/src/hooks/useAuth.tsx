"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";
import { api } from "@/lib/api";
import { destroySocket, getSocket } from "@/lib/socket";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
    status: AuthStatus;
    /** The signed-in username, or null. Persisted in localStorage because the backend never returns it. */
    username: string | null;
    login: (username: string, password: string) => Promise<void>;
    signup: (username: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
}

const USERNAME_KEY = "lethe-chat.username";
const UNAUTHORIZED = "Unauthorized"; // socket.io handshake rejection from the backend
const NO_SESSION = "without a session";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [username, setUsername] = useState<string | null>(() => {
        if (typeof window === "undefined") return null;
        return window.localStorage.getItem(USERNAME_KEY);
    });
    // Without a stored username there is nothing to probe — go straight to
    // the login page. With one, we start "loading" until the socket probe
    // below resolves.
    const [status, setStatus] = useState<AuthStatus>(() =>
        typeof window !== "undefined" &&
        window.localStorage.getItem(USERNAME_KEY)
            ? "loading"
            : "unauthenticated",
    );

    // Probe the session on mount: the backend accepts the Socket.IO handshake
    // only when a valid session cookie is present. There is no "who am I?"
    // endpoint, so this is the only way to detect a live session.
    useEffect(() => {
        if (!username) return;

        const socket = getSocket();
        let disposed = false;

        const handleConnect = () => {
            if (!disposed) setStatus("authenticated");
        };

        const handleConnectError = (err: Error) => {
            if (disposed) return;
            if (
                err.message === UNAUTHORIZED ||
                err.message.toLowerCase().includes(NO_SESSION)
            ) {
                // Session expired/cleared server-side — drop the stale local identity.
                socket.disconnect();
                window.localStorage.removeItem(USERNAME_KEY);
                setUsername(null);
                setStatus("unauthenticated");
            }
            // Any other connect_error (backend down, etc.) keeps status
            // "loading"; socket.io retries automatically.
        };

        socket.on("connect", handleConnect);
        socket.on("connect_error", handleConnectError);
        socket.connect();

        return () => {
            disposed = true;
            socket.off("connect", handleConnect);
            socket.off("connect_error", handleConnectError);
        };
    }, [username]);

    const login = useCallback(async (name: string, password: string) => {
        await api.login(name, password);
        window.localStorage.setItem(USERNAME_KEY, name);
        setUsername(name);
        setStatus("authenticated");
    }, []);

    const signup = useCallback(async (name: string, password: string) => {
        await api.signup(name, password);
        window.localStorage.setItem(USERNAME_KEY, name);
        setUsername(name);
        setStatus("authenticated");
    }, []);

    const signOut = useCallback(async () => {
        try {
            await api.logout();
        } catch (error) {
            console.warn("Logout request failed; clearing local session anyway.", error);
        }

        destroySocket();
        window.localStorage.removeItem(USERNAME_KEY);
        setUsername(null);
        setStatus("unauthenticated");
    }, []);

    return (
        <AuthContext.Provider value={{ status, username, login, signup, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return ctx;
}
