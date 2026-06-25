"use client";

import { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { ApiError, apiGet, apiSend } from "@/lib/api/fetcher";
import { formatDateTime, timeAgo } from "@/lib/format";
import { attemptStatus } from "@/lib/svix/status";
import type { ListResponse, Message, MessageAttempt } from "@/lib/svix/types";

export function PortalActivity() {
  const feed = usePaginatedList<Message>("/api/portal/messages");

  return (
    <div>
      <PageHeader
        title="Activity"
        description="Events sent to your application and how each delivery went."
      />

      {feed.error ? <Alert>{feed.error}</Alert> : null}

      <Card className="overflow-hidden">
        {feed.items.length === 0 && !feed.loading && !feed.error ? (
          <div className="p-6">
            <EmptyState
              icon={<Icon name="activity" />}
              title="No activity yet"
              description="When events are sent to your endpoints, they'll show up here."
            />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {feed.items.map((m) => (
              <MessageRow key={m.id} message={m} />
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-4 flex justify-center">
        {feed.loading ? (
          <Spinner />
        ) : !feed.done && feed.items.length > 0 ? (
          <Button variant="secondary" size="sm" onClick={feed.loadMore}>
            Load more
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function MessageRow({ message }: { message: Message }) {
  const [open, setOpen] = useState(false);
  const [attempts, setAttempts] = useState<MessageAttempt[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  async function loadAttempts() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<ListResponse<MessageAttempt>>(
        `/api/portal/messages/${encodeURIComponent(message.id)}/attempts`,
      );
      setAttempts(res.data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load attempts");
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && attempts === null) void loadAttempts();
  }

  async function resend(attemptId: string, endpointId: string) {
    setResendingId(attemptId);
    try {
      await apiSend(
        "POST",
        `/api/portal/endpoints/${encodeURIComponent(endpointId)}/messages/${encodeURIComponent(message.id)}/resend`,
      );
      await loadAttempts();
    } finally {
      setResendingId(null);
    }
  }

  return (
    <li>
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-50"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon
            name="chevronRight"
            size={14}
            className={`text-zinc-400 transition-transform ${open ? "rotate-90" : ""}`}
          />
          <span className="truncate font-mono text-sm text-zinc-900">
            {message.eventType}
          </span>
          {message.eventId ? (
            <span className="truncate font-mono text-xs text-zinc-400">
              {message.eventId}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-xs text-zinc-400">
          {timeAgo(message.timestamp)}
        </span>
      </button>

      {open ? (
        <div className="border-t border-zinc-100 bg-zinc-50/60 px-4 py-3">
          {loading ? (
            <Spinner />
          ) : error ? (
            <Alert>{error}</Alert>
          ) : attempts && attempts.length > 0 ? (
            <ul className="space-y-1">
              {attempts.map((a) => {
                const s = attemptStatus(a.status);
                return (
                  <li
                    key={a.id}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Badge tone={s.tone}>{s.label}</Badge>
                      <span className="truncate font-mono text-xs text-zinc-600">
                        {a.url}
                      </span>
                      <span className="font-mono text-xs text-zinc-400">
                        {a.responseStatusCode || "—"}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="text-xs text-zinc-400">
                        {formatDateTime(a.timestamp)}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resend(a.id, a.endpointId)}
                        disabled={resendingId === a.id}
                      >
                        {resendingId === a.id ? "…" : "Resend"}
                      </Button>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">No delivery attempts recorded.</p>
          )}

          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-zinc-500">
              Payload
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-white p-3 font-mono text-xs text-zinc-800 ring-1 ring-zinc-200">
              {JSON.stringify(message.payload, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}
    </li>
  );
}
