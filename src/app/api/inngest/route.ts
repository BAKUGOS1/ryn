import type { NextRequest } from "next/server";
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { schedule, probes, deliveries } from "@/lib/inngest/functions";
import { monitoringEnv } from "@/features/monitoring/runtime";
export const runtime = "nodejs";
export const maxDuration = 60;
const handlers = serve({
  client: inngest,
  functions: [schedule, probes, deliveries],
});
// Missing signing/provider configuration never exposes a dev-mode execution endpoint.
export async function GET(request: NextRequest) {
  if (!monitoringEnv())
    return new Response("Monitoring disabled", { status: 503 });
  return handlers.GET(request, undefined);
}
export async function POST(request: NextRequest) {
  if (!monitoringEnv())
    return new Response("Monitoring disabled", { status: 503 });
  return handlers.POST(request, undefined);
}
export async function PUT(request: NextRequest) {
  if (!monitoringEnv())
    return new Response("Monitoring disabled", { status: 503 });
  return handlers.PUT(request, undefined);
}
