import SetPasswordClient from "./SetPasswordClient";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; email?: string; role?: string }>;
}) {
  const params = await searchParams;

  return (
    <SetPasswordClient
      email={params.email || ""}
      role={params.role || "client"}
      temporaryPassword={params.code || ""}
    />
  );
}
