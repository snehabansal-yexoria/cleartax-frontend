import Link from "next/link";

export default function LoginSelector() {
  return (
    <div style={{ margin: "100px" }}>
      <h2>Select Login</h2>

      <Link href="/login/super-admin">Super Admin</Link>
      <br />

      <Link href="/login/admin">Admin</Link>
      <br />

      <Link href="/login/user">User</Link>
    </div>
  );
}
