"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { ConfirmDialog } from "@/components/overlay";
import { ApiError, apiSend } from "@/lib/api/fetcher";

export function DeleteApplicationButton({
  appId,
  appName,
}: {
  appId: string;
  appName?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await apiSend("DELETE", `/api/admin/apps/${encodeURIComponent(appId)}`);
      router.push("/console/applications");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to delete");
      setConfirming(false);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <ConfirmDialog
        open={confirming}
        title="Delete application"
        body={
          <>
            Delete{" "}
            <span className="font-semibold text-zinc-900">
              {appName ?? "this application"}
            </span>{" "}
            and <strong>all of its endpoints and messages</strong>? This cannot
            be undone.
          </>
        }
        confirmLabel="Delete application"
        busy={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={remove}
      />
      <Button
        variant="danger"
        size="sm"
        onClick={() => setConfirming(true)}
        disabled={busy}
      >
        {busy ? "Deleting…" : "Delete"}
      </Button>
      {error ? (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      ) : null}
    </div>
  );
}
