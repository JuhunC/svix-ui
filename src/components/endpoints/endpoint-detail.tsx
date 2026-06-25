"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Input,
  Spinner,
  Tabs,
  Textarea,
} from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { ApiError, apiGet, apiSend } from "@/lib/api/fetcher";
import { formatDateTime } from "@/lib/format";
import { attemptStatus } from "@/lib/svix/status";
import type {
  Endpoint,
  EndpointHeaders,
  EndpointSecret,
  EndpointTransformation,
  MessageAttempt,
} from "@/lib/svix/types";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "testing", label: "Testing" },
  { key: "advanced", label: "Advanced" },
  { key: "activity", label: "Activity" },
];

export function EndpointDetail({
  apiBase,
  backHref,
  afterDeleteHref,
}: {
  apiBase: string;
  backHref: string;
  afterDeleteHref: string;
}) {
  const router = useRouter();
  const base = apiBase;
  const [endpoint, setEndpoint] = useState<Endpoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("overview");

  const reload = useCallback(async () => {
    try {
      setEndpoint(await apiGet<Endpoint>(base));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load endpoint");
    } finally {
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  async function toggleDisabled() {
    if (!endpoint) return;
    setBusy(true);
    try {
      await apiSend("PATCH", base, { disabled: !endpoint.disabled });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this endpoint? Delivery to this URL will stop.")) return;
    setBusy(true);
    try {
      await apiSend("DELETE", base);
      router.push(afterDeleteHref);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to delete");
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (error && !endpoint) return <Alert>{error}</Alert>;
  if (!endpoint) return null;

  return (
    <div>
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <Icon name="chevronRight" size={14} className="rotate-180" /> Back
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate font-mono text-lg text-zinc-900">{endpoint.url}</h1>
          <div className="mt-1 flex items-center gap-2">
            {endpoint.disabled ? (
              <Badge tone="danger">Disabled</Badge>
            ) : (
              <Badge tone="success">Active</Badge>
            )}
            <span className="font-mono text-xs text-zinc-400">{endpoint.id}</span>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" size="sm" onClick={toggleDisabled} disabled={busy}>
            {endpoint.disabled ? "Enable" : "Disable"}
          </Button>
          <Button variant="danger" size="sm" onClick={remove} disabled={busy}>
            <Icon name="trash" size={15} /> Delete
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
      </div>

      <div className="mt-6 space-y-4">
        {tab === "overview" ? (
          <>
            <Card className="p-5">
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Detail label="Created" value={formatDateTime(endpoint.createdAt)} />
                <Detail label="Updated" value={formatDateTime(endpoint.updatedAt)} />
                <Detail
                  label="Rate limit"
                  value={endpoint.rateLimit ? `${endpoint.rateLimit}/s` : "—"}
                />
                <Detail
                  label="Channels"
                  value={endpoint.channels?.length ? endpoint.channels.join(", ") : "—"}
                />
              </dl>
            </Card>
            <SecretCard base={base} />
            <SubscriptionsCard base={base} endpoint={endpoint} onSaved={reload} />
          </>
        ) : null}

        {tab === "testing" ? (
          <SendExampleCard base={base} endpoint={endpoint} onSent={() => setTab("activity")} />
        ) : null}

        {tab === "advanced" ? (
          <>
            <HeadersCard base={base} />
            <TransformationCard base={base} />
          </>
        ) : null}

        {tab === "activity" ? <DeliveriesCard base={base} /> : null}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-zinc-800">{value}</dd>
    </div>
  );
}

function CardHeading({
  icon,
  title,
  children,
}: {
  icon: IconName;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
        <Icon name={icon} size={17} className="text-zinc-400" />
        {title}
      </h2>
      {children ? <div className="flex gap-2">{children}</div> : null}
    </div>
  );
}

function SecretCard({ base }: { base: string }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reveal() {
    setBusy(true);
    setError(null);
    try {
      setSecret((await apiGet<EndpointSecret>(`${base}/secret`)).key);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load secret");
    } finally {
      setBusy(false);
    }
  }

  async function rotate() {
    if (!confirm("Rotate the signing secret? The old secret stays valid for 24h.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiSend("POST", `${base}/secret/rotate`);
      setSecret((await apiGet<EndpointSecret>(`${base}/secret`)).key);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to rotate secret");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <CardHeading icon="key" title="Signing secret">
        {secret === null ? (
          <Button variant="secondary" size="sm" onClick={reveal} disabled={busy}>
            Reveal
          </Button>
        ) : null}
        <Button variant="secondary" size="sm" onClick={rotate} disabled={busy}>
          Rotate
        </Button>
      </CardHeading>
      {error ? <div className="mt-3"><Alert>{error}</Alert></div> : null}
      <p className="mt-3 break-all rounded-md bg-zinc-50 px-3 py-2 font-mono text-sm text-zinc-800">
        {secret ?? "whsec_••••••••••••••••••••••••"}
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        Verify with HMAC-SHA256 over <code>id.timestamp.body</code>; reject
        timestamps older than 5 minutes.
      </p>
    </Card>
  );
}

function SubscriptionsCard({
  base,
  endpoint,
  onSaved,
}: {
  base: string;
  endpoint: Endpoint;
  onSaved: () => Promise<void> | void;
}) {
  const initialSelected = (endpoint.filterTypes ?? []).length > 0;
  const [mode, setMode] = useState<"all" | "selected">(
    initialSelected ? "selected" : "all",
  );
  const [text, setText] = useState((endpoint.filterTypes ?? []).join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    const filterTypes =
      mode === "all"
        ? null
        : text.split(",").map((s) => s.trim()).filter(Boolean);
    try {
      await apiSend("PATCH", base, { filterTypes });
      await onSaved();
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <CardHeading icon="tag" title="Subscriptions" />
      <p className="mt-1 text-sm text-zinc-500">
        Choose which event types this endpoint receives.
      </p>
      <form onSubmit={save} className="mt-3">
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="radio" checked={mode === "all"} onChange={() => setMode("all")} />
          All event types
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="radio"
            checked={mode === "selected"}
            onChange={() => setMode("selected")}
          />
          Selected event types
        </label>
        {mode === "selected" ? (
          <div className="mt-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="invoice.paid, invoice.payment_failed"
            />
            <p className="mt-1 text-xs text-zinc-500">Comma-separated event type names.</p>
          </div>
        ) : null}
        {error ? <div className="mt-3"><Alert>{error}</Alert></div> : null}
        <div className="mt-3 flex items-center gap-3">
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Saving…" : "Save subscriptions"}
          </Button>
          {saved ? <span className="text-xs text-green-600">Saved</span> : null}
        </div>
      </form>
    </Card>
  );
}

function SendExampleCard({
  base,
  endpoint,
  onSent,
}: {
  base: string;
  endpoint: Endpoint;
  onSent: () => void;
}) {
  const suggestions = endpoint.filterTypes ?? [];
  const [eventType, setEventType] = useState(suggestions[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      await apiSend("POST", `${base}/send-example`, { eventType });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <CardHeading icon="send" title="Send a test event" />
      <p className="mt-1 text-sm text-zinc-500">
        Deliver an example payload of the chosen event type to this endpoint, then
        watch it land under Activity.
      </p>
      <form onSubmit={send} className="mt-4">
        <label className="mb-1 block text-sm font-medium text-zinc-700">
          Event type
        </label>
        <div className="flex gap-2">
          <Input
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            placeholder="invoice.paid"
            className="font-mono"
            list="send-example-types"
            required
          />
          <Button type="submit" disabled={busy || !eventType.trim()}>
            <Icon name="send" size={15} /> {busy ? "Sending…" : "Send"}
          </Button>
        </div>
        {suggestions.length > 0 ? (
          <datalist id="send-example-types">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        ) : null}
        {error ? <div className="mt-3"><Alert>{error}</Alert></div> : null}
        {sent ? (
          <div className="mt-3">
            <Alert tone="success">
              Example sent.{" "}
              <button
                type="button"
                className="font-medium underline"
                onClick={onSent}
              >
                View activity
              </button>
            </Alert>
          </div>
        ) : null}
      </form>
    </Card>
  );
}

function HeadersCard({ base }: { base: string }) {
  const [rows, setRows] = useState<Array<{ key: string; value: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    apiGet<EndpointHeaders>(`${base}/headers`)
      .then((res) => {
        if (!active) return;
        setRows(Object.entries(res.headers ?? {}).map(([key, value]) => ({ key, value })));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [base]);

  function update(i: number, patch: Partial<{ key: string; value: string }>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const headers: Record<string, string> = {};
    for (const { key, value } of rows) if (key.trim()) headers[key.trim()] = value;
    try {
      await apiSend("PATCH", `${base}/headers`, { headers });
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save headers");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <CardHeading icon="code" title="Custom headers" />
      <p className="mt-1 text-sm text-zinc-500">
        Extra HTTP headers sent with every delivery to this endpoint.
      </p>
      <div className="mt-3 space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={row.key}
              onChange={(e) => update(i, { key: e.target.value })}
              placeholder="X-Custom-Header"
              className="font-mono"
            />
            <Input
              value={row.value}
              onChange={(e) => update(i, { value: e.target.value })}
              placeholder="value"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRows((r) => r.filter((_, idx) => idx !== i))}
              aria-label="Remove header"
            >
              ✕
            </Button>
          </div>
        ))}
      </div>
      {error ? <div className="mt-3"><Alert>{error}</Alert></div> : null}
      <div className="mt-3 flex items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setRows((r) => [...r, { key: "", value: "" }])}
        >
          Add header
        </Button>
        <Button size="sm" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save headers"}
        </Button>
        {saved ? <span className="text-xs text-green-600">Saved</span> : null}
      </div>
    </Card>
  );
}

const TRANSFORM_TEMPLATE = `function handler(webhook) {
  // Reshape the payload before delivery. Available: webhook.payload,
  // webhook.method, webhook.url, webhook.headers, webhook.cancel.
  return webhook;
}`;

function TransformationCard({ base }: { base: string }) {
  const [enabled, setEnabled] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    apiGet<EndpointTransformation>(`${base}/transformation`)
      .then((t) => {
        if (!active) return;
        setEnabled(Boolean(t.enabled));
        setCode(t.code ?? "");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [base]);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await apiSend("PATCH", `${base}/transformation`, {
        enabled,
        code: code.trim() ? code : null,
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save transformation");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <CardHeading icon="code" title="Transformation" />
      <p className="mt-1 text-sm text-zinc-500">
        Run JavaScript on each payload before it is delivered to this endpoint.
      </p>
      <label className="mt-3 flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Enable transformation
      </label>
      <div className="mt-3">
        <Textarea
          rows={10}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={TRANSFORM_TEMPLATE}
          spellCheck={false}
        />
      </div>
      {error ? <div className="mt-3"><Alert>{error}</Alert></div> : null}
      <div className="mt-3 flex items-center gap-3">
        {code.trim().length === 0 ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCode(TRANSFORM_TEMPLATE)}
          >
            Insert template
          </Button>
        ) : null}
        <Button size="sm" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save transformation"}
        </Button>
        {saved ? <span className="text-xs text-green-600">Saved</span> : null}
      </div>
    </Card>
  );
}

function DeliveriesCard({ base }: { base: string }) {
  const attempts = usePaginatedList<MessageAttempt>(`${base}/attempts`, 15);
  const [recovering, setRecovering] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  async function resend(attemptId: string, msgId: string) {
    setResendingId(attemptId);
    setError(null);
    try {
      await apiSend("POST", `${base}/messages/${encodeURIComponent(msgId)}/resend`);
      attempts.reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to resend");
    } finally {
      setResendingId(null);
    }
  }

  async function recover(hours: number) {
    setRecovering(true);
    setNotice(null);
    setError(null);
    const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    try {
      await apiSend("POST", `${base}/recover`, { since });
      setNotice(`Recovery of failed messages from the last ${hours}h was queued.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to start recovery");
    } finally {
      setRecovering(false);
    }
  }

  return (
    <Card className="p-5">
      <CardHeading icon="activity" title="Recent deliveries">
        <Button variant="secondary" size="sm" onClick={() => recover(1)} disabled={recovering}>
          Recover 1h
        </Button>
        <Button variant="secondary" size="sm" onClick={() => recover(24)} disabled={recovering}>
          Recover 24h
        </Button>
      </CardHeading>

      {notice ? <div className="mt-3"><Alert tone="success">{notice}</Alert></div> : null}
      {error ? <div className="mt-3"><Alert>{error}</Alert></div> : null}
      {attempts.error ? <div className="mt-3"><Alert>{attempts.error}</Alert></div> : null}

      <div className="mt-3 overflow-hidden rounded-md border border-zinc-100">
        {attempts.items.length === 0 && !attempts.loading ? (
          <p className="p-4 text-sm text-zinc-500">No deliveries yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {attempts.items.map((a) => {
              const s = attemptStatus(a.status);
              return (
                <li key={a.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <Badge tone={s.tone}>{s.label}</Badge>
                    <span className="font-mono text-xs text-zinc-500">
                      {a.responseStatusCode || "—"}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-zinc-400">{formatDateTime(a.timestamp)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resend(a.id, a.msgId)}
                      disabled={resendingId === a.id}
                    >
                      {resendingId === a.id ? "…" : "Resend"}
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!attempts.done && attempts.items.length > 0 ? (
        <div className="mt-3 text-center">
          <Button variant="ghost" size="sm" onClick={attempts.loadMore}>
            Load more
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
