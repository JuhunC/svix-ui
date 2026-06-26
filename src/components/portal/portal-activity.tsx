"use client";

import { ActivityFeed } from "@/components/activity/activity-feed";

export function PortalActivity() {
  return (
    <ActivityFeed
      messagesPath="/api/portal/messages"
      catalogPath="/api/portal/event-types"
      detailHref={(id) => `/portal/activity/${encodeURIComponent(id)}`}
      description="Events sent to your application and how each delivery went."
    />
  );
}
