import { redirect } from "next/navigation";

// The client property page lives at /dashboard/client/properties/[propertyid].
// This entity-nested URL is kept only so older links and bookmarks still land
// on it instead of a 404.
export default async function ClientEntityPropertyRedirect({
  params,
}: {
  params: Promise<{ entityId: string; propertyId: string }>;
}) {
  const { propertyId } = await params;
  redirect(`/dashboard/client/properties/${propertyId}`);
}
