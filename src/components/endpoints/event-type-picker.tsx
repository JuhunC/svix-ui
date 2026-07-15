"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Spinner } from "@/components/ui";
import { apiGet } from "@/lib/api/fetcher";
import type { EventType, ListResponse } from "@/lib/svix/types";

/** Derives the catalog endpoint from an endpoints apiBase. */
export function catalogPathFor(apiBase: string): string {
  return apiBase.startsWith("/api/portal")
    ? "/api/portal/event-types"
    : "/api/admin/event-types";
}

function groupByPrefix(types: EventType[]): Array<[string, EventType[]]> {
  const groups = new Map<string, EventType[]>();
  for (const t of types) {
    const key = t.groupName || t.name.split(".")[0] || "other";
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

/**
 * Catalog-driven event-type subscription picker. `value === null` means "all
 * event types"; an array means an explicit subset (Svix `filterTypes`).
 */
export function EventTypePicker({
  catalogPath,
  value,
  onChange,
  onCatalogLoaded,
}: {
  catalogPath: string;
  value: string[] | null;
  onChange: (next: string[] | null) => void;
  /**
   * Called with the active (non-archived) event-type names once the catalog
   * loads, so the parent can drop archived selections on save — svix-server
   * rejects a filterTypes that references an archived type.
   */
  onCatalogLoaded?: (names: string[]) => void;
}) {
  const [types, setTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiGet<ListResponse<EventType>>(`${catalogPath}?limit=250`)
      .then((r) => {
        if (!active) return;
        setTypes(r.data);
        onCatalogLoaded?.(r.data.map((t) => t.name));
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [catalogPath, onCatalogLoaded]);

  const all = value === null;
  const selected = value ?? [];
  const groups = groupByPrefix(types);
  // Selected types that are no longer in the active catalog (archived or
  // removed). Only meaningful once the catalog has loaded.
  const catalogNames = new Set(types.map((t) => t.name));
  const orphans =
    !loading && !error ? selected.filter((name) => !catalogNames.has(name)) : [];

  function toggle(name: string) {
    onChange(
      selected.includes(name)
        ? selected.filter((x) => x !== name)
        : [...selected, name],
    );
  }

  return (
    <div>
      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input type="radio" checked={all} onChange={() => onChange(null)} />
        All event types
      </label>
      <label className="mt-2 flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="radio"
          checked={!all}
          onChange={() => onChange(selected)}
        />
        Only selected event types
      </label>

      {!all ? (
        <div className="mt-2 max-h-60 overflow-y-auto rounded-md border border-zinc-200 p-3">
          {loading ? (
            <Spinner />
          ) : error ? (
            <Alert>{error}</Alert>
          ) : types.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No event types defined yet.
            </p>
          ) : (
            <div className="space-y-3">
              {groups.map(([prefix, items]) => (
                <fieldset key={prefix}>
                  <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    {prefix}
                  </legend>
                  <div className="space-y-1">
                    {items.map((t) => (
                      <label
                        key={t.name}
                        className="flex items-start gap-2 text-sm text-zinc-700"
                      >
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selected.includes(t.name)}
                          onChange={() => toggle(t.name)}
                        />
                        <span className="min-w-0">
                          <span className="font-mono">{t.name}</span>
                          {t.description ? (
                            <span className="ml-2 text-xs text-zinc-400">
                              {t.description}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}

              {orphans.length > 0 ? (
                <fieldset>
                  <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Unavailable
                  </legend>
                  <p className="mb-1 text-xs text-amber-700">
                    Archived or removed — dropped when you save.
                  </p>
                  <div className="space-y-1">
                    {orphans.map((name) => (
                      <div key={name} className="flex items-center gap-2 text-sm">
                        <span className="font-mono text-zinc-400 line-through">{name}</span>
                        <Badge tone="warning">archived</Badge>
                      </div>
                    ))}
                  </div>
                </fieldset>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
