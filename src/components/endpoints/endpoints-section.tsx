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
import { Icon } from "@/components/icons";
import { Modal, ChipInput } from "@/components/overlay";
import {
  EventTypePicker,
  catalogPathFor,
} from "@/components/endpoints/event-type-picker";
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
  // Consumers reaching this through the App Portal may edit endpoint settings
  // but not add or delete endpoints — only the operator console (admin API)
  // can create them. Gate the "Add endpoint" affordances accordingly.
  const canManage = !base.startsWith("/api/portal");
  const { items, done, loading, error, loadMore, reload } =
    usePaginatedList<Endpoint>(base);
  const [adding, setAdding] = useState(false);

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">{heading}</h2>
        {canManage ? (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Icon name="plus" size={15} /> Add endpoint
          </Button>
        ) : null}
      </div>

      {canManage ? (
        <AddEndpointModal
          open={adding}
          base={base}
          catalogPath={catalogPathFor(base)}
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
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
              icon={<Icon name="endpoints" />}
              title="No endpoints"
              description={
                canManage
                  ? "Add an endpoint URL to start receiving webhooks."
                  : "No endpoints yet. Your provider adds endpoints for this application."
              }
              action={
                canManage ? (
                  <Button size="sm" onClick={() => setAdding(true)}>
                    <Icon name="plus" size={15} /> Add endpoint
                  </Button>
                ) : undefined
              }
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
                  {ep.channels && ep.channels.length > 0 ? (
                    <Badge tone="neutral">{ep.channels.length} ch</Badge>
                  ) : null}
                  {ep.filterTypes && ep.filterTypes.length > 0 ? (
                    <Badge tone="info">{ep.filterTypes.length} events</Badge>
                  ) : (
                    <Badge>All events</Badge>
                  )}
                  {ep.disabled ? (
                    <Badge tone="danger">Disabled</Badge>
                  ) : (
                    <Badge tone="success">Active</Badge>
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

function AddEndpointModal({
  open,
  base,
  catalogPath,
  onClose,
  onCreated,
}: {
  open: boolean;
  base: string;
  catalogPath: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [filterTypes, setFilterTypes] = useState<string[] | null>(null);
  const [channels, setChannels] = useState<string[]>([]);
  const [rateLimit, setRateLimit] = useState("");
  const [secret, setSecret] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setUrl("");
    setDescription("");
    setFilterTypes(null);
    setChannels([]);
    setRateLimit("");
    setSecret("");
    setShowAdvanced(false);
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiSend("POST", base, {
        url,
        description: description.trim() || undefined,
        filterTypes: filterTypes && filterTypes.length > 0 ? filterTypes : undefined,
        channels: channels.length > 0 ? channels : undefined,
        rateLimit: rateLimit ? Number(rateLimit) : undefined,
        secret: secret.trim() || undefined,
      });
      reset();
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add endpoint");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add endpoint"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={submit}
            disabled={submitting || !url.trim()}
          >
            {submitting ? "Adding…" : "Add endpoint"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit}>
        {error ? <div className="mb-4"><Alert>{error}</Alert></div> : null}
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
        <Field label="Subscribe to events">
          <EventTypePicker
            catalogPath={catalogPath}
            value={filterTypes}
            onChange={setFilterTypes}
          />
        </Field>
        <Field
          label="Channels (optional)"
          hint="Deliver only messages tagged with these channels."
        >
          <ChipInput
            values={channels}
            onChange={setChannels}
            placeholder="Add a channel and press Enter"
          />
        </Field>

        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-sm font-medium text-blue-600 hover:text-blue-500"
        >
          {showAdvanced ? "Hide advanced" : "Advanced"}
        </button>
        {showAdvanced ? (
          <div className="mt-3 space-y-4 rounded-md border border-zinc-200 p-4">
            <Field label="Rate limit (messages/sec, optional)" htmlFor="ep-rate">
              <Input
                id="ep-rate"
                type="number"
                min={1}
                value={rateLimit}
                onChange={(e) => setRateLimit(e.target.value)}
                placeholder="No limit"
              />
            </Field>
            <Field
              label="Signing secret (optional)"
              htmlFor="ep-secret"
              hint="Leave blank to have one generated (whsec_…)."
            >
              <Input
                id="ep-secret"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="whsec_…"
                className="font-mono"
              />
            </Field>
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
