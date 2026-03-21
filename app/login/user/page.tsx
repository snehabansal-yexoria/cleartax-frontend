"use client";

import { useState } from "react";
import { login } from "../../../src/lib/auth";

export default function UserLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin() {
    try {
      const response: any = await login(email, password);

      if (response.type === "NEW_PASSWORD_REQUIRED") {
        alert("Please set a new password first.");
        return;
      }

      const payload = response.result.getIdToken().decodePayload();
      const role = payload["custom:role"];

      if (role === "accountant") {
        window.location.href = "/dashboard/accountant";
      } else if (role === "client") {
        window.location.href = "/dashboard/client";
      } else {
        alert("Not authorized");
      }
    } catch {
      alert("Login failed");
    }
  }

  return (
    <div>
      <h1>User Login</h1>

      <input placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
      <input
        type="password"
        placeholder="Password"
        onChange={(e) => setPassword(e.target.value)}
      />

      <button onClick={handleLogin}>Login</button>
    </div>
  );
}
