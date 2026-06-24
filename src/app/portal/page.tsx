import { EndpointsSection } from "@/components/endpoints/endpoints-section";

export const dynamic = "force-dynamic";

export default function PortalHomePage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-900">Your webhook endpoints</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Add endpoints, view your signing secret, choose which events you receive,
        and replay failed deliveries.
      </p>
      <EndpointsSection
        apiBase="/api/portal/endpoints"
        hrefBase="/portal/endpoints"
        heading="Endpoints"
      />
    </div>
  );
}
