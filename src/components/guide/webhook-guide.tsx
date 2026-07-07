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
  { id: "overview", title: "How it works" },
  { id: "receive", title: "Receive & verify" },
  { id: "headers", title: "Request headers" },
  { id: "schemas", title: "Event payloads" },
  { id: "firewall", title: "Private networks" },
  { id: "testing", title: "Test it" },
  { id: "resources", title: "Svix docs & links" },
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

  console.log("received webhook", payload); // payload matches the event type's schema
  res.sendStatus(204); // acknowledge fast; do slow work asynchronously
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

// rawBody MUST be the exact bytes received (string or Buffer), not JSON.parse'd.
function verify(rawBody, headers, secret) {
  const id = headers["svix-id"];
  const ts = headers["svix-timestamp"];
  const sigHeader = headers["svix-signature"]; // e.g. "v1,AAA... v1,BBB..."
  if (!id || !ts || !sigHeader) throw new Error("missing svix headers");

  // Reject timestamps outside a 5-minute window (replay protection).
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(ts)) > 300)
    throw new Error("timestamp out of tolerance");

  // Sign  id + "." + timestamp + "." + rawBody  with the base64 secret.
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto
    .createHmac("sha256", key)
    .update(id + "." + ts + "." + rawBody)
    .digest("base64");

  // Constant-time compare against each space-delimited "version,signature".
  const ok = sigHeader.split(" ").some((part) => {
    const sig = part.split(",")[1];
    return sig && sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  });
  if (!ok) throw new Error("no matching signature");
  return JSON.parse(rawBody);
}`;

const FIREWALL_CLIENT = `# Your side: allow inbound ONLY from the svix-server host's egress IP.
# ufw (Debian / Ubuntu)
sudo ufw allow from 203.0.113.10 to any port 8080 proto tcp

# iptables
sudo iptables -A INPUT -p tcp -s 203.0.113.10 --dport 8080 -j ACCEPT`;

const FIREWALL_SERVER = `# Provider side (on the svix-server host): svix-server blocks private IPs by
# default (SSRF protection). Whitelist your subnet or deliveries silently fail.
SVIX_WHITELIST_SUBNETS: "10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"`;

const TEST_CURL = `curl -sS -X POST http://YOUR_HOST:8080/webhooks -d '{"ping":true}' -w "\\n%{http_code}\\n"`;

export function WebhookGuide({
  eventTypes,
  eventTypesEndpoint,
  portalLinks = false,
}: {
  /** Pre-loaded event types (public page renders these server-side). */
  eventTypes?: EventType[];
  /** Or a path to fetch them client-side (portal, with the session cookie). */
  eventTypesEndpoint?: string;
  /** Show in-portal cross-links (only meaningful for a signed-in consumer). */
  portalLinks?: boolean;
}) {
  const [types, setTypes] = useState<EventType[] | null>(eventTypes ?? null);
  const [typesError, setTypesError] = useState<string | null>(null);

  useEffect(() => {
    if (eventTypes || !eventTypesEndpoint) return;
    let active = true;
    apiGet<ListResponse<EventType>>(eventTypesEndpoint)
      .then((r) => {
        if (active) setTypes(r.data);
      })
      .catch((e) => {
        if (active) setTypesError(e instanceof Error ? e.message : "Failed to load event types");
      });
    return () => {
      active = false;
    };
  }, [eventTypes, eventTypesEndpoint]);

  return (
    <div>
      <PageHeader
        title="Webhook integration guide"
        description="How to receive, verify, and test the webhooks this service sends — with copy-paste examples and the JSON payload for every event type."
      />

      {/* Make it obvious the webhooks are Svix-based, so integrators know
       * they can reuse the official Svix libraries and docs. */}
      <div className="mb-8 rounded-lg border border-accent-ring bg-accent-soft p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-white">
            <Icon name="endpoints" size={17} />
          </span>
          <div className="min-w-0 text-sm leading-6 text-zinc-700">
            <p className="text-base font-semibold text-zinc-900">Powered by Svix</p>
            <p className="mt-1">
              These webhooks are delivered by <strong>Svix</strong>, the open
              webhook service, and follow the{" "}
              <ExternalLink href="https://www.standardwebhooks.com">
                Standard Webhooks
              </ExternalLink>{" "}
              spec. You can receive and verify them with the official{" "}
              <strong>Svix libraries</strong> for Node, Python, Go, Ruby, PHP,
              Java, Rust, and more — everything below works the same way for any
              Svix-powered provider.
            </p>
            <p className="mt-2">
              Full docs:{" "}
              <ExternalLink href="https://docs.svix.com/receiving/">
                docs.svix.com/receiving
              </ExternalLink>
              .
            </p>
          </div>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-8">
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
          <Section id="overview" title="How it works">
            <ul className="ml-5 list-disc space-y-1">
              <li>Each event is an HTTPS <Code>POST</Code> to your URL with a JSON body — the payload.</li>
              <li>Every request is <strong>signed</strong>. Verify it, then reply with any <Code>2xx</Code> quickly.</li>
              <li>Delivery is <strong>at-least-once</strong> and retried on failure — dedupe on the <Code>svix-id</Code> header.</li>
            </ul>
          </Section>

          <Section id="receive" title="Receive & verify">
            <p>
              Use the official Svix library — it checks the signature, does a
              timing-safe compare, and enforces the timestamp window for you.
              Verify the <strong>raw body</strong>, then respond <Code>2xx</Code>.
            </p>
            <Code label="Node.js (Express)">{NODE_SVIX}</Code>
            <Code label="Python (Flask)">{PYTHON_SVIX}</Code>
            <p className="text-sm text-zinc-500">
              No Svix library for your language? Here&apos;s the exact algorithm —
              the gotcha is verifying the raw bytes, not a re-serialized object.
            </p>
            <Code label="Manual verification (Node.js, no library)">{NODE_MANUAL}</Code>
          </Section>

          <Section id="headers" title="Request headers">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse text-sm">
                <thead className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Header</th>
                    <th className="py-2 font-medium">Meaning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  <HeaderRow name="svix-id" desc="Unique message ID. Dedupe retried deliveries on this." />
                  <HeaderRow name="svix-timestamp" desc="Unix seconds the message was signed. Reject if too old." />
                  <HeaderRow name="svix-signature" desc="Space-delimited v1,… signatures. Match at least one." />
                  <HeaderRow name="content-type" desc="application/json — the body is the raw JSON payload." />
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="schemas" title="Event payloads">
            <p>Each webhook body matches its event type&apos;s JSON Schema:</p>
            {typesError ? <Alert>{typesError}</Alert> : null}
            {types === null && !typesError ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : null}
            {types && types.length === 0 ? (
              <Card className="p-6 text-sm text-zinc-500">
                No event types have been published yet.
              </Card>
            ) : null}
            <div className="space-y-4">
              {(types ?? []).map((et) => (
                <SchemaCard key={et.name} eventType={et} />
              ))}
            </div>
          </Section>

          <Section id="firewall" title="Private networks & firewalls">
            <p>
              If your receiver is on a private network, traffic must flow both
              ways — configure <em>both</em> sides:
            </p>
            <Code label="1. Your side — allow inbound from the svix-server host IP">{FIREWALL_CLIENT}</Code>
            <Code label="2. Provider side — let svix-server reach a private IP">{FIREWALL_SERVER}</Code>
            <p className="text-sm text-zinc-500">
              Most private-network failures are the provider-side whitelist:
              svix-server won&apos;t even connect to a private IP without it. Share
              the second snippet with your provider if deliveries never arrive.
            </p>
          </Section>

          <Section id="testing" title="Test it">
            <ol className="ml-5 list-decimal space-y-1">
              <li>Run the receiver above with your endpoint&apos;s <Code>whsec_…</Code> secret.</li>
              <li>Trigger an event (or ask your provider to send a test one).</li>
              {portalLinks ? (
                <li>
                  Watch the{" "}
                  <Link className="text-accent hover:underline" href="/portal/activity">
                    Activity
                  </Link>{" "}
                  page: sent payload, your response, and status. <Code>2xx</Code> = success.
                </li>
              ) : (
                <li>Check your provider&apos;s dashboard: it shows the sent payload, your response, and status.</li>
              )}
            </ol>
            <p className="text-sm text-zinc-500">Quick reachability check (no signature):</p>
            <Code label="Reachability check">{TEST_CURL}</Code>
          </Section>

          <Section id="resources" title="Svix docs & links">
            <ul className="ml-5 list-disc space-y-1">
              <li><ExternalLink href="https://docs.svix.com/receiving/">Receiving webhooks — overview</ExternalLink></li>
              <li><ExternalLink href="https://docs.svix.com/receiving/verifying-payloads/how">Verifying payloads (all languages)</ExternalLink></li>
              <li><ExternalLink href="https://docs.svix.com/receiving/verifying-payloads/how-manual">Manual signature verification</ExternalLink></li>
              <li><ExternalLink href="https://docs.svix.com/consuming-webhooks-best-practices">Best practices for consuming webhooks</ExternalLink></li>
              <li><ExternalLink href="https://www.standardwebhooks.com">Standard Webhooks — the open spec Svix follows</ExternalLink></li>
            </ul>
            {portalLinks ? (
              <p className="text-sm text-zinc-500">
                In this portal:{" "}
                <Link className="text-accent hover:underline" href="/portal/endpoints">Endpoints</Link>{" "}
                (URL &amp; secret) ·{" "}
                <Link className="text-accent hover:underline" href="/portal/activity">Activity</Link>{" "}
                (deliveries) ·{" "}
                <Link className="text-accent hover:underline" href="/portal/catalog">Event catalog</Link>.
              </p>
            ) : null}
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

/** Inline code, or a labeled dark block with a copy button. */
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
  const [view, setView] = useState<"schema" | "example">("example");
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
