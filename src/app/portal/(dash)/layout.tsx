import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loadServerConfig } from "@/lib/config";
import { openPortalSession, type PortalSession } from "@/lib/auth/portal";
import { PORTAL_COOKIE } from "@/lib/api/portal";
import { Brand, DashboardShell, type NavItem } from "@/components/dashboard-shell";

export const dynamic = "force-dynamic";

const APP_NAV: NavItem[] = [
  { href: "/portal/endpoints", label: "Endpoints", icon: "endpoints" },
  { href: "/portal/activity", label: "Activity", icon: "activity" },
  { href: "/portal/catalog", label: "Event catalog", icon: "catalog" },
  { href: "/portal/guide", label: "Guide", icon: "guide" },
];

// An endpoint-scoped link only exposes its one endpoint (plus the shared guide).
function scopedNav(endpointId: string): NavItem[] {
  return [
    {
      href: `/portal/endpoints/${encodeURIComponent(endpointId)}`,
      label: "Your endpoint",
      icon: "endpoints",
    },
    { href: "/portal/guide", label: "Guide", icon: "guide" },
  ];
}

async function readPortalSession(): Promise<PortalSession | null> {
  try {
    const secret = loadServerConfig().sessionSecret;
    const store = await cookies();
    return openPortalSession(store.get(PORTAL_COOKIE)?.value, secret);
  } catch {
    return null;
  }
}

export default async function PortalDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await readPortalSession();
  if (!session) redirect("/portal/expired");

  const scoped = Boolean(session.endpointId);
  const nav = session.endpointId ? scopedNav(session.endpointId) : APP_NAV;

  return (
    <DashboardShell
      brand={<Brand subtitle={scoped ? "Endpoint settings" : "Webhook settings"} />}
      nav={nav}
    >
      {children}
    </DashboardShell>
  );
}
