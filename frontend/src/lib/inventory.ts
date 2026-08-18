import { apiFetch } from './api'

const BASE = '/api/v1/inventory'

export type InventoryItem = {
  id: number
  name: string
  sku: string | null
  category: string
  quantity: number
  unit: string | null
  reorder_level: number
  location: string | null
  supplier: string | null
  unit_cost: number
  status: string
  created_at: string
  updated_at: string
}

export type InventoryStats = {
  total_items: number
  total_units: number
  total_value: number
  low_stock: number
}

export type InventoryMovement = {
  id: number
  item_id: number
  movement_type: 'issue' | 'receipt' | 'adjustment' | 'return'
  quantity: number
  reason: string | null
  recipient: string | null
  performed_by: string | null
  performed_at: string
}

export type ItemInput = {
  name: string
  sku?: string | null
  category?: string
  unit?: string | null
  location?: string | null
  supplier?: string | null
  quantity?: number
  low_stock_threshold?: number
  unit_price?: number
}

export type MovementInput = {
  movement_type: 'inbound' | 'outbound'
  quantity: number
  note?: string | null
}

const get = <T,>(path: string) => apiFetch<T>(path)
const send = <T,>(path: string, method: string, body?: unknown) =>
  apiFetch<T>(path, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

export const inventory = {
  items: () => get<InventoryItem[]>(`${BASE}/items`),
  stats: () => get<InventoryStats>(`${BASE}/items/stats`),
  create: (payload: ItemInput) => send<InventoryItem>(`${BASE}/items`, 'POST', payload),
  item: (id: number) => get<{ item: InventoryItem; movements: InventoryMovement[] }>(`${BASE}/items/${id}`),
  update: (id: number, payload: Record<string, unknown>) => send<InventoryItem>(`${BASE}/items/${id}`, 'PATCH', payload),
  remove: (id: number) => send<void>(`${BASE}/items/${id}`, 'DELETE'),
  movement: (id: number, payload: MovementInput) =>
    send<{ movement: InventoryMovement; item: InventoryItem }>(`${BASE}/items/${id}/movements`, 'POST', payload),
}