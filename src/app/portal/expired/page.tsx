import { Card } from "@/components/ui";
import { Icon } from "@/components/icons";

export default function PortalExpiredPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-canvas px-4 py-16">
      <Card className="w-full max-w-sm p-8 text-center">
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
          <Icon name="link" size={20} />
        </span>
        <h1 className="text-lg font-semibold text-zinc-900">Link expired</h1>
        <p className="mt-2 text-sm text-zinc-500">
          This App Portal link is no longer valid. Ask the provider for a new
          link.
        </p>
      </Card>
    </main>
  );
}
