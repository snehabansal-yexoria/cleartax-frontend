"use client";

import NotificationsFeed from "@/app/components/notifications/NotificationsFeed";

// The client's notifications. Linked from the topbar bell's "View all".
export default function ClientAlertsPage() {
  return <NotificationsFeed role="client" />;
}
