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
} from "@/components/ui";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { ApiError, apiSend } from "@/lib/api/fetcher";
import type { Endpoint } from "@/lib/svix/types";

export function EndpointsSection({
  apiBase,
  hrefBase,
  heading = "Endpoints",
}: {
  apiBase: string;
  hrefBase: string;
  heading?: string;
}) {
  const base = apiBase;
  const { items, done, loading, error, loadMore, reload } =
    usePaginatedList<Endpoint>(base);
  const [creating, setCreating] = useState(false);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900">{heading}</h2>
        <Button size="sm" onClick={() => setCreating((v) => !v)}>
          {creating ? "Cancel" : "Add endpoint"}
        </Button>
      </div>

      {creating ? (
        <CreateEndpointForm
          base={base}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
        />
      ) : null}

      {error ? (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <Card className="mt-3 overflow-hidden">
        {items.length === 0 && !loading && !error ? (
          <div className="p-6">
            <EmptyState
              title="No endpoints"
              description="Add an endpoint URL to start delivering webhooks to this tenant."
            />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {items.map((ep) => (
              <li key={ep.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <Link
                    href={`${hrefBase}/${encodeURIComponent(ep.id)}`}
                    className="block truncate font-mono text-sm text-zinc-900 hover:underline"
                  >
                    {ep.url}
                  </Link>
                  {ep.description ? (
                    <p className="truncate text-xs text-zinc-500">{ep.description}</p>
                  ) : null}
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-2">
                  {ep.disabled ? (
                    <Badge tone="danger">Disabled</Badge>
                  ) : (
                    <Badge tone="success">Active</Badge>
                  )}
                  {ep.filterTypes && ep.filterTypes.length > 0 ? (
                    <Badge tone="info">{ep.filterTypes.length} events</Badge>
                  ) : (
                    <Badge>All events</Badge>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {!done && items.length > 0 ? (
        <div className="mt-3 text-center">
          <Button variant="secondary" size="sm" onClick={loadMore}>
            Load more
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function CreateEndpointForm({
  base,
  onCreated,
}: {
  base: string;
  onCreated: () => void;
}) {
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiSend("POST", base, {
        url,
        description: description.trim() ? description.trim() : undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add endpoint");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mt-3 p-5">
      <form onSubmit={onSubmit}>
        {error ? (
          <div className="mb-4">
            <Alert>{error}</Alert>
          </div>
        ) : null}
        <Field label="Endpoint URL" htmlFor="ep-url">
          <Input
            id="ep-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/webhooks/svix"
            required
          />
        </Field>
        <Field label="Description (optional)" htmlFor="ep-desc">
          <Input
            id="ep-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Production receiver"
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={submitting || !url.trim()}>
            {submitting ? "Adding…" : "Add endpoint"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
