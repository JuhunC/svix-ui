"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert, Card, PageHeader, Spinner } from "@/components/ui";
import { Icon } from "@/components/icons";
import { apiGet } from "@/lib/api/fetcher";
import { Code, ExternalLink, Section } from "@/components/guide/helpers";
import {
  OperationRow,
  anchorFor,
  samplePayloadFor,
} from "@/components/guide/operation-row";
import { Playground } from "@/components/guide/playground";
import type { EventType, ListResponse } from "@/lib/svix/types";

const SECTIONS: Array<{ id: string; title: string }> = [
  { id: "overview", title: "How it works" },
  { id: "events", title: "Events" },
  { id: "playground", title: "Try it out" },
  { id: "receive", title: "Receive & verify" },
  { id: "headers", title: "Request headers" },
  { id: "firewall", title: "Private networks" },
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [seed, setSeed] = useState<{ payload: string; nonce: number } | null>(null);

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

  function tryIt(payload: string) {
    setSeed((s) => ({ payload, nonce: (s?.nonce ?? 0) + 1 }));
    document.getElementById("playground")?.scrollIntoView({ behavior: "smooth" });
  }

  function openFromNav(name: string) {
    setExpanded((e) => ({ ...e, [name]: true }));
  }

  return (
    <div>
      <PageHeader
        title="Webhook reference"
        description="Every event this service sends, with sample payloads, real signed deliveries, and an interactive playground — like Swagger, for webhooks."
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
              spec. Receive and verify them with the official{" "}
              <strong>Svix libraries</strong> for Node, Python, Go, Ruby, PHP,
              Java, Rust, and more —{" "}
              <ExternalLink href="https://docs.svix.com/receiving/">
                docs.svix.com/receiving
              </ExternalLink>
              .
            </p>
          </div>
        </div>
      </div>

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
                  {s.id === "events" && types && types.length > 0 ? (
                    <ul className="space-y-0.5 py-0.5">
                      {types.map((t) => (
                        <li key={t.name}>
                          <a
                            href={`#${anchorFor(t.name)}`}
                            onClick={() => openFromNav(t.name)}
                            className="-ml-px block truncate border-l border-transparent py-0.5 pl-6 font-mono text-xs text-zinc-400 hover:border-accent hover:text-zinc-800"
                          >
                            {t.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
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

          <Section id="events" title="Events">
            <p>
              Every event type this service can send. Expand one to see the
              exact delivery — headers with a real signature, and the payload as
              sample data or JSON Schema. <strong>Try it out</strong> loads the
              sample into the playground below.
            </p>
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
            <div className="space-y-2">
              {(types ?? []).map((et) => (
                <OperationRow
                  key={et.name}
                  eventType={et}
                  expanded={Boolean(expanded[et.name])}
                  onToggle={() =>
                    setExpanded((e) => ({ ...e, [et.name]: !e[et.name] }))
                  }
                  onTryIt={tryIt}
                />
              ))}
            </div>
          </Section>

          <Section id="playground" title="Try it out">
            <Playground seed={seed} />
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

function HeaderRow({ name, desc }: { name: string; desc: string }) {
  return (
    <tr>
      <td className="py-2 pr-4 align-top font-mono text-xs text-zinc-900">{name}</td>
      <td className="py-2 align-top text-zinc-600">{desc}</td>
    </tr>
  );
}

// Re-exported for callers that want to deep-link a specific event type.
export { anchorFor, samplePayloadFor };
