"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { completeNewPassword } from "../../../src/lib/auth";
import { CognitoUser } from "amazon-cognito-identity-js";
import { userPool } from "../../../src/lib/cognito";

export default function SetPasswordClient({ email }: { email: string }) {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
          onSuccess: () => {
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

      <input
        type="password"
        placeholder="New password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
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

      <button onClick={handleSetPassword} disabled={loading}>
        {loading ? "Updating..." : "Set Password"}
      </button>
    </div>
  );
}
