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
import { exampleFromSchema } from "@/lib/svix/schema-example";
import type { EventType } from "@/lib/svix/types";

export function PortalCatalog() {
  const list = usePaginatedList<EventType>(
    "/api/portal/event-types?with_content=true",
  );

  const groups = new Map<string, EventType[]>();
  for (const et of list.items) {
    const key = et.groupName || et.name.split(".")[0] || "other";
    const arr = groups.get(key) ?? [];
    arr.push(et);
    groups.set(key, arr);
  }
  const grouped = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div>
      <PageHeader
        title="Event catalog"
        description="The events your application can emit. Subscribe your endpoints to the ones you care about."
      />

      {list.error ? <Alert>{list.error}</Alert> : null}

      {list.items.length === 0 && !list.loading && !list.error ? (
        <Card className="p-6">
          <EmptyState
            icon={<Icon name="catalog" />}
            title="No event types"
            description="The provider hasn't published any event types yet."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([prefix, items]) => (
            <div key={prefix}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {prefix}
              </h2>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-zinc-100">
                  {items.map((et) => (
                    <CatalogRow key={et.name} eventType={et} />
                  ))}
                </ul>
              </Card>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex justify-center">
        {list.loading ? (
          <Spinner />
        ) : !list.done && list.items.length > 0 ? (
          <Button variant="secondary" size="sm" onClick={list.loadMore}>
            Load more
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function CatalogRow({ eventType }: { eventType: EventType }) {
  const [view, setView] = useState<"none" | "schema" | "example">("none");
  const schema = eventType.schemas?.["1"];

  return (
    <li className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-zinc-900">
              {eventType.name}
            </span>
            {eventType.deprecated ? <Badge tone="warning">Deprecated</Badge> : null}
          </div>
          <p className="mt-0.5 text-sm text-zinc-500">{eventType.description}</p>
        </div>
        {schema ? (
          <div className="flex shrink-0 gap-1">
            <Button
              variant={view === "example" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView(view === "example" ? "none" : "example")}
            >
              Example
            </Button>
            <Button
              variant={view === "schema" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView(view === "schema" ? "none" : "schema")}
            >
              Schema
            </Button>
          </div>
        ) : null}
      </div>
      {view !== "none" && schema ? (
        <pre className="mt-3 max-h-72 overflow-auto rounded-md bg-zinc-50 p-3 font-mono text-xs text-zinc-800 ring-1 ring-zinc-200">
          {JSON.stringify(
            view === "example" ? exampleFromSchema(schema) : schema,
            null,
            2,
          )}
        </pre>
      ) : null}
    </li>
  );
}
