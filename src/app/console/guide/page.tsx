import { WebhookGuide } from "@/components/guide/webhook-guide";

export const dynamic = "force-dynamic";

// The same interactive webhook reference operators can share publicly, inside
// the console shell. Event types (with their schemas) come from the admin API.
export default function ConsoleGuidePage() {
  return (
    <WebhookGuide eventTypesEndpoint="/api/admin/event-types?with_content=true&limit=250" />
  );
}
