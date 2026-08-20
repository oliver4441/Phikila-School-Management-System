import { useEffect, useState } from 'react'
import { Link } from '../lib/router'
import './PhikilaLanding.css'

const CAPABILITIES = [
  { eyebrow: '01', title: 'Student operations', text: 'Manage admissions, profiles, enrollment, guardians, academic history and student records from one source of truth.', items: ['Student records', 'Enrollment & transfers', 'Guardian profiles'] },
  { eyebrow: '02', title: 'Academic management', text: 'Bring classes, subjects, examinations, results and academic years into a connected workflow for administrators and teachers.', items: ['Classes & subjects', 'Examinations & results', 'Academic years'] },
  { eyebrow: '03', title: 'Attendance & engagement', text: 'Track attendance consistently and surface the information teams need to act before small issues become larger ones.', items: ['Daily attendance', 'Class visibility', 'Engagement insights'] },
  { eyebrow: '04', title: 'Finance & fees', text: 'Create a clearer operational view of school finances, fee records and outstanding balances.', items: ['Fee management', 'Payment tracking', 'Financial visibility'] },
  { eyebrow: '05', title: 'Intelligent scheduling', text: 'Model teachers, subjects, rooms, periods and constraints, then generate and analyse timetables from a single workspace.', items: ['Requirements & constraints', 'Timetable generation', 'Scheduling analytics'] },
  { eyebrow: '06', title: 'AI-assisted workflows', text: 'Use AI where it improves decisions and reduces repetitive work, with provider controls and school context kept inside the platform.', items: ['School copilot', 'OCR workflows', 'AI provider controls'] },
]

const ROLES = [
  ['School administrators', 'Operate the institution with a unified view of people, academics, attendance, finance and reporting.'],
  ['Teachers', 'Manage classes, attendance, academic work and schedules without jumping between disconnected systems.'],
  ['Parents & students', 'Give families and learners a clearer path to the information they actually need.'],
]

export function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeCapability, setActiveCapability] = useState(4)

  useEffect(() => {
    document.title = 'Phikila · School operations, connected'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const capability = CAPABILITIES[activeCapability]

  return (
    <div className="phikila-landing">
      <header className="site-header">
        <div className="container header-inner">
          <a className="brand" href="#top" aria-label="Phikila home">
            <span className="brand-mark">P</span>
            <span>Phikila</span>
          </a>
          <button className="mobile-menu" onClick={() => setMobileOpen((value) => !value)} aria-label="Toggle navigation" aria-expanded={mobileOpen}>{mobileOpen ? '×' : '☰'}</button>
          <nav className={mobileOpen ? 'main-nav open' : 'main-nav'} aria-label="Primary navigation">
            <a href="#platform" onClick={() => setMobileOpen(false)}>Platform</a>
            <a href="#capabilities" onClick={() => setMobileOpen(false)}>Capabilities</a>
            <a href="#roles" onClick={() => setMobileOpen(false)}>For schools</a>
            <a href="#pricing" onClick={() => setMobileOpen(false)}>Pricing</a>
          </nav>
          <div className="header-actions">
            <Link to="/login" className="text-link">Sign in</Link>
            <Link to="/signup" className="button button-dark">Get started</Link>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-grid container">
            <div className="hero-copy">
              <div className="eyebrow"><span className="status-dot" /> Built for modern school operations</div>
              <h1>Run your school with <span>one connected system.</span></h1>
              <p>Phikila brings students, academics, attendance, finance, scheduling and intelligent workflows into a single operational platform.</p>
              <div className="hero-actions">
                <Link to="/signup" className="button button-primary">Start your school <span>→</span></Link>
                <a href="#platform" className="button button-secondary">Explore the platform</a>
              </div>
              <div className="trust-line"><span>One workspace</span><i /> <span>Role-based access</span><i /> <span>Built to scale</span></div>
            </div>
            <div className="hero-product" aria-label="Phikila product preview">
              <div className="window-bar"><span /><span /><span /><b>Phikila / Overview</b></div>
              <div className="product-layout">
                <aside><strong>Phikila</strong><small>School workspace</small><em>Overview</em><em>Students</em><em>Academics</em><em>Attendance</em><em>Finance</em><em className="active">Scheduling</em><em>Analytics</em></aside>
                <div className="product-main">
                  <div className="product-top"><div><small>School operations</small><h3>Good morning, administrator</h3></div><span className="user-chip">A</span></div>
                  <div className="metric-grid"><div><small>Students</small><strong>2,481</strong><span>↑ 8.4%</span></div><div><small>Attendance</small><strong>96.4%</strong><span>↑ 2.1%</span></div><div><small>Open fees</small><strong>184</strong><span>records</span></div></div>
                  <div className="schedule-card"><div className="card-head"><div><small>Timetable</small><strong>Today's schedule</strong></div><span>View all →</span></div>{['08:00  Mathematics · Grade 8A','10:00  Science · Grade 9B','12:00  English · Grade 7C','14:00  Mathematics · Grade 10A'].map((item) => <div className="schedule-row" key={item}><span>{item.slice(0, 5)}</span><b>{item.slice(6)}</b><i>Confirmed</i></div>)}</div>
                </div>
              </div>
              <div className="product-badge badge-one">Live school data</div><div className="product-badge badge-two">Secure access</div>
            </div>
          </div>
        </section>

        <section className="proof-strip"><div className="container proof-inner"><span>One platform for the school lifecycle</span><strong>Students</strong><strong>Academics</strong><strong>Attendance</strong><strong>Finance</strong><strong>Scheduling</strong><strong>Analytics</strong></div></section>

        <section className="section platform" id="platform">
          <div className="container">
            <div className="section-intro"><div><span className="kicker">THE PHIKILA PLATFORM</span><h2>Everything operational.<br /><span>Connected by design.</span></h2></div><p>Replace fragmented workflows with a shared operating layer for administrators, teachers, students and families.</p></div>
            <div className="capability-explorer" id="capabilities">
              <div className="capability-list">{CAPABILITIES.map((item, index) => <button className={index === activeCapability ? 'capability active' : 'capability'} key={item.title} onClick={() => setActiveCapability(index)}><span>{item.eyebrow}</span><strong>{item.title}</strong><i>→</i></button>)}</div>
              <div className="capability-detail"><span className="detail-number">{capability.eyebrow}</span><h3>{capability.title}</h3><p>{capability.text}</p><ul>{capability.items.map((item) => <li key={item}><span>✓</span>{item}</li>)}</ul><div className="detail-visual"><div className="mini-header"><span>Phikila workspace</span><span>Live</span></div><div className="mini-chart"><div style={{ height: '42%' }} /><div style={{ height: '68%' }} /><div style={{ height: '54%' }} /><div style={{ height: '82%' }} /><div style={{ height: '72%' }} /><div style={{ height: '92%' }} /></div><div className="mini-footer"><span>Operational visibility</span><b>Updated now</b></div></div></div>
            </div>
          </div>
        </section>

        <section className="section scheduling-section"><div className="container scheduling-grid"><div><span className="kicker">A DIFFERENTIATOR</span><h2>Timetabling without the spreadsheet <span>guesswork.</span></h2><p>Phikila models the constraints behind a real school timetable — teachers, subjects, rooms, periods and requirements — so teams can generate, review and improve schedules from one system.</p><Link to="/signup" className="inline-link">Explore scheduling <span>→</span></Link></div><div className="constraint-board"><div className="constraint-head"><span>Scheduling workspace</span><b>Optimized</b></div><div className="constraint-row"><span>Teacher availability</span><strong>98%</strong></div><div className="constraint-row"><span>Room conflicts</span><strong>0</strong></div><div className="constraint-row"><span>Required periods</span><strong>124 / 124</strong></div><div className="constraint-row"><span>Classes placed</span><strong>42 / 42</strong></div><div className="optimization"><span>Schedule quality</span><b>94%</b><div><i /></div></div></div></div></section>

        <section className="section roles" id="roles"><div className="container"><div className="center-intro"><span className="kicker">ONE PLATFORM, DIFFERENT EXPERIENCES</span><h2>Designed around the people who <span>run and use schools.</span></h2></div><div className="role-grid">{ROLES.map(([title, text], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p><a href="#platform">Explore experience →</a></article>)}</div></div></section>

        <section className="section workflow"><div className="container"><div className="center-intro"><span className="kicker">GO LIVE WITHOUT THE CHAOS</span><h2>From sign-up to <span>school workspace.</span></h2><p>A commercial onboarding path designed for the next stage of Phikila.</p></div><div className="workflow-line">{['Create account', 'Set up school', 'Choose plan', 'Complete payment', 'Workspace goes live'].map((step, index) => <div key={step}><span>{index + 1}</span><strong>{step}</strong>{index < 4 && <i>→</i>}</div>)}</div></div></section>

        <section className="section security"><div className="container security-grid"><div><span className="kicker">ENTERPRISE FOUNDATION</span><h2>Control, visibility and <span>accountability.</span></h2><p>As Phikila grows across schools, the platform should make permissions, school boundaries and operational activity visible by default.</p></div><div className="security-list"><div><strong>Role-based access</strong><span>Users see what their role permits.</span></div><div><strong>School-level isolation</strong><span>Each institution operates in its own workspace.</span></div><div><strong>Audit-ready activity</strong><span>Platform operations can be reviewed and traced.</span></div><div><strong>Platform administration</strong><span>Superadmin tooling sits above individual schools.</span></div></div></div></section>

        <section className="section pricing" id="pricing"><div className="container"><div className="section-intro"><div><span className="kicker">PRICING</span><h2>Simple now.<br /><span>Ready to scale.</span></h2></div><p>Pricing should evolve with the commercial model. The landing page keeps the structure clear without inventing traction or unsupported claims.</p></div><div className="pricing-card"><div><span>School workspace</span><h3>Choose a plan during onboarding.</h3><p>Start by creating your school account. Plan selection and payment can become part of the provisioning workflow as the commercial layer is finalized.</p></div><Link to="/signup" className="button button-dark">Get started <span>→</span></Link></div></div></section>

        <section className="final-cta"><div className="container"><span className="kicker">BUILD THE NEXT SCHOOL WORKSPACE</span><h2>Make school operations <span>simpler.</span></h2><p>Give your team one system for the work that keeps the school moving.</p><Link to="/signup" className="button button-light">Start with Phikila <span>→</span></Link></div></section>
      </main>

      <footer className="site-footer"><div className="container footer-grid"><div><a className="brand" href="#top"><span className="brand-mark">P</span><span>Phikila</span></a><p>School operations, connected.</p></div><div><small>Platform</small><a href="#platform">Capabilities</a><a href="#roles">For schools</a><a href="#pricing">Pricing</a></div><div><small>Account</small><Link to="/login">Sign in</Link><Link to="/signup">Get started</Link></div></div><div className="container footer-bottom"><span>© 2026 Phikila</span><span>School management platform</span></div></footer>
    </div>
  )
}
