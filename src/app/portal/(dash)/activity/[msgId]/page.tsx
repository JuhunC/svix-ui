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
      resendPath={(ep) =>
        `/api/portal/endpoints/${encodeURIComponent(ep)}/messages/${msg}/resend`
      }
      backHref="/portal/activity"
    />
  );
}
