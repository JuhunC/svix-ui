"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { ApiError, apiGet, apiSend } from "@/lib/api/fetcher";
import { formatDateTime } from "@/lib/format";
import { attemptStatus } from "@/lib/svix/status";
import type { Message, MessageAttempt } from "@/lib/svix/types";

export function MessageDetail({
  appId,
  msgId,
}: {
  appId: string;
  msgId: string;
}) {
  const appBase = `/api/admin/apps/${encodeURIComponent(appId)}`;
  const msgBase = `${appBase}/messages/${encodeURIComponent(msgId)}`;

  const [message, setMessage] = useState<Message | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMessage(await apiGet<Message>(msgBase));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "Failed to load message");
    }
  }, [msgBase]);

  useEffect(() => {
    // load() only updates state after an awaited fetch (no synchronous setState).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const attempts = usePaginatedList<MessageAttempt>(`${msgBase}/attempts`);
  const [resendingId, setResendingId] = useState<string | null>(null);

  async function resend(endpointId: string) {
    setResendingId(endpointId);
    try {
      await apiSend(
        "POST",
        `${msgBase}/endpoints/${encodeURIComponent(endpointId)}/resend`,
      );
      attempts.reload();
    } finally {
      setResendingId(null);
    }
  }

  return (
    <div>
      <Link
        href={`${"/console/applications/"}${encodeURIComponent(appId)}/messages`}
        className="text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Deliveries
      </Link>

      {loadError ? <div className="mt-4"><Alert>{loadError}</Alert></div> : null}

      {message ? (
        <>
          <div className="mt-2">
            <h1 className="font-mono text-lg text-zinc-900">{message.eventType}</h1>
            <p className="mt-1 text-xs text-zinc-500">
              {message.eventId ? `${message.eventId} · ` : ""}
              {formatDateTime(message.timestamp)}
            </p>
          </div>

          <Card className="mt-6 p-5">
            <h2 className="text-base font-semibold text-zinc-900">Payload</h2>
            <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-zinc-50 p-3 font-mono text-xs text-zinc-800">
              {JSON.stringify(message.payload, null, 2)}
            </pre>
          </Card>
        </>
      ) : null}

      <section className="mt-6">
        <h2 className="text-base font-semibold text-zinc-900">Delivery attempts</h2>
        {attempts.error ? (
          <div className="mt-3"><Alert>{attempts.error}</Alert></div>
        ) : null}
        <Card className="mt-3 overflow-hidden">
          {attempts.items.length === 0 && !attempts.loading ? (
            <p className="p-6 text-sm text-zinc-500">No attempts recorded.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Endpoint</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Code</th>
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {attempts.items.map((a) => {
                  const s = attemptStatus(a.status);
                  return (
                    <tr key={a.id}>
                      <td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-zinc-700">
                        {a.url}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={s.tone}>{s.label}</Badge>
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-700">
                        {a.responseStatusCode || "—"}
                        {a.responseDurationMs ? (
                          <span className="ml-1 text-xs text-zinc-400">
                            {a.responseDurationMs}ms
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {formatDateTime(a.timestamp)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => resend(a.endpointId)}
                          disabled={resendingId === a.endpointId}
                        >
                          {resendingId === a.endpointId ? "Resending…" : "Resend"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
        {!attempts.done && attempts.items.length > 0 ? (
          <div className="mt-3 text-center">
            <Button variant="secondary" size="sm" onClick={attempts.loadMore}>
              Load more
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
