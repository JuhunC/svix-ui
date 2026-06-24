import { Card } from "@/components/ui";

export default function ConsoleOverviewPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-zinc-900">Operator console</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Manage applications, event types, endpoints, and deliveries on your
        self-hosted Svix server.
      </p>

      <Card className="mt-6 p-6">
        <p className="text-sm text-zinc-700">
          You are signed in. Features are added as you build them — applications,
          event types, the delivery explorer, and the consumer App Portal.
        </p>
      </Card>
    </div>
  );
}
