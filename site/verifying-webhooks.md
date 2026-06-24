---
title: Verifying webhooks
layout: default
nav_order: 6
---

# Verifying webhooks
{: .no_toc }

Every webhook Svix delivers is signed so receivers can confirm it really came
from your server and was not tampered with or replayed. This page is for the
people building the **receiving** endpoints.

1. TOC
{:toc}

---

## The signature headers

Each delivery includes these headers:

| Header | Meaning |
|---|---|
| `svix-id` | Unique message id (also the idempotency key for the receiver). |
| `svix-timestamp` | Unix timestamp (seconds) when the message was sent. |
| `svix-signature` | Space-delimited list of signatures, each `v1,<base64>`. |

Svix also sends the [Standard Webhooks](https://www.standardwebhooks.com)
aliases `webhook-id`, `webhook-timestamp`, and `webhook-signature` with the same
values.

## The signing secret

Each endpoint has a secret shown in the console and the App Portal, prefixed
with `whsec_`. The part after the prefix is **base64-encoded**. Keep it secret;
it is the key used to verify signatures.

## Verify with the official libraries (recommended)

The simplest and safest path is the official Svix libraries, which handle the
signed-content construction, multiple signatures, and timestamp tolerance for
you.

### Node.js / TypeScript

```ts
import { Webhook } from "svix";

const wh = new Webhook(process.env.WEBHOOK_SECRET!); // whsec_...

// `payload` must be the RAW request body string (not the parsed object).
app.post("/webhooks", (req, res) => {
  try {
    const evt = wh.verify(req.body, {
      "svix-id": req.header("svix-id")!,
      "svix-timestamp": req.header("svix-timestamp")!,
      "svix-signature": req.header("svix-signature")!,
    });
    // evt is the verified, parsed payload
    res.sendStatus(204);
  } catch {
    res.sendStatus(400); // signature invalid → reject
  }
});
```

{: .warning }
Verify the **raw** request body, exactly as received. If your framework parses
JSON first and you re-serialize it, the bytes change and verification fails.
Configure a raw-body parser for the webhook route.

### Python

```python
from svix.webhooks import Webhook, WebhookVerificationError

wh = Webhook(os.environ["WEBHOOK_SECRET"])  # whsec_...

@app.post("/webhooks")
async def receive(request):
    payload = await request.body()  # raw bytes
    try:
        evt = wh.verify(payload, dict(request.headers))
    except WebhookVerificationError:
        return Response(status_code=400)
    return Response(status_code=204)
```

Libraries are also available for Go, Rust, Java/Kotlin, Ruby, C#, and PHP.

## Verify manually

If you can't use a library, the scheme is:

1. Strip the `whsec_` prefix and base64-decode the rest to get the key bytes.
2. Build the signed content as `{svix-id}.{svix-timestamp}.{rawBody}`.
3. Compute `HMAC-SHA256(key, signedContent)` and base64-encode it.
4. Compare (constant-time) against each `v1,<sig>` entry in `svix-signature`.
5. Reject if none match, or if `svix-timestamp` is more than ~5 minutes from now.

```js
const crypto = require("node:crypto");

function verify(secret, headers, rawBody) {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const id = headers["svix-id"];
  const ts = headers["svix-timestamp"];

  // Reject stale messages (replay protection).
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;

  const signedContent = `${id}.${ts}.${rawBody}`;
  const expected = crypto.createHmac("sha256", key).update(signedContent).digest("base64");

  return headers["svix-signature"]
    .split(" ")
    .map((s) => s.split(",")[1])
    .some((sig) =>
      sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)),
    );
}
```

## Good receiver practices

- **Respond fast with a 2xx.** Any `2xx` marks the delivery as successful. Do
  heavy work asynchronously and acknowledge quickly, or Svix will treat slow
  responses as failures and retry.
- **Be idempotent.** Retries mean the same `svix-id` can arrive more than once.
  De-duplicate on it.
- **Expect retries.** Failed deliveries are retried on a schedule over ~24
  hours; persistent failures eventually disable the endpoint until re-enabled or
  recovered.
- **Rotate safely.** After a secret rotation the previous secret stays valid for
  24 hours — accept either during the overlap.
