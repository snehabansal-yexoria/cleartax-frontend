import { redirect } from "next/navigation";

// A transaction has no page of its own in the client portal: its details open
// as a drawer over the transactions list. This path is kept so links to
// /dashboard/client/transactions/<id> land on that drawer instead of a 404.
export default async function ClientTransactionRedirect({
  params,
}: {
  params: Promise<{ transactionId: string }>;
}) {
  const { transactionId } = await params;
  redirect(`/dashboard/client/transactions?txn=${encodeURIComponent(transactionId)}`);
}
