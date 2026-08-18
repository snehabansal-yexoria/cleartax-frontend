import ForgotPasswordClient from "./ForgotPasswordClient";

export const dynamic = "force-dynamic";

export default function Page({
  searchParams,
}: {
  searchParams: { role?: string; email?: string };
}) {
  return (
    <ForgotPasswordClient
      role={searchParams.role || ""}
      initialEmail={searchParams.email || ""}
    />
  );
}
