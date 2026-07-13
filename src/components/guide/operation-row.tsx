"use client";

import { useMemo, useState } from "react";
import { Button, cn } from "@/components/ui";
import { Icon } from "@/components/icons";
import { exampleFromSchema } from "@/lib/svix/schema-example";
import { DEMO_SECRET, signPayload } from "@/lib/webhooks/sign";
import type { EventType } from "@/lib/svix/types";

/**
 * Fixed sample identifiers so the server render and the first client render
 * agree (no Date.now()/randomness during render → no hydration mismatch).
 */
export const SAMPLE_MSG_ID = "msg_2yZWjKpNXjIYuHkDPqGpXvVaKu1";
export const SAMPLE_TIMESTAMP = "1704067200"; // 2024-01-01T00:00:00Z

export function samplePayloadFor(et: EventType): string {
  const schema = et.schemas?.["1"];
  const sample = schema
    ? exampleFromSchema(schema)
    : { type: et.name, data: { example: true } };
  return JSON.stringify(sample, null, 2);
}

export function anchorFor(name: string): string {
  // Injective encoding: non-alphanumerics become _<hex>, so distinct event
  // names ("invoice.paid" vs "invoice-paid") can never share a DOM id.
  return `op-${name.replace(/[^A-Za-z0-9]/g, (c) => `_${c.charCodeAt(0).toString(16)}`)}`;
}

/**
 * One event type rendered like a Swagger operation: a collapsible POST row
 * with description, a real signed delivery preview, and the payload as
 * sample data or JSON Schema.
 */
export function OperationRow({
  eventType,
  expanded,
  onToggle,
  onTryIt,
}: {
  eventType: EventType;
  expanded: boolean;
  onToggle: () => void;
  onTryIt: (payload: string) => void;
}) {
  const [view, setView] = useState<"example" | "schema">("example");
  const schema = eventType.schemas?.["1"];
  const payload = useMemo(() => samplePayloadFor(eventType), [eventType]);

  // A real signature over the sample payload, so the preview is exact.
  const signature = useMemo(
    () => signPayload(DEMO_SECRET, SAMPLE_MSG_ID, SAMPLE_TIMESTAMP, payload),
    [payload],
  );

  return (
    <div
      id={anchorFor(eventType.name)}
      className={cn(
        "scroll-mt-6 rounded-lg border bg-white shadow-sm transition-colors",
        expanded ? "border-accent-ring" : "border-zinc-200",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-focus"
      >
        <span className="rounded bg-green-600 px-2 py-0.5 text-[11px] font-bold tracking-wide text-white">
          POST
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-sm font-medium text-zinc-900">
            {eventType.name}
          </span>
          {!expanded && eventType.description ? (
            <span className="block truncate text-xs text-zinc-500">
              {eventType.description}
            </span>
          ) : null}
        </span>
        {eventType.deprecated ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
            deprecated
          </span>
        ) : null}
        <Icon
          name="chevronRight"
          size={14}
          className={cn("shrink-0 text-zinc-400 transition-transform", expanded && "rotate-90")}
        />
      </button>

      {expanded ? (
        <div className="space-y-4 border-t border-zinc-100 px-4 py-4">
          {eventType.description ? (
            <p className="text-sm text-zinc-600">{eventType.description}</p>
          ) : null}

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Delivery request
            </p>
            <div className="overflow-x-auto whitespace-pre rounded-md bg-zinc-900 p-3 font-mono text-xs leading-relaxed text-zinc-100">
              <span className="text-green-400">POST</span> https://your-endpoint.example/webhooks
              {"\n"}
              <span className="text-zinc-400">content-type:</span> application/json{"\n"}
              <span className="text-zinc-400">svix-id:</span> {SAMPLE_MSG_ID}
              {"\n"}
              <span className="text-zinc-400">svix-timestamp:</span> {SAMPLE_TIMESTAMP}
              {"\n"}
              <span className="text-zinc-400">svix-signature:</span> {signature}
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              A real signature over the sample body below, signed with the demo
              secret <span className="font-mono">{DEMO_SECRET.slice(0, 12)}…</span> —
              your endpoint has its own <span className="font-mono">whsec_…</span> secret.
            </p>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {view === "example" ? "Sample payload" : "JSON Schema"}
              </p>
              {schema ? (
                <div className="flex gap-1">
                  <Button
                    variant={view === "example" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setView("example")}
                  >
                    Example
                  </Button>
                  <Button
                    variant={view === "schema" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setView("schema")}
                  >
                    Schema
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-zinc-400">
                  No schema published — generic sample shown
                </span>
              )}
            </div>
            <pre className="max-h-80 overflow-auto rounded-md bg-zinc-50 p-3 font-mono text-xs text-zinc-800 ring-1 ring-zinc-200">
              {view === "schema" && schema ? JSON.stringify(schema, null, 2) : payload}
            </pre>
          </div>

          <div>
            <Button size="sm" onClick={() => onTryIt(payload)}>
              <Icon name="send" size={14} /> Try it out
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
