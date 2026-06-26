import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loadServerConfig } from "@/lib/config";
import { openPortalSession } from "@/lib/auth/portal";
import { PORTAL_COOKIE } from "@/lib/api/portal";
import { Brand, DashboardShell, type NavItem } from "@/components/dashboard-shell";

export const dynamic = "force-dynamic";

const NAV: NavItem[] = [
  { href: "/portal/endpoints", label: "Endpoints", icon: "endpoints" },
  { href: "/portal/activity", label: "Activity", icon: "activity" },
  { href: "/portal/catalog", label: "Event catalog", icon: "catalog" },
];

async function hasValidPortalSession(): Promise<boolean> {
  try {
    const secret = loadServerConfig().sessionSecret;
    const store = await cookies();
    return openPortalSession(store.get(PORTAL_COOKIE)?.value, secret) !== null;
  } catch {
    return false;
  }
}

export default async function PortalDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await hasValidPortalSession())) redirect("/portal/expired");

  return (
    <DashboardShell brand={<Brand subtitle="Webhook settings" />} nav={NAV}>
      {children}
    </DashboardShell>
  );
}
