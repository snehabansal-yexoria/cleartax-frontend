import InviteClient from "./InviteClient";

export const dynamic = "force-dynamic";

export default function Page({
  searchParams,
}: {
  searchParams: { email?: string; role?: string };
}) {
  return (
    <InviteClient
      email={searchParams.email || ""}
      role={searchParams.role || "client"}
    />
  );
}
