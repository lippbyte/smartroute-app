// Hari 1 Task 1/3: akses tabel users. toPublicUser() satu-satunya jalan
// baris users keluar ke respons HTTP — password_hash tidak pernah ikut.
import { randomUUID } from "node:crypto";
import { db } from "../lib/db";
import type { Preferences } from "../lib/validation";

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  preferences_json: string;
  accessibility_json: string | null;
  accessibility_consent_at: string | null;
  created_at: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  preferences: Preferences;
  accessibility: { needs: string[]; consent_at: string } | null;
  created_at: string;
}

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    preferences: JSON.parse(row.preferences_json) as Preferences,
    accessibility:
      row.accessibility_json && row.accessibility_consent_at
        ? { needs: JSON.parse(row.accessibility_json) as string[], consent_at: row.accessibility_consent_at }
        : null,
    created_at: row.created_at,
  };
}

export class EmailTakenError extends Error {}

export function createUser(input: {
  email: string;
  name: string;
  passwordHash: string;
  preferences?: Preferences;
  accessibilityNeeds?: string[];
}): PublicUser {
  const now = new Date().toISOString();
  const id = randomUUID();
  try {
    db.prepare(
      `INSERT INTO users (id, email, name, password_hash, preferences_json, accessibility_json, accessibility_consent_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.email.trim().toLowerCase(),
      input.name,
      input.passwordHash,
      JSON.stringify(input.preferences ?? {}),
      input.accessibilityNeeds ? JSON.stringify(input.accessibilityNeeds) : null,
      input.accessibilityNeeds ? now : null,
      now,
    );
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint failed: users\.email/.test(err.message)) {
      throw new EmailTakenError();
    }
    throw err;
  }
  return getUserById(id)!;
}

export function findUserForLogin(email: string): { id: string; passwordHash: string } | null {
  const row = db
    .prepare("SELECT id, password_hash FROM users WHERE email = ?")
    .get(email.trim().toLowerCase()) as { id: string; password_hash: string } | undefined;
  return row ? { id: row.id, passwordHash: row.password_hash } : null;
}

export function getUserById(id: string): PublicUser | null {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return row ? toPublicUser(row) : null;
}

export function updatePreferences(userId: string, preferences: Preferences): PublicUser | null {
  db.prepare("UPDATE users SET preferences_json = ? WHERE id = ?").run(JSON.stringify(preferences), userId);
  return getUserById(userId);
}

export function setAccessibility(userId: string, needs: string[]): PublicUser | null {
  db.prepare("UPDATE users SET accessibility_json = ?, accessibility_consent_at = ? WHERE id = ?").run(
    JSON.stringify(needs),
    new Date().toISOString(),
    userId,
  );
  return getUserById(userId);
}

/** Hapus tuntas — kolom dikosongkan, bukan ditandai "nonaktif". */
export function clearAccessibility(userId: string): PublicUser | null {
  db.prepare("UPDATE users SET accessibility_json = NULL, accessibility_consent_at = NULL WHERE id = ?").run(userId);
  return getUserById(userId);
}
