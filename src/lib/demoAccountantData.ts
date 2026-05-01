export type DemoClientRecord = {
  id: string;
  email: string;
  status: string;
  name: string;
  phoneNumber: string;
  invitedByEmail: string;
  joinedAt: string | null;
  assignedAccountantId: string;
  assignedAccountantName: string;
};

export type DemoOrganizationRecord = {
  id: string;
  name: string;
};

export const DEMO_ORGANIZATION: DemoOrganizationRecord = {
  id: "demo-organization",
  name: "ClearTax Demo Organisation",
};

export function getDemoClientRecord(accountant?: {
  id?: string;
  name?: string;
  email?: string;
}): DemoClientRecord {
  const accountantId = String(accountant?.id || "demo-accountant");
  const accountantName =
    String(accountant?.name || "").trim() ||
    String(accountant?.email || "").trim() ||
    "Demo Accountant";

  return {
    id: "demo-client-001",
    email: "priya.mehta@example.com",
    status: "ACTIVE",
    name: "Priya Mehta",
    phoneNumber: "+91 98765 43210",
    invitedByEmail: accountant?.email || "admin@cleartax.local",
    joinedAt: "2026-04-15T10:30:00.000Z",
    assignedAccountantId: accountantId,
    assignedAccountantName: accountantName,
  };
}
