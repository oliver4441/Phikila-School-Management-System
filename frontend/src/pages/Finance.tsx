import { useCallback, useEffect, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { Alert } from '../components/Alert'
import { Badge, EmptyState, LoadingBlock, Spinner } from '../components/States'
import { DataTable, type Column } from '../components/DataTable'
import { friendlyApiError } from '../lib/api'
import { useToast } from '../components/Toast'
import { finance, type FeeStructure, type Invoice, type Payment, type FinanceOverview } from '../lib/finance'
import { streamAnalytics } from '../lib/ai'

const INVOICE_COLUMNS: Column<Invoice>[] = [
  { key: 'student', header: 'Student', value: (i) => i.student_id, render: (i) => `Student #${i.student_id}` },
  { key: 'fee', header: 'Fee', value: (i) => i.fee_structure_id ?? '', render: (i) => `Fee #${i.fee_structure_id}` },
  {
    key: 'amount',
    header: 'Amount',
    sortable: true,
    value: (i) => Number(i.amount),
    render: (i) => `KES ${Number(i.amount).toLocaleString()}`,
  },
  {
    key: 'balance',
    header: 'Balance',
    sortable: true,
    value: (i) => Number(i.balance),
    render: (i) => `KES ${Number(i.balance).toLocaleString()}`,
  },
  {
    key: 'status',
    header: 'Status',
    value: (i) => i.status,
    render: (i) => (
      <Badge tone={i.status === 'paid' ? 'success' : i.status === 'pending' ? 'warning' : 'danger'}>{i.status}</Badge>
    ),
  },
]

const PAYMENT_COLUMNS: Column<Payment>[] = [
  {
    key: 'date',
    header: 'Date',
    sortable: true,
    value: (p) => p.created_at ?? '',
    render: (p) => (p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'),
  },
  { key: 'student', header: 'Student', value: (p) => p.student_id, render: (p) => `Student #${p.student_id}` },
  { key: 'method', header: 'Method', sortable: true, value: (p) => p.payment_method || '', render: (p) => p.payment_method || '—' },
  {
    key: 'amount',
    header: 'Amount',
    sortable: true,
    value: (p) => Number(p.amount),
    render: (p) => <strong>KES {Number(p.amount).toLocaleString()}</strong>,
  },
  { key: 'reference', header: 'Reference', value: (p) => p.reference_number || '', render: (p) => p.reference_number || '—' },
]

export default function FinancePage() {
  const { notify } = useToast()
  const [overview, setOverview] = useState<FinanceOverview | null>(null)
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'fees' | 'invoices' | 'payments'>('overview')
  const [showNewFee, setShowNewFee] = useState(false)
  const [showNewInvoice, setShowNewInvoice] = useState(false)
  const [showNewPayment, setShowNewPayment] = useState(false)
  const [aiSummary, setAiSummary] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [showAi, setShowAi] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ov, fs, inv, pay] = await Promise.all([
        finance.overview(),
        finance.listFeeStructures(),
        finance.listInvoices(),
        finance.listPayments(),
      ])
      setOverview(ov)
      setFeeStructures(fs)
      setInvoices(inv)
      setPayments(pay)
    } catch (err) {
      setError(friendlyApiError(err, 'load finance'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div>
      <PageHeader
        title="Finance"
        description="Fee structures, invoices, and payment tracking."
      />

      {error && <Alert tone="error" title="Finance could not load">{error}</Alert>}

      <div role="tablist" aria-label="Finance sections" style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        {(['overview', 'fees', 'invoices', 'payments'] as const).map((tab) => (
          <button key={tab} role="tab" aria-selected={activeTab === tab} className={`button ${activeTab === tab ? 'button--primary' : 'button--secondary'} button--sm`}
            onClick={() => setActiveTab(tab)}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {loading ? <LoadingBlock label="Loading finance" rows={4} /> : (
        <>
          {activeTab === 'overview' && overview && (
            <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-3)' }}>
              <button
                className="button button--secondary button--sm"
                onClick={() => {
                  if (aiLoading) return
                  setShowAi(true)
                  setAiLoading(true)
                  setAiSummary('')
                  streamAnalytics({
                    endpoint: '/analytics/finance',
                    body: {},
                    onToken: (token) => setAiSummary((prev) => prev + token),
                    onDone: () => setAiLoading(false),
                    onError: (detail) => { setAiLoading(false); notify(detail, 'error') },
                  })
                }}
                disabled={aiLoading}
              >
                {aiLoading ? <><Spinner label="Analyzing" /> Analyzing…</> : '✦ AI Summary'}
              </button>
            </div>
            <div className="summary-grid" style={{ marginBottom: 'var(--space-4)' }}>
              {[
                { label: 'Total Invoiced', value: `KES ${Number(overview.total_invoiced).toLocaleString()}` },
                { label: 'Total Collected', value: `KES ${Number(overview.total_collected).toLocaleString()}` },
                { label: 'Outstanding', value: `KES ${Number(overview.total_outstanding).toLocaleString()}`, tone: (Number(overview.total_outstanding) > 0 ? 'warning' : undefined) },
                { label: 'Invoices', value: overview.invoices_count },
                { label: 'Paid', value: overview.paid_count },
                { label: 'Pending', value: overview.pending_count },
              ].map((c) => (
                <div key={c.label} className="card" style={{ padding: 'var(--space-4)' }}>
                  <p style={{ color: 'var(--color-ink-muted)', fontSize: '0.8125rem', fontWeight: 600, textTransform: 'uppercase' }}>{c.label}</p>
                  <p style={{ fontSize: '1.5rem', fontWeight: 700, color: c.tone === 'warning' ? 'var(--color-warning)' : undefined }}>{c.value}</p>
                </div>
              ))}
            </div>

            {showAi && (
              <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', border: '1px solid var(--color-line)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-muted)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>✦ AI Finance Summary</h3>
                  <button className="button button--ghost button--sm" onClick={() => { setShowAi(false); setAiSummary('') }}>✕ Dismiss</button>
                </div>
                {aiLoading && !aiSummary && (
                  <p style={{ color: 'var(--color-ink-muted)', fontSize: '0.875rem' }}><Spinner label="Analyzing finances" /> Analyzing finances…</p>
                )}
                {aiSummary && (
                  <div
                    style={{ fontSize: '0.9rem', lineHeight: 1.6 }}
                    dangerouslySetInnerHTML={{ __html: aiSummary.replace(/\n/g, '<br/>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }}
                  />
                )}
              </div>
            )}
            </>
          )}

          {activeTab === 'fees' && (
            <section className="section card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <h2 className="section__title" style={{ marginBottom: 0 }}>Fee Structures</h2>
                <button className="button button--primary button--sm" onClick={() => setShowNewFee(!showNewFee)}>+ Fee Structure</button>
              </div>
              {showNewFee && <NewFeeForm onCreated={() => { setShowNewFee(false); void load() }} onCancel={() => setShowNewFee(false)} />}
              {!feeStructures.length ? <EmptyState title="No fee structures" description="Create a fee structure to start invoicing." /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {feeStructures.map((f) => (
                    <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', flexWrap: 'wrap', padding: 'var(--space-3)', border: '1px solid var(--color-line)', borderRadius: 'var(--radius-md)' }}>
                      <div><strong>{f.name}</strong> <span style={{ color: 'var(--color-ink-muted)', fontSize: '0.85rem' }}>{f.description}</span></div>
                      <div><strong>KES {Number(f.amount).toLocaleString()}</strong> <Badge tone="success">{f.status}</Badge></div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'invoices' && (
            <section className="section card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <h2 className="section__title" style={{ marginBottom: 0 }}>Invoices</h2>
                <button className="button button--primary button--sm" onClick={() => setShowNewInvoice(!showNewInvoice)}>+ Invoice</button>
              </div>
              {showNewInvoice && <NewInvoiceForm feeStructures={feeStructures} onCreated={() => { setShowNewInvoice(false); void load() }} onCancel={() => setShowNewInvoice(false)} />}
              {!invoices.length ? <EmptyState title="No invoices" description="Create invoices for students." /> : (
                <DataTable caption="Invoices" columns={INVOICE_COLUMNS} rows={invoices} rowKey={(i) => i.id} searchable searchPlaceholder="Search invoices…" pageSize={25} />
              )}
            </section>
          )}

          {activeTab === 'payments' && (
            <section className="section card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                <h2 className="section__title" style={{ marginBottom: 0 }}>Payments</h2>
                <button className="button button--primary button--sm" onClick={() => setShowNewPayment(!showNewPayment)}>+ Record Payment</button>
              </div>
              {showNewPayment && <NewPaymentForm onCreated={() => { setShowNewPayment(false); void load() }} onCancel={() => setShowNewPayment(false)} />}
              {!payments.length ? <EmptyState title="No payments" description="Record payments against invoices." /> : (
                <DataTable caption="Payments" columns={PAYMENT_COLUMNS} rows={payments} rowKey={(p) => p.id} searchable searchPlaceholder="Search payments…" pageSize={25} />
              )}
            </section>
          )}
        </>
      )}
    </div>
  )
}

function NewFeeForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const { notify } = useToast()
  const [form, setForm] = useState({ name: '', amount: '', description: '' })
  const [submitting, setSubmitting] = useState(false)
  return (
    <div style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-3)', border: '1px dashed var(--color-line-strong)', borderRadius: 'var(--radius-md)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: 1, minWidth: '12rem' }}><label className="field__label" htmlFor="fee-name">Name</label><input id="fee-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Tuition Fee" /></div>
        <div className="field"><label className="field__label" htmlFor="fee-amount">Amount (KES)</label><input id="fee-amount" className="input" type="number" min={1} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
        <button className="button button--primary" disabled={!form.name.trim() || !form.amount || submitting}
          onClick={async () => {
            setSubmitting(true)
            try {
              await finance.createFeeStructure({ name: form.name.trim(), amount: Number(form.amount), description: form.description })
              notify('Fee structure created.', 'success')
              onCreated()
            } catch (err) {
              notify(friendlyApiError(err, 'create the fee structure'), 'error')
              setSubmitting(false)
            }
          }}>{submitting ? 'Creating…' : 'Create'}</button>
        <button className="button button--secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

function NewInvoiceForm({ feeStructures, onCreated, onCancel }: { feeStructures: FeeStructure[]; onCreated: () => void; onCancel: () => void }) {
  const { notify } = useToast()
  const [form, setForm] = useState({ student_id: '', fee_structure_id: feeStructures[0]?.id || 0 })
  const [submitting, setSubmitting] = useState(false)
  const selectedFee = feeStructures.find((f) => f.id === form.fee_structure_id)
  const noFees = feeStructures.length === 0
  return (
    <div style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-3)', border: '1px dashed var(--color-line-strong)', borderRadius: 'var(--radius-md)' }}>
      {noFees ? (
        <Alert tone="info">Create a fee structure first, then you can invoice against it.</Alert>
      ) : (
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field"><label className="field__label" htmlFor="invoice-student">Student ID</label><input id="invoice-student" className="input" type="number" min={1} value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} /></div>
          <div className="field"><label className="field__label" htmlFor="invoice-fee">Fee Structure</label>
            <select id="invoice-fee" className="input" value={form.fee_structure_id} onChange={(e) => setForm({ ...form, fee_structure_id: Number(e.target.value) })}>
              {feeStructures.map((f) => <option key={f.id} value={f.id}>{f.name} — KES {Number(f.amount).toLocaleString()}</option>)}
            </select>
          </div>
          <button className="button button--primary" disabled={!form.student_id || submitting}
            onClick={async () => {
              setSubmitting(true)
              try {
                await finance.createInvoice({ student_id: Number(form.student_id), fee_structure_id: form.fee_structure_id, amount: selectedFee?.amount || 0 })
                notify('Invoice created.', 'success')
                onCreated()
              } catch (err) {
                notify(friendlyApiError(err, 'create the invoice'), 'error')
                setSubmitting(false)
              }
            }}>{submitting ? 'Creating…' : 'Create'}</button>
          <button className="button button--secondary" onClick={onCancel}>Cancel</button>
        </div>
      )}
    </div>
  )
}

function NewPaymentForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const { notify } = useToast()
  const [form, setForm] = useState({ invoice_id: '', student_id: '', amount: '', payment_method: 'cash' })
  const [submitting, setSubmitting] = useState(false)
  return (
    <div style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-3)', border: '1px dashed var(--color-line-strong)', borderRadius: 'var(--radius-md)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field"><label className="field__label" htmlFor="payment-invoice">Invoice ID</label><input id="payment-invoice" className="input" type="number" min={1} value={form.invoice_id} onChange={(e) => setForm({ ...form, invoice_id: e.target.value })} /></div>
        <div className="field"><label className="field__label" htmlFor="payment-student">Student ID</label><input id="payment-student" className="input" type="number" min={1} value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} /></div>
        <div className="field"><label className="field__label" htmlFor="payment-amount">Amount (KES)</label><input id="payment-amount" className="input" type="number" min={1} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
        <div className="field"><label className="field__label" htmlFor="payment-method">Method</label>
          <select id="payment-method" className="input" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
            <option value="cash">Cash</option><option value="bank">Bank</option><option value="mobile">Mobile</option><option value="cheque">Cheque</option>
          </select>
        </div>
        <button className="button button--primary" disabled={!form.invoice_id || !form.student_id || !form.amount || submitting}
          onClick={async () => {
            setSubmitting(true)
            try {
              await finance.recordPayment({ invoice_id: Number(form.invoice_id), student_id: Number(form.student_id), amount: Number(form.amount), payment_method: form.payment_method })
              notify('Payment recorded.', 'success')
              onCreated()
            } catch (err) {
              notify(friendlyApiError(err, 'record the payment'), 'error')
              setSubmitting(false)
            }
          }}>{submitting ? 'Recording…' : 'Record'}</button>
        <button className="button button--secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}