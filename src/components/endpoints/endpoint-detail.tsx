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
  Field,
  Input,
  Spinner,
  Tabs,
  Textarea,
  cn,
} from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { ChipInput, Modal } from "@/components/overlay";
import {
  EventTypePicker,
  catalogPathFor,
} from "@/components/endpoints/event-type-picker";
import { PortalLinkButton } from "@/components/applications/portal-link-button";
import { usePaginatedList } from "@/lib/hooks/use-paginated-list";
import { ApiError, apiGet, apiSend } from "@/lib/api/fetcher";
import { formatDateTime } from "@/lib/format";
import { attemptStatus } from "@/lib/svix/status";
import type {
  Endpoint,
  EndpointHeaders,
  EndpointSecret,
  EndpointStats,
  EndpointTransformation,
  Message,
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
  const isPortal = apiBase.startsWith("/api/portal");
  // In the console the base is /api/admin/apps/{appId}/endpoints/{endpointId};
  // pull the ids out to offer a per-endpoint consumer portal link.
  const adminMatch = base.match(
    /^\/api\/admin\/apps\/([^/]+)\/endpoints\/([^/]+)$/,
  );
  const consoleAppId = adminMatch ? decodeURIComponent(adminMatch[1]) : null;
  const consoleEndpointId = adminMatch ? decodeURIComponent(adminMatch[2]) : null;
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
          {/* Consumers may change settings but not delete the endpoint itself. */}
          {!isPortal ? (
            <Button variant="danger" size="sm" onClick={remove} disabled={busy}>
              <Icon name="trash" size={15} /> Delete
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-6">
        {/* The portal can't send test events, so drop that dead-end tab there. */}
        <Tabs
          tabs={isPortal ? TABS.filter((t) => t.key !== "testing") : TABS}
          active={tab}
          onChange={setTab}
        />
      </div>

      <div className="mt-6 space-y-4">
        {tab === "overview" ? (
          <>
            <StatsStrip base={base} />
            <Card className="p-5">
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Detail label="Created" value={formatDateTime(endpoint.createdAt)} />
                <Detail label="Updated" value={formatDateTime(endpoint.updatedAt)} />
                <Detail
                  label="Rate limit"
                  value={endpoint.rateLimit ? `${endpoint.rateLimit}/s` : "—"}
                />
              </dl>
            </Card>
            <SecretCard base={base} />
            <SubscriptionsCard base={base} endpoint={endpoint} onSaved={reload} />
            {consoleAppId && consoleEndpointId ? (
              <PortalLinkButton
                appId={consoleAppId}
                to={`/portal/endpoints/${encodeURIComponent(consoleEndpointId)}`}
                title="Consumer portal link"
                description="Share a magic link that opens this endpoint's settings in the App Portal for your customer."
                buttonLabel="Create link"
              />
            ) : null}
          </>
        ) : null}

        {tab === "testing" ? (
          <SendExampleCard
            base={base}
            endpoint={endpoint}
            isPortal={isPortal}
            onSent={() => setTab("activity")}
          />
        ) : null}

        {tab === "advanced" ? (
          <>
            <RateLimitCard base={base} endpoint={endpoint} onSaved={reload} />
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
  const [filterTypes, setFilterTypes] = useState<string[] | null>(
    endpoint.filterTypes && endpoint.filterTypes.length > 0
      ? endpoint.filterTypes
      : null,
  );
  const [channels, setChannels] = useState<string[]>(endpoint.channels ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await apiSend("PATCH", base, {
        filterTypes: filterTypes && filterTypes.length > 0 ? filterTypes : null,
        channels: channels.length > 0 ? channels : null,
      });
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
        Choose which event types this endpoint receives, and optionally restrict
        it to specific channels.
      </p>
      <div className="mt-3">
        <EventTypePicker
          catalogPath={catalogPathFor(base)}
          value={filterTypes}
          onChange={setFilterTypes}
        />
      </div>
      <div className="mt-4">
        <Field
          label="Channels"
          hint="Only deliver messages tagged with these channels (leave empty for all)."
        >
          <ChipInput
            values={channels}
            onChange={setChannels}
            placeholder="Add a channel and press Enter"
          />
        </Field>
      </div>
      {error ? <div className="mt-3"><Alert>{error}</Alert></div> : null}
      <div className="mt-3 flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save subscriptions"}
        </Button>
        {saved ? <span className="text-xs text-green-600">Saved</span> : null}
      </div>
    </Card>
  );
}

function StatsStrip({ base }: { base: string }) {
  const [stats, setStats] = useState<EndpointStats | null>(null);

  useEffect(() => {
    let active = true;
    apiGet<EndpointStats>(`${base}/stats`)
      .then((s) => {
        if (active) setStats(s);
      })
      .catch(() => {}); // guarded: hide strip when unsupported
    return () => {
      active = false;
    };
  }, [base]);

  if (!stats) return null;
  const cells: Array<{ label: string; value: number; tone: string }> = [
    { label: "Succeeded", value: stats.success, tone: "text-green-700" },
    { label: "Pending", value: stats.pending, tone: "text-amber-700" },
    { label: "Sending", value: stats.sending, tone: "text-blue-700" },
    { label: "Failed", value: stats.fail, tone: "text-red-700" },
  ];

  return (
    <Card className="p-0">
      <dl className="grid grid-cols-4 divide-x divide-zinc-100">
        {cells.map((c) => (
          <div key={c.label} className="px-4 py-3 text-center">
            <dt className="text-xs uppercase tracking-wide text-zinc-400">
              {c.label}
            </dt>
            <dd className={`mt-0.5 text-lg font-semibold ${c.tone}`}>{c.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function RateLimitCard({
  base,
  endpoint,
  onSaved,
}: {
  base: string;
  endpoint: Endpoint;
  onSaved: () => Promise<void> | void;
}) {
  const [rate, setRate] = useState(
    endpoint.rateLimit ? String(endpoint.rateLimit) : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await apiSend("PATCH", base, {
        rateLimit: rate.trim() ? Number(rate) : null,
      });
      await onSaved();
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <CardHeading icon="activity" title="Rate limit" />
      <p className="mt-1 text-sm text-zinc-500">
        Cap delivery throughput to this endpoint. Leave blank for no limit.
      </p>
      <div className="mt-3 flex items-end gap-3">
        <div className="w-48">
          <Field label="Messages per second" htmlFor="rate-limit">
            <Input
              id="rate-limit"
              type="number"
              min={1}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="No limit"
            />
          </Field>
        </div>
        <div className="pb-4">
          <Button size="sm" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
        {saved ? <span className="pb-5 text-xs text-green-600">Saved</span> : null}
      </div>
      {error ? <Alert>{error}</Alert> : null}
    </Card>
  );
}

function SendExampleCard({
  base,
  endpoint,
  isPortal,
  onSent,
}: {
  base: string;
  endpoint: Endpoint;
  isPortal: boolean;
  onSent: () => void;
}) {
  const suggestions = endpoint.filterTypes ?? [];
  const [eventType, setEventType] = useState(suggestions[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [sent, setSent] = useState(false);

  // App Portal tokens are not permitted to send example events on svix-server,
  // so guard the consumer view rather than show a 403.
  if (isPortal) {
    return (
      <Card className="p-5">
        <CardHeading icon="send" title="Send a test event" />
        <div className="mt-3">
          <Alert tone="info">
            Sending test events isn&apos;t available from the App Portal. Ask your
            provider to trigger one from their console.
          </Alert>
        </div>
      </Card>
    );
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setUnsupported(false);
    setSent(false);
    try {
      await apiSend("POST", `${base}/send-example`, { eventType });
      setSent(true);
    } catch (err) {
      // svix-server cannot always generate an example (400) and may forbid it
      // (403); surface that as an expected, explained state rather than an error.
      if (err instanceof ApiError && (err.status === 400 || err.status === 403)) {
        setUnsupported(true);
      } else {
        setError(err instanceof ApiError ? err.message : "Failed to send");
      }
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
        {unsupported ? (
          <div className="mt-3">
            <Alert tone="info">
              This svix-server build can&apos;t generate an example for this event
              type. Example generation isn&apos;t supported on every svix-server
              version — you can still trigger a real event from your application.
            </Alert>
          </div>
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
  // Distinguish "loaded, none configured" from "couldn't load": saving with an
  // unread config would PATCH over the existing headers. Block Save until a
  // successful load (a 404 = unsupported/none, which is a safe empty state).
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiGet<EndpointHeaders>(`${base}/headers`)
      .then((res) => {
        if (!active) return;
        setRows(Object.entries(res.headers ?? {}).map(([key, value]) => ({ key, value })));
        setLoaded(true);
      })
      .catch((e) => {
        if (!active) return;
        if (e instanceof ApiError && e.status === 404) setLoaded(true);
        else setLoadError(e instanceof ApiError ? e.message : "Failed to load headers");
      });
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
      {loadError ? (
        <div className="mt-3">
          <Alert>
            Couldn&apos;t load the current headers ({loadError}). Editing is
            disabled so a save can&apos;t overwrite them — reload to try again.
          </Alert>
        </div>
      ) : null}
      {error ? <div className="mt-3"><Alert>{error}</Alert></div> : null}
      <div className="mt-3 flex items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          disabled={!loaded}
          onClick={() => setRows((r) => [...r, { key: "", value: "" }])}
        >
          Add header
        </Button>
        <Button size="sm" onClick={save} disabled={busy || !loaded}>
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
  // null = loading, true = server supports it, false = not on this svix-server.
  const [supported, setSupported] = useState<boolean | null>(null);
  // Non-404 load failure: don't let a save overwrite an unread transformation.
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiGet<EndpointTransformation>(`${base}/transformation`)
      .then((t) => {
        if (!active) return;
        setEnabled(Boolean(t.enabled));
        setCode(t.code ?? "");
        setSupported(true);
      })
      .catch((e) => {
        if (!active) return;
        // svix-server builds without transformations return 404 for this route.
        if (e instanceof ApiError && e.status === 404) {
          setSupported(false);
        } else {
          setSupported(true);
          setLoadError(e instanceof ApiError ? e.message : "Failed to load transformation");
        }
      });
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

  if (supported === false) {
    return (
      <Card className="p-5">
        <CardHeading icon="code" title="Transformation" />
        <div className="mt-3">
          <Alert tone="info">
            Transformations aren&apos;t supported by this svix-server build.
            Custom headers above still apply to every delivery.
          </Alert>
        </div>
      </Card>
    );
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
      {loadError ? (
        <div className="mt-3">
          <Alert>
            Couldn&apos;t load the current transformation ({loadError}). Editing
            is disabled so a save can&apos;t overwrite it — reload to try again.
          </Alert>
        </div>
      ) : null}
      {error ? <div className="mt-3"><Alert>{error}</Alert></div> : null}
      <div className="mt-3 flex items-center gap-3">
        {code.trim().length === 0 ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={Boolean(loadError)}
            onClick={() => setCode(TRANSFORM_TEMPLATE)}
          >
            Insert template
          </Button>
        ) : null}
        <Button size="sm" onClick={save} disabled={busy || Boolean(loadError)}>
          {busy ? "Saving…" : "Save transformation"}
        </Button>
        {saved ? <span className="text-xs text-green-600">Saved</span> : null}
      </div>
    </Card>
  );
}

export function AttemptRow({
  attempt,
  expanded,
  onToggle,
  onResend,
  resending,
  showEndpoint,
  sentPayload,
}: {
  attempt: MessageAttempt;
  expanded: boolean;
  onToggle: () => void;
  onResend?: () => void;
  resending?: boolean;
  showEndpoint?: boolean;
  /** The message body that was delivered. "loading"/null while fetching/failed;
   *  undefined = don't show (e.g. already shown elsewhere on the page). */
  sentPayload?: "loading" | Record<string, unknown> | null;
}) {
  const s = attemptStatus(attempt.status);
  return (
    <li>
      <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 items-center gap-2 text-left"
        >
          <Icon
            name="chevronRight"
            size={12}
            className={cn(
              "text-zinc-400 transition-transform",
              expanded && "rotate-90",
            )}
          />
          <Badge tone={s.tone}>{s.label}</Badge>
          <span className="font-mono text-xs text-zinc-500">
            {attempt.responseStatusCode || "—"}
          </span>
          {showEndpoint ? (
            <span className="truncate font-mono text-xs text-zinc-400">
              {attempt.url}
            </span>
          ) : null}
        </button>
        <span className="flex shrink-0 items-center gap-3">
          <span className="text-xs text-zinc-400">
            {formatDateTime(attempt.timestamp)}
          </span>
          {onResend ? (
            <Button variant="ghost" size="sm" onClick={onResend} disabled={resending}>
              {resending ? "…" : "Resend"}
            </Button>
          ) : null}
        </span>
      </div>
      {expanded ? (
        <div className="border-t border-zinc-100 bg-zinc-50/60 px-4 py-3">
          <dl className="grid grid-cols-3 gap-3 text-xs">
            <AttemptMeta
              label="Status code"
              value={String(attempt.responseStatusCode || "—")}
            />
            <AttemptMeta
              label="Duration"
              value={
                attempt.responseDurationMs != null
                  ? `${attempt.responseDurationMs} ms`
                  : "—"
              }
            />
            <AttemptMeta
              label="Trigger"
              value={attempt.triggerType === 1 ? "Manual" : "Scheduled"}
            />
          </dl>
          {sentPayload !== undefined ? (
            <>
              <p className="mt-3 text-xs uppercase tracking-wide text-zinc-400">
                Sent payload
              </p>
              <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-white p-3 font-mono text-xs text-zinc-800 ring-1 ring-zinc-200">
                {sentPayload === "loading"
                  ? "Loading…"
                  : sentPayload === null
                    ? "(payload unavailable — it may have expired)"
                    : JSON.stringify(sentPayload, null, 2)}
              </pre>
            </>
          ) : null}
          <p className="mt-3 text-xs uppercase tracking-wide text-zinc-400">
            Response body
          </p>
          <pre className="mt-1 max-h-48 overflow-auto rounded-md bg-white p-3 font-mono text-xs text-zinc-800 ring-1 ring-zinc-200">
            {attempt.response || "(empty)"}
          </pre>
        </div>
      ) : null}
    </li>
  );
}

function AttemptMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-0.5 font-mono text-zinc-700">{value}</dd>
    </div>
  );
}

const RECOVER_PRESETS: Array<[string, string]> = [
  ["1h", "Last hour"],
  ["24h", "Last 24 hours"],
  ["7d", "Last 7 days"],
  ["custom", "Custom range"],
];

function RecoverModal({
  open,
  base,
  onClose,
  onDone,
}: {
  open: boolean;
  base: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [preset, setPreset] = useState("24h");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    let sinceIso: string;
    let untilIso: string | undefined;
    if (preset === "custom") {
      if (!since) {
        setError("Pick a start time.");
        setBusy(false);
        return;
      }
      sinceIso = new Date(since).toISOString();
      untilIso = until ? new Date(until).toISOString() : undefined;
    } else {
      const hours = preset === "1h" ? 1 : preset === "7d" ? 24 * 7 : 24;
      sinceIso = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    }
    try {
      const res = await apiSend<{ status?: string }>("POST", `${base}/recover`, {
        since: sinceIso,
        until: untilIso,
      });
      onDone(
        `Recovery ${res?.status ? `(${res.status})` : "queued"} — failed messages are being re-sent.`,
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to start recovery");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Recover failed messages"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={run} disabled={busy}>
            {busy ? "Starting…" : "Start recovery"}
          </Button>
        </>
      }
    >
      <p className="text-sm text-zinc-500">
        Re-send messages that failed delivery to this endpoint within a time
        window. Svix limits recovery to the last 14 days.
      </p>
      {error ? <div className="mt-3"><Alert>{error}</Alert></div> : null}
      <div className="mt-4 space-y-2">
        {RECOVER_PRESETS.map(([k, l]) => (
          <label key={k} className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="radio"
              checked={preset === k}
              onChange={() => setPreset(k)}
            />
            {l}
          </label>
        ))}
      </div>
      {preset === "custom" ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Since" htmlFor="rec-since">
            <Input
              id="rec-since"
              type="datetime-local"
              value={since}
              onChange={(e) => setSince(e.target.value)}
            />
          </Field>
          <Field label="Until (optional)" htmlFor="rec-until">
            <Input
              id="rec-until"
              type="datetime-local"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </Field>
        </div>
      ) : null}
    </Modal>
  );
}

function DeliveriesCard({ base }: { base: string }) {
  const attempts = usePaginatedList<MessageAttempt>(
    `${base}/attempts?with_content=true`,
    15,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [recoverOpen, setRecoverOpen] = useState(false);
  // The delivered payload lives on the Message, not the attempt — fetch it
  // lazily (once per message) when a delivery row is expanded.
  const [payloads, setPayloads] = useState<
    Record<string, "loading" | Record<string, unknown> | null>
  >({});
  const messageBase = base.replace(/\/endpoints\/[^/]+$/, "");

  function toggle(a: MessageAttempt) {
    const next = expanded === a.id ? null : a.id;
    setExpanded(next);
    if (next && payloads[a.msgId] === undefined) {
      setPayloads((p) => ({ ...p, [a.msgId]: "loading" }));
      apiGet<Message>(`${messageBase}/messages/${encodeURIComponent(a.msgId)}`)
        .then((m) => setPayloads((p) => ({ ...p, [a.msgId]: m.payload })))
        .catch(() => setPayloads((p) => ({ ...p, [a.msgId]: null })));
    }
  }

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

  return (
    <Card className="p-5">
      <RecoverModal
        open={recoverOpen}
        base={base}
        onClose={() => setRecoverOpen(false)}
        onDone={(msg) => {
          setRecoverOpen(false);
          setNotice(msg);
        }}
      />
      <CardHeading icon="activity" title="Recent deliveries">
        <Button variant="secondary" size="sm" onClick={() => setRecoverOpen(true)}>
          Recover failed
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
            {attempts.items.map((a) => (
              <AttemptRow
                key={a.id}
                attempt={a}
                expanded={expanded === a.id}
                onToggle={() => toggle(a)}
                onResend={() => resend(a.id, a.msgId)}
                resending={resendingId === a.id}
                sentPayload={payloads[a.msgId]}
              />
            ))}
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
