import { useMemo, useState } from 'react'
import { Link } from '../lib/router'
import './DemoOnboardingPage.css'

type Plan = { id: string; name: string; description: string; price: string; highlight?: boolean }

const PLANS: Plan[] = [
  { id: 'starter', name: 'Starter', description: 'Core tools for a growing school.', price: 'Demo plan' },
  { id: 'growth', name: 'Growth', description: 'More automation and operational visibility.', price: 'Demo plan', highlight: true },
  { id: 'enterprise', name: 'Enterprise', description: 'Designed for larger institutions and groups.', price: 'Talk to Phikila' },
]

const STEPS = ['School', 'Plan', 'Trial', 'Ready']

export function DemoOnboardingPage() {
  const [step, setStep] = useState(0)
  const [schoolName, setSchoolName] = useState('Phikila Academy')
  const [adminName, setAdminName] = useState('Jane Wanjiku')
  const [plan, setPlan] = useState('growth')
  const [submitted, setSubmitted] = useState(false)
  const trialEnds = useMemo(() => {
    const date = new Date()
    date.setMonth(date.getMonth() + 1)
    return date.toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })
  }, [])

  function next() {
    if (step === 0 && !schoolName.trim()) return
    if (step < STEPS.length - 1) setStep((value) => value + 1)
    else setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="demo-onboarding">
        <div className="demo-shell demo-success">
          <div className="demo-brand"><span>P</span><strong>Phikila</strong></div>
          <div className="success-mark">✓</div>
          <p className="demo-kicker">Demo provisioning complete</p>
          <h1>{schoolName} is ready.</h1>
          <p className="demo-lead">This is a demo-only school workspace skeleton. In production, successful payment or trial activation will provision the tenant automatically.</p>
          <div className="trial-card"><strong>30-day free trial</strong><span>Trial access ends {trialEnds}</span><b>No payment required for this demo</b></div>
          <div className="demo-summary"><div><small>Administrator</small><strong>{adminName}</strong></div><div><small>Plan</small><strong>{PLANS.find((item) => item.id === plan)?.name}</strong></div><div><small>Workspace</small><strong>Provisioned</strong></div></div>
          <div className="demo-actions"><Link to="/" className="demo-button secondary">Back to Phikila</Link><Link to="/signup" className="demo-button primary">Create a real account →</Link></div>
          <p className="demo-note">Demo data only. No payment was collected and no production tenant was created.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="demo-onboarding">
      <div className="demo-shell">
        <header className="demo-header"><Link to="/" className="demo-brand"><span>P</span><strong>Phikila</strong></Link><span className="demo-mode">Demo onboarding</span></header>
        <div className="progress"><div className="progress-track"><span style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }} /></div>{STEPS.map((label, index) => <div className={index <= step ? 'progress-step active' : 'progress-step'} key={label}><b>{index + 1}</b><span>{label}</span></div>)}</div>

        <main className="demo-content">
          {step === 0 && <section><p className="demo-kicker">01 · School setup</p><h1>Let's create your school workspace.</h1><p className="demo-lead">Use demo data now. This flow is intentionally shaped so an agent can later connect it to real authentication, tenant provisioning and billing.</p><div className="demo-form"><label>School name<input value={schoolName} onChange={(event) => setSchoolName(event.target.value)} /></label><label>Administrator name<input value={adminName} onChange={(event) => setAdminName(event.target.value)} /></label><label>Country<select defaultValue="Kenya"><option>Kenya</option><option>Uganda</option><option>Tanzania</option></select></label></div></section>}
          {step === 1 && <section><p className="demo-kicker">02 · Choose a plan</p><h1>Pick the workspace that fits.</h1><p className="demo-lead">All plans include the same one-month demo trial. Real billing will be connected later.</p><div className="plan-grid">{PLANS.map((item) => <button key={item.id} className={plan === item.id ? 'plan selected' : 'plan'} onClick={() => setPlan(item.id)}><div><span>{item.highlight ? 'Recommended' : 'Plan'}</span><h3>{item.name}</h3><p>{item.description}</p></div><strong>{item.price}</strong></button>)}</div></section>}
          {step === 2 && <section><p className="demo-kicker">03 · Free trial</p><h1>Start with one month free.</h1><p className="demo-lead">The commercial skeleton reserves the first 30 days as a trial period. No payment is collected in demo mode.</p><div className="trial-preview"><div><span>Trial period</span><strong>30 days</strong></div><div><span>Payment today</span><strong>KES 0</strong></div><div><span>Selected plan</span><strong>{PLANS.find((item) => item.id === plan)?.name}</strong></div></div><div className="check-list"><span>✓ School workspace provisioning</span><span>✓ Administrator onboarding</span><span>✓ Trial status and expiry tracking</span><span>✓ Ready for payment-provider integration</span></div></section>}
          {step === 3 && <section><p className="demo-kicker">04 · Review</p><h1>Ready to provision the demo workspace.</h1><p className="demo-lead">Review the simulated subscription before the demo provisioning step.</p><div className="review-card"><div><span>School</span><strong>{schoolName}</strong></div><div><span>Administrator</span><strong>{adminName}</strong></div><div><span>Plan</span><strong>{PLANS.find((item) => item.id === plan)?.name}</strong></div><div><span>Trial</span><strong>30 days free</strong></div><div><span>Payment</span><strong>Demo — KES 0</strong></div></div></section>}
        </main>

        <footer className="demo-footer"><span>Demo environment · No real payment or tenant provisioning</span><div>{step > 0 && <button className="demo-button secondary" onClick={() => setStep((value) => value - 1)}>Back</button>}<button className="demo-button primary" onClick={next}>{step === STEPS.length - 1 ? 'Provision demo workspace →' : 'Continue →'}</button></div></footer>
      </div>
    </div>
  )
}
