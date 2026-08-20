# Phikila Payments Integration Plan

## Objective

Add a school-fee payment layer without changing the existing authentication, academics, timetable, student, attendance, examinations, or finance workflows until the payment layer is ready.

## Recommended architecture

Use **Paystack as the first payment gateway** for Kenyan schools, with a provider abstraction so direct Safaricom Daraja can be added later without changing the finance UI or invoice model.

Paystack currently supports Kenya M-PESA and card payments, and its Kenya M-PESA channel uses a customer phone number and an authorization flow. Successful payments are confirmed asynchronously through webhooks. citeturn0search0turn0search9

Safaricom's Daraja 3.0 remains the direct M-PESA integration option and provides access to M-PESA APIs for web and mobile applications. citeturn0search1turn0search2

## Phase 1 — Payment data model

Add payment-specific tables without replacing the existing finance tables:

- `payment_providers` — provider configuration per school; encrypted/secret values remain server-side.
- `payment_customers` — payer identity and normalized phone/email.
- `payment_transactions` — immutable payment attempt record with provider, amount, currency, reference, status, and timestamps.
- `payment_allocations` — maps a successful payment to one or more student fee invoices/charges.
- `payment_webhook_events` — raw provider event ID, payload hash, processing state, and timestamps for idempotency/audit.
- `payment_refunds` — refund requests and provider references.

Every school-owned record must carry `school_id`. Provider credentials must never be stored in `VITE_*` variables or sent to the browser.

## Phase 2 — Paystack collection

Implement a server-side provider adapter:

```text
PaymentProvider
  ├── initializePayment()
  ├── verifyPayment()
  ├── handleWebhook()
  └── refundPayment()
```

Paystack flow:

1. Parent/student selects an outstanding fee invoice.
2. Backend creates a pending transaction and unique reference.
3. Backend initializes Paystack checkout or M-PESA payment.
4. Browser completes authorization.
5. Paystack sends the webhook.
6. Backend validates the webhook, verifies the transaction, and processes it idempotently.
7. Payment is allocated to the invoice.
8. Invoice balance and student account are updated in one database transaction.
9. Receipt is generated and exposed in the parent/student portal.

Paystack's current Kenya pricing lists M-PESA transactions at 1.5%, with no upfront or monthly fee; actual commercial terms should still be confirmed before production launch. citeturn0search10

## Phase 3 — M-PESA direct option

Add a `daraja` provider implementation after the Paystack path is stable.

Use Daraja for schools that want direct Safaricom M-PESA integration, particularly where a school's existing Paybill/Till setup makes direct reconciliation preferable. Daraja exposes M-PESA APIs and a sandbox for testing. citeturn0search1turn0search3

Expected flow:

```text
Invoice
  ↓
Create payment transaction
  ↓
M-PESA STK Push / supported Daraja collection API
  ↓
Safaricom callback
  ↓
Verify + idempotency check
  ↓
Allocate to invoice
  ↓
Receipt + ledger update
```

Do not ask users for an M-PESA PIN or transaction code. The authorization happens on the customer's device/provider flow. citeturn0search19

## Phase 4 — Finance integration

The existing Finance page should become the accounting view of the payment layer rather than the payment gateway itself.

Add:

- outstanding balances by student
- invoice/payment history
- partial payments
- overpayment handling
- payment references
- automated receipts
- daily collection totals
- provider fees
- refunds
- failed/expired payments
- reconciliation status
- exportable payment ledger

A payment must not be marked as paid solely because the browser returned from checkout. The authoritative state must come from verified provider status/webhook processing.

## Phase 5 — Parent experience

Add a parent-facing payment flow:

```text
Student → Fees → Outstanding invoice → Pay now
                                      ↓
                         M-PESA / Card checkout
                                      ↓
                              Payment status
                                      ↓
                                Receipt
```

For M-PESA, normalize Kenyan numbers to international format before sending them to the provider. Paystack's current documentation gives `+254...` as the expected format. citeturn0search0

## Phase 6 — Reconciliation and controls

Implement:

- webhook idempotency using provider event/reference IDs
- transaction-level audit trail
- signed/verified webhook handling
- server-side amount validation
- invoice ownership validation by `school_id`
- duplicate-payment protection
- refund authorization rules
- reconciliation dashboard
- daily provider-to-ledger comparison
- failed webhook retry queue

No client-provided amount should be trusted. The backend should derive the payable amount from the current invoice state.

## Phase 7 — Future payouts

Keep collection and payout concerns separate. If Phikila later needs to pay refunds, staff, suppliers, or other recipients, add a transfer provider interface instead of reusing collection logic.

Paystack currently documents Kenya transfers to M-PESA wallets, Paybill/Till numbers, and bank accounts, with limits and fees that vary by destination and amount. citeturn0search18turn0search21

## Security requirements

- Provider secret keys: backend only.
- Webhook endpoints: public HTTPS endpoint, but authenticate/verify every event according to provider requirements.
- Never trust payment status from query parameters or browser state.
- Never expose database credentials, Supabase service-role credentials, JWT secrets, or gateway secret keys to Vite.
- Record provider references and internal transaction IDs separately.
- Make webhook processing idempotent.
- Keep financial records append-oriented and auditable.

## Rollout order

1. Payment database model.
2. Provider abstraction.
3. Paystack M-PESA collection.
4. Paystack card collection.
5. Webhooks + verification + idempotency.
6. Invoice allocation and receipts.
7. Parent payment UI.
8. Reconciliation dashboard.
9. Direct Daraja provider.
10. Refunds and optional payouts.

**Current implementation scope:** this commit only introduces the new public landing frontend and this payment architecture plan. Existing application functionality and backend payment behavior remain unchanged.
