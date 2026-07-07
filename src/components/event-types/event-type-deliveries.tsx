"use client";

import { useEffect, useState } from "react";
import { Card, Select } from "@/components/ui";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { apiGet } from "@/lib/api/fetcher";
import type { Application, ListResponse } from "@/lib/svix/types";

/**
 * Recent deliveries of a single event type, in one place on the event-type
 * page. Event types are org-global but messages are per-application, so the
 * operator picks an application; the feed is pinned to this event type and
 * each message drills into its per-endpoint delivery attempts.
 */
export function EventTypeDeliveries({ eventType }: { eventType: string }) {
  const [apps, setApps] = useState<Application[] | null>(null);
  const [appId, setAppId] = useState("");

  useEffect(() => {
    let active = true;
    apiGet<ListResponse<Application>>("/api/admin/apps?limit=100")
      .then((page) => {
        if (!active) return;
        setApps(page.data);
        setAppId((cur) => cur || page.data[0]?.id || "");
      })
      .catch(() => {
        if (active) setApps([]);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-zinc-900">Recent deliveries</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Recent <code className="font-mono">{eventType}</code> messages for an
            application — open one to see how it was delivered to each endpoint.
          </p>
        </div>
        {apps && apps.length > 0 ? (
          <label className="flex shrink-0 items-center gap-2 text-sm text-zinc-600">
            Application
            <Select size="sm" value={appId} onChange={(e) => setAppId(e.target.value)}>
              {apps.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.uid ? ` (${a.uid})` : ""}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
      </div>

      {apps !== null && apps.length === 0 ? (
        <Card className="mt-3 p-6 text-sm text-zinc-500">
          No applications yet — create one to see deliveries for this event type.
        </Card>
      ) : appId ? (
        <div className="mt-3">
          <ActivityFeed
            key={appId}
            embedded
            lockedEventType={eventType}
            messagesPath={`/api/admin/apps/${encodeURIComponent(appId)}/messages`}
            catalogPath="/api/admin/event-types"
            detailHref={(id) =>
              `/console/applications/${encodeURIComponent(appId)}/messages/${encodeURIComponent(id)}`
            }
          />
        </div>
      ) : null}
    </section>
  );
}
