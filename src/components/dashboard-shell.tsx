"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
}

function useIsActive() {
  const pathname = usePathname();
  return (item: NavItem) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-white">
        <Icon name="endpoints" size={16} />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold text-zinc-900">svix-ui</span>
        {subtitle ? (
          <span className="block text-[11px] text-zinc-400">{subtitle}</span>
        ) : null}
      </span>
    </div>
  );
}

export function DashboardShell({
  brand,
  nav,
  footer,
  children,
}: {
  brand: React.ReactNode;
  nav: NavItem[];
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const isActive = useIsActive();

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 bg-white md:flex">
        <div className="flex h-14 items-center px-5">{brand}</div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {nav.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
                )}
              >
                <Icon
                  name={item.icon}
                  size={18}
                  className={active ? "text-indigo-600" : "text-zinc-400"}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {footer ? (
          <div className="border-t border-zinc-200 p-3">{footer}</div>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-2 md:hidden">
          <div className="flex-1">{brand}</div>
          {footer}
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-zinc-200 bg-white px-2 py-1 md:hidden">
          {nav.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium",
                  active ? "bg-indigo-50 text-indigo-700" : "text-zinc-600",
                )}
              >
                <Icon name={item.icon} size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
