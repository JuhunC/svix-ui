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
import type { EventType } from "@/lib/svix/types";

export function PortalCatalog() {
  const list = usePaginatedList<EventType>("/api/portal/event-types");

  return (
    <div>
      <PageHeader
        title="Event catalog"
        description="The events your application can emit. Subscribe your endpoints to the ones you care about."
      />

      {list.error ? <Alert>{list.error}</Alert> : null}

      <Card className="overflow-hidden">
        {list.items.length === 0 && !list.loading && !list.error ? (
          <div className="p-6">
            <EmptyState
              icon={<Icon name="catalog" />}
              title="No event types"
              description="The provider hasn't published any event types yet."
            />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {list.items.map((et) => (
              <CatalogRow key={et.name} eventType={et} />
            ))}
          </ul>
        )}
      </Card>

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
  const [open, setOpen] = useState(false);
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
          <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? "Hide schema" : "View schema"}
          </Button>
        ) : null}
      </div>
      {open && schema ? (
        <pre className="mt-3 max-h-72 overflow-auto rounded-md bg-zinc-50 p-3 font-mono text-xs text-zinc-800 ring-1 ring-zinc-200">
          {JSON.stringify(schema, null, 2)}
        </pre>
      ) : null}
    </li>
  );
}
