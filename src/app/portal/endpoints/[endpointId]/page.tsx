import { EndpointDetail } from "@/components/endpoints/endpoint-detail";

export const dynamic = "force-dynamic";

export default async function PortalEndpointPage({
  params,
}: {
  params: Promise<{ endpointId: string }>;
}) {
  const { endpointId } = await params;
  return (
    <EndpointDetail
      apiBase={`/api/portal/endpoints/${encodeURIComponent(endpointId)}`}
      backHref="/portal"
      afterDeleteHref="/portal"
    />
  );
}
