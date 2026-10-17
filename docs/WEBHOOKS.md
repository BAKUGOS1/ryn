# Signed intake contract

The endpoint is `POST /api/events/webhook/{sourceId}`. An owner/admin creates the webhook draft and saves the signing secret once. Publish after configuring the development worker. Raw signing secrets never appear in logs or ordinary reads. Keep them outside source control.

Required headers:

| Header                 | Value                                                                 |
| ---------------------- | --------------------------------------------------------------------- |
| Content-Type           | application/json                                                      |
| X-FutureFlow-Timestamp | Unix seconds, 10 digits, within 300 seconds of server time            |
| X-FutureFlow-Event-Id  | Stable logical event ID, 1–100 ASCII letters/digits/underscore/hyphen |
| X-FutureFlow-Signature | `v1=` followed by lowercase hex HMAC-SHA256                           |

Sign the UTF-8 bytes of `timestamp + "." + eventId + "."`, followed by the exact request body bytes. Use the displayed secret as a UTF-8 string, not hex-decoded bytes. Whitespace changes alter the signature. An event ID always represents the same body; use a new ID for a new event. Retries may sign a fresh timestamp while retaining the original ID and body.

Node example (read the secret from your own secret manager):

```js
import { createHmac } from "node:crypto";
const timestamp = String(Math.floor(Date.now() / 1000));
const eventId = "ticket_1042";
const body = JSON.stringify({ priority: "critical" });
const signature = createHmac("sha256", process.env.FUTUREFLOW_SIGNING_SECRET)
  .update(timestamp + "." + eventId + ".")
  .update(body)
  .digest("hex");
// Send body unchanged with the required headers to your configured app origin.
```

202 means accepted durably; it does not mean delivered. 200 means the same event was already accepted. 409 means an ID/body conflict. Invalid signature is 401; unsupported media is 415; malformed JSON is 400; oversized payload is 413. Source unavailable, paused, archived or source-rate-exhausted is deliberately 404. Workspace intake quota is 429. Missing worker/encryption configuration fails closed with 503. Responses are not cached. All accepted event IDs persist for dedupe until an explicit retention policy is implemented; do not delete receipts independently of dedupe requirements.

## Encryption keys and rotation

Set `WEBHOOK_ACTIVE_KEY_ID` and a server-only `WEBHOOK_ENCRYPTION_KEYS` JSON object mapping key IDs to independently generated 32-byte base64 keys. Generate these in a secret manager; do not print or commit real keys. Retain every key referenced by existing secret envelopes. Set a new active ID before creating/rotating secrets; old envelopes continue to decrypt with their stored key ID. Removing an old key before re-encrypting/rotating every affected source makes those webhooks unavailable.

For signing-secret rotation, use the admin control, save the new secret once and update the sender. The old secret stops working immediately, with no grace window. Source revision is checked again during durable acceptance, so a lookup performed before rotation cannot admit an old-secret request after rotation. A crash between database write and response requires another rotation; plaintext cannot be retrieved later.

`AUTOMATION_ENABLED=false` and `MONITORING_ENABLED=false` by default. No unsigned development worker mode is supplied. Use dedicated development provider accounts before enabling. Website probing additionally requires its own flag and operator host allowlist.

## V1 boundaries

Scalar payload paths only, five path segments, no prototype access, scripts, interpolation or user-defined HTTP actions. Nested objects/arrays, missing fields and oversized strings normalize to null. Deadline triggers carry an empty event field object; condition logic on deadlines can inspect missing/null semantics, not arbitrary computed calendar expressions. The supported deadline template connects directly to its notification. No recurring schedules, joins, unrestricted fan-out email or arbitrary recipients are offered.
