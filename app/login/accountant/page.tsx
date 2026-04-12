import LoginComponent from "@/app/components/LoginComponent";

export default function AccountantLoginPage() {
  return <LoginComponent allowedRoles={["accountant"]} />;
}
