import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";

const CARDS: Array<{
  href: string;
  icon: IconName;
  title: string;
  body: string;
}> = [
  {
    href: "/console/applications",
    icon: "apps",
    title: "Applications",
    body: "Create tenants, manage their endpoints, and open the consumer App Portal.",
  },
  {
    href: "/console/event-types",
    icon: "tag",
    title: "Event types",
    body: "Define the catalog of events your applications can emit, with JSON schemas.",
  },
];

export default function ConsoleOverviewPage() {
  return (
    <div>
      <PageHeader
        title="Operator console"
        description="Manage applications, event types, endpoints, and deliveries on your self-hosted Svix server."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="group">
            <Card className="h-full p-5 transition-colors group-hover:border-indigo-300">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                  <Icon name={c.icon} size={18} />
                </span>
                <h2 className="text-base font-semibold text-zinc-900">
                  {c.title}
                </h2>
              </div>
              <p className="mt-3 text-sm text-zinc-500">{c.body}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
