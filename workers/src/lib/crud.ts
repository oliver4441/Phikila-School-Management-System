import { escapeIdentifier } from '@neondatabase/serverless'
import type { Sql } from './db'

export async function insertRow(db: Sql, table: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const keys = Object.keys(data).filter((k) => data[k] !== undefined)
  if (!keys.length) throw new Error('No fields to insert.')
  const cols = keys.map((k) => escapeIdentifier(k)).join(', ')
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
  const values = keys.map((k) => data[k])
  const rows = await db.query(`insert into ${table} (${cols}) values (${placeholders}) returning *`, values)
  return rows[0]
}

export async function updateRowById(
  db: Sql,
  table: string,
  id: string,
  data: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const keys = Object.keys(data).filter((k) => data[k] !== undefined)
  if (!keys.length) return null
  const sets = keys.map((k, i) => `${escapeIdentifier(k)} = $${i + 1}`).join(', ')
  const values = [...keys.map((k) => data[k]), id]
  const rows = await db.query(`update ${table} set ${sets} where id = $${keys.length + 1} returning *`, values)
  return rows[0] ?? null
}

export async function deleteRowById(db: Sql, table: string, id: string): Promise<void> {
  await db.query(`delete from ${table} where id = $1`, [id])
}

export async function upsertRow(
  db: Sql,
  table: string,
  data: Record<string, unknown>,
  conflictCols: string[],
): Promise<Record<string, unknown> | null> {
  const keys = Object.keys(data).filter((k) => data[k] !== undefined)
  if (!keys.length) return null
  const cols = keys.map((k) => escapeIdentifier(k)).join(', ')
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
  const conflict = conflictCols.map((c) => escapeIdentifier(c)).join(', ')
  const updateKeys = keys.filter((k) => !conflictCols.includes(k))
  const updates = updateKeys.length
    ? updateKeys.map((k) => `${escapeIdentifier(k)} = excluded.${escapeIdentifier(k)}`).join(', ')
    : 'updated_at = now()'
  const values = keys.map((k) => data[k])
  const rows = await db.query(
    `insert into ${table} (${cols}) values (${placeholders}) on conflict (${conflict}) do update set ${updates} returning *`,
    values,
  )
  return rows[0] ?? null
}

export function pick(body: Record<string, unknown>, ...fields: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of fields) if (body[f] !== undefined) out[f] = body[f]
  return out
}
