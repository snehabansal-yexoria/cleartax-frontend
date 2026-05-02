"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

function getLoginPathForRole(role: string) {
  const normalizedRole = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");

  if (normalizedRole === "super_admin") return "/login/super-admin";
  if (normalizedRole === "admin") return "/login/admin";
  if (normalizedRole === "accountant") return "/login/accountant";

  return "/login/user";
}

export default function InviteClient({
  email,
  role,
  token,
}: {
  email: string;
  role: string;
  token: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const loginUrl = new URL(getLoginPathForRole(role), window.location.origin);

    if (token) {
      loginUrl.searchParams.set("invite", token);
    }

    if (email) {
      loginUrl.searchParams.set("email", email);
    }

    router.replace(
      `${loginUrl.pathname}${loginUrl.search}${window.location.hash}`,
    );
  }, [email, role, router, token]);

  function goToLogin() {
    alert(
      "Your account will be created by the administrator. Please login using the temporary password provided.",
    );

    router.push(getLoginPathForRole(role));
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
