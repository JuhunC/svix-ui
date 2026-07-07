"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button, Field, Input, Label, Select, Textarea } from "@/components/ui";
import { Modal, ChipInput } from "@/components/overlay";
import { ApiError, apiGet, apiSend } from "@/lib/api/fetcher";
import type { Application, ListResponse, Message } from "@/lib/svix/types";

/**
 * Sends (creates) a webhook message of a given event type. In Svix a message
 * always belongs to an application, so the operator picks which app to deliver
 * to; the payload is seeded from the event type's schema example.
 */
export function SendEventModal({
  open,
  eventType,
  initialPayload,
  onClose,
}: {
  open: boolean;
  eventType: string;
  initialPayload: string;
  onClose: () => void;
}) {
  const [apps, setApps] = useState<Application[] | null>(null);
  const [appId, setAppId] = useState("");
  const [payload, setPayload] = useState(initialPayload);
  const [eventId, setEventId] = useState("");
  const [channels, setChannels] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ appId: string; msgId: string } | null>(
    null,
  );

  // The parent mounts this fresh on each open (see the conditional render), so
  // useState initializers above reset the form — no reset effect needed.

  // Load applications to choose a delivery target.
  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!appId) {
      setError("Choose an application to deliver to.");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      setError("Payload must be valid JSON.");
      return;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      setError("Payload must be a JSON object.");
      return;
    }

    setBusy(true);
    try {
      const msg = await apiSend<Message>(
        "POST",
        `/api/admin/apps/${encodeURIComponent(appId)}/messages`,
        {
          eventType,
          payload: parsed,
          eventId: eventId.trim() || undefined,
          channels: channels.length > 0 ? channels : undefined,
        },
      );
      setResult({ appId, msgId: msg.id });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send event");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-baseline gap-2">
          Send event
          <code className="font-mono text-sm text-zinc-500">{eventType}</code>
        </span>
      }
      wide
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            {result ? "Close" : "Cancel"}
          </Button>
          {!result ? (
            <Button
              size="sm"
              onClick={submit}
              disabled={busy || !appId || (apps !== null && apps.length === 0)}
            >
              {busy ? "Sending…" : "Send event"}
            </Button>
          ) : null}
        </>
      }
    >
      {result ? (
        <Alert tone="success">
          Event sent to the application.{" "}
          <Link
            href={`/console/applications/${encodeURIComponent(result.appId)}/messages/${encodeURIComponent(result.msgId)}`}
            className="font-medium underline"
          >
            View delivery
          </Link>
          .
        </Alert>
      ) : apps !== null && apps.length === 0 ? (
        <Alert tone="info">
          No applications yet. Create one under{" "}
          <Link href="/console/applications" className="font-medium underline">
            Applications
          </Link>{" "}
          first — a message is always delivered to an application&apos;s
          endpoints.
        </Alert>
      ) : (
        <form onSubmit={submit}>
          {error ? (
            <div className="mb-4">
              <Alert>{error}</Alert>
            </div>
          ) : null}

          <Field label="Application" htmlFor="send-app">
            <Select
              id="send-app"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              className="w-full"
            >
              {apps === null ? (
                <option value="">Loading…</option>
              ) : (
                apps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.uid ? ` (${a.uid})` : ""}
                  </option>
                ))
              )}
            </Select>
          </Field>

          <div className="mb-4">
            <Label htmlFor="send-payload">Payload (JSON)</Label>
            <Textarea
              id="send-payload"
              rows={12}
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              spellCheck={false}
              className="text-xs"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Seeded from the event type&apos;s schema — edit before sending.
            </p>
          </div>

          <Field label="Event ID (optional)" htmlFor="send-eventid" hint="Your own idempotent identifier for this event.">
            <Input
              id="send-eventid"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              placeholder="evt_1234"
              className="font-mono"
            />
          </Field>

          <Field label="Channels (optional)" hint="Deliver only to endpoints subscribed to these channels.">
            <ChipInput
              values={channels}
              onChange={setChannels}
              placeholder="Add a channel and press Enter"
            />
          </Field>
        </form>
      )}
    </Modal>
  );
}
