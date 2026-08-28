"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { credentialsSchema } from "@/lib/validation";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

type FieldErrors = Partial<Record<"username" | "password", string>>;

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
    const { login, signup } = useAuth();
    const router = useRouter();
    const isLogin = mode === "login";

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setFormError(null);

        const parsed = credentialsSchema.safeParse({ username, password });
        if (!parsed.success) {
            const errors: FieldErrors = {};
            for (const issue of parsed.error.issues) {
                const field = issue.path[0];
                if (field === "username" || field === "password") {
                    errors[field] = issue.message;
                }
            }
            setFieldErrors(errors);
            return;
        }
        setFieldErrors({});

        setSubmitting(true);
        try {
            const action = isLogin ? login : signup;
            await action(parsed.data.username, parsed.data.password);
            router.replace("/chat");
        } catch (err) {
            setFormError(
                err instanceof ApiError
                    ? err.message
                    : "Something went wrong. Please try again.",
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="auth-shell">
            <main className="auth-card">
                <div className="auth-wordmark">
                    <Image
                        className="brand-logo"
                        src="/logo.svg"
                        alt="Lethe Chat"
                        width={200}
                        height={64}
                    />
                    <p className="subtitle">
                        {isLogin
                            ? "Welcome back — sign in to continue"
                            : "Create an account to start chatting"}
                    </p>
                </div>

                {formError && (
                    <p className="form-error" role="alert">
                        {formError}
                    </p>
                )}

                <form onSubmit={onSubmit} noValidate>
                    <div className="field">
                        <label htmlFor="username">Username</label>
                        <input
                            id="username"
                            name="username"
                            autoComplete="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="4–12 characters: letters, numbers, _ or -"
                            aria-invalid={fieldErrors.username ? true : undefined}
                        />
                        {fieldErrors.username && (
                            <p className="field-error" role="alert">
                                {fieldErrors.username}
                            </p>
                        )}
                    </div>

                    <div className="field">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete={isLogin ? "current-password" : "new-password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="At least 8 characters"
                            aria-invalid={fieldErrors.password ? true : undefined}
                        />
                        {fieldErrors.password && (
                            <p className="field-error" role="alert">
                                {fieldErrors.password}
                            </p>
                        )}
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-block"
                        disabled={submitting}
                    >
                        {submitting
                            ? "Please wait…"
                            : isLogin
                              ? "Sign in"
                              : "Create account"}
                    </button>
                </form>

                <p className="auth-switch">
                    {isLogin ? (
                        <>
                            No account? <Link href="/signup">Create one</Link>
                        </>
                    ) : (
                        <>
                            Already have an account? <Link href="/login">Sign in</Link>
                        </>
                    )}
                </p>
            </main>
        </div>
    );
}
