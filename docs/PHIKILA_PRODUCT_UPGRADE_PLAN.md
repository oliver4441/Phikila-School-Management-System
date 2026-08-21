# Phikila School Management System — Product Upgrade Plan

## Purpose

This document defines the product direction for upgrading Phikila from a collection of school-management modules into a coherent, operational school-management SaaS platform.

The central principle is:

> **Every major dashboard is a registry + workflow + analytics surface.**

Phikila must not become a read-only reporting system. Authorized users must be able to enter, record, edit, approve, publish, and act on the underlying school data directly from the relevant module.

---

## 1. Product principles

### 1.1 Dashboard = action + registry + intelligence

A dashboard should answer four questions:

1. **What is happening?** — KPIs and trends.
2. **What data exists?** — searchable registry.
3. **What needs to be entered or changed?** — data-entry workflows.
4. **What should I do next?** — alerts and actionable tasks.

### 1.2 Do not separate data entry from analytics unnecessarily

Users should not have to leave a dashboard to perform the action that the dashboard is describing.

Examples:

- Finance shows balances and allows payment recording.
- Attendance shows attendance statistics and allows teachers to mark attendance.
- Students shows enrollment metrics and allows authorized staff to add/edit students.
- Examinations shows performance and allows authorized staff to enter/import marks.
- Timetable shows scheduling health and allows authorized users to resolve conflicts or generate a timetable.

### 1.3 Role-aware experiences

Different roles should see different priorities and actions.

- **Super Admin:** platform operations, schools, onboarding, access, billing and platform health.
- **Principal/School Administrator:** whole-school operations and management.
- **Finance Officer:** payments, balances, fee structures, receipts and financial reconciliation.
- **Teacher:** today's classes, attendance, marks and teaching workload.
- **Student:** timetable, attendance, results, fees and announcements.
- **Parent/Guardian:** child attendance, results, fees and school communication.

---

# 2. School dashboard redesign

The school dashboard should become the operational command centre rather than a collection of counts.

## Executive header

Display:

- School name
- Current academic year
- Current term
- School status
- User/role context

## Needs Attention

Make this the highest-priority component.

Examples:

- Students absent today
- Outstanding fee balances
- Timetable conflicts
- Unassigned lessons
- Pending admissions
- Results awaiting approval
- Teachers without schedules
- Pending administrative approvals

Each item should link directly to the action that resolves it.

## Executive KPIs

Potential metrics:

- Total students
- Teachers
- Attendance today
- Fee collection rate
- Outstanding fees
- Academic performance
- Timetable completion

## Quick Actions

Provide direct entry points:

- Add student
- Add teacher
- Take attendance
- Record payment
- Enter results
- Create announcement
- Generate timetable

---

# 3. Finance: registry first, analytics second

Finance is both a financial dashboard and the school's financial registry.

## Finance overview

Show:

- Expected fees
- Collected fees
- Outstanding balance
- Collection rate
- Recent payments
- Overdue accounts
- Payment trends

## Payment registry

Provide a searchable, filterable registry containing at minimum:

- Student
- Admission number
- Class
- Amount due
- Amount paid
- Balance
- Payment status
- Last payment
- Action

## Record Payment workflow

A prominent **Record Payment** action should allow an authorized user to:

1. Search/select a student.
2. View current balance and outstanding charges.
3. Enter payment amount.
4. Select payment method.
5. Enter transaction/reference number.
6. Enter payment date.
7. Record receiving account/person where applicable.
8. Add notes.
9. Save the transaction.

Supported payment methods should be extensible and may include:

- M-Pesa
- Bank
- Cash
- Cheque
- Card
- Other

On successful recording, the system should:

- Create the transaction.
- Allocate it against outstanding charges.
- Update the student's balance.
- Update school-level financial totals.
- Generate a unique receipt number.
- Make the receipt available for printing/download.
- Create an audit event.

## Other finance workflows

The finance module should eventually support:

- Fee structures
- Fee charges
- Payment allocation
- Receipts
- Reversals/refunds with permissions
- Payment inbox/reconciliation
- Expenses
- Procurement
- Budgets
- Financial reports
- Audit trail

---

# 4. Attendance: teacher-first data entry

Attendance must be an operational workflow, not merely a statistic.

A teacher should be able to open a class and immediately see the student register for the relevant lesson/day.

Each student should have simple status controls such as:

- Present
- Absent
- Late
- Excused

The teacher saves the register directly from the page.

The same data should power:

- Daily attendance
- Class attendance
- Student attendance history
- Teacher attendance where applicable
- Attendance trends
- Chronic absenteeism alerts
- Parent notifications

---

# 5. Students registry

The student module should combine a registry with operational workflows.

## Add/Edit Student

Capture relevant school information such as:

- Student identity
- Admission number
- Class/level
- Enrollment status
- Guardian/parent
- Contact details
- Emergency information
- Documents
- Fee status
- Attendance history
- Academic history

The registry should support search, filtering, bulk actions and import/export where appropriate.

---

# 6. Teachers registry

The teacher module should support:

- Add/edit teacher
- Employee number
- Contact information
- Subjects
- Classes
- Availability
- Timetable
- Attendance
- Qualifications
- Employment status
- Assignments

Teacher data should feed scheduling, attendance, examinations and reporting.

---

# 7. Classes and academic structure

Authorized administrators should be able to create and maintain:

- Academic years
- Terms
- Levels
- Classes
- Subjects
- Rooms
- Class teachers
- Student assignments
- Subject assignments

These records should be connected rather than isolated setup screens.

---

# 8. Examinations and results

Examinations should support an end-to-end workflow:

1. Create examination.
2. Select classes/subjects.
3. Assign responsible teachers.
4. Enter or import marks.
5. Validate marks.
6. Calculate results.
7. Review anomalies.
8. Approve.
9. Publish.
10. Generate reports.

The dashboard should surface:

- Average performance
- Mean grade
- Grade distribution
- Top-performing classes
- Subjects declining in performance
- Students requiring intervention
- Results awaiting approval

---

# 9. Timetable as an intelligent operational subsystem

The existing scheduling functionality should remain a core differentiator.

The timetable area should combine:

- Requirements
- Constraints
- Generation
- Conflict detection
- Conflict resolution
- Quality scoring
- Versions
- Publishing
- Analytics
- Copilot assistance

The dashboard should summarize timetable health in one place.

Example:

- 482/500 lessons scheduled
- 4 hard conflicts
- 11 soft conflicts
- 7 unassigned lessons
- Current version: v12
- Status: Draft

Actions:

- Resolve conflicts
- Generate timetable
- Review version
- Publish

---

# 10. Super Admin / platform control plane

The existing platform layer should evolve into a SaaS control plane.

## Platform dashboard

Track:

- Total schools
- Active schools
- Pending onboarding
- Suspended schools
- Total users
- Pending access requests
- Platform administrators
- Platform health
- Recent platform activity

## School lifecycle

Represent every tenant through a defined lifecycle:

```text
Lead / Signup
      ↓
Payment
      ↓
Provisioning
      ↓
Onboarding
      ↓
Active
      ↓
Renewal
      ↓
Suspended / Cancelled
```

The super admin should be able to see exactly where a school is in this lifecycle.

---

# 11. Automated onboarding

After successful payment, the platform should be able to automatically:

- Create/provision the school tenant.
- Create the school administrator.
- Configure roles and permissions.
- Create the academic year/term defaults.
- Create default levels where appropriate.
- Configure storage.
- Create required school settings.
- Send the welcome message.

The school administrator should then enter an onboarding wizard:

1. School information
2. Academic structure
3. Teachers
4. Classes
5. Subjects
6. Students
7. Fees
8. Attendance
9. Timetable
10. Launch

Onboarding progress should be visible to both the school administrator and super admin.

---

# 12. Navigation architecture

Avoid a flat sidebar containing every feature.

Recommended grouping:

### HOME
- Dashboard
- Notifications
- Tasks

### SCHOOL
- Students
- Teachers
- Classes
- Parents/Guardians
- Admissions

### ACADEMICS
- Subjects
- Curriculum
- Examinations
- Results
- Reports

### ATTENDANCE
- Today's attendance
- Attendance records
- Reports

### FINANCE
- Overview
- Payments
- Fees
- Balances
- Expenses
- Reports

### TIMETABLE
- Timetable
- Requirements
- Constraints
- Generate
- Versions
- Analytics

### COMMUNICATION
- Announcements
- Email
- SMS/notifications

### ADMINISTRATION
- School profile
- Academic year
- Users
- Roles and permissions
- Settings

### AI
- Copilot
- OCR
- AI providers

Navigation should be role-aware so users only see relevant areas.

---

# 13. Contextual AI

AI should be integrated into workflows instead of existing only as a separate feature.

Examples:

- "Why did attendance drop this week?"
- "Which students have chronic absence?"
- "Why are fee collections below target?"
- "Which classes are underperforming?"
- "Generate a timetable that minimizes teacher gaps."
- "Summarize this school's performance this term."

AI responses must respect user permissions and should be based on the school's authorized data.

---

# 14. Permissions and auditability

Because dashboards will write real school data, every mutation must be permission-controlled.

Examples:

| Action | Super Admin | Principal | Finance | Teacher |
|---|---:|---:|---:|---:|
| Add student | Yes | Yes | No | No |
| Record payment | Yes | Yes | Yes | No |
| Take attendance | Yes | Yes | No | Yes |
| Enter marks | Yes | Yes | No | Yes |
| Publish results | Yes | Yes | No | No |
| Edit fee structure | Yes | Yes | Yes | No |
| Generate timetable | Yes | Yes | No | No |

Sensitive operations should generate audit events containing the actor, action, target, timestamp and relevant metadata.

---

# 15. Implementation roadmap

## Phase 1 — UX foundation

- Redesign AppShell/navigation.
- Establish design tokens and component hierarchy.
- Improve responsive/mobile layouts.
- Add notifications/tasks surfaces.
- Add global search/command access where useful.
- Preserve existing backend and working functionality.

## Phase 2 — Operational school dashboard

Build:

- Needs Attention
- KPI overview
- Quick Actions
- Attendance summary
- Finance summary
- Student summary
- Academic summary
- Timetable health
- Recent activity

Every summary should link to the corresponding registry/workflow.

## Phase 3 — Registry/workflow upgrades

Prioritize:

1. Students
2. Teachers
3. Attendance
4. Finance/payments
5. Examinations/results
6. Classes/subjects

Each module should support create/edit/search/filter and appropriate bulk workflows.

## Phase 4 — Timetable intelligence

Polish scheduling generation, conflict resolution, quality, versions, publishing and analytics.

## Phase 5 — SaaS control plane

Upgrade:

- Super Admin dashboard
- School lifecycle
- Tenant management
- Access requests
- Administrator management
- Audit logs
- Platform health
- Billing/subscription state
- Automated onboarding

## Phase 6 — Automation and contextual AI

Automate:

```text
Payment
  → Provisioning
  → Onboarding
  → Activation
  → Monitoring
  → Renewal
  → Suspension when necessary
```

Then integrate contextual AI into the operational workflows.

---

# 16. Product success criteria

The upgrade is successful when:

- A school administrator can understand the school's state in seconds.
- A teacher can complete attendance without navigating through unnecessary screens.
- A finance officer can find a student, record a payment and issue a receipt from the finance registry.
- An administrator can add/edit school records directly from the relevant module.
- Management dashboards are derived from the same source-of-truth registries used for data entry.
- Every sensitive write is permission-controlled and auditable.
- Super Admin can understand and manage the lifecycle of every school.
- New schools can move from payment to usable application with minimal manual intervention.
- Mobile users can complete the most common operational tasks quickly.

---

## Core design rule

> **Do not build dashboards that merely tell users what happened. Build dashboards that let authorized users record what is happening, act on it, and immediately see the resulting intelligence.**
