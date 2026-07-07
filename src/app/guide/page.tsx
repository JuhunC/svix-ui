import type { Metadata } from "next";
import { getAdminClient } from "@/lib/config";
import { WebhookGuide } from "@/components/guide/webhook-guide";
import { BrandMark } from "@/components/dashboard-shell";
import type { EventType } from "@/lib/svix/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Webhook integration guide — svix-ui",
  description:
    "How to receive, verify, and test the webhooks this service sends, with the JSON payload schema for every event type.",
};

// Public, no login required. Event types (with their JSON schemas) are the
// payload contract integrators need, so we load them server-side with the
// operator's admin token and render them read-only.
export default async function PublicGuidePage() {
  let eventTypes: EventType[] = [];
  try {
    const res = await getAdminClient().listEventTypes({ withContent: true, limit: 250 });
    eventTypes = res.data;
  } catch {
    // The guide still renders (without the schema catalog) if the server is
    // unreachable or no admin token is configured.
  }

  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3 lg:px-8">
          <BrandMark />
          <span className="text-sm font-semibold text-zinc-900">svix-ui</span>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
        <WebhookGuide eventTypes={eventTypes} />
      </div>
    </main>
  );
}
