"use client";

import { useState } from "react";
import { Alert, Button, Card, Input, cn } from "@/components/ui";
import { ApiError, apiSend } from "@/lib/api/fetcher";
import { copyToClipboard } from "@/lib/clipboard";

/**
 * Generates a consumer App Portal magic link for an application. When `to` is
 * set (a portal path such as `/portal/endpoints/ep_123`), the launch link deep
 * links the customer straight to that page — e.g. a single endpoint's settings.
 */
export function PortalLinkButton({
  appId,
  to,
  title = "Consumer App Portal",
  description = "Generate a magic link your customer opens to self-serve their endpoints, secret, subscriptions, and replays.",
  buttonLabel = "Create portal link",
  className,
}: {
  appId: string;
  to?: string;
  title?: string;
  description?: string;
  buttonLabel?: string;
  className?: string;
}) {
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const res = await apiSend<{
        token: string;
        app: string;
        exp: number;
        to: string | null;
        link: string | null;
      }>("POST", `/api/admin/apps/${encodeURIComponent(appId)}/portal-link`, to ? { to } : {});
      // Prefer a server-built link (set only when SVIX_UI_PUBLIC_URL is
      // configured); otherwise build it from this browser's origin, which is
      // the host the operator — and the customer — actually use.
      const query = new URLSearchParams({
        token: res.token,
        app: res.app,
        exp: String(res.exp),
      });
      if (res.to) query.set("to", res.to);
      setLink(res.link ?? `${window.location.origin}/portal/launch?${query.toString()}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to create link");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    // Works over plain HTTP too (navigator.clipboard is unavailable there).
    const ok = await copyToClipboard(link);
    setCopied(ok);
  }

  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        </div>
        <Button size="sm" onClick={generate} disabled={busy}>
          {busy ? "Creating…" : buttonLabel}
        </Button>
      </div>

      {error ? <div className="mt-3"><Alert>{error}</Alert></div> : null}

      {link ? (
        <div className="mt-3 flex gap-2">
          <Input readOnly value={link} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
          <Button variant="secondary" size="sm" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
