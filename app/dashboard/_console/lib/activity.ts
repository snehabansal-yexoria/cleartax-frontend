import type { People, Portfolio } from "./adminData";
import { isStatementDone } from "./metrics";

export type ActivityKind =
  | "invite"
  | "entity_created"
  | "entity_updated"
  | "property_created"
  | "property_updated"
  | "statement_uploaded";

export type ActivityEvent = {
  id: string;
  at: string;
  kind: ActivityKind;
  action: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  clientId: string;
  clientName: string;
  module: "Users" | "Entities" | "Properties" | "Bank statements";
  record: string;
  detail: string;
};

export const ACTIVITY_LABELS: Record<ActivityKind, { label: string; tone: "green" | "blue" | "teal" | "purple" | "amber" }> = {
  invite: { label: "Invited", tone: "green" },
  entity_created: { label: "Added entity", tone: "green" },
  entity_updated: { label: "Edited entity", tone: "blue" },
  property_created: { label: "Added property", tone: "green" },
  property_updated: { label: "Edited property", tone: "blue" },
  statement_uploaded: { label: "Statement uploaded", tone: "teal" },
};

function isLater(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  return new Date(a).getTime() - new Date(b).getTime() > 60_000;
}

/**
 * Builds an activity log from the records the API already returns (create and
 * update stamps on users, entities, properties and bank statements). It has no
 * before/after values; those need the dedicated audit-log endpoint.
 */
export function buildActivity(people: People | undefined, portfolio: Portfolio | undefined): ActivityEvent[] {
  if (!people) return [];

  const directory = new Map<string, { name: string; role: string }>();
  for (const user of people.accountants) directory.set(user.id, { name: user.name || user.email, role: "Accountant" });
  for (const user of people.invitedClients) directory.set(user.id, { name: user.name || user.email, role: "Client" });
  for (const client of people.clients) directory.set(client.id, { name: client.name || client.email, role: "Client" });
  const clientName = (id: string) => directory.get(id)?.name ?? "—";
  const actor = (id: string | null | undefined) =>
    id ? directory.get(id) ?? { name: "Org admin", role: "Admin" } : { name: "System", role: "System" };

  const events: ActivityEvent[] = [];

  for (const user of [...people.accountants, ...people.invitedClients]) {
    if (!user.createdAt) continue;
    events.push({
      id: `invite-${user.id}`,
      at: user.createdAt,
      kind: "invite",
      action: ACTIVITY_LABELS.invite.label,
      actorId: user.invitedByEmail,
      actorName: user.invitedByEmail || "Org admin",
      actorRole: "Admin",
      clientId: user.role === "client" ? user.id : "",
      clientName: user.role === "client" ? user.name || user.email : "—",
      module: "Users",
      record: `${user.role === "accountant" ? "Accountant" : "Client"} · ${user.email}`,
      detail: user.name ? `${user.name} invited` : "Invitation sent",
    });
  }

  for (const entity of portfolio?.entities ?? []) {
    const creator = actor(entity.createdBy);
    events.push({
      id: `entity-c-${entity.id}`,
      at: entity.createdAt,
      kind: "entity_created",
      action: ACTIVITY_LABELS.entity_created.label,
      actorId: entity.createdBy,
      actorName: creator.name,
      actorRole: creator.role,
      clientId: entity.clientId,
      clientName: clientName(entity.clientId),
      module: "Entities",
      record: entity.name,
      detail: `New ${entity.entityType} · ${entity.beneficiaries?.length ?? 0} beneficiaries`,
    });
    if (isLater(entity.updatedAt, entity.createdAt)) {
      const editor = actor(entity.updatedBy || entity.createdBy);
      events.push({
        id: `entity-u-${entity.id}`,
        at: entity.updatedAt,
        kind: "entity_updated",
        action: ACTIVITY_LABELS.entity_updated.label,
        actorId: entity.updatedBy || entity.createdBy,
        actorName: editor.name,
        actorRole: editor.role,
        clientId: entity.clientId,
        clientName: clientName(entity.clientId),
        module: "Entities",
        record: entity.name,
        detail: "Entity details updated",
      });
    }
  }

  for (const property of portfolio?.properties ?? []) {
    const creator = actor(property.createdBy);
    events.push({
      id: `property-c-${property.id}`,
      at: property.createdAt,
      kind: "property_created",
      action: ACTIVITY_LABELS.property_created.label,
      actorId: property.createdBy,
      actorName: creator.name,
      actorRole: creator.role,
      clientId: property.clientId,
      clientName: clientName(property.clientId),
      module: "Properties",
      record: property.name,
      detail: [property.propertyType.replace("_", " "), property.status].filter(Boolean).join(" · "),
    });
    if (isLater(property.updatedAt, property.createdAt)) {
      const editor = actor(property.updatedBy || property.createdBy);
      events.push({
        id: `property-u-${property.id}`,
        at: property.updatedAt,
        kind: "property_updated",
        action: ACTIVITY_LABELS.property_updated.label,
        actorId: property.updatedBy || property.createdBy,
        actorName: editor.name,
        actorRole: editor.role,
        clientId: property.clientId,
        clientName: clientName(property.clientId),
        module: "Properties",
        record: property.name,
        detail: property.status ? `Status: ${property.status}` : "Property details updated",
      });
    }
  }

  for (const statement of portfolio?.statements ?? []) {
    events.push({
      id: `statement-${statement.id}`,
      at: statement.createdAt,
      kind: "statement_uploaded",
      action: ACTIVITY_LABELS.statement_uploaded.label,
      actorId: "",
      actorName: "System",
      actorRole: "System",
      clientId: statement.clientId,
      clientName: clientName(statement.clientId),
      module: "Bank statements",
      record: `Statement · ${statement.summary?.totalTransactions ?? 0} lines`,
      detail: isStatementDone(statement) ? "Processed" : `Status: ${statement.status || "pending"}`,
    });
  }

  return events
    .filter((event) => event.at && !Number.isNaN(new Date(event.at).getTime()))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
