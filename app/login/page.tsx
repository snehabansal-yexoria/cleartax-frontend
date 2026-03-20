"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import { login, completeNewPassword } from "../../src/lib/auth";
import { CognitoUser } from "amazon-cognito-identity-js";

interface TokenPayload {
  email: string;
  "custom:role"?: string;
}

export default function LoginPage() {
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

        document.cookie = `idToken=${token}; path=/`;

        router.replace("/dashboard");
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

  return (
    <div style={{ width: "400px", margin: "100px auto" }}>
      <h2>Login</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {!requireNewPassword && (
        <>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <br />
          <br />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <br />
          <br />

          <button onClick={handleLogin} disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </>
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
    </div>
  );
}
