"use client";

import { useSearchParams, useRouter } from "next/navigation";

export default function InvitePage() {
  const router = useRouter();
  const params = useSearchParams();

  const email = params.get("email") || "";
  const role = params.get("role") || "client";

  function goToLogin() {
    alert(
      "Your account will be created by the administrator. Please login using the temporary password provided.",
    );

    router.push("/login");
  }

  return (
    <div style={{ padding: "40px" }}>
      <h1>Invitation</h1>

      <p>You have been invited to the platform.</p>

      <p>Email: {email}</p>

      <p>Role: {role}</p>

      <br />

      <button onClick={goToLogin}>Continue to Login</button>
    </div>
  );
}
