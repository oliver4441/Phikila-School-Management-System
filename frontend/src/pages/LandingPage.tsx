import { useEffect, useState } from 'react'
import { Link } from '../lib/router'
import './PhikilaLanding.css'

const FEATURES = [
  ['blue', 'fa-user-graduate', 'Student Management', 'Complete profiles, enrollment, progress tracking, and academic history in one place.'],
  ['green', 'fa-chalkboard-teacher', 'Teacher Portal', 'Empower educators with tools for grading, attendance, and class communication.'],
  ['purple', 'fa-calendar-check', 'Attendance & Schedule', 'Automated attendance tracking with real-time sync and smart timetable management.'],
  ['orange', 'fa-chart-simple', 'Analytics & Reports', 'Data-driven insights with custom reports on performance, engagement, and growth.'],
  ['pink', 'fa-comments', 'Parent Communication', 'Keep parents informed with instant updates, progress reports, and announcements.'],
  ['cyan', 'fa-coins', 'Fee Management', 'Simplify invoicing, online payments, and financial tracking for your institution.'],
] as const

export function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    document.title = 'Phikila · Smart School Management System'
    const onScroll = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const closeMobile = () => setMobileOpen(false)

  return (
    <div className="phikila-landing">
      <nav className={`navbar${scrolled ? ' scrolled' : ''}`} id="navbar">
        <div className="container">
          <a href="#hero" className="logo" onClick={closeMobile}>
            <i className="fas fa-graduation-cap" />
            <span>Phi<span>kila</span></span>
          </a>
          <ul className={`nav-links${mobileOpen ? ' open' : ''}`}>
            <li><a href="#features" onClick={closeMobile}>Features</a></li>
            <li><a href="#how-it-works" onClick={closeMobile}>How It Works</a></li>
            <li><a href="#testimonials" onClick={closeMobile}>Testimonials</a></li>
            <li><a href="#pricing" onClick={closeMobile}>Pricing</a></li>
          </ul>
          <div className="nav-actions">
            <Link to="/login" className="btn btn-outline">Log in</Link>
            <Link to="/signup" className="btn btn-primary"><span>Get Started</span></Link>
            <button className="mobile-toggle" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle navigation">
              <i className={mobileOpen ? 'fas fa-times' : 'fas fa-bars'} />
            </button>
          </div>
        </div>
      </nav>

      <section className="hero" id="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge"><span className="dot" />Trusted by 500+ schools worldwide</div>
            <h1>The smarter way to<br /><span className="gradient-text">manage your school</span></h1>
            <p>Phikila is the all-in-one school management platform that connects administrators, teachers, students, and parents in one seamless experience.</p>
            <div className="hero-buttons">
              <Link to="/signup" className="btn btn-primary btn-glow"><span>Start free trial</span><i className="fas fa-arrow-right" /></Link>
              <a href="#features" className="btn btn-outline"><i className="fas fa-play-circle" /> Watch demo</a>
            </div>
            <div className="hero-stats">
              <div><h4><span className="gradient-text">12K+</span></h4><p>Active students</p></div>
              <div><h4><span className="gradient-text">98%</span></h4><p>Satisfaction rate</p></div>
              <div><h4><span className="gradient-text">4.9</span> ⭐</h4><p>Average rating</p></div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="mockup-wrapper">
              <div className="mockup">
                <div className="mockup-header">
                  <div className="dots"><span /><span /><span /></div>
                  <span className="mockup-title"><i className="fas fa-chart-simple" /> Dashboard · Overview</span>
                </div>
                <div className="mockup-body">
                  <MockupRow label="Attendance" width="87%" value="87%" />
                  <MockupRow label="Grade Avg" width="76%" value="B+" tone="green" />
                  <MockupRow label="Completion" width="92%" value="92%" tone="orange" />
                  <MockupRow label="Engagement" width="68%" value="68%" tone="pink" />
                </div>
                <div className="mockup-footer">
                  <div className="badge-group"><span className="badge"><i className="fas fa-check-circle" /> Live sync</span><span className="badge blue"><i className="fas fa-users" /> 24 online</span></div>
                  <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}><i className="fas fa-arrow-up" style={{ color: '#22c55e' }} /> +12% this week</span>
                </div>
              </div>
              <FloatCard icon="fa-user-graduate" tone="blue" text="1,284 students" sub="enrolled this month" />
              <FloatCard icon="fa-check-circle" tone="green" text="98% attendance" sub="across all classes" />
              <FloatCard icon="fa-star" tone="purple" text="4.9 rating" sub="from 500+ reviews" />
              <FloatCard icon="fa-clock" tone="orange" text="24/7 support" sub="always here to help" />
            </div>
          </div>
        </div>
      </section>

      <section className="features" id="features">
        <div className="container">
          <div className="text-center">
            <span className="section-label"><span className="line" /> Features <span className="line" /></span>
            <h2 className="section-title">Everything you need to <span className="gradient-text">run your school</span></h2>
            <p className="section-sub center">From attendance to analytics, Phikila covers every aspect of modern education management.</p>
          </div>
          <div className="features-grid">
            {FEATURES.map(([tone, icon, title, desc]) => (
              <div className="feature-card" key={title}>
                <div className={`icon ${tone}`}><i className={`fas ${icon}`} /></div>
                <h4>{title}</h4><p>{desc}</p>
                <a href="#how-it-works" className="learn-more">Learn more <i className="fas fa-arrow-right" /></a>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="how-it-works" id="how-it-works">
        <div className="container">
          <div className="text-center">
            <span className="section-label"><span className="line" /> How it works <span className="line" /></span>
            <h2 className="section-title">Get started in <span className="gradient-text">3 simple steps</span></h2>
            <p className="section-sub center">Set up your school in minutes and start managing everything from one dashboard.</p>
          </div>
          <div className="steps-grid">
            <Step number="1" title="Create your account" text="Sign up for free and set up your school profile in just a few clicks." />
            <Step number="2" title="Add your data" text="Import students, teachers, classes, and courses using our bulk tools." />
            <Step number="3" title="Start managing" text="Track attendance, grades, fees, and communicate with everyone in one place." />
          </div>
        </div>
      </section>

      <section className="testimonials" id="testimonials">
        <div className="container">
          <div className="text-center">
            <span className="section-label"><span className="line" /> Testimonials <span className="line" /></span>
            <h2 className="section-title">Loved by <span className="gradient-text">educators worldwide</span></h2>
            <p className="section-sub center">See what school leaders and teachers say about Phikila.</p>
          </div>
          <div className="testimonial-grid">
            <Testimonial initials="JD" tone="a1" name="Dr. James Doyle" role="Principal, Greenfield High" text="Phikila transformed our school operations. Attendance tracking alone saved us 10+ hours per week." />
            <Testimonial initials="SM" tone="a2" name="Sarah Mitchell" role="Head of Academics, Riverview" text="The parent communication feature is a game-changer. Engagement has never been higher." />
            <Testimonial initials="MR" tone="a3" name="Michael Rodriguez" role="IT Director, Prep Academy" text="Intuitive, fast, and reliable. Our teachers love the gradebook and analytics dashboards." />
          </div>
        </div>
      </section>

      <section className="pricing" id="pricing">
        <div className="container">
          <div className="text-center">
            <span className="section-label"><span className="line" /> Pricing <span className="line" /></span>
            <h2 className="section-title">Choose the plan that <span className="gradient-text">fits your school</span></h2>
            <p className="section-sub center">Transparent pricing with no hidden fees. Upgrade or downgrade anytime.</p>
          </div>
          <div className="pricing-grid">
            <PricingCard name="Starter" price="$49" desc="Perfect for small schools and startups." features={['Up to 200 students','10 teachers','Basic attendance','Grade management','Email support']} />
            <PricingCard name="Professional" price="$99" desc="Best for growing schools and districts." features={['Up to 1,000 students','50 teachers','Advanced attendance + analytics','Parent communication portal','Fee management','Priority support']} popular />
            <PricingCard name="Enterprise" price="Custom" desc="For large institutions with custom needs." features={['Unlimited students & teachers','Custom integrations','Advanced security & compliance','Dedicated account manager','24/7 premium support']} />
          </div>
        </div>
      </section>

      <section className="cta" id="cta">
        <div className="container">
          <h2>Ready to <span className="gradient-text">transform</span> your school?</h2>
          <p>Join 500+ schools already using Phikila to streamline their operations and improve learning outcomes.</p>
          <div className="btn-group"><Link to="/signup" className="btn btn-primary btn-glow"><span>Start free trial</span><i className="fas fa-arrow-right" /></Link><a href="mailto:sales@phikila.com" className="btn btn-white">Book a demo</a></div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <div className="brand"><h4><i className="fas fa-graduation-cap" /> Phikila</h4><p>Smart school management platform designed to streamline administration, enhance learning, and connect communities.</p><div className="social"><a href="#" aria-label="Twitter"><i className="fab fa-twitter" /></a><a href="#" aria-label="LinkedIn"><i className="fab fa-linkedin-in" /></a><a href="#" aria-label="Facebook"><i className="fab fa-facebook-f" /></a><a href="#" aria-label="YouTube"><i className="fab fa-youtube" /></a></div></div>
          <div className="col"><h5>Product</h5><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#how-it-works">How it works</a><a href="#cta">Get started</a></div>
          <div className="col"><h5>Company</h5><a href="#hero">About</a><a href="mailto:sales@phikila.com">Contact</a><a href="#testimonials">Testimonials</a></div>
          <div className="col"><h5>Support</h5><Link to="/login">Help center</Link><a href="#features">Documentation</a><a href="mailto:support@phikila.com">Support</a></div>
        </div>
        <div className="footer-bottom"><p>© 2026 Phikila. All rights reserved. Made with <i className="fas fa-heart" /> for education.</p></div>
      </footer>
    </div>
  )
}

function MockupRow({ label, width, value, tone = '' }: { label: string; width: string; value: string; tone?: string }) {
  return <div className="mockup-row"><span className="label">{label}</span><div className="bar-track"><div className={`bar-fill ${tone}`} style={{ width }} /></div><span className="value">{value}</span></div>
}

function FloatCard({ icon, tone, text, sub }: { icon: string; tone: string; text: string; sub: string }) {
  return <div className="float-card"><div className={`icon-circle ${tone}`}><i className={`fas ${icon}`} /></div><div>{text}<small>{sub}</small></div></div>
}

function Step({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="step-card"><div className="step-number">{number}</div><h4>{title}</h4><p>{text}</p></div>
}

function Testimonial({ initials, tone, name, role, text }: { initials: string; tone: string; name: string; role: string; text: string }) {
  return <div className="testimonial-card"><div className="stars">★★★★★</div><blockquote>“{text}”</blockquote><div className="author"><div className={`avatar ${tone}`}>{initials}</div><div><h5>{name}</h5><span>{role}</span></div></div></div>
}

function PricingCard({ name, price, desc, features, popular = false }: { name: string; price: string; desc: string; features: string[]; popular?: boolean }) {
  return <div className={`pricing-card${popular ? ' popular' : ''}`}>{popular && <span className="popular-badge">Most Popular</span>}<div className="plan-name">{name}</div><div className="price">{price}{price !== 'Custom' && <span>/mo</span>}</div><p className="plan-desc">{desc}</p><ul className="features-list">{features.map((feature) => <li key={feature}><i className="fas fa-check" /> {feature}</li>)}</ul><Link to="/signup" className={`btn ${popular ? 'btn-primary' : 'btn-outline'}`}>{popular ? <><span>Get Started</span><i className="fas fa-arrow-right" /></> : 'Get Started'}</Link></div>
}
