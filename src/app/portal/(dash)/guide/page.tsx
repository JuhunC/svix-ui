import { getGuideNetworkInfo } from "@/lib/config";
import { WebhookGuide } from "@/components/guide/webhook-guide";

export const dynamic = "force-dynamic";

export default function PortalGuidePage() {
  return (
    <WebhookGuide
      eventTypesEndpoint="/api/portal/event-types?with_content=true&limit=250"
      portalLinks
      {...getGuideNetworkInfo()}
    />
  );
}
