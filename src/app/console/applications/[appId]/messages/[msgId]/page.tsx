import { MessageDetailView } from "@/components/messages/message-detail";

export const dynamic = "force-dynamic";

export default async function MessageDetailPage({
  params,
}: {
  params: Promise<{ appId: string; msgId: string }>;
}) {
  const { appId, msgId } = await params;
  const app = encodeURIComponent(appId);
  const msg = encodeURIComponent(msgId);
  return (
    <MessageDetailView
      messagePath={`/api/admin/apps/${app}/messages/${msg}`}
      resendTemplate={`/api/admin/apps/${app}/messages/${msg}/endpoints/{endpointId}/resend`}
      backHref={`/console/applications/${app}/messages`}
    />
  );
}
