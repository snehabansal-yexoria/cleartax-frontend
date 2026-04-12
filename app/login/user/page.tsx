import LoginComponent from "@/app/components/LoginComponent";

export default function UserLoginPage() {
  return <LoginComponent allowedRoles={["client"]} />;
}
