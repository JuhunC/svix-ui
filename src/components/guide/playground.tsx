"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Field, Input, Textarea, cn } from "@/components/ui";
import { Code } from "@/components/guide/helpers";
import {
  DEMO_SECRET,
  generateMsgId,
  signPayload,
  verifySignature,
} from "@/lib/webhooks/sign";
import { SAMPLE_MSG_ID, SAMPLE_TIMESTAMP } from "@/components/guide/operation-row";

const DOCS_VECTOR = {
  msgId: "msg_p5jXN8AQM9LWM0D4loKWxJek",
  timestamp: "1614265330",
  payload: '{"test": 2432232314}',
  signature: "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=",
};

const DEFAULT_PAYLOAD = `{
  "type": "demo.event",
  "data": { "example": true }
}`;

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/**
 * Swagger-style "try it out" for webhooks, entirely in the browser:
 * - Sign: build a genuinely signed sample delivery + the curl to send it.
 * - Verify: paste a received delivery and check its signature.
 */
export function Playground({
  seed,
}: {
  /** Bumped by "Try it out" on an operation row: seeds the payload box. */
  seed: { payload: string; nonce: number } | null;
}) {
  const [tab, setTab] = useState<"sign" | "verify">("sign");

  // --- Sign tab state --------------------------------------------------------
  const [url, setUrl] = useState("http://localhost:8080/webhooks");
  const [secret, setSecret] = useState(DEMO_SECRET);
  const [payload, setPayload] = useState(DEFAULT_PAYLOAD);
  // Deterministic initial values (SSR-safe); refreshed on mount.
  const [msgId, setMsgId] = useState(SAMPLE_MSG_ID);
  const [timestamp, setTimestamp] = useState(SAMPLE_TIMESTAMP);
  // "Now" snapshot for the verify tab's replay-window note (client-only).
  const [nowSec, setNowSec] = useState(0);

  useEffect(() => {
    // Runs once post-hydration to swap the fixed SSR-safe sample values for
    // fresh ones — no cascading renders beyond this initial pass.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMsgId(generateMsgId());
    setTimestamp(String(Math.floor(Date.now() / 1000)));
    setNowSec(Math.floor(Date.now() / 1000));
  }, []);

  useEffect(() => {
    if (seed) {
      // Seeding is driven by a parent-side click; a single follow-up render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPayload(seed.payload);
      setTab("sign");
    }
  }, [seed]);

  const signed = useMemo(() => {
    try {
      return { signature: signPayload(secret, msgId, timestamp, payload), error: null };
    } catch {
      return {
        signature: null,
        error: "Invalid secret — expected base64 after the whsec_ prefix.",
      };
    }
  }, [secret, msgId, timestamp, payload]);

  const payloadJsonError = useMemo(() => {
    try {
      JSON.parse(payload);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Invalid JSON";
    }
  }, [payload]);

  const curl = useMemo(() => {
    if (!signed.signature) return "";
    return [
      `curl -i -X POST ${shellQuote(url)} \\`,
      `  -H 'content-type: application/json' \\`,
      `  -H ${shellQuote(`svix-id: ${msgId}`)} \\`,
      `  -H ${shellQuote(`svix-timestamp: ${timestamp}`)} \\`,
      `  -H ${shellQuote(`svix-signature: ${signed.signature}`)} \\`,
      `  --data-raw ${shellQuote(payload)}`,
    ].join("\n");
  }, [url, msgId, timestamp, payload, signed.signature]);

  // --- Verify tab state ------------------------------------------------------
  const [vSecret, setVSecret] = useState(DEMO_SECRET);
  const [vId, setVId] = useState("");
  const [vTs, setVTs] = useState("");
  const [vSig, setVSig] = useState("");
  const [vBody, setVBody] = useState("");

  // Keep the replay-window note honest on long-lived tabs: re-snapshot "now"
  // whenever the pasted timestamp changes, not just at page load.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNowSec(Math.floor(Date.now() / 1000));
  }, [vTs]);

  const verdict = useMemo(() => {
    if (!vId && !vTs && !vSig && !vBody) return null;
    if (!vId || !vTs || !vSig || !vBody) return { ok: false, note: "Fill in all four delivery fields." };
    const ok = verifySignature(vSecret, vId, vTs, vBody, vSig);
    let note = ok
      ? "Signature is valid for this body and secret."
      : "No signature in the header matches — check the secret, and make sure the body is the exact raw bytes received.";
    const age = Math.abs(nowSec - Number(vTs));
    if (ok && nowSec > 0 && Number.isFinite(age) && age > 300) {
      note += ` Note: the timestamp is ${Math.round(age / 60)} minutes old — receivers should reject it (5-minute replay window).`;
    }
    return { ok, note };
  }, [vSecret, vId, vTs, vSig, vBody, nowSec]);

  return (
    <Card className="p-5">
      <div className="flex gap-1 border-b border-zinc-200 pb-3">
        <Button
          variant={tab === "sign" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setTab("sign")}
        >
          Build a signed delivery
        </Button>
        <Button
          variant={tab === "verify" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setTab("verify")}
        >
          Verify a delivery
        </Button>
      </div>

      {tab === "sign" ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-zinc-600">
            Everything is computed in your browser — nothing is sent anywhere.
            Edit any field and the signature updates. Then fire the curl at your
            receiver: with the same secret configured, verification must pass.
          </p>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Field label="Your endpoint URL" htmlFor="pg-url">
              <Input id="pg-url" value={url} onChange={(e) => setUrl(e.target.value)} />
            </Field>
            <Field
              label="Signing secret"
              htmlFor="pg-secret"
              hint="Demo secret from the Svix docs — replace with your endpoint's whsec_… to produce real signatures."
            >
              <Input
                id="pg-secret"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="font-mono"
              />
            </Field>
          </div>
          <Field
            label="Payload (raw body — signed byte-for-byte as typed)"
            htmlFor="pg-payload"
          >
            <Textarea
              id="pg-payload"
              rows={8}
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              spellCheck={false}
              className="text-xs"
            />
          </Field>
          {payloadJsonError ? (
            <p className="text-xs text-amber-700">
              Not valid JSON ({payloadJsonError}) — it will still be signed, but
              receivers typically expect JSON.
            </p>
          ) : null}
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-0 flex-1">
              <Field label="svix-id" htmlFor="pg-id">
                <Input
                  id="pg-id"
                  value={msgId}
                  onChange={(e) => setMsgId(e.target.value)}
                  className="font-mono text-xs"
                />
              </Field>
            </div>
            <div className="w-40">
              <Field label="svix-timestamp" htmlFor="pg-ts">
                <Input
                  id="pg-ts"
                  value={timestamp}
                  onChange={(e) => setTimestamp(e.target.value)}
                  className="font-mono text-xs"
                />
              </Field>
            </div>
            <div className="pb-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setMsgId(generateMsgId());
                  setTimestamp(String(Math.floor(Date.now() / 1000)));
                }}
              >
                Regenerate
              </Button>
            </div>
          </div>

          {signed.error ? (
            <p role="alert" className="text-sm text-red-600">
              {signed.error}
            </p>
          ) : (
            <>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Computed signature
                </p>
                <p className="break-all rounded-md bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-800 ring-1 ring-zinc-200">
                  {signed.signature}
                </p>
              </div>
              <Code label="Send it (curl)">{curl}</Code>
            </>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-zinc-600">
            Paste a delivery your endpoint received (headers + exact raw body)
            to check its signature. Runs entirely in your browser.
          </p>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Field label="Signing secret" htmlFor="pg-vsecret">
              <Input
                id="pg-vsecret"
                value={vSecret}
                onChange={(e) => setVSecret(e.target.value)}
                className="font-mono"
              />
            </Field>
            <Field label="svix-id" htmlFor="pg-vid">
              <Input
                id="pg-vid"
                value={vId}
                onChange={(e) => setVId(e.target.value)}
                className="font-mono text-xs"
              />
            </Field>
            <Field label="svix-timestamp" htmlFor="pg-vts">
              <Input
                id="pg-vts"
                value={vTs}
                onChange={(e) => setVTs(e.target.value)}
                className="font-mono text-xs"
              />
            </Field>
            <Field label="svix-signature" htmlFor="pg-vsig">
              <Input
                id="pg-vsig"
                value={vSig}
                onChange={(e) => setVSig(e.target.value)}
                className="font-mono text-xs"
              />
            </Field>
          </div>
          <Field label="Raw body (exact bytes received)" htmlFor="pg-vbody">
            <Textarea
              id="pg-vbody"
              rows={5}
              value={vBody}
              onChange={(e) => setVBody(e.target.value)}
              spellCheck={false}
              className="text-xs"
            />
          </Field>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setVSecret(DEMO_SECRET);
                setVId(DOCS_VECTOR.msgId);
                setVTs(DOCS_VECTOR.timestamp);
                setVSig(DOCS_VECTOR.signature);
                setVBody(DOCS_VECTOR.payload);
              }}
            >
              Fill with the documented example
            </Button>
            {verdict ? (
              <span
                role="status"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                  verdict.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    verdict.ok ? "bg-green-500" : "bg-red-500",
                  )}
                />
                {verdict.ok ? "Valid signature" : "Invalid"}
              </span>
            ) : null}
          </div>
          {verdict ? <p className="text-xs text-zinc-500">{verdict.note}</p> : null}
        </div>
      )}
    </Card>
  );
}
