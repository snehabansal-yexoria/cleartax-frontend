"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "../../src/lib/session";
import { jwtDecode } from "jwt-decode";
import { logout } from "../../src/lib/logout";

interface TokenPayload {
  email: string;
  "custom:role"?: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const [email, setEmail] = useState<string>("");
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    async function loadSession() {
      try {
        const session: any = await getSession();

        if (!session) {
          router.replace("/login");
          return;
        }

        const idToken = session.getIdToken();
        const token = idToken.getJwtToken();

        const decoded: TokenPayload = jwtDecode(token);

        setEmail(decoded.email || "");

        const userRole = decoded["custom:role"] || "client";

        setRole(userRole);
      } catch (error) {
        console.error("Session error:", error);
        router.replace("/login");
      }
    }

    loadSession();
  }, [router]);

  function handleLogout() {
    logout();

    router.replace("/login");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: "250px",
          background: "#111",
          color: "white",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h3>Dashboard</h3>

          <p>{email}</p>

          <p>Role: {role}</p>

          <hr />

          <nav>
            <a href="/dashboard">Home</a>

            <br />
            <br />

            {role === "super_admin" && (
              <>
                <a href="/dashboard/super-admin">Super Admin Panel</a>
                <br />
                <br />

                <a href="/dashboard/super-admin/invite-admin">Invite User</a>
                <br />
                <br />

                <a href="/dashboard/super-admin/create-organization">
                  Create Organization
                </a>
              </>
            )}

            {role === "admin" && (
              <>
                <a href="/dashboard/admin">Admin Panel</a>
                <br />
                <br />
              </>
            )}

            {role === "accountant" && (
              <>
                <a href="/dashboard/accountant">Accountant Panel</a>
                <br />
                <br />
              </>
            )}

            {role === "client" && (
              <>
                <a href="/dashboard/client">Client Panel</a>
                <br />
                <br />
              </>
            )}
          </nav>
        </div>

        <button
          onClick={handleLogout}
          style={{
            padding: "10px",
            background: "#e11d48",
            color: "white",
            border: "none",
            cursor: "pointer",
            borderRadius: "4px",
          }}
        >
          Logout
        </button>
      </aside>

      <main style={{ flex: 1, padding: "40px" }}>{children}</main>
    </div>
  );
}
