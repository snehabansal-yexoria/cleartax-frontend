import Link from "next/link";

const loginRoles = [
  {
    href: "/login/super-admin",
    signupHref: "/signup/super-admin",
    title: "Super Admin",
    description: "Manage organizations, onboard admins, and monitor platform access.",
    accentClass: "login-role-card-gold",
  },
  {
    href: "/login/admin",
    signupHref: "/signup/admin",
    title: "Admin",
    description: "Invite accountants and clients while managing one organization.",
    accentClass: "login-role-card-blue",
  },
  {
    href: "/login/accountant",
    signupHref: "/signup/accountant",
    title: "Accountant",
    description: "Track clients, send invitations, and manage onboarding activity.",
    accentClass: "login-role-card-ice",
  },
  {
    href: "/login/user",
    signupHref: "/signup/user",
    title: "Client",
    description: "Access your portfolio workspace, documents, and registration flow.",
    accentClass: "login-role-card-plain",
  },
];

export default function LoginRoleSelector({
  mode = "login",
}: {
  mode?: "login" | "signup";
}) {
  return (
    <section
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        background:
          "radial-gradient(circle at top left, rgba(244, 161, 23, 0.18), transparent 28%), linear-gradient(180deg, #f8faff 0%, #eef2fb 100%)",
      }}
    >
      <div
        style={{
          width: "min(1180px, 100%)",
          display: "flex",
          flexDirection: "column",
          gap: "30px",
        }}
      >
        <div
          style={{
            borderRadius: "30px",
            padding: "30px",
            background: "linear-gradient(135deg, #26316c 0%, #334089 100%)",
            color: "#ffffff",
            boxShadow: "0 30px 70px rgba(31, 42, 95, 0.18)",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "14px",
            }}
          >
            <div
              style={{
                width: "54px",
                height: "54px",
                borderRadius: "16px",
                background: "linear-gradient(180deg, #ffb425 0%, #f4a117 100%)",
                color: "#25326f",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 16px 30px rgba(244, 161, 23, 0.24)",
                flexShrink: 0,
              }}
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="5" y="5" width="6" height="6" rx="1.2" />
                <rect x="13" y="5" width="6" height="6" rx="1.2" />
                <rect x="5" y="13" width="6" height="6" rx="1.2" />
                <rect x="13" y="13" width="6" height="6" rx="1.2" />
              </svg>
            </div>
            <span
              style={{
                color: "#ffb11f",
                fontSize: "1.75rem",
                fontWeight: 800,
                letterSpacing: "-0.03em",
              }}
            >
              Clear Portfolio
            </span>
          </div>

          <div
            style={{
              maxWidth: "70ch",
              marginTop: "28px",
            }}
          >
            <p
              style={{
                color: "rgba(255, 255, 255, 0.7)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontSize: "0.82rem",
                fontWeight: 700,
              }}
            >
              Choose your access point
            </p>
            <h1
              style={{
                marginTop: "14px",
                fontSize: "clamp(2.3rem, 5vw, 3.9rem)",
                lineHeight: 0.98,
                fontWeight: 800,
                letterSpacing: "-0.05em",
              }}
            >
              {mode === "signup"
                ? "Create the right workspace account"
                : "Sign in to the right workspace"}
            </h1>
            <p
              style={{
                marginTop: "16px",
                color: "rgba(255, 255, 255, 0.78)",
                fontSize: "1.02rem",
                maxWidth: "58ch",
              }}
            >
              {mode === "signup"
                ? "Pick the role you want to register so we can collect the right onboarding details before your first login."
                : "Pick the portal that matches your role so you land directly in the right dashboard and onboarding flow."}
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "18px",
          }}
        >
          {loginRoles.map((role) => (
            <Link
              key={`${mode}-${role.href}`}
              href={mode === "signup" ? role.signupHref : role.href}
              className={role.accentClass}
              style={{
                display: "block",
                minHeight: "220px",
                padding: "22px",
                borderRadius: "24px",
                textDecoration: "none",
                border: "1px solid rgba(203, 211, 234, 0.8)",
                background:
                  role.accentClass === "login-role-card-gold"
                    ? "linear-gradient(180deg, #fff5d6 0%, #fff0c0 100%)"
                    : role.accentClass === "login-role-card-blue"
                      ? "linear-gradient(180deg, #e4e9ff 0%, #dce2fb 100%)"
                      : role.accentClass === "login-role-card-ice"
                        ? "linear-gradient(180deg, #eff7ff 0%, #e8f0ff 100%)"
                        : "rgba(255, 255, 255, 0.94)",
                boxShadow: "0 18px 40px rgba(48, 59, 109, 0.08)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    minHeight: "34px",
                    padding: "0 12px",
                    borderRadius: "999px",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    background: "rgba(47, 60, 130, 0.08)",
                    color: "#2f3c82",
                  }}
                >
                  {role.title}
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    minHeight: "34px",
                    padding: "0 12px",
                    borderRadius: "999px",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    background: "rgba(255, 255, 255, 0.7)",
                    color: "#5d6787",
                  }}
                >
                  {mode === "signup" ? "Sign Up" : "Open"}
                </span>
              </div>
              <h2
                style={{
                  marginTop: "22px",
                  color: "#1f2d4f",
                  fontSize: "1.5rem",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                }}
              >
                {role.title}
              </h2>
              <p
                style={{
                  marginTop: "14px",
                  color: "#586682",
                  fontSize: "1rem",
                  lineHeight: 1.6,
                }}
              >
                {role.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
