"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Select,
  Spinner,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { apiGet } from "@/lib/api/fetcher";
import { timeAgo } from "@/lib/format";
import type { EventType, ListResponse, Message } from "@/lib/svix/types";

const TIME_RANGES = [
  { key: "", label: "All time", hours: 0 },
  { key: "1h", label: "Last hour", hours: 1 },
  { key: "24h", label: "Last 24h", hours: 24 },
  { key: "7d", label: "Last 7 days", hours: 24 * 7 },
  { key: "30d", label: "Last 30 days", hours: 24 * 30 },
];

export function ActivityFeed({
  messagesPath,
  catalogPath,
  detailHref,
  title = "Activity",
  description = "Events sent to this application and how each delivery went.",
  lockedEventType,
  embedded = false,
}: {
  messagesPath: string;
  catalogPath: string;
  detailHref: (msgId: string) => string;
  title?: string;
  description?: string;
  /** Pin the feed to a single event type and hide its event-type filter. */
  lockedEventType?: string;
  /** Render compactly (no PageHeader) for embedding inside another page. */
  embedded?: boolean;
}) {
  const [eventType, setEventType] = useState(lockedEventType ?? "");
  const [channel, setChannel] = useState("");
  const [range, setRange] = useState("");
  const [afterIso, setAfterIso] = useState("");
  const [types, setTypes] = useState<EventType[]>([]);

  // Compute the cutoff in the handler (not in render/useMemo) so the request
  // path is stable between renders.
  function selectRange(key: string) {
    setRange(key);
    const hours = TIME_RANGES.find((r) => r.key === key)?.hours ?? 0;
    setAfterIso(
      hours > 0 ? new Date(Date.now() - hours * 3600 * 1000).toISOString() : "",
    );
  }

  useEffect(() => {
    let active = true;
    apiGet<ListResponse<EventType>>(`${catalogPath}?limit=250`)
      .then((r) => {
        if (active) setTypes(r.data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [catalogPath]);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (eventType) params.set("event_types", eventType);
    if (channel.trim()) params.set("channel", channel.trim());
    if (afterIso) params.set("after", afterIso);
    const qs = params.toString();
    return qs ? `${messagesPath}?${qs}` : messagesPath;
  }, [messagesPath, eventType, channel, afterIso]);

  const feed = usePaginatedList<Message>(path);

  return (
    <div>
      {!embedded ? <PageHeader title={title} description={description} /> : null}

      <Card className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-3">
          {!lockedEventType ? (
            <Filter label="Event type">
              <Select
                size="sm"
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
              >
                <option value="">All</option>
                {types.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Filter>
          ) : null}
          <Filter label="Channel">
            <input
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="any"
              className="h-8 w-32 rounded-md border border-zinc-300 bg-white px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-focus"
            />
          </Filter>
          <Filter label="Time">
            <Select
              size="sm"
              value={range}
              onChange={(e) => selectRange(e.target.value)}
            >
              {TIME_RANGES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Filter>
          {(!lockedEventType && eventType) || channel || range ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!lockedEventType) setEventType("");
                setChannel("");
                selectRange("");
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </Card>

      {feed.error ? <Alert>{feed.error}</Alert> : null}

      <Card className="overflow-hidden">
        {feed.items.length === 0 && !feed.loading && !feed.error ? (
          <div className="p-6">
            <EmptyState
              icon={<Icon name="activity" />}
              title="No activity"
              description="When events are sent, they'll show up here."
            />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {feed.items.map((m) => (
              <li key={m.id}>
                <Link
                  href={detailHref(m.id)}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-mono text-sm text-zinc-900">
                      {m.eventType}
                    </span>
                    {m.eventId ? (
                      <span className="truncate font-mono text-xs text-zinc-400">
                        {m.eventId}
                      </span>
                    ) : null}
                    {m.channels && m.channels.length > 0 ? (
                      <Badge tone="neutral">{m.channels.join(", ")}</Badge>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <time
                      dateTime={m.timestamp}
                      title={new Date(m.timestamp).toLocaleString()}
                      className="text-xs text-zinc-400"
                    >
                      {timeAgo(m.timestamp)}
                    </time>
                    <Icon name="chevronRight" size={14} className="text-zinc-300" />
                  </span>
                </Link>
              </li>
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

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-zinc-500">
      {label}
      {children}
    </label>
  );
}
