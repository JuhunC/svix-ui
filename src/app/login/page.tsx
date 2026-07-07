"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, Button, Card, Field, Input, Spinner } from "@/components/ui";
import { BrandMark } from "@/components/dashboard-shell";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        router.push("/console");
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Login failed");
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-canvas px-4 py-16">
      <Card className="w-full max-w-sm p-7">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3">
            <BrandMark size="lg" />
          </span>
          <h1 className="text-lg font-semibold text-zinc-900">svix-ui</h1>
          <p className="text-sm text-zinc-500">Sign in to the operator console</p>
        </div>
        <form onSubmit={onSubmit}>
          {error ? (
            <div className="mb-4">
              <Alert>{error}</Alert>
            </div>
          ) : null}
          <Field label="Username" htmlFor="username">
            <Input
              id="username"
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Spinner className="border-white/40 border-t-white" /> : null}
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="mt-5 border-t border-zinc-100 pt-4 text-center text-sm text-zinc-500">
          Integrating with these webhooks?{" "}
          <a href="/guide" className="text-accent hover:underline">
            Read the webhook guide
          </a>
          .
        </p>
      </Card>
    </main>
  );
}
