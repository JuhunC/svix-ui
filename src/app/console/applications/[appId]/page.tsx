import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminClient } from "@/lib/config";
import { SvixApiError } from "@/lib/svix/errors";
import { Alert, BackLink, Badge, Card, Detail, FOCUS_RING, cn } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { DeleteApplicationButton } from "@/components/applications/delete-application-button";
import { EditApplicationName } from "@/components/applications/edit-application-name";
import { PortalLinkButton } from "@/components/applications/portal-link-button";
import { EndpointsSection } from "@/components/endpoints/endpoints-section";
import type { Application } from "@/lib/svix/types";

export const dynamic = "force-dynamic";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  const { appId } = await params;
  let app: Application | null = null;
  let error: string | null = null;
  try {
    app = await getAdminClient().getApplication(appId);
  } catch (e) {
    if (e instanceof SvixApiError && e.isNotFound) notFound();
    error = e instanceof Error ? e.message : "Failed to load application";
  }

  return (
    <div>
      <BackLink href="/console/applications">Applications</BackLink>

      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      {app ? (
        <>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <EditApplicationName appId={app.id} name={app.name} />
              <div className="mt-1 flex items-center gap-2">
                <span className="font-mono text-xs text-zinc-500">{app.id}</span>
                {app.uid ? <Badge>{app.uid}</Badge> : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`/console/applications/${encodeURIComponent(app.id)}/messages`}
                className={cn(
                  "inline-flex h-8 items-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 shadow-sm hover:bg-zinc-50",
                  FOCUS_RING,
                )}
              >
                View deliveries
              </Link>
              <DeleteApplicationButton appId={app.id} appName={app.name} />
            </div>
          </div>

          <Card className="mt-6 p-5">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Detail label="Created" value={formatDateTime(app.createdAt)} />
              <Detail label="Updated" value={formatDateTime(app.updatedAt)} />
              <Detail
                label="Rate limit"
                value={app.rateLimit ? `${app.rateLimit}/s` : "—"}
              />
              <Detail label="UID" value={app.uid ?? "—"} />
            </dl>
          </Card>

          <PortalLinkButton appId={app.id} className="mt-6" />

          <EndpointsSection
            apiBase={`/api/admin/apps/${encodeURIComponent(app.id)}/endpoints`}
            hrefBase={`/console/applications/${encodeURIComponent(app.id)}/endpoints`}
          />
        </>
      ) : null}
    </div>
  );
}
