import InviteClient from "./InviteClient";

export const dynamic = "force-dynamic";

type InviteSearchParams = {
  email?: string;
  role?: string;
  token?: string;
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<InviteSearchParams>;
}) {
  const params = await searchParams;

  return (
    <InviteClient
      email={params.email || ""}
      role={params.role || "client"}
      token={params.token || ""}
    />
  );
}
