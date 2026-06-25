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
  PageHeader,
  Textarea,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { ApiError, apiSend } from "@/lib/api/fetcher";
import type { EventType } from "@/lib/svix/types";

export function EventTypesView() {
  const [showArchived, setShowArchived] = useState(false);
  const { items, done, loading, error, loadMore, reload } =
    usePaginatedList<EventType>(
      showArchived
        ? "/api/admin/event-types?includeArchived=true"
        : "/api/admin/event-types",
    );
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHeader
        title="Event types"
        description="The catalog of events your applications can emit."
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Show archived
            </label>
            <Button onClick={() => setCreating((v) => !v)}>
              {creating ? (
                "Cancel"
              ) : (
                <>
                  <Icon name="plus" size={16} /> New event type
                </>
              )}
            </Button>
          </>
        }
      />

      {creating ? (
        <EventTypeForm
          onSaved={() => {
            setCreating(false);
            reload();
          }}
        />
      ) : null}

      {error ? <div className="mt-4"><Alert>{error}</Alert></div> : null}

      <Card className="mt-4 overflow-hidden">
        {items.length === 0 && !loading && !error ? (
          <div className="p-6">
            <EmptyState
              icon={<Icon name="tag" />}
              title="No event types"
              description="Define the events your applications emit so consumers can subscribe."
            />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {items.map((et) => (
              <li key={et.name} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/console/event-types/${encodeURIComponent(et.name)}`}
                    className="font-mono text-sm font-medium text-zinc-900 hover:underline"
                  >
                    {et.name}
                  </Link>
                  <p className="truncate text-xs text-zinc-500">{et.description}</p>
                </div>
                <div className="ml-3 flex shrink-0 gap-2">
                  {et.deprecated ? <Badge tone="warning">Deprecated</Badge> : null}
                  {et.archived ? <Badge tone="danger">Archived</Badge> : null}
                  {et.schemas ? <Badge tone="info">Schema</Badge> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {!done && items.length > 0 ? (
        <div className="mt-4 text-center">
          <Button variant="secondary" size="sm" onClick={loadMore}>
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function EventTypeForm({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [schema, setSchema] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    let schemas: Record<string, unknown> | undefined;
    if (schema.trim()) {
      try {
        schemas = { "1": JSON.parse(schema) };
      } catch {
        setError("Schema must be valid JSON.");
        return;
      }
    }

    setSubmitting(true);
    try {
      await apiSend("POST", "/api/admin/event-types", {
        name,
        description,
        schemas,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mt-4 p-5">
      <form onSubmit={onSubmit}>
        {error ? <div className="mb-4"><Alert>{error}</Alert></div> : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="et-name" hint="e.g. invoice.paid">
            <Input
              id="et-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="invoice.paid"
              className="font-mono"
              required
            />
          </Field>
          <Field label="Description" htmlFor="et-desc">
            <Input
              id="et-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="An invoice was paid"
              required
            />
          </Field>
        </div>
        <Field
          label="JSON Schema (optional)"
          htmlFor="et-schema"
          hint="Draft-7 JSON Schema for the payload. Stored as version 1."
        >
          <Textarea
            id="et-schema"
            rows={6}
            value={schema}
            onChange={(e) => setSchema(e.target.value)}
            placeholder={'{\n  "type": "object",\n  "properties": { "amount": { "type": "number" } }\n}'}
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={submitting || !name.trim() || !description.trim()}>
            {submitting ? "Creating…" : "Create event type"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
