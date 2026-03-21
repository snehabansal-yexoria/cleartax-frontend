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

export default function LoginComponent({
  allowedRoles,
}: {
  allowedRoles: string[];
}) {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [requireNewPassword, setRequireNewPassword] = useState(false);
  const [user, setUser] = useState<CognitoUser | null>(null);
  const [attributes, setAttributes] = useState<any>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const result: any = await login(email, password);

      // 🔥 Handle first login
      if (result.type === "NEW_PASSWORD_REQUIRED") {
        setUser(result.user);

        const requiredAttributes: any = {};
        requiredAttributes.name = email;

        setAttributes(requiredAttributes);
        setRequireNewPassword(true);

        setLoading(false);
        return;
      }

      if (result.type === "SUCCESS") {
        const token = result.idToken;
        const decoded: TokenPayload = jwtDecode(token);

        const role = decoded["custom:role"] || "client";

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
    } catch (err: any) {
      setError(err.message || "Login failed");
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
      await completeNewPassword(user, newPassword, attributes);

      alert("Password updated successfully. Please login again.");
      setRequireNewPassword(false);
    } catch (err: any) {
      setError(err.message || "Password update failed");
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
                <p className="darkBg txt-center">
                  Secure administrative access for financial dashboard
                  management. Monitor, control, and oversee all system
                  operations.
                </p>
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
                      <input
                        type="password"
                        placeholder="Enter your password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    <div className="login-submit">
                      <button onClick={handleLogin} disabled={loading}>
                        {loading ? "Logging in..." : "Log In to Dashboard"}
                      </button>
                    </div>
                  </div>
                )}

                {requireNewPassword && (
                  <>
                    <h3>Set New Password</h3>

                    <input
                      type="password"
                      placeholder="New password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />

                    <br />
                    <br />

                    <input
                      type="password"
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />

                    <br />
                    <br />

                    <button onClick={handleSetNewPassword} disabled={loading}>
                      {loading ? "Updating..." : "Update Password"}
                    </button>
                  </>
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
