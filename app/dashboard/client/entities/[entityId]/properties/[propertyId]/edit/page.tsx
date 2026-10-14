import { redirect } from "next/navigation";

// See ../page.tsx: the edit form lives at
// /dashboard/client/properties/[propertyid]/edit.
export default async function ClientEntityPropertyEditRedirect({
  params,
}: {
  params: Promise<{ entityId: string; propertyId: string }>;
}) {
  const { propertyId } = await params;
  redirect(`/dashboard/client/properties/${propertyId}/edit`);
}
