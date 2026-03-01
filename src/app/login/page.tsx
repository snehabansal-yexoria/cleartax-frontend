"use client";

import { useState } from "react";
import { signIn, confirmSignIn, fetchAuthSession } from "aws-amplify/auth";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [challenge, setChallenge] = useState(false);

  async function handleLogin() {
    try {
      const user = await signIn({ username: email, password });

      if (
        user.nextStep?.signInStep ===
        "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED"
      ) {
        setChallenge(true);
        return;
      }

      await completeLogin();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleNewPassword() {
    try {
      await confirmSignIn({ challengeResponse: newPassword });
      await completeLogin();
    } catch (err) {
      console.error(err);
    }
  }

  async function completeLogin() {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();

    // Store token in cookie via backend
    await fetch("/api/auth/session", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });

    const groups = session.tokens?.idToken?.payload["cognito:groups"];

    const role = groups?.[0];

    if (role === "super_admin") router.push("/super-admin");
    else if (role === "admin") router.push("/admin");
    else router.push("/dashboard");
  }

  return (
    <div>
      {!challenge ? (
        <>
          <input
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={handleLogin}>Login</button>
        </>
      ) : (
        <>
          <input
            type="password"
            placeholder="Set New Password"
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button onClick={handleNewPassword}>Set Password</button>
        </>
      )}
    </div>
  );
}
