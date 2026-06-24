import { EndpointDetail } from "@/components/endpoints/endpoint-detail";

export const dynamic = "force-dynamic";

export default async function EndpointDetailPage({
  params,
}: {
  params: Promise<{ appId: string; endpointId: string }>;
}) {
  const { appId, endpointId } = await params;
  return (
    <EndpointDetail
      apiBase={`/api/admin/apps/${encodeURIComponent(appId)}/endpoints/${encodeURIComponent(endpointId)}`}
      backHref={`/console/applications/${encodeURIComponent(appId)}`}
      afterDeleteHref={`/console/applications/${encodeURIComponent(appId)}`}
    />
  );
}
