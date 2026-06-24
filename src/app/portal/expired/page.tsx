import { Card } from "@/components/ui";

export default function PortalExpiredPage() {
  return (
    <Card className="p-8 text-center">
      <h1 className="text-lg font-semibold text-zinc-900">Link expired</h1>
      <p className="mt-2 text-sm text-zinc-500">
        This App Portal link is no longer valid. Ask the provider for a new link.
      </p>
    </Card>
  );
}
