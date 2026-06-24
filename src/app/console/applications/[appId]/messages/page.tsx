import { MessagesView } from "@/components/messages/messages-view";

export const dynamic = "force-dynamic";

export default async function MessagesPage({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  const { appId } = await params;
  return <MessagesView appId={appId} />;
}
