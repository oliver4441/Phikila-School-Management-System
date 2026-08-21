import { useEffect, useState, type ReactNode } from 'react'
import { LogoMark } from '../components/Logo'
import {
  CalendarIcon,
  CheckIcon,
  ChevronRightIcon,
  DashboardIcon,
  GridIcon,
  LayersIcon,
  LockIcon,
  SchoolIcon,
  SparkIcon,
  UserIcon,
} from '../components/icons'
import { Link } from '../lib/router'
import { api } from '../lib/api'

type Feature = {
  icon: ReactNode
  eyebrow: string
  title: string
  description: string
}

const FEATURES: Feature[] = [
  {
    icon: <CalendarIcon />,
    eyebrow: 'Scheduling',
    title: 'Build timetables with confidence',
    description: 'Bring periods, rooms, teachers, and constraints together before publishing a schedule.',
  },
  {
    icon: <UserIcon />,
    eyebrow: 'People',
    title: 'Keep every learner record organised',
    description: 'Manage student enrolment, class assignments, and staff information from one reliable workspace.',
  },
  {
    icon: <LayersIcon />,
    eyebrow: 'Academics',
    title: 'Structure the academic year clearly',
    description: 'Set up years, terms, levels, streams, subjects, and teaching requirements without scattered files.',
  },
  {
    icon: <CheckIcon />,
    eyebrow: 'Daily operations',
    title: 'Make attendance easier to act on',
    description: 'Capture class attendance consistently and give school teams a clearer view of daily participation.',
  },
  {
    icon: <GridIcon />,
    eyebrow: 'Performance',
    title: 'Turn results into useful insight',
    description: 'Record examinations, review performance, and prepare reports that support better decisions.',
  },
  {
    icon: <SparkIcon />,
    eyebrow: 'Productivity',
    title: 'Move repetitive work forward faster',
    description: 'Use document scanning, scheduling assistance, and connected workflows to reduce administrative effort.',
  },
]

const OPERATIONS = [
  { label: 'School setup', icon: <SchoolIcon /> },
  { label: 'Academic structure', icon: <LayersIcon /> },
  { label: 'Timetables', icon: <CalendarIcon /> },
  { label: 'Students & staff', icon: <UserIcon /> },
  { label: 'Attendance', icon: <CheckIcon /> },
  { label: 'Reports & insight', icon: <GridIcon /> },
]

const PILLARS = [
  {
    icon: <LayersIcon />,
    title: 'One connected system',
    description: 'Records, academics, scheduling, attendance, and reporting — linked, not scattered.',
  },
  {
    icon: <LockIcon />,
    title: 'Role-aware access',
    description: 'Give each person the right level of visibility without exposing what they should not see.',
  },
  {
    icon: <SparkIcon />,
    title: 'Built to reduce effort',
    description: 'Scanning, scheduling assistance, and connected workflows that move repetitive work forward.',
  },
]

export function LandingPage() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    document.title = 'Phikila — School operations, in one place'
    api.health().then(() => setApiStatus('online')).catch(() => setApiStatus('offline'))
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const els = document.querySelectorAll('.pld-reveal')
    if (!els.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('pld--in')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -50px 0px' },
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="pld">
      <a className="skip-link" href="#main-content">Skip to main content</a>

      {/* ──────────────────────────  Nav  ────────────────────────── */}
      <header className={`pld-hero ${scrolled ? 'pld-hero--scrolled' : ''}`}>
        <nav className="pld-nav" aria-label="Main navigation">
          <a className="pld-brand" href="#top" aria-label="Phikila home">
            <LogoMark size={36} tone="dark" />
            <span className="pld-brand-copy">
              <span className="pld-brand-name">PHIKILA</span>
              <span className="pld-brand-tag">School Management System</span>
            </span>
          </a>

          <div className="pld-nav-links">
            <a href="#platform">Platform</a>
            <a href="#capabilities">Capabilities</a>
            <a href="#workflow">How it works</a>
          </div>

          <div className="pld-nav-actions">
            <Link className="pld-sign-in" to="/login">Sign in</Link>
            <Link className="pld-nav-cta" to="/signup">
              Get started <ChevronRightIcon width={15} height={15} />
            </Link>
          </div>
        </nav>

        {/* ──────────────────────────  Hero  ────────────────────────── */}
        <main id="main-content">
          <div className="pld-hero-grid" id="top">
            <div className="pld-hero-copy pld-reveal">
              <div className="pld-announcement">
                <span className="pld-announcement-dot" />
                One connected school operating system
              </div>
              <h1 className="pld-title">
                School operations,
                <br />
                <span className="pld-title-italic">finally in sync.</span>
              </h1>
              <p className="pld-subtitle">
                Bring records, academics, scheduling, attendance, finance, and reporting into one clear system—so your team can spend less time chasing information and more time moving the school forward.
              </p>
              <div className="pld-cta">
                <Link className="pld-btn pld-btn--primary" to="/signup">
                  Create your workspace <ChevronRightIcon width={17} height={17} />
                </Link>
                <a className="pld-btn pld-btn--ghost" href="#platform">
                  Explore the platform
                </a>
              </div>
              <div className="pld-hero-points" aria-label="Platform highlights">
                <span><CheckIcon width={14} height={14} /> Guided setup</span>
                <span><CheckIcon width={14} height={14} /> Role-aware access</span>
                <span><CheckIcon width={14} height={14} /> One source of truth</span>
              </div>
            </div>

            {/* ── Product preview ── */}
            <div className="pld-stage pld-reveal" aria-label="Illustrative preview of the Phikila dashboard">
              <div className="pld-stage-glow" />
              <div className="pld-card-preview">
                <div className="pld-preview-topbar">
                  <div className="pld-preview-brand">
                    <LogoMark size={20} tone="light" />
                    <span>Phikila</span>
                  </div>
                  <div className="pld-preview-actions">
                    <span className="pld-preview-search">Search…</span>
                    <span className="pld-preview-avatar">AM</span>
                  </div>
                </div>
                <div className="pld-preview-body">
                  <aside className="pld-preview-sidebar" aria-hidden="true">
                    <span className="pld-preview-nav pld-preview-nav--active"><DashboardIcon /> Overview</span>
                    <span className="pld-preview-nav"><CalendarIcon /> Timetable</span>
                    <span className="pld-preview-nav"><UserIcon /> Students</span>
                    <span className="pld-preview-nav"><CheckIcon /> Attendance</span>
                    <span className="pld-preview-nav"><GridIcon /> Reports</span>
                  </aside>
                  <div className="pld-preview-workspace">
                    <div className="pld-preview-heading">
                      <div>
                        <span className="pld-preview-kicker">Monday overview</span>
                        <strong>Good morning, Admin</strong>
                      </div>
                      <span className="pld-preview-term">Term 2 · Week 6</span>
                    </div>
                    <div className="pld-preview-metrics">
                      <div className="pld-metric">
                        <span>Students</span><strong>1,248</strong><small>Active enrolment</small>
                      </div>
                      <div className="pld-metric">
                        <span>Attendance</span><strong>94.8%</strong><small className="pld-metric-up">↑ 1.6% this week</small>
                      </div>
                      <div className="pld-metric pld-metric--hidden">
                        <span>Staff</span><strong>86</strong><small>4 departments</small>
                      </div>
                    </div>
                    <div className="pld-preview-panels">
                      <div className="pld-panel pld-panel--schedule">
                        <div className="pld-panel-head"><strong>Today's schedule</strong><span>View all</span></div>
                        <div className="pld-lesson"><time>08:00</time><i className="pld-lesson-line pld-lesson-line--green" /><div><strong>Mathematics</strong><span>Grade 9 · Room 12</span></div></div>
                        <div className="pld-lesson"><time>09:20</time><i className="pld-lesson-line pld-lesson-line--amber" /><div><strong>English Language</strong><span>Grade 8 · Room 04</span></div></div>
                        <div className="pld-lesson"><time>11:00</time><i className="pld-lesson-line pld-lesson-line--blue" /><div><strong>Integrated Science</strong><span>Grade 10 · Lab 02</span></div></div>
                      </div>
                      <div className="pld-panel pld-panel--attendance">
                        <div className="pld-panel-head"><strong>Attendance</strong><span>Today</span></div>
                        <div className="pld-ring"><span><strong>94.8%</strong><small>Present</small></span></div>
                        <div className="pld-bars" aria-hidden="true">
                          <i style={{ height: '48%' }} /><i style={{ height: '64%' }} /><i style={{ height: '57%' }} /><i style={{ height: '78%' }} /><i style={{ height: '88%' }} /><i style={{ height: '73%' }} /><i style={{ height: '94%' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pld-float pld-float--top">
                <span className="pld-float-icon"><CheckIcon width={15} height={15} /></span>
                <span><strong>Schedule ready</strong><small>No conflicts detected</small></span>
              </div>
              <div className="pld-float pld-float--bottom">
                <span className="pld-float-icon pld-float-icon--amber"><SparkIcon width={15} height={15} /></span>
                <span><strong>Daily overview</strong><small>Everything in one view</small></span>
              </div>
            </div>
          </div>
        </main>
      </header>

      {/* ──────────────────────────  Marquee  ────────────────────────── */}
      <div className="pld-marquee" aria-hidden="true">
        <div className="pld-marquee-track">
          {[...OPERATIONS, ...OPERATIONS].map((item, i) => (
            <span className="pld-marquee-item" key={i}>
              {item.icon}{item.label}
            </span>
          ))}
        </div>
      </div>

      {/* ──────────────────────────  Pillars  ────────────────────────── */}
      <section className="pld-section pld-pillars">
        <div className="pld-section-inner">
          <div className="pld-pillars-grid">
            {PILLARS.map((pillar) => (
              <article className="pld-pillar pld-reveal" key={pillar.title}>
                <span className="pld-pillar-icon">{pillar.icon}</span>
                <h3>{pillar.title}</h3>
                <p>{pillar.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────────────  Platform showcase  ────────────────────────── */}
      <section className="pld-section pld-platform" id="platform">
        <div className="pld-section-inner">
          <div className="pld-section-head pld-reveal">
            <p className="pld-eyebrow">Built for operational clarity</p>
            <h2>Run the whole school without losing the details.</h2>
            <p>Phikila gives every workflow a proper home, while keeping the information your team depends on connected and easy to understand.</p>
          </div>

          <div className="pld-bento">
            <article className="pld-bento-card pld-bento-card--wide pld-bento-card--dark pld-reveal">
              <div className="pld-bento-copy">
                <span className="pld-bento-icon"><CalendarIcon /></span>
                <p className="pld-bento-label">Smarter scheduling</p>
                <h3>Build a timetable around real school constraints.</h3>
                <p>Coordinate teaching requirements, rooms, periods, and availability in one structured workflow.</p>
              </div>
              <div className="pld-mini-timetable" aria-hidden="true">
                <div className="pld-tt-days"><span>MON</span><span>TUE</span><span>WED</span><span>THU</span></div>
                <div className="pld-tt-grid">
                  <span className="pld-slot pld-slot--green">Math <small>08:00</small></span>
                  <span className="pld-slot pld-slot--blue">English <small>08:00</small></span>
                  <span />
                  <span className="pld-slot pld-slot--amber">Science <small>09:20</small></span>
                  <span />
                  <span className="pld-slot pld-slot--amber">Science <small>09:20</small></span>
                  <span className="pld-slot pld-slot--green">Math <small>10:40</small></span>
                  <span />
                </div>
              </div>
            </article>

            <article className="pld-bento-card pld-bento-card--records pld-reveal">
              <span className="pld-bento-icon pld-bento-icon--light"><UserIcon /></span>
              <p className="pld-bento-label">Connected records</p>
              <h3>A complete view of your school community.</h3>
              <p>Keep student and staff information structured, current, and ready for the next task.</p>
              <div className="pld-record-stack" aria-hidden="true">
                <div><span className="pld-record-avatar">AN</span><p><strong>Amara N.</strong><small>Grade 9 · East</small></p><em>Active</em></div>
                <div><span className="pld-record-avatar pld-record-avatar--amber">KM</span><p><strong>Kelvin M.</strong><small>Grade 10 · North</small></p><em>Active</em></div>
                <div><span className="pld-record-avatar pld-record-avatar--blue">LW</span><p><strong>Linet W.</strong><small>Grade 8 · West</small></p><em>Active</em></div>
              </div>
            </article>

            <article className="pld-bento-card pld-bento-card--insight pld-reveal">
              <span className="pld-bento-icon pld-bento-icon--light"><GridIcon /></span>
              <p className="pld-bento-label">Decision-ready insight</p>
              <h3>See what needs attention sooner.</h3>
              <p>Bring attendance, academic performance, and school operations into a clearer daily picture.</p>
              <div className="pld-insight-chart" aria-hidden="true">
                <div className="pld-chart-legend"><span>Term progress</span><strong>On track</strong></div>
                <div className="pld-chart-bars"><i /><i /><i /><i /><i /><i /><i /></div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ──────────────────────────  Capabilities  ────────────────────────── */}
      <section className="pld-section pld-capabilities" id="capabilities">
        <div className="pld-section-inner">
          <div className="pld-section-head pld-section-head--left pld-reveal">
            <p className="pld-eyebrow">A platform that grows with the work</p>
            <h2>Every essential workflow. One consistent experience.</h2>
          </div>
          <div className="pld-feature-grid">
            {FEATURES.map((feature) => (
              <article className="pld-feature-card pld-reveal" key={feature.title}>
                <span className="pld-feature-icon">{feature.icon}</span>
                <div>
                  <p className="pld-feature-eyebrow">{feature.eyebrow}</p>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────────────  Workflow  ────────────────────────── */}
      <section className="pld-section pld-workflow" id="workflow">
        <div className="pld-section-inner pld-workflow-inner">
          <div className="pld-section-head pld-reveal">
            <p className="pld-eyebrow pld-eyebrow--light">A clearer path from day one</p>
            <h2>Set up carefully. Operate confidently.</h2>
            <p>Phikila turns a complex school setup into a straightforward sequence your team can follow.</p>
          </div>
          <ol className="pld-steps">
            <li className="pld-reveal">
              <span className="pld-step-num">01</span>
              <div><h3>Build your foundation</h3><p>Add the school profile, academic calendar, levels, streams, staff, and subjects.</p></div>
            </li>
            <li className="pld-reveal">
              <span className="pld-step-num">02</span>
              <div><h3>Connect your workflows</h3><p>Bring students, teaching requirements, timetables, attendance, and assessments together.</p></div>
            </li>
            <li className="pld-reveal">
              <span className="pld-step-num">03</span>
              <div><h3>Run with a shared view</h3><p>Give the right people the context they need to keep daily operations moving.</p></div>
            </li>
          </ol>
        </div>
      </section>

      {/* ──────────────────────────  Philosophy  ────────────────────────── */}
      <section className="pld-section pld-philosophy">
        <div className="pld-section-inner pld-philosophy-inner pld-reveal">
          <span className="pld-philosophy-mark" aria-hidden="true">"</span>
          <blockquote>
            A school is not a spreadsheet. It is people, plans, and daily decisions that deserve a system built with the same care.
          </blockquote>
          <p className="pld-philosophy-attr">The Phikila design principle</p>
        </div>
      </section>

      {/* ──────────────────────────  Final CTA  ────────────────────────── */}
      <section className="pld-final-cta">
        <div className="pld-final-cta-glow" />
        <div className="pld-final-cta-inner pld-reveal">
          <p className="pld-eyebrow pld-eyebrow--light">A better operating rhythm starts here</p>
          <h2>Give your school one clear place to move forward.</h2>
          <p>Set up your workspace and bring the people, plans, and information behind every school day together.</p>
          <div className="pld-cta pld-cta--centered">
            <Link className="pld-btn pld-btn--primary" to="/signup">
              Get started with Phikila <ChevronRightIcon width={17} height={17} />
            </Link>
            <Link className="pld-btn pld-btn--outline" to="/login">Sign in</Link>
          </div>
        </div>
      </section>

      {/* ──────────────────────────  Footer  ────────────────────────── */}
      <footer className="pld-footer">
        <div className="pld-footer-main">
          <div className="pld-footer-brand">
            <span className="pld-brand">
              <LogoMark size={32} tone="dark" />
              <span className="pld-brand-copy">
                <span className="pld-brand-name">PHIKILA</span>
                <span className="pld-brand-tag">School Management System</span>
              </span>
            </span>
            <p>A clearer operating system for modern school teams.</p>
          </div>
          <div className="pld-footer-links">
            <div><strong>Platform</strong><a href="#platform">Overview</a><a href="#capabilities">Capabilities</a><a href="#workflow">How it works</a></div>
            <div><strong>Access</strong><Link to="/login">Sign in</Link><Link to="/signup">Create account</Link></div>
          </div>
        </div>
        <div className="pld-footer-bottom">
          <p>© {new Date().getFullYear()} Phikila School Management System. All rights reserved.</p>
          <span className="pld-status" aria-live="polite">
            <i className={`pld-status-dot pld-status-dot--${apiStatus}`} />
            {apiStatus === 'checking' ? 'Checking system status' : apiStatus === 'online' ? 'All systems operational' : 'Status unavailable'}
          </span>
        </div>
      </footer>
    </div>
  )
}
