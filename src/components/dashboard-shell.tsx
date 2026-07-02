"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
}

function matches(item: NavItem, pathname: string): boolean {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function Brand({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white">
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
  headerRight,
  version,
  children,
}: {
  brand: ReactNode;
  nav: NavItem[];
  footer?: ReactNode;
  headerRight?: ReactNode;
  version?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = nav.find((item) => matches(item, pathname));

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 bg-white md:flex">
        <div className="flex h-14 items-center px-5">{brand}</div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {nav.map((item) => {
            const on = matches(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  on
                    ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
                )}
              >
                <Icon
                  name={item.icon}
                  size={18}
                  className={on ? "text-blue-600" : "text-zinc-400"}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {footer ? (
          <div className="border-t border-zinc-200 p-3">{footer}</div>
        ) : null}
        {version ? (
          <div className="border-t border-zinc-200 px-4 py-2">
            <span className="font-mono text-[11px] text-zinc-400">{version}</span>
          </div>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top header bar (matches the example's SiteHeader). */}
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/90 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3 md:hidden">{brand}</div>
          <h2 className="hidden text-sm font-semibold text-zinc-900 md:block">
            {active?.label ?? ""}
          </h2>
          <div className="flex items-center gap-3">{headerRight}</div>
        </header>

        {/* Mobile nav */}
        <nav className="flex gap-1 overflow-x-auto border-b border-zinc-200 bg-white px-2 py-1 md:hidden">
          {nav.map((item) => {
            const on = matches(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium",
                  on ? "bg-blue-50 text-blue-700" : "text-zinc-600",
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
