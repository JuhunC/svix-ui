"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Spinner } from "@/components/ui";
import { Icon } from "@/components/icons";
import { AttemptRow } from "@/components/endpoints/endpoint-detail";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { ApiError, apiGet, apiSend } from "@/lib/api/fetcher";
import { formatDateTime } from "@/lib/format";
import type { Message, MessageAttempt } from "@/lib/svix/types";

/**
 * Master-detail message view, shared by the console and the consumer portal.
 * `messagePath` resolves the message + its attempts; `resendPath` builds the
 * per-endpoint resend URL (the two surfaces use different route shapes).
 */
export function MessageDetailView({
  messagePath,
  resendPath,
  backHref,
}: {
  messagePath: string;
  resendPath: (endpointId: string) => string;
  backHref: string;
}) {
  const [message, setMessage] = useState<Message | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMessage(await apiGet<Message>(messagePath));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "Failed to load message");
    }
  }, [messagePath]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const attempts = usePaginatedList<MessageAttempt>(
    `${messagePath}/attempts?with_content=true`,
  );
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function resend(endpointId: string) {
    setResendingId(endpointId);
    try {
      await apiSend("POST", resendPath(endpointId));
      attempts.reload();
    } finally {
      setResendingId(null);
    }
  }

  return (
    <div>
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <Icon name="chevronRight" size={14} className="rotate-180" /> Back
      </Link>

      {loadError ? <div className="mt-4"><Alert>{loadError}</Alert></div> : null}

      {message ? (
        <>
          <div className="mt-2">
            <h1 className="font-mono text-lg text-zinc-900">{message.eventType}</h1>
            <p className="mt-1 text-xs text-zinc-500">
              {message.eventId ? `${message.eventId} · ` : ""}
              <span className="font-mono">{message.id}</span> ·{" "}
              {formatDateTime(message.timestamp)}
            </p>
            {message.channels && message.channels.length > 0 ? (
              <p className="mt-1 text-xs text-zinc-400">
                Channels: {message.channels.join(", ")}
              </p>
            ) : null}
          </div>

          <Card className="mt-6 p-5">
            <h2 className="text-base font-semibold text-zinc-900">Payload</h2>
            <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-zinc-50 p-3 font-mono text-xs text-zinc-800">
              {JSON.stringify(message.payload, null, 2)}
            </pre>
          </Card>
        </>
      ) : (
        <div className="mt-8 flex justify-center">
          {!loadError ? <Spinner /> : null}
        </div>
      )}

      <section className="mt-6">
        <h2 className="text-base font-semibold text-zinc-900">Delivery attempts</h2>
        {attempts.error ? (
          <div className="mt-3"><Alert>{attempts.error}</Alert></div>
        ) : null}
        <Card className="mt-3 overflow-hidden">
          {attempts.items.length === 0 && !attempts.loading ? (
            <p className="p-6 text-sm text-zinc-500">No attempts recorded.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {attempts.items.map((a) => (
                <AttemptRow
                  key={a.id}
                  attempt={a}
                  showEndpoint
                  expanded={expanded === a.id}
                  onToggle={() => setExpanded(expanded === a.id ? null : a.id)}
                  onResend={() => resend(a.endpointId)}
                  resending={resendingId === a.endpointId}
                />
              ))}
            </ul>
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
