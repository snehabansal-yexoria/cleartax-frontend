import LoginComponent from "../../components/LoginComponent";

export default function Page() {
  return <LoginComponent allowedRoles={["super_admin"]} />;
}
