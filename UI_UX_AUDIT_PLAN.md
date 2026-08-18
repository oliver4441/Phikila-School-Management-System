# Phikila School Management System: UI/UX Audit Plan

**Prepared by:** Phikila UX Audit Team
**Date:** 2026-08-18
**Scope:** Frontend (39 pages) + Core User Flows
**Methodology:** Automated + Manual Testing

---

## 🎯 Objectives

1. **Validate clickability** — Ensure all interactive elements (buttons, links, forms) work as expected
2. **Test user flows** — Verify critical paths (login, enrollment, payments, scheduling)
3. **Identify UX issues** — Find broken links, missing states, error handling gaps
4. **Assess accessibility** — Check keyboard navigation, screen reader compatibility
5. **Evaluate responsiveness** — Test across breakpoints (mobile, tablet, desktop)
6. **Document findings** — Create actionable bug reports with reproduction steps

---

## 🧪 Test Strategy

| Test Type | Tools | Coverage | Notes |
|-----------|-------|----------|-------|
| **Automated Clickability** | Playwright | 100% of pages | Scripted interaction tests |
| **Manual User Flows** | Browser DevTools | Critical paths | Exploratory testing |
| **Accessibility Audit** | axe-core, keyboard | 20% sample | WCAG 2.1 AA compliance |
| **Responsiveness Check** | Chrome DevTools | 3 breakpoints | Mobile (375px), Tablet (768px), Desktop (1280px) |
| **Error Handling** | Manual + Console | All forms | Invalid inputs, API failures |
| **Performance** | Lighthouse | Critical pages | Load times, interactivity |

---

## 📋 Test Matrix

### 🔗 Pages to Test (39 Total)

| Category | Pages | Test Focus |
|----------|-------|------------|
| **Authentication** | Login, Sign Up, Forgot Password, Reset Password | Form validation, error handling, session management |
| **Core Dashboard** | Dashboard, Landing, Awaiting Approval | Navigation, data display, empty states |
| **School Setup** | School Profile, Setup (Teachers, Subjects, Classes, Rooms), Periods, Levels, Academic Years | CRUD operations, validation, data integrity |
| **Scheduling** | Timetable, My Timetable, Requirements, Constraints, Generate, Copilot, Analytics, Versions | Complex UI interactions, drag-and-drop, solver integration |
| **Student Management** | Students, Attendance, Examinations | Data tables, filtering, pagination |
| **Finance** | Finance, Payment Inbox, Treasury | Payment processing, reconciliation, reporting |
| **Platform Admin** | Platform Dashboard, Schools, School Detail, Requests, Admins, Audit | Admin controls, access management, audit logging |
| **Utilities** | Profile, AI Providers, OCR Scan, Reports | Configuration, integrations |

---

## 🚀 Test Execution Plan

### Phase 1: Automated Clickability Scan (Playwright)

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 2,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'Desktop Chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],
})

// tests/clickability.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Clickability Audit', () => {
  const pages = [
    '/', '/login', '/signup', '/forgot-password', '/reset-password',
    '/timetable', '/my-timetable', '/setup/periods', '/setup/teachers',
    '/setup/subjects', '/setup/classes', '/setup/rooms', '/setup/school',
    '/setup/academic-years', '/setup/levels', '/scheduling/requirements',
    '/scheduling/constraints', '/scheduling/generate', '/scheduling/copilot',
    '/scheduling/analytics', '/versions', '/students', '/attendance',
    '/examinations', '/finance', '/finance/payment-inbox', '/finance/treasury',
    '/ocr', '/analytics', '/profile', '/settings/ai-providers',
    '/platform', '/platform/schools', '/platform/schools/detail',
    '/platform/requests', '/platform/admins', '/platform/audit'
  ]

  for (const path of pages) {
    test(`Page ${path} should load and have no broken interactive elements`, async ({ page }) => {
      await page.goto(path)
      await expect(page).toHaveTitle(/Phikila/)

      // Check for console errors
      page.on('console', msg => {
        if (msg.type() === 'error') {
          throw new Error(`Console error on ${path}: ${msg.text()}`)
        }
      })

      // Test all buttons
      const buttons = await page.locator('button, [role="button"]').all()
      for (const button of buttons) {
        await button.scrollIntoViewIfNeeded()
        await button.click({ force: true, timeout: 5000 })
        await page.waitForLoadState('networkidle')
      }

      // Test all links
      const links = await page.locator('a[href]').all()
      for (const link of links) {
        const href = await link.getAttribute('href')
        if (href && !href.startsWith('http') && !href.startsWith('mailto:')) {
          await link.scrollIntoViewIfNeeded()
          await link.click({ force: true, timeout: 5000 })
          await page.waitForLoadState('networkidle')
          await page.goBack()
        }
      }

      // Test all form inputs
      const inputs = await page.locator('input, select, textarea').all()
      for (const input of inputs) {
        await input.scrollIntoViewIfNeeded()
        await input.fill('test')
        await input.blur()
      }
    })
  }
})
```

### Phase 2: Manual User Flow Testing

| Flow | Steps | Expected Outcome | Notes |
|------|-------|------------------|-------|
| **Login Flow** | 1. Navigate to /login
2. Enter valid credentials
3. Submit form
4. Verify redirect to dashboard | Successful login, session established | Test with invalid credentials, expired session |
| **Student Enrollment** | 1. Navigate to /students
2. Click "Add Student"
3. Fill form
4. Submit
5. Verify student appears in list | Student created, guardians linked | Test validation, duplicate detection |
| **Payment Processing** | 1. Navigate to /finance/payment-inbox
2. Select payment
3. Match to student
4. Post payment
5. Verify receipt | Payment posted, invoice updated | Test reconciliation, error handling |
| **Timetable Generation** | 1. Navigate to /scheduling/requirements
2. Set requirements
3. Navigate to /scheduling/generate
4. Start solver
5. Verify timetable | Timetable generated, conflicts resolved | Test solver failure, quality metrics |
| **Platform Admin** | 1. Navigate to /platform/requests
2. Approve access request
3. Verify user has access | User granted access, audit log updated | Test RBAC, error handling |

### Phase 3: Accessibility Audit

```typescript
// tests/accessibility.spec.ts
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('Accessibility Audit', () => {
  const samplePages = [
    '/', '/login', '/students', '/finance', '/timetable', '/platform'
  ]

  for (const path of samplePages) {
    test(`Page ${path} should have no accessibility violations`, async ({ page }) => {
      await page.goto(path)
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      expect(accessibilityScanResults.violations).toEqual([])
    })
  }
})

// Manual checks:
- Keyboard navigation (Tab, Shift+Tab, Enter, Space)
- Screen reader compatibility (VoiceOver, NVDA)
- Color contrast (WCAG 2.1 AA)
- Focus management
- ARIA attributes
```

### Phase 4: Responsiveness Testing

```typescript
// tests/responsiveness.spec.ts
import { test, expect, devices } from '@playwright/test'

test.describe('Responsiveness Audit', () => {
  const breakpoints = [
    { name: 'Mobile', ...devices['Pixel 5'] },
    { name: 'Tablet', viewport: { width: 768, height: 1024 } },
    { name: 'Desktop', viewport: { width: 1280, height: 800 } }
  ]

  const pages = ['/', '/students', '/finance', '/timetable']

  for (const path of pages) {
    for (const { name, viewport } of breakpoints) {
      test(`Page ${path} should render correctly on ${name}`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await page.goto(path)

        // Check for horizontal overflow
        const overflow = await page.evaluate(() => {
          return document.body.scrollWidth > document.documentElement.clientWidth
        })
        expect(overflow).toBe(false)

        // Check for layout shifts
        const layoutShifts = await page.evaluate(() => {
          return window.layoutShiftScore || 0
        })
        expect(layoutShifts).toBeLessThan(0.1)

        // Take screenshot for visual regression
        expect(await page.screenshot()).toMatchSnapshot(`${path.replace(/\//g, '_')}-${name}.png`)
      })
    }
  }
})
```

### Phase 5: Error Handling Audit

```typescript
// tests/error-handling.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Error Handling Audit', () => {
  test('Form validation should show helpful error messages', async ({ page }) => {
    await page.goto('/students')
    await page.click('button:has-text("Add Student")')
    await page.click('button:has-text("Save")')

    // Verify validation messages
    const errors = await page.locator('.text-red-500').all()
    expect(errors.length).toBeGreaterThan(0)
    for (const error of errors) {
      const text = await error.textContent()
      expect(text).toMatch(/required|invalid/i)
    }
  })

  test('API errors should show user-friendly messages', async ({ page }) => {
    // Mock API failure
    await page.route('/api/v1/students', route => route.abort())
    await page.goto('/students')

    // Verify error message
    const toast = await page.locator('.toast-error')
    await expect(toast).toContainText('We could not load students')
  })

  test('404 page should be helpful', async ({ page }) => {
    await page.goto('/non-existent-page')
    await expect(page).toHaveTitle(/Not Found/)
    await expect(page.locator('h1')).toContainText('Page not found')
    await expect(page.locator('a:has-text("Go to Dashboard")')).toBeVisible()
  })
})
```

---

## 📊 Reporting

### Bug Report Template

```markdown
### 🐛 [Severity] Page: [Page Name] - [Issue Title]

**Description:**
[Clear description of the issue]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Screenshots/Videos:**
[Attachments]

**Environment:**
- OS: [Windows/macOS/Linux]
- Browser: [Chrome/Firefox/Safari]
- Viewport: [375px/768px/1280px]

**Severity:**
- [ ] Critical (Blocks user, data loss, security)
- [ ] High (Major functionality broken)
- [ ] Medium (Minor functionality broken)
- [ ] Low (Cosmetic, minor UX)

**Priority:**
- [ ] P0 (Fix immediately)
- [ ] P1 (Fix in next sprint)
- [ ] P2 (Fix when possible)

**Additional Context:**
[Any relevant console errors, network requests, etc.]
```

### Dashboard

```typescript
// src/lib/auditDashboard.ts
type AuditFinding = {
  id: string
  page: string
  path: string
  category: 'Clickability' | 'User Flow' | 'Accessibility' | 'Responsiveness' | 'Error Handling'
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  priority: 'P0' | 'P1' | 'P2'
  title: string
  description: string
  steps: string[]
  expected: string
  actual: string
  environment: {
    os: string
    browser: string
    viewport: string
  }
  status: 'Open' | 'In Progress' | 'Fixed' | 'Won\'t Fix'
  createdAt: string
  updatedAt: string
  screenshots: string[]
}

// Sample data structure for audit dashboard
const auditFindings: AuditFinding[] = []
```

---

## 🛠️ Tools & Setup

### Required Tools

| Tool | Purpose | Installation |
|------|---------|--------------|
| **Playwright** | Automated testing | `npm install -D @playwright/test` |
| **axe-core** | Accessibility testing | `npm install -D @axe-core/playwright` |
| **Lighthouse** | Performance testing | Built into Chrome DevTools |
| **React Testing Library** | Component testing | `npm install -D @testing-library/react` |
| **Vitest** | Unit testing | `npm install -D vitest` |
| **MSW** | API mocking | `npm install -D msw` |

### Setup Instructions

```bash
# Install dependencies
cd frontend
npm install -D @playwright/test @axe-core/playwright
npx playwright install

# Run tests
npx playwright test --project="Desktop Chrome"
npx playwright test --project="Mobile Chrome"

# Generate report
npx playwright show-report
```

---

## 📅 Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Setup & Planning** | 1 week | Test plan, test scripts, environment setup |
| **Automated Testing** | 2 weeks | Clickability report, accessibility report, responsiveness report |
| **Manual Testing** | 3 weeks | User flow reports, bug reports, UX feedback |
| **Analysis & Reporting** | 1 week | Consolidated audit report, prioritized backlog, recommendations |
| **Total** | **7 weeks** | Comprehensive UI/UX audit |

---

## 🎯 Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Clickability Pass Rate** | 95% | Playwright test results |
| **Critical Bugs** | 0 | Bug tracker |
| **High Severity Bugs** | < 5 | Bug tracker |
| **Accessibility Violations** | 0 (WCAG 2.1 AA) | axe-core results |
| **Responsiveness Issues** | < 3 per page | Visual regression tests |
| **User Flow Completion** | 100% | Manual test results |
| **Error Handling Coverage** | 90% | Error scenario tests |

---

## 🏁 Next Steps

1. **Set up test environment** — Install Playwright, axe-core, etc.
2. **Develop test scripts** — Automated clickability, accessibility, responsiveness
3. **Execute automated tests** — Run against staging environment
4. **Conduct manual testing** — Exploratory testing of critical flows
5. **Document findings** — Create bug reports, prioritize issues
6. **Present recommendations** — Consolidated report with actionable insights

**Prepared by:** Phikila UX Audit Team
**Date:** 2026-08-18