"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import { login, completeNewPassword } from "../../src/lib/auth";
import { CognitoUser } from "amazon-cognito-identity-js";
import Image from "next/image";
import logo from "../../public/clear-tax.svg";
import logoBlue from "../../public/clear-tax-blue.svg";
import shield from "../../public/shield.svg";
import lock from "../../public/lock.svg";
import live from "../../public/live.svg";
import analytics from "../../public/analytics.svg";
import users from "../../public/users.svg";
import realTime from "../../public/real-time.svg";

interface TokenPayload {
  email: string;
  "custom:role"?: string;
}

interface NewPasswordResult {
  type: "NEW_PASSWORD_REQUIRED";
  user: CognitoUser;
  userAttributes?: Record<string, string>;
}

interface LoginSuccessResult {
  type: "SUCCESS";
  idToken: string;
}

type LoginResult = NewPasswordResult | LoginSuccessResult;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function LoginComponent({
  allowedRoles,
}: {
  allowedRoles: string[];
}) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [requireNewPassword, setRequireNewPassword] = useState(false);
  const [user, setUser] = useState<CognitoUser | null>(null);
  const [attributes, setAttributes] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const result = (await login(email, password)) as LoginResult;

      // 🔥 Handle first login
      if (result.type === "NEW_PASSWORD_REQUIRED") {
        setUser(result.user);
        console.log("User attributes:", result.user);

        const requiredAttributes: Record<string, string> = {};
        requiredAttributes.name = email;

        setAttributes(requiredAttributes);
        setRequireNewPassword(true);

        setLoading(false);
        return;
      }

      if (result.type === "SUCCESS") {
        const token = result.idToken;
        const decoded: TokenPayload = jwtDecode(token);
        console.log(decoded);

        await fetch("/api/invitations/accept", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => undefined);

        const role = (decoded["custom:role"] || "client").toLowerCase();
        console.log(role);

        // 🔥 ROLE CHECK
        if (!allowedRoles.includes(role)) {
          setError("You are not allowed to login here");
          setLoading(false);
          return;
        }

        // 🔥 Save token
        document.cookie = `idToken=${token}; path=/`;

        // 🔥 Role-based redirect
        if (role === "super_admin") {
          router.replace("/dashboard/super-admin");
        } else if (role === "admin") {
          router.replace("/dashboard/admin");
        } else if (role === "accountant") {
          router.replace("/dashboard/accountant");
        } else {
          router.replace("/dashboard/client");
        }
      }
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Login failed"));
    }

    setLoading(false);
  };

  const handleSetNewPassword = async () => {
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!user) return;

    setLoading(true);
    setError("");

    try {
      const result = await completeNewPassword(user, newPassword, attributes);
      const idToken =
        typeof result === "object" &&
        result !== null &&
        "getIdToken" in result &&
        typeof result.getIdToken === "function"
          ? result.getIdToken().getJwtToken()
          : "";

      if (idToken) {
        await fetch("/api/invitations/accept", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });
      }

      alert("Password updated successfully. Please login again.");
      setRequireNewPassword(false);
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Password update failed"));
    }

    setLoading(false);
  };

  const role = allowedRoles[0];

  const roleMap: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    accountant: "Accountant",
    client: "Client",
  };

  return (
    <div className="loginSection">
      <div className="login-container">
        <div className="login-wrapper">
          <div className="login-left">
            <div className="login-left-wrap">
              <div className="ll-top">
                <div className="llt-icon-head">
                  <div className="login-icon">
                    <Image
                      src={logo}
                      alt="Login Illustration"
                      width={100}
                      height={100}
                      className="icon"
                    />
                  </div>
                  <h1>Clear Portfolio</h1>
                </div>
                <h2>{roleMap[role] || "Login"}</h2>
                {(role === "super_admin" || role === "admin") && (
                  <p className="darkBg txt-center">
                    Secure administrative access for financial dashboard
                    management. Monitor, control, and oversee all system
                    operations.
                  </p>
                )}

                {(role === "accountant" || role === "client") && (
                  <p className="darkBg txt-center">
                    Access professional tools for portfolio reconciliation, tax
                    planning, and client financial reporting.
                  </p>
                )}
              </div>
              <div className="ll-bottom">
                <div className="llb-item">
                  <Image src={shield} alt="Secure" width={56} height={56} />
                  <p className="darkBg txt-center">Secure Access</p>
                </div>
                <div className="llb-item">
                  <Image src={lock} alt="Secure" width={56} height={56} />
                  <p className="darkBg txt-center">Encrypted</p>
                </div>
                <div className="llb-item">
                  <Image src={live} alt="Secure" width={56} height={56} />
                  <p className="darkBg txt-center">Live Status</p>
                </div>
                <div className="llb-item">
                  <Image src={analytics} alt="Secure" width={56} height={56} />
                  <p className="darkBg txt-center">Analytics</p>
                </div>
                <div className="llb-item">
                  <Image src={users} alt="Secure" width={56} height={56} />
                  <p className="darkBg txt-center">User Control</p>
                </div>
                <div className="llb-item">
                  <Image src={realTime} alt="Secure" width={56} height={56} />
                  <p className="darkBg txt-center">Real-time</p>
                </div>
              </div>
            </div>
            <div className="ll-copyright">
              <p>© 2026 Clear Portfolio | Internal Use Only</p>
            </div>
          </div>
          <div className="login-right">
            <div className="login-right-wrap">
              <div className="lr-top">
                <div className="login-icon">
                  <Image
                    src={logoBlue}
                    alt="Login Illustration"
                    width={100}
                    height={100}
                    className="icon"
                  />
                </div>
                <div className="lr-top-text">
                  <h2>{roleMap[role] || "Login"} Portal</h2>
                  <p>Please sign in to manage the system.</p>
                </div>
              </div>
              <div className="lr-form">
                {!requireNewPassword && (
                  <div className="login-form-wrap">
                    <div className="login-element">
                      <label htmlFor="email">Email Address</label>
                      <input
                        type="email"
                        placeholder="admin@clearportfolio.com"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="login-element">
                      <label htmlFor="password">Password</label>
                      <div className="login-password-field">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          id="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          className="login-password-toggle"
                          onClick={() => setShowPassword((current) => !current)}
                        >
                          {showPassword ? "Hide" : "View"}
                        </button>
                      </div>
                    </div>
                    <div className="login-submit">
                      <button onClick={handleLogin} disabled={loading}>
                        {loading ? "Logging in..." : "Log In to Dashboard"}
                      </button>
                    </div>
                  </div>
                )}

                {requireNewPassword && (
                  <div className="login-form-wrap">
                    <div className="login-element">
                      <label htmlFor="password_email">Email Address</label>
                      <input
                        type="email"
                        id="password_email"
                        value={email}
                        disabled
                      />
                    </div>
                    <div className="login-element">
                      <label htmlFor="new_password">New Password</label>
                      <div className="login-password-field">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          id="new_password"
                          placeholder="New password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          className="login-password-toggle"
                          onClick={() =>
                            setShowNewPassword((current) => !current)
                          }
                        >
                          {showNewPassword ? "Hide" : "View"}
                        </button>
                      </div>
                    </div>
                    <div className="login-element">
                      <label htmlFor="confirm_password">Confirm Password</label>
                      <div className="login-password-field">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          id="confirm_password"
                          placeholder="Confirm password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          className="login-password-toggle"
                          onClick={() =>
                            setShowConfirmPassword((current) => !current)
                          }
                        >
                          {showConfirmPassword ? "Hide" : "View"}
                        </button>
                      </div>
                    </div>
                    <div className="login-submit">
                      <button onClick={handleSetNewPassword} disabled={loading}>
                        {loading ? "Creating..." : "Create Password"}
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="login-error">
                    <p
                      style={{
                        color: "red",
                        textAlign: "center",
                        paddingTop: "8px",
                      }}
                    >
                      {error}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// "use client";

// import { useState } from "react";
// import { useRouter } from "next/navigation";
// import { jwtDecode } from "jwt-decode";
// import { login, completeNewPassword } from "@/src/lib/auth";
// import { CognitoUser } from "amazon-cognito-identity-js";
// import Image from "next/image";

// import logo from "@/public/clear-tax.svg";
// import logoBlue from "@/public/clear-tax-blue.svg";
// import shield from "@/public/shield.svg";
// import lock from "@/public/lock.svg";
// import live from "@/public/live.svg";
// import analytics from "@/public/analytics.svg";
// import users from "@/public/users.svg";
// import realTime from "@/public/real-time.svg";

// interface TokenPayload {
//   email: string;
//   "custom:role"?: string;
// }

// export default function LoginComponent({
//   allowedRoles,
// }: {
//   allowedRoles: string[];
// }) {
//   const router = useRouter();

//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");

//   const [newPassword, setNewPassword] = useState("");
//   const [confirmPassword, setConfirmPassword] = useState("");

//   const [requireNewPassword, setRequireNewPassword] = useState(false);
//   const [user, setUser] = useState<CognitoUser | null>(null);

//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");

//   // 🔐 LOGIN
//   const handleLogin = async () => {
//     setError("");
//     setLoading(true);

//     try {
//       const result: any = await login(email, password);

//       // 🔥 NEW PASSWORD FLOW
//       if (result.type === "NEW_PASSWORD_REQUIRED") {
//         setUser(result.user);
//         setRequireNewPassword(true);
//         setLoading(false);
//         return;
//       }

//       if (result.type === "SUCCESS") {
//         const token = result.idToken;
//         const decoded: TokenPayload = jwtDecode(token);

//         const role = decoded["custom:role"]?.toLowerCase();

//         if (!role) {
//           setError("Role not assigned. Contact admin.");
//           setLoading(false);
//           return;
//         }

//         if (!allowedRoles.includes(role)) {
//           setError("You are not allowed to login here");
//           setLoading(false);
//           return;
//         }

//         document.cookie = `idToken=${token}; path=/; secure; samesite=strict`;

//         if (role === "super_admin") {
//           router.replace("/dashboard/super-admin");
//         } else if (role === "admin") {
//           router.replace("/dashboard/admin");
//         } else if (role === "accountant") {
//           router.replace("/dashboard/accountant");
//         } else {
//           router.replace("/dashboard/client");
//         }
//       }
//     } catch (err: any) {
//       setError(err.message || "Login failed");
//     }

//     setLoading(false);
//   };

//   // 🔐 SET PASSWORD
//   const handleSetNewPassword = async () => {
//     if (newPassword !== confirmPassword) {
//       setError("Passwords do not match");
//       return;
//     }

//     if (!user) return;

//     setLoading(true);
//     setError("");

//     try {
//       await completeNewPassword(user, newPassword, {});

//       setRequireNewPassword(false);
//       setPassword("");
//       setNewPassword("");
//       setConfirmPassword("");

//       setError("Password updated. Please login.");
//     } catch (err: any) {
//       setError(err.message || "Password update failed");
//     }

//     setLoading(false);
//   };

//   const role = allowedRoles[0];

//   const roleMap: Record<string, string> = {
//     super_admin: "Super Admin",
//     admin: "Admin",
//     accountant: "Accountant",
//     client: "Client",
//   };

//   return (
//     <div className="loginSection">
//       <div className="login-container">
//         <div className="login-wrapper">
//           {/* LEFT PANEL */}
//           <div className="login-left">
//             <div className="login-left-wrap">
//               <div className="ll-top">
//                 <div className="llt-icon-head">
//                   <div className="login-icon">
//                     <Image src={logo} alt="logo" width={100} height={100} />
//                   </div>
//                   <h1>Clear Portfolio</h1>
//                 </div>

//                 <h2>{roleMap[role]}</h2>

//                 <p className="darkBg txt-center">
//                   Secure administrative access for financial dashboard
//                   management.
//                 </p>
//               </div>

//               <div className="ll-bottom">
//                 {[shield, lock, live, analytics, users, realTime].map(
//                   (icon, i) => (
//                     <div key={i} className="llb-item">
//                       <Image src={icon} alt="icon" width={56} height={56} />
//                     </div>
//                   ),
//                 )}
//               </div>
//             </div>

//             <div className="ll-copyright">
//               <p>© 2026 Clear Portfolio</p>
//             </div>
//           </div>

//           {/* RIGHT PANEL */}
//           <div className="login-right">
//             <div className="login-right-wrap">
//               <div className="lr-top">
//                 <Image src={logoBlue} alt="logo" width={100} height={100} />
//                 <h2>{roleMap[role]} Portal</h2>
//               </div>

//               <div className="lr-form">
//                 {/* LOGIN FORM */}
//                 {!requireNewPassword && (
//                   <>
//                     <input
//                       type="email"
//                       placeholder="Email"
//                       value={email}
//                       onChange={(e) => setEmail(e.target.value)}
//                     />

//                     <input
//                       type="password"
//                       placeholder="Password"
//                       value={password}
//                       onChange={(e) => setPassword(e.target.value)}
//                     />

//                     <button onClick={handleLogin} disabled={loading}>
//                       {loading ? "Logging in..." : "Login"}
//                     </button>
//                   </>
//                 )}

//                 {/* PASSWORD SET FORM */}
//                 {requireNewPassword && (
//                   <>
//                     <input value={email} disabled />

//                     <input
//                       type="password"
//                       placeholder="New Password"
//                       value={newPassword}
//                       onChange={(e) => setNewPassword(e.target.value)}
//                     />

//                     <input
//                       type="password"
//                       placeholder="Confirm Password"
//                       value={confirmPassword}
//                       onChange={(e) => setConfirmPassword(e.target.value)}
//                     />

//                     <button onClick={handleSetNewPassword} disabled={loading}>
//                       {loading ? "Creating..." : "Create Password"}
//                     </button>
//                   </>
//                 )}

//                 {error && <p style={{ color: "red" }}>{error}</p>}
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
