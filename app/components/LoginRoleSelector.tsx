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
          "radial-gradient(circle at top left, rgba(122, 92, 250, 0.18), transparent 28%), linear-gradient(180deg, #FAF8F3 0%, #F3F0E9 100%)",
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
            background: "linear-gradient(135deg, #242629 0%, #2E3135 100%)",
            color: "#FFFFFF",
            boxShadow: "0 30px 70px rgba(21, 23, 25, 0.18)",
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
                background: "linear-gradient(180deg, #7A5CFA 0%, #7A5CFA 100%)",
                color: "#242629",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 16px 30px rgba(122, 92, 250, 0.24)",
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
                color: "#7A5CFA",
                fontSize: "1.75rem",
                fontWeight: 800,
                letterSpacing: "-0.03em",
              }}
            >
              Thetaxio
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
                border: "1px solid rgba(213, 203, 245, 0.8)",
                background:
                  role.accentClass === "login-role-card-gold"
                    ? "linear-gradient(180deg, #F4E5DC 0%, #F1DCD1 100%)"
                    : role.accentClass === "login-role-card-blue"
                      ? "linear-gradient(180deg, #EBE6F4 0%, #E6DFF4 100%)"
                      : role.accentClass === "login-role-card-ice"
                        ? "linear-gradient(180deg, #F3F0E9 0%, #EDE9F4 100%)"
                        : "rgba(255, 255, 255, 0.94)",
                boxShadow: "0 18px 40px rgba(36, 38, 41, 0.08)",
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
                    background: "rgba(46, 49, 53, 0.08)",
                    color: "#2E3135",
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
                    color: "#676766",
                  }}
                >
                  {mode === "signup" ? "Sign Up" : "Open"}
                </span>
              </div>
              <h2
                style={{
                  marginTop: "22px",
                  color: "#151719",
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
                  color: "#636362",
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
