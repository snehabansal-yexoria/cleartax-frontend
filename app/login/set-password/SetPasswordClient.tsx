"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CognitoUser } from "amazon-cognito-identity-js";
import { userPool } from "../../../src/lib/cognito";

export default function SetPasswordClient({ email }: { email: string }) {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSetPassword = async () => {
    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const user = new CognitoUser({
        Username: email,
        Pool: userPool,
      });

      user.completeNewPasswordChallenge(
        password,
        {},
        {
          onSuccess: async (result) => {
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
              }).catch(() => undefined);
            }

            alert("Password set successfully");
            router.push("/login");
          },
          onFailure: (err) => {
            alert(err.message || "Error setting password");
          },
        },
      );
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    }

    setLoading(false);
  };

  return (
    <div style={{ width: "400px", margin: "100px auto" }}>
      <h2>Set Your Password</h2>

      <p>{email}</p>

      <div className="login-password-field">
        <input
          type={showPassword ? "text" : "password"}
          placeholder="New password"
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

      <br />
      <br />

      <div className="login-password-field">
        <input
          type={showConfirmPassword ? "text" : "password"}
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <button
          type="button"
          className="login-password-toggle"
          onClick={() => setShowConfirmPassword((current) => !current)}
        >
          {showConfirmPassword ? "Hide" : "View"}
        </button>
      </div>

      <br />
      <br />

      <button onClick={handleSetPassword} disabled={loading}>
        {loading ? "Updating..." : "Set Password"}
      </button>
    </div>
  );
}
