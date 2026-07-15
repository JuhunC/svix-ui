import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loadServerConfig } from "@/lib/config";
import { openPortalSession } from "@/lib/auth/portal";
import { PORTAL_COOKIE } from "@/lib/api/portal";
import { PortalActivity } from "@/components/portal/portal-activity";

export const dynamic = "force-dynamic";

export default async function PortalActivityPage() {
  // The app-wide activity feed isn't available to an endpoint-scoped link — its
  // deliveries live on the endpoint's own Activity tab. Send them there.
  // (Read the session outside the redirect: redirect() throws NEXT_REDIRECT,
  // which must not be swallowed by the catch.)
  let scopedEndpointId: string | undefined;
  try {
    const secret = loadServerConfig().sessionSecret;
    const store = await cookies();
    scopedEndpointId = openPortalSession(
      store.get(PORTAL_COOKIE)?.value,
      secret,
    )?.endpointId;
  } catch {
    // Fall through to the normal feed; the BFF still enforces access.
  }

  if (scopedEndpointId) {
    redirect(`/portal/endpoints/${encodeURIComponent(scopedEndpointId)}`);
  }

  return <PortalActivity />;
}
