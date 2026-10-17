import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readEnv } from "./env";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export function checkOrigin(request: Request) {
  const env = readEnv();
  if (!env)
    throw new HttpError(
      503,
      "Setup required. Configure the development Supabase project.",
    );
  if (request.headers.get("origin") !== env.origin)
    throw new HttpError(403, "Request origin not allowed.");
}
export async function body<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "JSON required.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Body required.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 8192) {
      await reader.cancel();
      throw new HttpError(413, "Request too large.");
    }
    chunks.push(value);
  }
  try {
    return schema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch {
    throw new HttpError(400, "Check your entries and try again.");
  }
}
export function failure(error: unknown) {
  const requestId = randomUUID();
  const status = error instanceof HttpError ? error.status : 500;
  // Never log request bodies, email addresses, tokens or provider error text.
  if (status >= 500)
    console.error(
      JSON.stringify({ event: "request.failed", requestId, status }),
    );
  return json(
    {
      error:
        error instanceof HttpError
          ? error.message
          : "The request could not be completed. Please retry.",
      requestId,
    },
    status,
  );
}
export function dbError(error: { code?: string; message: string } | null) {
  if (!error) return;
  const map: Record<string, [number, string]> = {
    FF001: [403, "You do not have permission for this action."],
    FF002: [400, "This invitation is invalid, expired, or already used."],
    FF003: [409, "This change conflicts with the workspace state."],
    FF004: [429, "Too many requests. Please try again later."],
    FF005: [409, "The foundation workspace limit has been reached."],
    "23505": [409, "That workspace address or invitation is already in use."],
    "23514": [400, "Check your entries and try again."],
  };
  const [status, message] = map[error.code ?? ""] ?? [
    500,
    "The request could not be completed.",
  ];
  throw new HttpError(status, message);
}
