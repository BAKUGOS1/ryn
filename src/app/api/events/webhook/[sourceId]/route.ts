import { readKeyring } from "@/features/automations/webhook-security";
import { receiveWebhook } from "@/features/automations/intake";
import { workerRepository } from "@/features/monitoring/repository";
import { automationEnv } from "@/features/monitoring/runtime";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  const ring = readKeyring();
  if (!ring || !automationEnv())
    return Response.json(
      { error: "Webhook intake disabled." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  try {
    return await receiveWebhook(
      request,
      (await params).sourceId,
      workerRepository(),
      ring,
    );
  } catch {
    return Response.json(
      { error: "Webhook temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
