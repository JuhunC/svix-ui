import { EndpointDetail } from "@/components/endpoints/endpoint-detail";

export const dynamic = "force-dynamic";

export default async function EndpointDetailPage({
  params,
}: {
  params: Promise<{ appId: string; endpointId: string }>;
}) {
  const { appId, endpointId } = await params;
  return <EndpointDetail appId={appId} endpointId={endpointId} />;
}
