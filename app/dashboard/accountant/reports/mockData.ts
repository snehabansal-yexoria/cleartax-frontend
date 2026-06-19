export interface ClientData {
  id: string;
  name: string;
  initials: string;
  entityType: string;
  portfolio: string;
  propertiesCount: number | string;
  entitiesCount: number | string;
  transactionsCount: number | string;
  totalActions: number;
  lastActivity: string;
}

export interface TimelineEvent {
  id: string;
  clientId: string;
  clientName: string;
  action: string;
  detail: string;
  time: string;
  type: "added" | "edited" | "deleted" | "reclassified";
  timestamp: Date;
}

export interface TransactionRecord {
  id: string;
  clientId: string;
  clientName: string;
  clientInitials: string;
  action: "Added" | "Edited" | "Deleted";
  transactionName: string;
  category: string;
  property: string;
  amount: number;
  date: string;
  timestamp: Date;
}

export interface PropertyRecord {
  id: string;
  clientId: string;
  clientName: string;
  clientInitials: string;
  action: "Added" | "Edited" | "Deleted";
  property: string;
  type: string;
  change: string;
  date: string;
  timestamp: Date;
}

export interface EntityRecord {
  id: string;
  clientId: string;
  clientName: string;
  clientInitials: string;
  action: "Added" | "Edited" | "Deleted";
  entityName: string;
  type: string;
  change: string;
  date: string;
  timestamp: Date;
}

export interface DocumentRecord {
  id: string;
  clientId: string;
  clientName: string;
  clientInitials: string;
  action: "Added" | "Edited" | "Deleted";
  documentName: string;
  type: string;
  size: string;
  date: string;
  timestamp: Date;
}

export interface RuleRecord {
  id: string;
  clientId: string;
  clientName: string;
  clientInitials: string;
  action: "Added" | "Edited" | "Deleted";
  ruleName: string;
  change: string;
  date: string;
  timestamp: Date;
}

// Helper to construct a dynamic date relative to June 19, 2026
const getMockDate = (daysAgo: number, timeStr: string): Date => {
  const d = new Date("2026-06-19T00:00:00");
  d.setDate(d.getDate() - daysAgo);
  const [time, modifier] = timeStr.split(" ");
  let [hours, minutes] = time.split(":");
  let h = parseInt(hours);
  if (modifier?.toLowerCase() === "pm" && h < 12) h += 12;
  if (modifier?.toLowerCase() === "am" && h === 12) h = 0;
  d.setHours(h, parseInt(minutes), 0, 0);
  return d;
};

export const mockClients: ClientData[] = [
  {
    id: "sneha-bansal",
    name: "Sneha Bansal",
    initials: "SB",
    entityType: "Discretionary trust",
    portfolio: "$7.2M portfolio",
    propertiesCount: 1,
    entitiesCount: 0,
    transactionsCount: 6,
    totalActions: 4,
    lastActivity: "11:47 AM",
  },
  {
    id: "raj-patel",
    name: "Raj Patel",
    initials: "RP",
    entityType: "SMSF",
    portfolio: "$3.8M portfolio",
    propertiesCount: 0,
    entitiesCount: 9,
    transactionsCount: 9,
    totalActions: 6,
    lastActivity: "10:32 AM",
  },
  {
    id: "mark-williams",
    name: "Mark Williams",
    initials: "MW",
    entityType: "Individual",
    portfolio: "$1.9M portfolio",
    propertiesCount: 0,
    entitiesCount: 1,
    transactionsCount: 6,
    totalActions: 2,
    lastActivity: "09:02 AM",
  },
  {
    id: "li-chen",
    name: "Li Chen",
    initials: "LC",
    entityType: "Unit trust",
    portfolio: "$2.4M portfolio",
    propertiesCount: 0,
    entitiesCount: 0,
    transactionsCount: 0,
    totalActions: 1,
    lastActivity: "08:10 AM",
  },
  {
    id: "james-cooper",
    name: "James Cooper",
    initials: "JC",
    entityType: "Individual",
    portfolio: "$1.2M portfolio",
    propertiesCount: "-",
    entitiesCount: "-",
    transactionsCount: "-",
    totalActions: 0,
    lastActivity: "No activity in this period",
  },
  {
    id: "aisha-khan",
    name: "Aisha Khan",
    initials: "AK",
    entityType: "Company (Pty Ltd)",
    portfolio: "$4.1M portfolio",
    propertiesCount: "-",
    entitiesCount: "-",
    transactionsCount: "-",
    totalActions: 0,
    lastActivity: "No activity in this period",
  },
  {
    id: "tom-nguyen",
    name: "Tom Nguyen",
    initials: "TN",
    entityType: "Individual",
    portfolio: "$900K portfolio",
    propertiesCount: "-",
    entitiesCount: "-",
    transactionsCount: "-",
    totalActions: 0,
    lastActivity: "No activity in this period",
  },
  {
    id: "priya-mehta",
    name: "Priya Mehta",
    initials: "PM",
    entityType: "Discretionary trust",
    portfolio: "$5.6M portfolio",
    propertiesCount: "-",
    entitiesCount: "-",
    transactionsCount: "-",
    totalActions: 0,
    lastActivity: "No activity in this period",
  },
  {
    id: "david-kim",
    name: "David Kim",
    initials: "DK",
    entityType: "SMSF",
    portfolio: "$2.8M portfolio",
    propertiesCount: "-",
    entitiesCount: "-",
    transactionsCount: "-",
    totalActions: 0,
    lastActivity: "No activity in this period",
  },
  {
    id: "sarah-obrien",
    name: "Sarah O'Brien",
    initials: "SO",
    entityType: "Individual",
    portfolio: "$1.5M portfolio",
    propertiesCount: "-",
    entitiesCount: "-",
    transactionsCount: "-",
    totalActions: 0,
    lastActivity: "No activity in this period",
  },
  {
    id: "michael-tran",
    name: "Michael Tran",
    initials: "MT",
    entityType: "Partnership",
    portfolio: "$3.1M portfolio",
    propertiesCount: "-",
    entitiesCount: "-",
    transactionsCount: "-",
    totalActions: 0,
    lastActivity: "No activity in this period",
  },
];

export const mockTimelineEvents: TimelineEvent[] = [
  {
    id: "ev-1",
    clientId: "sneha-bansal",
    clientName: "Sneha Bansal",
    action: "Edited property",
    detail: "12 Maple St — Status: Vacant → Rented, Value: $820K → $850K",
    time: "11:47 AM",
    type: "edited",
    timestamp: getMockDate(0, "11:47 AM"),
  },
  {
    id: "ev-2",
    clientId: "raj-patel",
    clientName: "Raj Patel",
    action: "Added 5 transactions",
    detail: "Bulk import — bank statement, Juno batch",
    time: "10:32 AM",
    type: "added",
    timestamp: getMockDate(0, "10:32 AM"),
  },
  {
    id: "ev-3",
    clientId: "sneha-bansal",
    clientName: "Sneha Bansal",
    action: "Added property",
    detail: "12 Maple St, Sydney — Residential, Vacant, $820K",
    time: "09:14 AM",
    type: "added",
    timestamp: getMockDate(0, "09:14 AM"),
  },
  {
    id: "ev-4",
    clientId: "mark-williams",
    clientName: "Mark Williams",
    action: "Reclassified 6 transactions",
    detail: "Unclassified → Maintenance / Utilities",
    time: "09:17 AM",
    type: "reclassified",
    timestamp: getMockDate(0, "09:17 AM"),
  },
  {
    id: "ev-5",
    clientId: "sneha-bansal",
    clientName: "Sneha Bansal",
    action: "Uploaded document",
    detail: "Lease agreement — 12 Maple St",
    time: "08:55 AM",
    type: "added",
    timestamp: getMockDate(0, "08:55 AM"),
  },
  {
    id: "ev-6",
    clientId: "mark-williams",
    clientName: "Mark Williams",
    action: "Edited entity",
    detail: "Williams Family Trust — ownership 100% confirmed",
    time: "08:40 AM",
    type: "edited",
    timestamp: getMockDate(0, "08:40 AM"),
  },
  {
    id: "ev-7",
    clientId: "raj-patel",
    clientName: "Raj Patel",
    action: "Deleted transaction",
    detail: "Duplicate entry removed — $1,200 maintenance",
    time: "08:21 AM",
    type: "deleted",
    timestamp: getMockDate(0, "08:21 AM"),
  },
  // Past days events (within 7 days)
  {
    id: "ev-8",
    clientId: "sneha-bansal",
    clientName: "Sneha Bansal",
    action: "Edited property",
    detail: "12 Maple St — Renovation completed",
    time: "10 Jun, 04:00 PM",
    type: "edited",
    timestamp: getMockDate(2, "04:00 PM"),
  },
  {
    id: "ev-9",
    clientId: "mark-williams",
    clientName: "Mark Williams",
    action: "Added property",
    detail: "22 Coast Dr, Perth — Commercial, $1.35M",
    time: "10 Jun, 08:50 AM",
    type: "added",
    timestamp: getMockDate(5, "08:50 AM"),
  },
];

export const mockTransactions: TransactionRecord[] = [
  // Today's Transactions (0 days ago)
  {
    id: "TXN-1842",
    clientId: "raj-patel",
    clientName: "Raj Patel",
    clientInitials: "RP",
    action: "Added",
    transactionName: "Westpac — Mortgage repayment",
    category: "Interest / Loan",
    property: "4 Park Ave, Melbourne",
    amount: -2400,
    date: "10 Jun, 10:32 AM",
    timestamp: getMockDate(0, "10:32 AM"),
  },
  {
    id: "TXN-1843",
    clientId: "raj-patel",
    clientName: "Raj Patel",
    clientInitials: "RP",
    action: "Added",
    transactionName: "Tenant rent — June",
    category: "Rental income",
    property: "4 Park Ave, Melbourne",
    amount: 3200,
    date: "10 Jun, 10:32 AM",
    timestamp: getMockDate(0, "10:32 AM"),
  },
  {
    id: "TXN-1844",
    clientId: "raj-patel",
    clientName: "Raj Patel",
    clientInitials: "RP",
    action: "Added",
    transactionName: "AGL — Electricity",
    category: "Maintenance",
    property: "4 Park Ave, Melbourne",
    amount: -180,
    date: "10 Jun, 10:32 AM",
    timestamp: getMockDate(0, "10:32 AM"),
  },
  {
    id: "TXN-1845",
    clientId: "raj-patel",
    clientName: "Raj Patel",
    clientInitials: "RP",
    action: "Added",
    transactionName: "Strata fees Q2",
    category: "Management fees",
    property: "4 Park Ave, Melbourne",
    amount: -620,
    date: "10 Jun, 10:32 AM",
    timestamp: getMockDate(0, "10:32 AM"),
  },
  {
    id: "TXN-1846",
    clientId: "raj-patel",
    clientName: "Raj Patel",
    clientInitials: "RP",
    action: "Added",
    transactionName: "Council rates",
    category: "Maintenance",
    property: "4 Park Ave, Melbourne",
    amount: -340,
    date: "10 Jun, 10:32 AM",
    timestamp: getMockDate(0, "10:32 AM"),
  },
  {
    id: "TXN-1847",
    clientId: "sneha-bansal",
    clientName: "Sneha Bansal",
    clientInitials: "SB",
    action: "Added",
    transactionName: "Insurance premium — annual",
    category: "Insurance",
    property: "12 Maple St, Sydney",
    amount: -1280,
    date: "10 Jun, 09:14 AM",
    timestamp: getMockDate(0, "09:14 AM"),
  },
  {
    id: "TXN-1848",
    clientId: "sneha-bansal",
    clientName: "Sneha Bansal",
    clientInitials: "SB",
    action: "Added",
    transactionName: "Plumber — leak repair",
    category: "Maintenance",
    property: "12 Maple St, Sydney",
    amount: -450,
    date: "10 Jun, 09:14 AM",
    timestamp: getMockDate(0, "09:14 AM"),
  },
  {
    id: "TXN-1820",
    clientId: "mark-williams",
    clientName: "Mark Williams",
    clientInitials: "MW",
    action: "Edited",
    transactionName: "AGL — Gas",
    category: "Unclassified → Maintenance / Utilities",
    property: "22 Coast Dr, Perth",
    amount: -95,
    date: "10 Jun, 09:02 AM",
    timestamp: getMockDate(0, "09:02 AM"),
  },
  {
    id: "TXN-1821",
    clientId: "sneha-bansal",
    clientName: "Sneha Bansal",
    clientInitials: "SB",
    action: "Edited",
    transactionName: "Quarterly Water Rates",
    category: "Utilities",
    property: "12 Maple St, Sydney",
    amount: -340,
    date: "10 Jun, 11:47 AM",
    timestamp: getMockDate(0, "11:47 AM"),
  },
  {
    id: "TXN-1822",
    clientId: "sneha-bansal",
    clientName: "Sneha Bansal",
    clientInitials: "SB",
    action: "Edited",
    transactionName: "Common Area Painting",
    category: "Maintenance",
    property: "12 Maple St, Sydney",
    amount: -1500,
    date: "10 Jun, 11:47 AM",
    timestamp: getMockDate(0, "11:47 AM"),
  },
  {
    id: "TXN-1823",
    clientId: "sneha-bansal",
    clientName: "Sneha Bansal",
    clientInitials: "SB",
    action: "Edited",
    transactionName: "Landlord Insurance",
    category: "Insurance",
    property: "12 Maple St, Sydney",
    amount: -980,
    date: "10 Jun, 11:47 AM",
    timestamp: getMockDate(0, "11:47 AM"),
  },
  {
    id: "TXN-1824",
    clientId: "sneha-bansal",
    clientName: "Sneha Bansal",
    clientInitials: "SB",
    action: "Edited",
    transactionName: "Pest Control Services",
    category: "Maintenance",
    property: "12 Maple St, Sydney",
    amount: -220,
    date: "10 Jun, 11:47 AM",
    timestamp: getMockDate(0, "11:47 AM"),
  },
  {
    id: "TXN-1825",
    clientId: "sneha-bansal",
    clientName: "Sneha Bansal",
    clientInitials: "SB",
    action: "Edited",
    transactionName: "Fire Safety Audit",
    category: "Compliance",
    property: "12 Maple St, Sydney",
    amount: -450,
    date: "10 Jun, 11:47 AM",
    timestamp: getMockDate(0, "11:47 AM"),
  },
  {
    id: "TXN-1830",
    clientId: "raj-patel",
    clientName: "Raj Patel",
    clientInitials: "RP",
    action: "Deleted",
    transactionName: "Duplicate Bank Fee Entry",
    category: "Bank Fees",
    property: "4 Park Ave, Melbourne",
    amount: -15,
    date: "10 Jun, 08:21 AM",
    timestamp: getMockDate(0, "08:21 AM"),
  },

  // Past Transactions (within 7 days)
  {
    id: "TXN-1801",
    clientId: "sneha-bansal",
    clientName: "Sneha Bansal",
    clientInitials: "SB",
    action: "Added",
    transactionName: "Office Depot Supply",
    category: "Office Expenses",
    property: "12 Maple St, Sydney",
    amount: -120,
    date: "08 Jun, 02:15 PM",
    timestamp: getMockDate(2, "02:15 PM"),
  },
  {
    id: "TXN-1802",
    clientId: "mark-williams",
    clientName: "Mark Williams",
    clientInitials: "MW",
    action: "Added",
    transactionName: "Consultation Fee Received",
    category: "Professional Services",
    property: "22 Coast Dr, Perth",
    amount: 1500,
    date: "06 Jun, 11:00 AM",
    timestamp: getMockDate(4, "11:00 AM"),
  },

  // Older Transactions (within 30 days)
  {
    id: "TXN-1750",
    clientId: "li-chen",
    clientName: "Li Chen",
    clientInitials: "LC",
    action: "Added",
    transactionName: "Annual Software Subscription",
    category: "Software License",
    property: "Suite 402, Sydney",
    amount: -890,
    date: "28 May, 09:30 AM",
    timestamp: getMockDate(12, "09:30 AM"),
  },
  {
    id: "TXN-1751",
    clientId: "sneha-bansal",
    clientName: "Sneha Bansal",
    clientInitials: "SB",
    action: "Edited",
    transactionName: "Rental Property Cleaning",
    category: "Maintenance",
    property: "12 Maple St, Sydney",
    amount: -350,
    date: "25 May, 01:10 PM",
    timestamp: getMockDate(15, "01:10 PM"),
  },

  // Oldest Transactions (within 3 months)
  {
    id: "TXN-1610",
    clientId: "raj-patel",
    clientName: "Raj Patel",
    clientInitials: "RP",
    action: "Added",
    transactionName: "Commercial Unit Fitout Deposit",
    category: "Capital Expenses",
    property: "4 Park Ave, Melbourne",
    amount: -12000,
    date: "15 Apr, 10:00 AM",
    timestamp: getMockDate(45, "10:00 AM"),
  },
];

export const mockProperties: PropertyRecord[] = [
  {
    id: "PROP-0091",
    clientId: "sneha-bansal",
    clientName: "Sneha Bansal",
    clientInitials: "SB",
    action: "Added",
    property: "12 Maple St, Sydney",
    type: "Residential",
    change: "New: Vacant · $820,000 · Depreciation: Yes",
    date: "10 Jun, 09:14 AM",
    timestamp: getMockDate(0, "09:14 AM"),
  },
  {
    id: "PROP-0091",
    clientId: "sneha-bansal",
    clientName: "Sneha Bansal",
    clientInitials: "SB",
    action: "Edited",
    property: "12 Maple St, Sydney",
    type: "Residential",
    change: "Vacant → Rented · $850K",
    date: "10 Jun, 11:47 AM",
    timestamp: getMockDate(0, "11:47 AM"),
  },
  {
    id: "PROP-0064",
    clientId: "mark-williams",
    clientName: "Mark Williams",
    clientInitials: "MW",
    action: "Edited",
    property: "22 Coast Dr, Perth",
    type: "Commercial",
    change: "$1.35M → $1.40M",
    date: "10 Jun, 08:50 AM",
    timestamp: getMockDate(0, "08:50 AM"),
  },
  // Past properties (within 7 days)
  {
    id: "PROP-0064",
    clientId: "mark-williams",
    clientName: "Mark Williams",
    clientInitials: "MW",
    action: "Added",
    property: "22 Coast Dr, Perth",
    type: "Commercial",
    change: "New: Under Offer · $1.35M",
    date: "06 Jun, 08:50 AM",
    timestamp: getMockDate(5, "08:50 AM"),
  },
];

export const mockEntities: EntityRecord[] = [
  {
    id: "ENT-0021",
    clientId: "mark-williams",
    clientName: "Mark Williams",
    clientInitials: "MW",
    action: "Edited",
    entityName: "Williams Family Trust",
    type: "Unit trust",
    change: "90% → 100%",
    date: "10 Jun, 08:40 AM",
    timestamp: getMockDate(0, "08:40 AM"),
  },
  // Past entities (within 30 days)
  {
    id: "ENT-0035",
    clientId: "sneha-bansal",
    clientName: "Sneha Bansal",
    clientInitials: "SB",
    action: "Added",
    entityName: "Bansal Holdings Pty Ltd",
    type: "Company (Pty Ltd)",
    change: "Incorporated successfully",
    date: "25 May, 10:00 AM",
    timestamp: getMockDate(15, "10:00 AM"),
  },
];

export const mockDocuments: DocumentRecord[] = [
  {
    id: "DOC-1094",
    clientId: "sneha-bansal",
    clientName: "Sneha Bansal",
    clientInitials: "SB",
    action: "Added",
    documentName: "Lease agreement — 12 Maple St",
    type: "Lease agreement",
    size: "2.4 MB · PDF",
    date: "10 Jun, 08:55 AM",
    timestamp: getMockDate(0, "08:55 AM"),
  },
  // Past documents (within 7 days)
  {
    id: "DOC-1022",
    clientId: "mark-williams",
    clientName: "Mark Williams",
    clientInitials: "MW",
    action: "Added",
    documentName: "Land Valuation Notice - Perth",
    type: "Valuation Statement",
    size: "1.8 MB · PDF",
    date: "07 Jun, 02:30 PM",
    timestamp: getMockDate(4, "02:30 PM"),
  },
];

export const mockRules: RuleRecord[] = [
  {
    id: "RULE-142",
    clientId: "sneha-bansal",
    clientName: "Sneha Bansal",
    clientInitials: "SB",
    action: "Edited",
    ruleName: "AGL utilities - Maintenance",
    change: 'Matches "AGL" → Matches "AGL" or "Origin Energy"',
    date: "10 Jun, 08:55 AM",
    timestamp: getMockDate(0, "08:55 AM"),
  },
];

// Dynamic Date Range Filter Utility
export function filterDataByPeriod<T extends { timestamp: Date }>(
  items: T[],
  period: string,
  fromDate?: string,
  toDate?: string
): T[] {
  const baseDate = new Date("2026-06-19T23:59:59");
  const start = new Date(baseDate);

  if (period === "Today") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "7 days") {
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
  } else if (period === "30 days") {
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
  } else if (period === "3 months") {
    start.setDate(start.getDate() - 90);
    start.setHours(0, 0, 0, 0);
  } else if (period === "custom" || (period === "" && fromDate && toDate)) {
    if (fromDate && toDate) {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      return items.filter((item) => item.timestamp >= from && item.timestamp <= to);
    }
  }

  return items.filter((item) => item.timestamp >= start && item.timestamp <= baseDate);
}
