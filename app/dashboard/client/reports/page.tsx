import { redirect } from "next/navigation";

// Reports has one report today; the index lands on it. A list of reports goes
// here once there is a second.
export default function ClientReportsPage() {
  redirect("/dashboard/client/reports/portfolio-summary");
}
