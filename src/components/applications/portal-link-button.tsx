"use client";

import { useState } from "react";
import { Alert, Button, Card, Input } from "@/components/ui";
import { ApiError, apiSend } from "@/lib/api/fetcher";

export function PortalLinkButton({ appId }: { appId: string }) {
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
        link: string | null;
      }>("POST", `/api/admin/apps/${encodeURIComponent(appId)}/portal-link`, {});
      // Prefer a server-built link (set only when SVIX_UI_PUBLIC_URL is
      // configured); otherwise build it from this browser's origin, which is
      // the host the operator — and the customer — actually use.
      const query = new URLSearchParams({
        token: res.token,
        app: res.app,
        exp: String(res.exp),
      }).toString();
      setLink(res.link ?? `${window.location.origin}/portal/launch?${query}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to create link");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      // Clipboard may be unavailable; the link is still selectable.
    }
  }

  return (
    <Card className="mt-6 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Consumer App Portal</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Generate a magic link your customer opens to self-serve their
            endpoints, secret, subscriptions, and replays.
          </p>
        </div>
        <Button size="sm" onClick={generate} disabled={busy}>
          {busy ? "Creating…" : "Create portal link"}
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
