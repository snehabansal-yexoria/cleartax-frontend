import { redirect } from "next/navigation";

// Reconciliations are now session-scoped; the workspace lives at
// /reconciliation/[sessionId]. This route exists only so that any legacy link
// lands users on the entity detail page where they can pick or create a
// session from the Reconciliations tab.
export default async function ReconciliationIndex({
  params,
}: {
  params: Promise<{ clientId: string; entityId: string }>;
}) {
  const { clientId, entityId } = await params;
  redirect(
    `/dashboard/accountant/clients/${clientId}/entities/${entityId}?tab=reconciliation`,
  );
}
