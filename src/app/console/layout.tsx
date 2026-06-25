import { redirect } from "next/navigation";
import { getOperatorSession } from "@/lib/auth/server";
import { LogoutButton } from "@/components/logout-button";
import { Brand, DashboardShell, type NavItem } from "@/components/dashboard-shell";

// Auth is evaluated per request; never prerender the console.
export const dynamic = "force-dynamic";

const NAV: NavItem[] = [
  { href: "/console", label: "Overview", icon: "dashboard", exact: true },
  { href: "/console/applications", label: "Applications", icon: "apps" },
  { href: "/console/event-types", label: "Event types", icon: "tag" },
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
