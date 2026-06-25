import { EndpointsSection } from "@/components/endpoints/endpoints-section";

export default function PortalEndpointsPage() {
  return (
    <EndpointsSection
      apiBase="/api/portal/endpoints"
      hrefBase="/portal/endpoints"
      heading="Endpoints"
    />
  );
}
