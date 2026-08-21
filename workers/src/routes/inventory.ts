import { Hono } from 'hono'
import { createSql } from '../lib/db'
import { insertRow, updateRowById, deleteRowById } from '../lib/crud'
import { requireAuth } from '../lib/auth'
import { jsonError } from '../lib/http'
import type { Bindings } from '../lib/env'

export const inventoryRoutes = new Hono<{ Bindings: Bindings }>()

inventoryRoutes.get('/items', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select * from inventory_items order by name`
  return c.json(rows)
})

inventoryRoutes.get('/items/stats', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const rows = await createSql(c.env)`select quantity, reorder_level, unit_cost from inventory_items`
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
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const db = createSql(c.env)
  let item: Record<string, unknown>
  try {
    item = await insertRow(db, 'inventory_items', {
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
    await db`insert into inventory_movements (item_id, movement_type, quantity, reason) values (${item.id}, 'receipt', ${Number(body.quantity)}, 'Initial stock')`
  }
  return c.json(item, 201)
})

inventoryRoutes.get('/items/:itemId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const db = createSql(c.env)
  const itemId = c.req.param('itemId')
  const item = (await db`select * from inventory_items where id = ${itemId} limit 1`)[0]
  if (!item) return c.json({ detail: 'Item not found.' }, 404)
  const movements = await db`select * from inventory_movements where item_id = ${itemId} order by performed_at desc`
  return c.json({ ...item, movements })
})

inventoryRoutes.patch('/items/:itemId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const data: Record<string, unknown> = { ...body }
  if (body.low_stock_threshold !== undefined) data.reorder_level = Number(body.low_stock_threshold)
  if (body.unit_price !== undefined) data.unit_cost = Number(body.unit_price)
  delete data.low_stock_threshold
  delete data.unit_price
  const updated = await updateRowById(createSql(c.env), 'inventory_items', c.req.param('itemId'), data)
  return c.json(updated)
})

inventoryRoutes.delete('/items/:itemId', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  await deleteRowById(createSql(c.env), 'inventory_items', c.req.param('itemId'))
  return c.body(null, 204)
})

inventoryRoutes.post('/items/:itemId/movements', async (c) => {
  const { error } = requireAuth(c as never)
  if (error) return error
  const body = await c.req.json().catch(() => ({}))
  const db = createSql(c.env)
  const itemId = c.req.param('itemId')
  const quantity = Number(body.quantity ?? 0)
  const movementType = body.movement_type === 'outbound' ? -1 : 1
  const delta = quantity * movementType

  const item = (await db`select quantity from inventory_items where id = ${itemId} limit 1`)[0]
  if (!item) return c.json({ detail: 'Item not found.' }, 404)
  const newQuantity = Math.max(0, Number(item.quantity ?? 0) + delta)

  const movementRows = await db`
    insert into inventory_movements (item_id, movement_type, quantity, reason)
    values (${itemId}, ${body.movement_type === 'outbound' ? 'issue' : 'receipt'}, ${quantity}, ${body.note ?? body.reason ?? null})
    returning *
  `
  const updatedRows = await db`update inventory_items set quantity = ${newQuantity}, updated_at = now() where id = ${itemId} returning *`
  return c.json({ movement: movementRows[0], item: updatedRows[0] }, 201)
})