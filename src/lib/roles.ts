import { pool } from "./db";
import { normalizeRoleName } from "./roleNames";

type RoleRow = { id: string | number; role_name: string };

let cache: {
  idByName: Map<string, number>;
  nameById: Map<number, string>;
  loadedAt: number;
} | null = null;

const TTL_MS = 5 * 60 * 1000;

async function loadRoles() {
  const result = await pool.query<RoleRow>(`SELECT id, role_name FROM roles`);

  const idByName = new Map<string, number>();
  const nameById = new Map<number, string>();

  for (const row of result.rows) {
    const id = Number(row.id);
    if (!Number.isFinite(id)) continue;
    idByName.set(normalizeRoleName(row.role_name), id);
    nameById.set(id, normalizeRoleName(row.role_name));
  }

  cache = { idByName, nameById, loadedAt: Date.now() };
}

async function ensureCache() {
  if (!cache || Date.now() - cache.loadedAt > TTL_MS) {
    await loadRoles();
  }
}

export async function getRoleIdByName(name: string) {
  await ensureCache();
  return cache!.idByName.get(normalizeRoleName(name)) ?? null;
}

export async function getRoleNameById(id: number | string | null) {
  if (id === null || id === undefined) return "unknown";
  const n = typeof id === "number" ? id : Number.parseInt(String(id), 10);
  if (!Number.isFinite(n)) return "unknown";
  await ensureCache();
  return cache!.nameById.get(n) || "unknown";
}

export async function getRoleIdsByNames(names: string[]) {
  await ensureCache();
  return names
    .map((n) => cache!.idByName.get(normalizeRoleName(n)))
    .filter((id): id is number => typeof id === "number");
}
