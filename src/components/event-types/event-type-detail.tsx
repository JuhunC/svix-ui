"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Alert, Button, Card, Field, Input, Textarea } from "@/components/ui";
import { ApiError, apiGet, apiSend } from "@/lib/api/fetcher";
import type { EventType } from "@/lib/svix/types";

export function EventTypeDetail({ name }: { name: string }) {
  const router = useRouter();
  const path = `/api/admin/event-types/${encodeURIComponent(name)}`;

  const [description, setDescription] = useState("");
  const [schema, setSchema] = useState("");
  const [archived, setArchived] = useState(false);
  const [deprecated, setDeprecated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const et = await apiGet<EventType>(path);
      setDescription(et.description);
      setArchived(Boolean(et.archived));
      setDeprecated(Boolean(et.deprecated));
      const v1 = et.schemas?.["1"];
      setSchema(v1 ? JSON.stringify(v1, null, 2) : "");
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "Failed to load event type");
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    // load() only updates state after an awaited fetch (no synchronous setState).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    let schemas: Record<string, unknown> | undefined;
    if (schema.trim()) {
      try {
        schemas = { "1": JSON.parse(schema) };
      } catch {
        setError("Schema must be valid JSON.");
        return;
      }
    }

    setBusy(true);
    try {
      await apiSend("PUT", path, { description, schemas, archived, deprecated });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !confirm(
        `Permanently delete event type "${name}"? This removes it for good and cannot be undone. To hide it without deleting, tick "Archived" and save instead.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await apiSend("DELETE", `${path}?expunge=true`);
      router.push("/console/event-types");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to delete");
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-zinc-400">Loading…</p>;
  if (loadError) return <Alert>{loadError}</Alert>;

  return (
    <div>
      <Link href="/console/event-types" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← Event types
      </Link>
      <div className="mt-2 flex items-start justify-between">
        <h1 className="font-mono text-lg text-zinc-900">{name}</h1>
        <Button variant="danger" size="sm" onClick={remove} disabled={busy}>
          Delete permanently
        </Button>
      </div>

      <Card className="mt-6 p-5">
        <form onSubmit={save}>
          {error ? <div className="mb-4"><Alert>{error}</Alert></div> : null}
          <Field label="Description" htmlFor="et-desc">
            <Input
              id="et-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </Field>
          <Field
            label="JSON Schema (version 1)"
            htmlFor="et-schema"
            hint="Draft-7 JSON Schema for the payload."
          >
            <Textarea
              id="et-schema"
              rows={10}
              value={schema}
              onChange={(e) => setSchema(e.target.value)}
              placeholder="{}"
            />
          </Field>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={deprecated}
                onChange={(e) => setDeprecated(e.target.checked)}
              />
              Deprecated
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={archived}
                onChange={(e) => setArchived(e.target.checked)}
              />
              Archived
            </label>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
            {saved ? <span className="text-xs text-green-600">Saved</span> : null}
          </div>
        </form>
      </Card>
    </div>
  );
}
