"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CognitoUser } from "amazon-cognito-identity-js";
import { completeNewPassword, login } from "../../../src/lib/auth";

type LoginChallengeResult = {
  type: "NEW_PASSWORD_REQUIRED";
  user: CognitoUser;
  userAttributes?: Record<string, string>;
};

type LoginSuccessResult = {
  type: "SUCCESS";
  idToken: string;
  accessToken: string;
};

type InviteLoginResult = LoginChallengeResult | LoginSuccessResult;

function getRoleLoginHref(role: string) {
  const normalizedRole = String(role || "").toLowerCase();

  if (normalizedRole === "client") {
    return "/login/user";
  }

  if (["admin", "accountant", "super-admin", "super_admin"].includes(normalizedRole)) {
    return `/login/${normalizedRole.replace("_", "-")}`;
  }

  return "/login";
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function SetPasswordClient({
  email,
  role,
  temporaryPassword,
}: {
  email: string;
  role: string;
  temporaryPassword: string;
}) {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPreparingInvite, setIsPreparingInvite] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState<CognitoUser | null>(null);
  const [attributes, setAttributes] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;

    async function prepareInviteChallenge() {
      if (!email || !temporaryPassword) {
        setError("This invitation link is missing required setup details.");
        setIsPreparingInvite(false);
        return;
      }

      try {
        const result = (await login(email, temporaryPassword)) as InviteLoginResult;

        if (!isMounted) {
          return;
        }

        if (result.type === "NEW_PASSWORD_REQUIRED") {
          setUser(result.user);
          setAttributes({
            ...(result.userAttributes || {}),
            name: result.userAttributes?.name || email,
          });
          setIsPreparingInvite(false);
          return;
        }

        setError(
          "This invitation has already been completed. Please log in with your password.",
        );
        setIsPreparingInvite(false);
      } catch (inviteError) {
        if (!isMounted) {
          return;
        }

        setError(
          getErrorMessage(
            inviteError,
            "This invitation link is invalid or has expired.",
          ),
        );
        setIsPreparingInvite(false);
      }
    }

    prepareInviteChallenge();

    return () => {
      isMounted = false;
    };
  }, [email, temporaryPassword]);

  async function handleSetPassword() {
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!user) {
      setError("This invitation is not ready yet. Please reopen the invite link.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await completeNewPassword(user, password, attributes);
      const idToken =
        typeof result === "object" &&
        result !== null &&
        "getIdToken" in result &&
        typeof result.getIdToken === "function"
          ? result.getIdToken().getJwtToken()
          : "";
      const accessToken =
        typeof result === "object" &&
        result !== null &&
        "getAccessToken" in result &&
        typeof result.getAccessToken === "function"
          ? result.getAccessToken().getJwtToken()
          : "";

      if (idToken) {
        if (accessToken) {
          document.cookie = `accessToken=${accessToken}; path=/`;
        }

        document.cookie = `idToken=${idToken}; path=/`;

        await fetch("/api/invitations/accept", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }).catch(() => undefined);
      }

      alert("Password created successfully. Please login with your new password.");
      router.push(getRoleLoginHref(role));
    } catch (setPasswordError) {
      setError(getErrorMessage(setPasswordError, "Password update failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="loginSection">
      <div className="login-set-password-card">
        <p className="portal-kicker">Invitation Setup</p>
        <h1>Create Your Password</h1>
        <p>
          {email
            ? `Finish setting up ${email} to access Clear Portfolio.`
            : "Finish setting up your Clear Portfolio account."}
        </p>

        {isPreparingInvite ? (
          <div className="login-set-password-state">
            Preparing your secure invitation...
          </div>
        ) : (
          <>
            <div className="login-element">
              <label htmlFor="invite_email">Email Address</label>
              <input id="invite_email" type="email" value={email} disabled />
            </div>

            <div className="login-element">
              <label htmlFor="new_password">New Password</label>
              <div className="login-password-field">
                <input
                  id="new_password"
                  type={showPassword ? "text" : "password"}
                  placeholder="New password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
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

            <div className="login-element">
              <label htmlFor="confirm_password">Confirm Password</label>
              <div className="login-password-field">
                <input
                  id="confirm_password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
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
              <button onClick={handleSetPassword} disabled={loading || !user}>
                {loading ? "Creating Password..." : "Create Password"}
              </button>
            </div>
          </>
        )}

        {error && (
          <div className="login-error">
            <p>{error}</p>
            <button
              type="button"
              className="portal-secondary-link"
              onClick={() => router.push(getRoleLoginHref(role))}
            >
              Go to login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
