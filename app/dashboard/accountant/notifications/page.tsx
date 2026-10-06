"use client";

import NotificationsFeed from "@/app/components/notifications/NotificationsFeed";

// The accountant's notifications. Linked from the topbar bell's "View all".
export default function AccountantNotificationsPage() {
  return <NotificationsFeed role="accountant" />;
}
