"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Textarea,
} from "@/components/ui";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { ApiError, apiSend } from "@/lib/api/fetcher";
import { timeAgo } from "@/lib/format";
import type { Message } from "@/lib/svix/types";

export function MessagesView({ appId }: { appId: string }) {
  const base = `/api/admin/apps/${encodeURIComponent(appId)}/messages`;
  const { items, done, loading, error, loadMore, reload } =
    usePaginatedList<Message>(base);
  const [sending, setSending] = useState(false);

  return (
    <div>
      <Link
        href={`/console/applications/${encodeURIComponent(appId)}`}
        className="text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Application
      </Link>

      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Deliveries</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Messages sent to this application and their delivery attempts.
          </p>
        </div>
        <Button onClick={() => setSending((v) => !v)}>
          {sending ? "Cancel" : "Send test message"}
        </Button>
      </div>

      {sending ? (
        <SendMessageForm
          base={base}
          onSent={() => {
            setSending(false);
            reload();
          }}
        />
      ) : null}

      {error ? <div className="mt-4"><Alert>{error}</Alert></div> : null}

      <Card className="mt-4 overflow-hidden">
        {items.length === 0 && !loading && !error ? (
          <div className="p-6">
            <EmptyState
              title="No messages yet"
              description="Send a test message or trigger an event to see deliveries here."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2 font-medium">Event type</th>
                <th className="px-4 py-2 font-medium">Event ID</th>
                <th className="px-4 py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {items.map((m) => (
                <tr key={m.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/console/applications/${encodeURIComponent(appId)}/messages/${encodeURIComponent(m.id)}`}
                      className="font-mono text-zinc-900 hover:underline"
                    >
                      {m.eventType}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                    {m.eventId ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    <time dateTime={m.timestamp} title={new Date(m.timestamp).toLocaleString()}>
                      {timeAgo(m.timestamp)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>

      {!done && items.length > 0 ? (
        <div className="mt-4 text-center">
          <Button variant="secondary" size="sm" onClick={loadMore}>
            Load more
          </Button>
        </div>
      ) : null}

      {items.length > 0 ? (
        <p className="mt-2 text-right">
          <Badge>{items.length} loaded</Badge>
        </p>
      ) : null}
    </div>
  );
}

function SendMessageForm({ base, onSent }: { base: string; onSent: () => void }) {
  const [eventType, setEventType] = useState("");
  const [payload, setPayload] = useState('{\n  "hello": "world"\n}');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(payload);
    } catch {
      setError("Payload must be valid JSON.");
      return;
    }

    setSubmitting(true);
    try {
      await apiSend("POST", base, { eventType, payload: parsed });
      onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mt-4 p-5">
      <form onSubmit={onSubmit}>
        {error ? <div className="mb-4"><Alert>{error}</Alert></div> : null}
        <Field label="Event type" htmlFor="msg-event-type">
          <Input
            id="msg-event-type"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            placeholder="invoice.paid"
            className="font-mono"
            required
          />
        </Field>
        <Field label="Payload (JSON)" htmlFor="msg-payload">
          <Textarea
            id="msg-payload"
            rows={6}
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={submitting || !eventType.trim()}>
            {submitting ? "Sending…" : "Send message"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
