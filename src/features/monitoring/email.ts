import "server-only";
import { z } from "zod";
export class DeliveryError extends Error {
  constructor(
    public disposition: "retry" | "review",
    public category: string,
  ) {
    super(category);
  }
}
export function withinRetryWindow(firstAttemptAt: string, now = Date.now()) {
  const elapsed = now - new Date(firstAttemptAt).getTime();
  return (
    Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 23 * 60 * 60 * 1000
  );
}
export async function sendEmail(
  input: {
    id: string;
    to: string;
    subject: string;
    text: string;
    firstAttemptAt: string;
  },
  config: { apiKey: string; from: string },
  send: typeof fetch = fetch,
) {
  if (!withinRetryWindow(input.firstAttemptAt))
    throw new DeliveryError("review", "idempotency_window_expired");
  let response: Response;
  try {
    response = await send("https://api.resend.com/emails", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: "Bearer " + config.apiKey,
        "Content-Type": "application/json",
        "Idempotency-Key": "futureflow/" + input.id,
      },
      body: JSON.stringify({
        from: config.from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
    });
  } catch {
    throw new DeliveryError("retry", "provider_outcome_unknown");
  }
  if (!response.ok)
    throw new DeliveryError(
      response.status === 429 || response.status >= 500 ? "retry" : "review",
      "provider_" + response.status,
    );
  const text = await response.text();
  if (text.length > 8192)
    throw new DeliveryError("review", "provider_response_invalid");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new DeliveryError("retry", "provider_response_invalid");
  }
  const parsed = z.object({ id: z.string().min(1).max(200) }).safeParse(data);
  if (!parsed.success)
    throw new DeliveryError("retry", "provider_response_invalid");
  return parsed.data.id;
}
