import { Brand, DashboardShell, type NavItem } from "@/components/dashboard-shell";

export const dynamic = "force-dynamic";

const NAV: NavItem[] = [
  { href: "/portal/endpoints", label: "Endpoints", icon: "endpoints" },
  { href: "/portal/activity", label: "Activity", icon: "activity" },
  { href: "/portal/catalog", label: "Event catalog", icon: "catalog" },
];

export default function PortalDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DashboardShell brand={<Brand subtitle="Webhook settings" />} nav={NAV}>
      {children}
    </DashboardShell>
  );
}
