"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { ApiError, apiSend } from "@/lib/api/fetcher";

export function DeleteApplicationButton({ appId }: { appId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!confirm("Delete this application and all of its endpoints and messages?")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiSend("DELETE", `/api/admin/apps/${encodeURIComponent(appId)}`);
      router.push("/console/applications");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to delete");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="danger" size="sm" onClick={remove} disabled={busy}>
        {busy ? "Deleting…" : "Delete"}
      </Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
