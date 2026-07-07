"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, FOCUS_RING, Input, cn } from "@/components/ui";
import { Icon } from "@/components/icons";
import { ApiError, apiSend } from "@/lib/api/fetcher";

/**
 * Inline editor for an application's display name. The parent page is a server
 * component, so this holds the editing state and refreshes the route after a
 * successful rename to re-render the canonical app.
 */
export function EditApplicationName({
  appId,
  name,
}: {
  appId: string;
  name: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setDraft(name);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setDraft(name);
    setError(null);
  }

  async function save() {
    const next = draft.trim();
    if (!next || next === name) {
      cancel();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiSend("PATCH", `/api/admin/apps/${encodeURIComponent(appId)}`, {
        name: next,
      });
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to rename application");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5">
        <h1 className="text-xl font-semibold text-zinc-900">{name}</h1>
        <button
          type="button"
          onClick={startEditing}
          aria-label="Rename application"
          title="Rename"
          className={cn(
            "rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700",
            FOCUS_RING,
          )}
        >
          <Icon name="pencil" size={15} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <Input
          aria-label="Application name"
          value={draft}
          autoFocus
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void save();
            } else if (e.key === "Escape") {
              cancel();
            }
          }}
          className="h-9 w-64"
        />
        <Button size="sm" onClick={save} disabled={busy || !draft.trim()}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button variant="ghost" size="sm" onClick={cancel} disabled={busy}>
          Cancel
        </Button>
      </div>
      {error ? (
        <div className="mt-2">
          <Alert>{error}</Alert>
        </div>
      ) : null}
    </div>
  );
}
