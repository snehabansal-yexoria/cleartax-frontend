import SetPasswordClient from "./SetPasswordClient";

export const dynamic = "force-dynamic";

export default function Page({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  return <SetPasswordClient email={searchParams.email || ""} />;
}
