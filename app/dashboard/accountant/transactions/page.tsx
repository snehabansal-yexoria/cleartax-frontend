import { AllTransactionsView } from "@/app/components/TransactionsFeature";

export default function AccountantTransactionsPage() {
  // Selection, the running total and Export Selected are for this page only —
  // the per-client, entity and property surfaces render the same component
  // without it.
  return <AllTransactionsView context={{ kind: "none" }} enableSelection />;
}
