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
  Spinner,
} from "@/components/ui";
import { Icon } from "@/components/icons";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { ApiError, apiSend } from "@/lib/api/fetcher";
import { formatDateTime } from "@/lib/format";
import type { Application } from "@/lib/svix/types";

export function ApplicationsView() {
  const { items, done, loading, error, loadMore, reload } =
    usePaginatedList<Application>("/api/admin/apps");
  const [creating, setCreating] = useState(false);

  return (
    <div>
      <PageHeader
        title="Applications"
        description="Each application is a tenant — a consumer of your webhooks."
        actions={
          <Button onClick={() => setCreating((v) => !v)}>
            {creating ? (
              "Cancel"
            ) : (
              <>
                <Icon name="plus" size={16} /> New application
              </>
            )}
          </Button>
        }
      />

      {creating ? (
        <CreateApplicationForm
          onCreated={() => {
            setCreating(false);
            reload();
          }}
        />
      ) : null}

      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <Card className="mt-4 overflow-hidden">
        {items.length === 0 && !loading && !error ? (
          <div className="p-6">
            <EmptyState
              icon={<Icon name="apps" />}
              title="No applications yet"
              description="Create your first application to start sending webhooks to a tenant."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">ID</th>
                <th className="px-4 py-2 font-medium">Created</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {items.map((app) => (
                <tr key={app.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/console/applications/${encodeURIComponent(app.id)}`}
                      className="font-medium text-zinc-900 hover:underline"
                    >
                      {app.name}
                    </Link>
                    {app.uid ? (
                      <span className="ml-2">
                        <Badge>{app.uid}</Badge>
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                    {app.id}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    {formatDateTime(app.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/console/applications/${encodeURIComponent(app.id)}`}
                      className="text-sm text-zinc-500 hover:text-zinc-900"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </Card>

      <div className="mt-4 flex items-center justify-center">
        {loading ? (
          <Spinner />
        ) : !done && items.length > 0 ? (
          <Button variant="secondary" size="sm" onClick={loadMore}>
            Load more
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function CreateApplicationForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [uid, setUid] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiSend("POST", "/api/admin/apps", {
        name,
        uid: uid.trim() ? uid.trim() : undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mt-4 p-5">
      <form onSubmit={onSubmit}>
        {error ? (
          <div className="mb-4">
            <Alert>{error}</Alert>
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="app-name">
            <Input
              id="app-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Inc."
              required
            />
          </Field>
          <Field
            label="UID (optional)"
            htmlFor="app-uid"
            hint="Stable identifier you control, usable in place of the ID."
          >
            <Input
              id="app-uid"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              placeholder="cust_acme"
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? "Creating…" : "Create application"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
