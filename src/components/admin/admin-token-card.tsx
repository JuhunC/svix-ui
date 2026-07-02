"use client";

import { useState } from "react";
import { Alert, Button, Card } from "@/components/ui";
import { Icon } from "@/components/icons";
import { ApiError, apiGet } from "@/lib/api/fetcher";
import { copyToClipboard } from "@/lib/clipboard";

/**
 * Reveals and copies the privileged Svix admin token for the authenticated
 * operator. The token is fetched on demand (masked until "Reveal") and copied
 * with a plain-HTTP-safe clipboard helper.
 */
export function AdminTokenCard() {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function reveal() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiGet<{ token: string; serverUrl: string }>(
        "/api/admin/token",
      );
      setToken(res.token);
      setServerUrl(res.serverUrl);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load token");
    } finally {
      setBusy(false);
    }
  }

  function hide() {
    setToken(null);
    setServerUrl(null);
    setCopied(false);
  }

  async function copy() {
    if (!token) return;
    setCopied(await copyToClipboard(token));
  }

  return (
    <Card className="mt-6 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
          <Icon name="key" size={17} className="text-zinc-400" />
          Svix API token
        </h2>
        <div className="flex shrink-0 gap-2">
          {token === null ? (
            <Button variant="secondary" size="sm" onClick={reveal} disabled={busy}>
              {busy ? "Revealing…" : "Reveal"}
            </Button>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={hide}>
                Hide
              </Button>
              <Button variant="secondary" size="sm" onClick={copy}>
                <Icon name="copy" size={14} /> {copied ? "Copied" : "Copy"}
              </Button>
            </>
          )}
        </div>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        The admin token svix-ui uses to talk to svix-server. Copy it for direct
        API calls or SDK configuration.
      </p>

      {error ? (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <p className="mt-3 break-all rounded-md bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-800">
        {token ?? "•".repeat(48)}
      </p>
      {serverUrl ? (
        <p className="mt-2 text-xs text-zinc-500">
          Server URL: <code className="font-mono">{serverUrl}</code>
        </p>
      ) : null}

      <div className="mt-3">
        <Alert tone="info">
          This token has full access to every application on your svix-server —
          treat it like a password.
        </Alert>
      </div>
    </Card>
  );
}
