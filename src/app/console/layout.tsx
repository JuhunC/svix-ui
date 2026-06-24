import { redirect } from "next/navigation";
import Link from "next/link";
import { getOperatorSession } from "@/lib/auth/server";
import { LogoutButton } from "@/components/logout-button";
import { ConsoleNav } from "@/components/console-nav";

// Auth is evaluated per request; never prerender the console.
export const dynamic = "force-dynamic";

export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getOperatorSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <Link href="/console" className="text-sm font-semibold text-zinc-900">
              svix-ui
            </Link>
            <ConsoleNav />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-500">{session.sub}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
