"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Alert, Button, Card, PageHeader, Spinner } from "@/components/ui";
import { Icon } from "@/components/icons";
import { apiGet } from "@/lib/api/fetcher";
import { copyToClipboard } from "@/lib/clipboard";
import { exampleFromSchema } from "@/lib/svix/schema-example";
import type { EventType, ListResponse } from "@/lib/svix/types";

const SECTIONS: Array<{ id: string; title: string }> = [
  { id: "overview", title: "How delivery works" },
  { id: "endpoint", title: "Your receiving endpoint" },
  { id: "headers", title: "Request headers" },
  { id: "verify", title: "Verify the signature" },
  { id: "retries", title: "Retries, idempotency & failures" },
  { id: "schemas", title: "Event types & payload schemas" },
  { id: "firewall", title: "Firewall & private networks" },
  { id: "testing", title: "Test your integration" },
  { id: "resources", title: "Reference & links" },
];

const NODE_SVIX = `// npm install svix express
import express from "express";
import { Webhook } from "svix";

const app = express();
const secret = process.env.WEBHOOK_SECRET; // your endpoint's signing secret: "whsec_..."

// Verify against the RAW request body — never a re-serialized JSON object.
app.post("/webhooks", express.raw({ type: "application/json" }), (req, res) => {
  let payload;
  try {
    payload = new Webhook(secret).verify(req.body, {
      "svix-id": req.header("svix-id"),
      "svix-timestamp": req.header("svix-timestamp"),
      "svix-signature": req.header("svix-signature"),
    });
  } catch {
    return res.status(400).send("invalid signature");
  }

  // payload is the verified JSON body — it matches the event type's schema.
  console.log("received webhook", payload);
  res.sendStatus(204); // acknowledge fast; do heavy work asynchronously
});

app.listen(8080);`;

const PYTHON_SVIX = `# pip install svix flask
import os
from flask import Flask, request
from svix.webhooks import Webhook, WebhookVerificationError

app = Flask(__name__)
secret = os.environ["WEBHOOK_SECRET"]  # "whsec_..."

@app.post("/webhooks")
def webhook():
    try:
        payload = Webhook(secret).verify(request.data, dict(request.headers))
    except WebhookVerificationError:
        return "", 400
    print("received webhook", payload)
    return "", 204`;

const NODE_MANUAL = `import crypto from "node:crypto";

// Verify a Svix webhook without the library.
// rawBody MUST be the exact bytes received (string or Buffer), not JSON.parse'd.
function verify(rawBody, headers, secret) {
  const id = headers["svix-id"];
  const ts = headers["svix-timestamp"];
  const sigHeader = headers["svix-signature"]; // e.g. "v1,AAA... v1,BBB..."
  if (!id || !ts || !sigHeader) throw new Error("missing svix headers");

  // 1. Replay protection: reject timestamps outside a 5-minute window.
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(ts)) > 300) throw new Error("timestamp out of tolerance");

  // 2. Decode the secret (the base64 part after the "whsec_" prefix).
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");

  // 3. HMAC-SHA256 over  id + "." + timestamp + "." + rawBody  then base64-encode.
  const signedContent = id + "." + ts + "." + rawBody;
  const expected = crypto.createHmac("sha256", key).update(signedContent).digest("base64");

  // 4. Constant-time compare against each space-delimited "version,signature".
  const ok = sigHeader.split(" ").some((part) => {
    const sig = part.split(",")[1];
    return sig && sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  });
  if (!ok) throw new Error("no matching signature");
  return JSON.parse(rawBody);
}`;

const FIREWALL_CLIENT = `# Your receiver is on a private network. Allow inbound webhook traffic ONLY from
# the svix-server host's egress IP (ask your provider for it). Example port 8080.

# ufw (Debian / Ubuntu)
sudo ufw allow from 203.0.113.10 to any port 8080 proto tcp

# iptables
sudo iptables -A INPUT -p tcp -s 203.0.113.10 --dport 8080 -j ACCEPT

# Cloud security group — add an inbound rule:
#   protocol = TCP   port = 8080   source = 203.0.113.10/32`;

const FIREWALL_SERVER = `# Provider / operator side — on the svix-server host.
# svix-server blocks delivery to private IP ranges by default (SSRF protection),
# so deliveries to a private receiver silently fail. Whitelist its subnet:
SVIX_WHITELIST_SUBNETS: "10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"

# Then confirm svix-server can reach the endpoint from its OWN host:
curl -sS -X POST http://10.0.0.42:8080/webhooks -d '{}' -o /dev/null -w "%{http_code}\\n"`;

export function PortalGuide() {
  const [types, setTypes] = useState<EventType[] | null>(null);
  const [typesError, setTypesError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiGet<ListResponse<EventType>>("/api/portal/event-types?with_content=true&limit=250")
      .then((r) => {
        if (active) setTypes(r.data);
      })
      .catch((e) => {
        if (active) setTypesError(e instanceof Error ? e.message : "Failed to load event types");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <PageHeader
        title="Webhook integration guide"
        description="Everything you need to receive, verify, and test webhooks from this application — the payload schema for every event type, signature verification, and firewall setup for private networks."
      />

      <div className="lg:grid lg:grid-cols-[210px_1fr] lg:gap-8">
        <nav aria-label="On this page" className="hidden lg:block">
          <div className="sticky top-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              On this page
            </p>
            <ul className="space-y-1 border-l border-zinc-200">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="-ml-px block border-l border-transparent py-1 pl-3 text-sm text-zinc-500 hover:border-accent hover:text-zinc-900"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <div className="min-w-0 space-y-10">
          <Section id="overview" title="How delivery works">
            <p>
              When an event happens in the provider&apos;s system, it is sent to
              every endpoint you have subscribed to that event type. Delivery is
              a single HTTPS <Code>POST</Code> to your endpoint URL with a JSON
              body — the <em>payload</em>. Your job is to receive that request,
              verify it really came from the provider, and respond quickly.
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li>Delivery is <strong>at-least-once</strong>: a webhook may arrive more than once, so make your handler idempotent (see below).</li>
              <li>Order is <strong>not guaranteed</strong>. Use the payload&apos;s own fields or timestamps if you need ordering.</li>
              <li>Every request is <strong>signed</strong> so you can prove it came from the provider and was not tampered with.</li>
            </ul>
          </Section>

          <Section id="endpoint" title="Your receiving endpoint">
            <p>Expose one HTTP endpoint that meets these requirements:</p>
            <ul className="ml-5 list-disc space-y-1">
              <li>Accepts <Code>POST</Code> with <Code>Content-Type: application/json</Code>.</li>
              <li>Is reachable from the svix-server host (see <a className="text-accent hover:underline" href="#firewall">Firewall &amp; private networks</a>).</li>
              <li>Responds with any <strong>2xx</strong> status to acknowledge. Any other status (or a timeout) is treated as a failure and retried.</li>
              <li>Responds <strong>fast</strong> — acknowledge first (return <Code>2xx</Code>), then do slow processing asynchronously. Long handlers risk a delivery timeout and needless retries.</li>
              <li>Reads the <strong>raw request body</strong> for signature verification (see below) before parsing it as JSON.</li>
            </ul>
            <p className="text-sm text-zinc-500">
              You can find your endpoint&apos;s URL, signing secret, and event
              subscriptions on the{" "}
              <Link className="text-accent hover:underline" href="/portal/endpoints">
                Endpoints
              </Link>{" "}
              page.
            </p>
          </Section>

          <Section id="headers" title="Request headers">
            <p>Each delivery carries these headers:</p>
            <div className="overflow-x-auto">
              <table className="mt-2 w-full min-w-[34rem] border-collapse text-sm">
                <thead className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Header</th>
                    <th className="py-2 font-medium">Meaning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  <HeaderRow name="svix-id" desc="Unique message ID. Use it to deduplicate retried deliveries." />
                  <HeaderRow name="svix-timestamp" desc="Unix seconds the message was signed. Reject if too old (replay protection)." />
                  <HeaderRow name="svix-signature" desc="Space-delimited list of version,signature pairs (e.g. v1,…). Verify against at least one." />
                  <HeaderRow name="content-type" desc="application/json — the body is the raw JSON payload." />
                  <HeaderRow name="user-agent" desc="Identifies the Svix delivery agent." />
                </tbody>
              </table>
            </div>
            <p className="text-sm text-zinc-500">
              The provider may also attach custom headers your endpoint was
              configured with. The message body is exactly the JSON payload for
              the event type — nothing is wrapped around it.
            </p>
          </Section>

          <Section id="verify" title="Verify the signature">
            <p>
              <strong>Always verify the signature before trusting a webhook.</strong>{" "}
              It proves the request came from the provider and was not modified.
              The signature is an HMAC-SHA256 of{" "}
              <Code>{"svix-id . svix-timestamp . rawBody"}</Code> keyed with your
              endpoint&apos;s signing secret (the <Code>whsec_…</Code> value on the
              Endpoints page).
            </p>
            <p className="font-medium text-zinc-800">
              Recommended: use the official Svix libraries — they handle the
              parsing, timing-safe comparison, and timestamp tolerance for you.
            </p>
            <Code label="Node.js (Express)">{NODE_SVIX}</Code>
            <Code label="Python (Flask)">{PYTHON_SVIX}</Code>
            <p>
              If you can&apos;t use a library, here is the exact algorithm. The
              one rule that trips people up: verify the <strong>raw bytes</strong>{" "}
              of the body — if your framework parses JSON and you re-serialize it,
              the signature will not match.
            </p>
            <Code label="Manual verification (Node.js, no library)">{NODE_MANUAL}</Code>
            <p className="text-sm text-zinc-500">
              Svix&apos;s full guide, with examples in 13+ languages, is at{" "}
              <ExternalLink href="https://docs.svix.com/receiving/verifying-payloads/how">
                docs.svix.com/receiving/verifying-payloads
              </ExternalLink>
              .
            </p>
          </Section>

          <Section id="retries" title="Retries, idempotency & failures">
            <ul className="ml-5 list-disc space-y-1">
              <li><strong>Retries:</strong> if your endpoint doesn&apos;t return a 2xx, the provider retries several times with exponential backoff over roughly a day before giving up.</li>
              <li><strong>Idempotency:</strong> the same event can be delivered more than once (a retry, or a manual replay). Deduplicate on the <Code>svix-id</Code> header — process each ID at most once.</li>
              <li><strong>Inspecting deliveries:</strong> the{" "}
                <Link className="text-accent hover:underline" href="/portal/activity">
                  Activity
                </Link>{" "}
                page shows every delivery, the exact <em>sent payload</em>, the
                response your endpoint returned, and the status. Open a failed
                delivery to see your endpoint&apos;s response body.
              </li>
              <li><strong>Replaying:</strong> from an endpoint&apos;s Activity you can resend an individual message, or use <em>Recover failed</em> to replay a whole time window once your endpoint is healthy again.</li>
            </ul>
          </Section>

          <Section id="schemas" title="Event types & payload schemas">
            <p>
              Every webhook body matches the JSON Schema of its event type. Build
              and validate your handler against these. The full catalog with an
              example for each is on the{" "}
              <Link className="text-accent hover:underline" href="/portal/catalog">
                Event catalog
              </Link>{" "}
              page.
            </p>
            {typesError ? <Alert>{typesError}</Alert> : null}
            {types === null && !typesError ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : null}
            {types && types.length === 0 ? (
              <Card className="p-6 text-sm text-zinc-500">
                The provider hasn&apos;t published any event types yet.
              </Card>
            ) : null}
            <div className="space-y-4">
              {(types ?? []).map((et) => (
                <SchemaCard key={et.name} eventType={et} />
              ))}
            </div>
          </Section>

          <Section id="firewall" title="Firewall & private networks">
            <p>
              If your receiver is on a private network or behind a firewall,
              deliveries only succeed when traffic can flow <em>both</em> ways.
              There are two sides to configure.
            </p>
            <h3 className="mt-4 text-sm font-semibold text-zinc-900">1. Your side — allow inbound from the svix-server host</h3>
            <p>
              Open your endpoint&apos;s port to the svix-server host&apos;s egress
              IP only (ask your provider for it — don&apos;t open it to the whole
              internet). Then verify the delivery source IP on the{" "}
              <Link className="text-accent hover:underline" href="/portal/activity">
                Activity
              </Link>{" "}
              page matches.
            </p>
            <Code label="Allow inbound (replace the IP and port)">{FIREWALL_CLIENT}</Code>
            <h3 className="mt-4 text-sm font-semibold text-zinc-900">2. Provider side — let svix-server reach a private IP</h3>
            <p>
              This is the most common reason private-network deliveries fail:
              svix-server refuses to connect to private IP ranges by default
              (SSRF protection), so it never even reaches your firewall. The
              operator must whitelist your subnet. Share this with your provider
              if deliveries never arrive.
            </p>
            <Code label="svix-server (operator) configuration">{FIREWALL_SERVER}</Code>
            <p className="text-sm text-zinc-500">
              Quick diagnosis: if Activity shows deliveries with a connection /
              &quot;blocked&quot; error and never a real HTTP status from your
              endpoint, it&apos;s almost always the provider-side SSRF whitelist.
              If it shows an HTTP status (e.g. 000/timeout) but your endpoint sees
              nothing, it&apos;s your inbound firewall.
            </p>
          </Section>

          <Section id="testing" title="Test your integration">
            <ol className="ml-5 list-decimal space-y-2">
              <li>Run a receiver that verifies signatures — the Node or Python snippet above is a complete, working example. Point it at a port your provider can reach.</li>
              <li>On the{" "}
                <Link className="text-accent hover:underline" href="/portal/endpoints">
                  Endpoints
                </Link>{" "}
                page, set your endpoint URL, copy the <Code>whsec_…</Code> signing
                secret into your receiver, and subscribe to the event types you
                want.
              </li>
              <li>Trigger an event — either from your own app, or ask the provider to send a test event of that type from their console.</li>
              <li>Watch the{" "}
                <Link className="text-accent hover:underline" href="/portal/activity">
                  Activity
                </Link>{" "}
                page: you&apos;ll see the delivery, the exact sent payload, and the
                response your endpoint returned. A 2xx means success.
              </li>
              <li>Confirm your receiver logged the verified payload and that its shape matches the event type&apos;s schema above.</li>
            </ol>
            <p>Quick reachability check from the svix-server host (no signature):</p>
            <Code label="Reachability check">{'curl -sS -X POST http://YOUR_HOST:8080/webhooks -d \'{"ping":true}\' -w "\\n%{http_code}\\n"'}</Code>
          </Section>

          <Section id="resources" title="Reference & links">
            <ul className="ml-5 list-disc space-y-1">
              <li><ExternalLink href="https://docs.svix.com/receiving/introduction">Receiving webhooks — overview</ExternalLink></li>
              <li><ExternalLink href="https://docs.svix.com/receiving/verifying-payloads/how">Verifying payloads (all languages)</ExternalLink></li>
              <li><ExternalLink href="https://docs.svix.com/receiving/verifying-payloads/how-manual">Manual signature verification</ExternalLink></li>
              <li><ExternalLink href="https://docs.svix.com/consuming-webhooks-best-practices">Best practices for consuming webhooks</ExternalLink></li>
              <li><ExternalLink href="https://www.standardwebhooks.com">Standard Webhooks — the open spec Svix follows</ExternalLink></li>
            </ul>
            <p className="text-sm text-zinc-500">
              In this portal:{" "}
              <Link className="text-accent hover:underline" href="/portal/endpoints">Endpoints</Link>{" "}
              (URL, secret, subscriptions) ·{" "}
              <Link className="text-accent hover:underline" href="/portal/activity">Activity</Link>{" "}
              (deliveries &amp; payloads) ·{" "}
              <Link className="text-accent hover:underline" href="/portal/catalog">Event catalog</Link>{" "}
              (schemas).
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-zinc-700">{children}</div>
    </section>
  );
}

function HeaderRow({ name, desc }: { name: string; desc: string }) {
  return (
    <tr>
      <td className="py-2 pr-4 align-top font-mono text-xs text-zinc-900">{name}</td>
      <td className="py-2 align-top text-zinc-600">{desc}</td>
    </tr>
  );
}

/** Inline code. */
function Code({ children, label }: { children: string; label?: string }) {
  const isBlock = children.includes("\n") || Boolean(label);
  const [copied, setCopied] = useState(false);
  if (!isBlock) {
    return (
      <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.85em] text-zinc-800">
        {children}
      </code>
    );
  }
  return (
    <div className="mt-1">
      {label ? (
        <div className="rounded-t-md border border-b-0 border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-500">
          {label}
        </div>
      ) : null}
      <div className="relative">
        <button
          type="button"
          onClick={async () => setCopied(await copyToClipboard(children))}
          className="absolute right-2 top-2 z-10 rounded bg-white/10 px-2 py-0.5 text-xs text-zinc-300 hover:bg-white/20"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <pre
          className={`overflow-x-auto ${label ? "rounded-b-md" : "rounded-md"} bg-zinc-900 p-4 font-mono text-xs leading-relaxed text-zinc-100`}
        >
          {children}
        </pre>
      </div>
    </div>
  );
}

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-accent hover:underline"
    >
      {children}
      <Icon name="externalLink" size={13} />
    </a>
  );
}

function SchemaCard({ eventType }: { eventType: EventType }) {
  const [view, setView] = useState<"schema" | "example">("schema");
  const schema = eventType.schemas?.["1"];
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="font-mono text-sm font-medium text-zinc-900">
            {eventType.name}
          </span>
          {eventType.description ? (
            <p className="mt-0.5 text-sm text-zinc-500">{eventType.description}</p>
          ) : null}
        </div>
        {schema ? (
          <div className="flex shrink-0 gap-1">
            <Button
              variant={view === "schema" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("schema")}
            >
              Schema
            </Button>
            <Button
              variant={view === "example" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setView("example")}
            >
              Example
            </Button>
          </div>
        ) : (
          <span className="shrink-0 self-center text-xs text-zinc-400">
            No schema published
          </span>
        )}
      </div>
      {schema ? (
        <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-zinc-50 p-3 font-mono text-xs text-zinc-800 ring-1 ring-zinc-200">
          {JSON.stringify(view === "schema" ? schema : exampleFromSchema(schema), null, 2)}
        </pre>
      ) : null}
    </Card>
  );
}
