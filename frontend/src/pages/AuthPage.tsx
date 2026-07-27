import { FormEvent, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";

type Mode = "login" | "register";

const PASSWORD_HINT =
  "At least 8 characters, with uppercase, lowercase, a number, and a symbol.";

function passwordStrengthError(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include a number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include a symbol.";
  return null;
}

function PasswordInput({
  id,
  visible,
  onToggleVisible,
  ...props
}: Omit<ComponentProps<typeof Input>, "type"> & {
  visible: boolean;
  onToggleVisible: () => void;
}) {
  return (
    <div className="relative">
      <Input id={id} type={visible ? "text" : "password"} className="pr-10" {...props} />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex items-center px-3 text-parsel-muted hover:text-parsel-text"
        onClick={onToggleVisible}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-controls={id}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function AuthPage({ mode }: { mode: Mode }) {
  const { isAuthenticated, login, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

    if (isRegister) {
      const strengthError = passwordStrengthError(password);
      if (strengthError) {
        setError(strengthError);
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isRegister) {
        await register(username.trim(), email.trim(), password, confirmPassword);
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
    <div className="relative flex min-h-dvh flex-col bg-parsel-canvas text-parsel-text">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <Link
          to="/"
          className="text-sm font-semibold uppercase tracking-[0.08em] text-parsel-primary hover:underline"
        >
          Parsel
        </Link>
        <ThemeToggle />
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-none border border-parsel-border bg-parsel-surface p-6 shadow-none">
          <div className="mb-6">
            <p className="text-[28px] font-semibold uppercase tracking-[0.08em] text-parsel-primary">
              Parsel
            </p>
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
                <PasswordInput
                  id="password"
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  required
                  minLength={isRegister ? 8 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  visible={showPassword}
                  onToggleVisible={() => setShowPassword((v) => !v)}
                />
                {isRegister ? (
                  <p className="mt-1.5 text-xs text-parsel-muted">{PASSWORD_HINT}</p>
                ) : null}
              </Field>
              {isRegister ? (
                <Field>
                  <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
                  <PasswordInput
                    id="confirm-password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    visible={showConfirmPassword}
                    onToggleVisible={() => setShowConfirmPassword((v) => !v)}
                  />
                </Field>
              ) : null}
            </FieldGroup>

            {error ? (
              <p className="rounded-none bg-parsel-danger-bg px-3 py-2 text-sm text-parsel-danger-text">
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
          <p className="mt-3 text-center text-sm text-parsel-muted">
            <Link className="font-medium text-parsel-primary hover:underline" to="/">
              ← Back to home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
