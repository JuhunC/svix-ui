import { redirect } from "next/navigation";
import { getOperatorSession } from "@/lib/auth/server";
import { LogoutButton } from "@/components/logout-button";
import { Brand, DashboardShell, type NavItem } from "@/components/dashboard-shell";
import { Icon } from "@/components/icons";
import { getAppVersion } from "@/lib/version";

// Auth is evaluated per request; never prerender the console.
export const dynamic = "force-dynamic";

const NAV: NavItem[] = [
  { href: "/console", label: "Overview", icon: "dashboard", exact: true },
  { href: "/console/applications", label: "Applications", icon: "apps" },
  { href: "/console/event-types", label: "Event types", icon: "tag" },
  { href: "/console/guide", label: "Guide", icon: "guide" },
];

export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getOperatorSession();
  if (!session) redirect("/login");

  return (
    <DashboardShell
      brand={<Brand subtitle="Operator console" />}
      nav={NAV}
      version={getAppVersion().label}
      headerRight={
        <a
          href="https://github.com/JuhunC/svix-ui"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
        >
          <Icon name="github" size={16} />
          <span className="hidden sm:inline">GitHub</span>
        </a>
      }
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs text-zinc-500">
            {session.sub}
          </span>
          <LogoutButton />
        </div>
      }
    >
      {children}
    </DashboardShell>
  );
}
