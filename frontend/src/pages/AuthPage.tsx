import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";

type Mode = "login" | "register";

export function AuthPage({ mode }: { mode: Mode }) {
  const { isAuthenticated, login, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    const next = searchParams.get("next") || "/overview";
    return <Navigate to={next} replace />;
  }

  const isRegister = mode === "register";
  const title = isRegister ? "Create account" : "Sign in";
  const submitLabel = isRegister ? "Register" : "Sign in";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isRegister) {
        await register(username.trim(), email.trim(), password);
      } else {
        await login(loginId.trim(), password);
      }
      const next = searchParams.get("next") || "/overview";
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-parsel-canvas px-4 py-10 text-parsel-text">
      <div className="w-full max-w-md rounded-xl border border-parsel-border bg-parsel-surface p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-[28px] font-semibold tracking-tight text-parsel-primary">Parsel</p>
          <h1 className="mt-1 text-xl font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-parsel-muted">
            {isRegister
              ? "Pick a username, email, and password to create your account."
              : "Sign in with your username or email, and password."}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <FieldGroup>
            {isRegister ? (
              <>
                <Field>
                  <FieldLabel htmlFor="username">Username</FieldLabel>
                  <Input
                    id="username"
                    type="text"
                    autoComplete="username"
                    required
                    minLength={3}
                    maxLength={32}
                    pattern="[A-Za-z0-9_]{3,32}"
                    title="3–32 characters: letters, numbers, and underscores"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
              </>
            ) : (
              <Field>
                <FieldLabel htmlFor="login">Username or email</FieldLabel>
                <Input
                  id="login"
                  type="text"
                  autoComplete="username"
                  required
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                required
                minLength={isRegister ? 8 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
          </FieldGroup>

          {error ? (
            <p className="rounded-md bg-parsel-danger-bg px-3 py-2 text-sm text-parsel-danger-text">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Please wait…" : submitLabel}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-parsel-muted">
          {isRegister ? (
            <>
              Already have an account?{" "}
              <Link className="font-medium text-parsel-primary hover:underline" to="/login">
                Sign in
              </Link>
            </>
          ) : (
            <>
              Need an account?{" "}
              <Link className="font-medium text-parsel-primary hover:underline" to="/register">
                Register
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
