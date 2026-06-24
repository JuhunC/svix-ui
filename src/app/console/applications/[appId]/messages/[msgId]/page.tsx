import { MessageDetail } from "@/components/messages/message-detail";

export const dynamic = "force-dynamic";

export default async function MessageDetailPage({
  params,
}: {
  params: Promise<{ appId: string; msgId: string }>;
}) {
  const { appId, msgId } = await params;
  return <MessageDetail appId={appId} msgId={msgId} />;
}
