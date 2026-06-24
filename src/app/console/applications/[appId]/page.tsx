import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminClient } from "@/lib/config";
import { SvixApiError } from "@/lib/svix/errors";
import { Alert, Badge, Card } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { DeleteApplicationButton } from "@/components/applications/delete-application-button";
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
      <Link
        href="/console/applications"
        className="text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← Applications
      </Link>

      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      {app ? (
        <>
          <div className="mt-2 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold text-zinc-900">{app.name}</h1>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-mono text-xs text-zinc-500">{app.id}</span>
                {app.uid ? <Badge>{app.uid}</Badge> : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/console/applications/${encodeURIComponent(app.id)}/messages`}
                className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                View deliveries
              </Link>
              <DeleteApplicationButton appId={app.id} />
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

          <PortalLinkButton appId={app.id} />

          <EndpointsSection
            apiBase={`/api/admin/apps/${encodeURIComponent(app.id)}/endpoints`}
            hrefBase={`/console/applications/${encodeURIComponent(app.id)}/endpoints`}
          />
        </>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-800">{value}</dd>
    </div>
  );
}
