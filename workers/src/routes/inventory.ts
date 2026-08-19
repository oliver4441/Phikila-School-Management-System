import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { insertRow, updateRowById, deleteRowById } from '../lib/crud'
import { resolveTenant, requireWrite, tenantSchoolId } from '../lib/tenancy'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const inventoryRoutes = new Hono<{ Bindings: Bindings }>()

inventoryRoutes.get('/items', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db`select * from inventory_items where school_id = ${sid} order by name`
  return c.json(rows)
})

inventoryRoutes.get('/items/stats', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const rows = await db`select quantity, reorder_level, unit_cost from inventory_items where school_id = ${sid}`
  let totalValue = 0
  let lowStock = 0
  let totalUnits = 0
  for (const item of rows) {
    const quantity = Number(item.quantity ?? 0)
    totalUnits += quantity
    totalValue += quantity * Number(item.unit_cost ?? 0)
    if (quantity <= Number(item.reorder_level ?? 0)) lowStock += 1
  }
  return c.json({ total_items: rows.length, total_units: totalUnits, total_value: totalValue, low_stock: lowStock })
})

inventoryRoutes.post('/items', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  let item: Record<string, unknown>
  try {
    item = await insertRow(db, 'inventory_items', {
      school_id: sid,
      name: body.name,
      sku: body.sku ?? null,
      category: body.category ?? 'General',
      unit: body.unit ?? null,
      location: body.location ?? null,
      supplier: body.supplier ?? null,
      status: body.status ?? 'In Stock',
      quantity: Number(body.quantity ?? 0),
      reorder_level: Number(body.low_stock_threshold ?? body.reorder_level ?? 0),
      unit_cost: Number(body.unit_price ?? body.unit_cost ?? 0),
    })
  } catch (err) {
    return jsonError(c, (err as Error).message, 400)
  }
  if (Number(body.quantity ?? 0) > 0) {
    await db`insert into inventory_movements (school_id, item_id, movement_type, quantity, reason) values (${sid}, ${item.id}, 'receipt', ${Number(body.quantity)}, 'Initial stock')`
  }
  return c.json(item, 201)
})

inventoryRoutes.get('/items/:itemId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const itemId = c.req.param('itemId')
  const item = (await db`select * from inventory_items where id = ${itemId} and school_id = ${sid} limit 1`)[0]
  if (!item) return c.json({ detail: 'Item not found.' }, 404)
  const movements = await db`select * from inventory_movements where item_id = ${itemId} and school_id = ${sid} order by performed_at desc`
  return c.json({ ...item, movements })
})

inventoryRoutes.patch('/items/:itemId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const data: Record<string, unknown> = { ...body }
  if (body.low_stock_threshold !== undefined) data.reorder_level = Number(body.low_stock_threshold)
  if (body.unit_price !== undefined) data.unit_cost = Number(body.unit_price)
  delete data.low_stock_threshold
  delete data.unit_price
  const ok = await db`select 1 from inventory_items where id = ${c.req.param('itemId')} and school_id = ${sid}`
  if (!ok[0]) return c.json({ detail: 'Item not found.' }, 404)
  const updated = await updateRowById(db, 'inventory_items', c.req.param('itemId'), { ...data, school_id: sid })
  return c.json(updated)
})

inventoryRoutes.delete('/items/:itemId', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const ok = await db`select 1 from inventory_items where id = ${c.req.param('itemId')} and school_id = ${sid}`
  if (!ok[0]) return c.json({ detail: 'Item not found.' }, 404)
  await deleteRowById(db, 'inventory_items', c.req.param('itemId'))
  return c.body(null, 204)
})

inventoryRoutes.post('/items/:itemId/movements', async (c) => {
  const db = createSql(c.env)
  const ten = await resolveTenant(c, db)
  if ('error' in ten) return ten.error
  const sid = tenantSchoolId(ten.ctx)
  if (!sid) return c.json({ detail: 'Select a school first.' }, 400)
  const w = requireWrite(ten.ctx)
  if ('error' in w) return w.error
  const body = await c.req.json().catch(() => ({}))
  const itemId = c.req.param('itemId')
  const quantity = Number(body.quantity ?? 0)
  const movementType = body.movement_type === 'outbound' ? -1 : 1
  const delta = quantity * movementType

  const item = (await db`select quantity from inventory_items where id = ${itemId} and school_id = ${sid} limit 1`)[0]
  if (!item) return c.json({ detail: 'Item not found.' }, 404)
  const newQuantity = Math.max(0, Number(item.quantity ?? 0) + delta)

  const movementRows = await db`
    insert into inventory_movements (school_id, item_id, movement_type, quantity, reason)
    values (${sid}, ${itemId}, ${body.movement_type === 'outbound' ? 'issue' : 'receipt'}, ${quantity}, ${body.note ?? body.reason ?? null})
    returning *
  `
  const updatedRows = await db`update inventory_items set quantity = ${newQuantity}, updated_at = now() where id = ${itemId} and school_id = ${sid} returning *`
  return c.json({ movement: movementRows[0], item: updatedRows[0] }, 201)
})