"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { bootstrapAdmin, login } from "../../lib/api";
import { setStoredToken, setStoredUser } from "../../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await login({ email: email.trim(), password });
      setStoredToken(result.access_token);
      setStoredUser(result.user);
      router.replace("/");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  const onBootstrap = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedName || !trimmedEmail || !trimmedPassword) {
      setError("Enter name, email, and password to bootstrap the first admin.");
      return;
    }

    setBootstrapping(true);
    setError(null);
    try {
      await bootstrapAdmin({
        name: trimmedName,
        email: trimmedEmail,
        role: "admin",
        password: trimmedPassword,
      });
      const result = await login({ email: trimmedEmail, password: trimmedPassword });
      setStoredToken(result.access_token);
      setStoredUser(result.user);
      router.replace("/");
    } catch (err: any) {
      setError(err.message || "Bootstrap failed");
    } finally {
      setBootstrapping(false);
    }
  };

  return (
    <section className="auth-card">
      <div className="badge">Authentication</div>
      <h1>Sign In</h1>
      <p className="lede">
        Staff/Admin portal for borrowing operations, returns, and fine monitoring.
      </p>

      <form onSubmit={onSubmit} data-testid="login-form">
        <div>
          <label>Name</label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            data-testid="login-name"
            placeholder="Used only for first admin bootstrap"
          />
        </div>
        <div>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            data-testid="login-email"
            required
          />
        </div>
        <div>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            data-testid="login-password"
            required
          />
        </div>
        <button type="submit" data-testid="login-submit" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign In"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={onBootstrap}
          disabled={bootstrapping}
        >
          {bootstrapping ? "Creating..." : "Bootstrap Admin (First Run)"}
        </button>
      </form>

      {error && (
        <p className="notice" data-testid="error">
          {error}
        </p>
      )}
      <p className="footer">
        Customer/member self-login is disabled. First run: use Bootstrap Admin once.
      </p>
    </section>
  );
}
