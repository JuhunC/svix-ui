import { MessageDetailView } from "@/components/messages/message-detail";

export const dynamic = "force-dynamic";

export default async function PortalMessageDetailPage({
  params,
}: {
  params: Promise<{ msgId: string }>;
}) {
  const { msgId } = await params;
  const msg = encodeURIComponent(msgId);
  return (
    <MessageDetailView
      messagePath={`/api/portal/messages/${msg}`}
      resendTemplate={`/api/portal/endpoints/{endpointId}/messages/${msg}/resend`}
      backHref="/portal/activity"
    />
  );
}
