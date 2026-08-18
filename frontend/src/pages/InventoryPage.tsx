import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Alert } from '../components/Alert'
import { Badge, EmptyState, ErrorState, LoadingBlock } from '../components/States'
import { friendlyApiError } from '../lib/api'
import { inventory, type InventoryItem } from '../lib/inventory'

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<InventoryItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setItems(await inventory.items())
    } catch (err) {
      setError(friendlyApiError(err, 'load inventory'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <PageHeader
        title="Inventory"
        description={`Store items — ${items?.length ?? 0} total`}
        actions={
          <button className="button button--primary button--sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? '✕ Close' : '+ Add Item'}
          </button>
        }
      />

      {showForm && <ItemForm onCreated={() => { setShowForm(false); load() }} onCancel={() => setShowForm(false)} />}

      {selected && (
        <ItemDetail item={selected} onClose={() => setSelected(null)} onChanged={load} />
      )}

      {error ? (
        <ErrorState title="Inventory could not load" message={error} onRetry={load} retryLabel="Retry" />
      ) : loading ? (
        <LoadingBlock label="Loading inventory" rows={5} />
      ) : !items?.length ? (
        <EmptyState title="No inventory items" description="Add your first store item to get started." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-line)' }}>
                <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Name</th>
                <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Category</th>
                <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>SKU</th>
                <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Qty</th>
                <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Location</th>
                <th style={{ padding: 'var(--space-2)', textAlign: 'left' }}>Status</th>
                <th style={{ padding: 'var(--space-2)' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} style={{ borderBottom: '1px solid var(--color-line)' }}>
                  <td style={{ padding: 'var(--space-2)', fontWeight: 600 }}>{i.name}</td>
                  <td style={{ padding: 'var(--space-2)' }}>{i.category}</td>
                  <td style={{ padding: 'var(--space-2)' }}>{i.sku || '—'}</td>
                  <td style={{ padding: 'var(--space-2)' }}>{i.quantity} {i.unit || ''}</td>
                  <td style={{ padding: 'var(--space-2)' }}>{i.location || '—'}</td>
                  <td style={{ padding: 'var(--space-2)' }}>
                    <Badge tone={i.quantity <= i.reorder_level ? 'warning' : i.status === 'Out of Stock' ? 'danger' : 'success'}>
                      {i.status}
                    </Badge>
                  </td>
                  <td style={{ padding: 'var(--space-2)' }}>
                    <button className="button button--ghost button--sm" onClick={() => setSelected(i)}>
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ItemForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    name: '', sku: '', category: 'General', unit: '', location: '',
    supplier: '', quantity: '', reorder_level: '', unit_price: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await inventory.create({
        name: form.name,
        sku: form.sku || null,
        category: form.category,
        unit: form.unit || null,
        location: form.location || null,
        supplier: form.supplier || null,
        quantity: Number(form.quantity || 0),
        low_stock_threshold: Number(form.reorder_level || 0),
        unit_price: Number(form.unit_price || 0),
      })
      onCreated()
    } catch (err) {
      setError(friendlyApiError(err, 'add item'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card section" style={{ marginBottom: 'var(--space-4)' }}>
      <h2 className="section__title">Add Inventory Item</h2>
      {error && <Alert tone="error">{error}</Alert>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 12rem' }}>
            <label className="field__label">Name *</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 8rem' }}>
            <label className="field__label">SKU</label>
            <input className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 8rem' }}>
            <label className="field__label">Category</label>
            <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 6rem' }}>
            <label className="field__label">Unit</label>
            <input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="e.g. pcs" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: '1 1 8rem' }}>
            <label className="field__label">Quantity</label>
            <input className="input" type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 8rem' }}>
            <label className="field__label">Reorder Level</label>
            <input className="input" type="number" min="0" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 8rem' }}>
            <label className="field__label">Unit Price</label>
            <input className="input" type="number" min="0" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Location</label>
            <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Supplier</label>
            <input className="input" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button className="button button--primary" type="submit" disabled={submitting}>{submitting ? 'Saving…' : 'Add Item'}</button>
          <button className="button button--secondary" type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  )
}

function ItemDetail({ item, onClose, onChanged }: {
  item: InventoryItem
  onClose: () => void
  onChanged: () => void
}) {
  const [movementType, setMovementType] = useState<'inbound' | 'outbound'>('inbound')
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function recordMovement(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await inventory.movement(item.id, {
        movement_type: movementType,
        quantity: Number(quantity),
        note: note || null,
      })
      setQuantity('')
      setNote('')
      onChanged()
    } catch (err) {
      setError(friendlyApiError(err, 'record movement'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card section" style={{ marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <h2 className="section__title" style={{ marginBottom: 0 }}>{item.name}</h2>
        <button className="button button--ghost button--sm" onClick={onClose}>✕ Close</button>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(12rem, 1fr))', gap: 'var(--space-3)' }}>
        <div><dt style={{ color: 'var(--color-ink-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>Quantity</dt><dd style={{ fontWeight: 600 }}>{item.quantity} {item.unit || ''}</dd></div>
        <div><dt style={{ color: 'var(--color-ink-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>Reorder Level</dt><dd>{item.reorder_level}</dd></div>
        <div><dt style={{ color: 'var(--color-ink-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>Unit Price</dt><dd>{item.unit_cost || 0}</dd></div>
        <div><dt style={{ color: 'var(--color-ink-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>Location</dt><dd>{item.location || '—'}</dd></div>
        <div><dt style={{ color: 'var(--color-ink-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>Supplier</dt><dd>{item.supplier || '—'}</dd></div>
        <div><dt style={{ color: 'var(--color-ink-muted)', fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase' }}>Status</dt><dd><Badge tone={item.quantity <= item.reorder_level ? 'warning' : 'success'}>{item.status}</Badge></dd></div>
      </dl>

      <form onSubmit={recordMovement} style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--color-line)', paddingTop: 'var(--space-3)' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Record Stock Movement</h3>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 10rem' }}>
            <label className="field__label">Type</label>
            <select className="input" value={movementType} onChange={(e) => setMovementType(e.target.value as 'inbound' | 'outbound')}>
              <option value="inbound">Stock In</option>
              <option value="outbound">Stock Out</option>
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 8rem' }}>
            <label className="field__label">Quantity *</label>
            <input className="input" required type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="field" style={{ flex: '1 1 14rem' }}>
            <label className="field__label">Note</label>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <button className="button button--primary" type="submit" disabled={busy}>{busy ? 'Recording…' : 'Record'}</button>
        </div>
      </form>
    </div>
  )
}