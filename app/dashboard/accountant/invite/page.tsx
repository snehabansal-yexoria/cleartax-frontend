import { redirect } from "next/navigation";

export default function AccountantInviteRedirectPage() {
  redirect("/dashboard/accountant/clients?invite=1");
}
