import { EventTypeDetail } from "@/components/event-types/event-type-detail";

export const dynamic = "force-dynamic";

export default async function EventTypeDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  return <EventTypeDetail name={name} />;
}
