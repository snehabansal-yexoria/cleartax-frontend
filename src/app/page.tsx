"use client";

import { useState } from "react";
import { signIn, confirmSignIn, fetchAuthSession } from "aws-amplify/auth";
import { useRouter } from "next/navigation";
import { configureAmplify } from "../lib/amplify";

export default function Home() {
  configureAmplify();
  console.log(process.env.NEXT_PUBLIC_USER_POOL_ID);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [challenge, setChallenge] = useState(false);

  async function handleLogin() {
    const response = await signIn({
      username: email,
      password,
    });

    if (
      response.nextStep?.signInStep ===
      "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED"
    ) {
      setChallenge(true);
      return;
    }

    const session = await fetchAuthSession();
    console.log(session.tokens?.idToken?.payload);
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
    <div style={{ padding: 40 }}>
      <h1>Login</h1>

      {!challenge ? (
        <>
          <input
            placeholder="Email"
            onChange={(e) => setEmail(e.target.value)}
          />
          <br />
          <br />
          <input
            type="password"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
          />
          <br />
          <br />
          <button onClick={handleLogin}>Login</button>
        </>
      ) : (
        <>
          <h3>Set New Password</h3>
          <input
            type="password"
            placeholder="New Password"
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <br />
          <br />
          <button onClick={handleNewPassword}>Set Password</button>
        </>
      )}
    </div>
  );
}
