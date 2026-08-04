# Claude Code Master Prompt — MMPraise Administration Platform Upgrade

Read the accompanying file:

`MMPRAISE_ADMIN_AUDIT_README.md`

Treat that document as the product and UX specification for this task.

## Your role

Act as a multidisciplinary senior team:

- Principal Product Designer
- Principal Full-Stack Engineer
- Senior Frontend Engineer
- Senior Backend Engineer
- Database Architect
- Data Migration Engineer
- Email Deliverability Engineer
- Cybersecurity Engineer
- Accessibility Specialist
- QA Automation Engineer
- shadcn/ui Design System Engineer
- GSAP Motion Designer

## Objective

Upgrade the complete MMPraise administration platform into a scalable operational system.

Do not perform a cosmetic-only redesign.

Implement the information architecture, workflows, permissions, security controls, data structures, states, and UI improvements described in the audit README.

Preserve working functionality unless the specification explicitly replaces it.

Do not stop after producing recommendations. Implement the work directly.

---

## Confirmed event configuration

Use one shared source of truth:

- Event: Marathon Messiah’s Praise
- Edition: 85 Hours Marathon Messiah’s Praise
- Year: 2027
- Duration: 85 hours
- Start: Monday, 1 March 2027 at 2:00 AM WAT
- Timezone: Africa/Lagos
- ISO timestamp: `2027-03-01T02:00:00+01:00`
- Venue: RCCG Prayer Foyer, New Arena, Redemption City, Nigeria

Update active current-edition content and new registration identifiers accordingly.

Do not alter legitimate historical references or historical identifiers.

---

## First phase: inspect before changing code

Inspect:

- Framework
- Routing
- Layouts
- Data fetching
- Database schema
- Authentication
- Password reset
- Roles and permissions
- Email provider
- Background queues
- Existing tests
- Audit logging
- CSV utilities
- shadcn/ui setup
- GSAP setup
- Event settings
- Shared components
- Public website integration
- Volunteer dashboard integration

Produce a concise implementation plan, then implement it.

Do not introduce duplicate systems.

---

## Required admin information architecture

Implement a responsive admin shell with grouped navigation:

### Overview
- Dashboard

### Applications
- Applicants
- Review Queue

### People
- Current Volunteers
- Previous Participants
- Administrators

### Communications
- Messages
- Announcements
- Email Delivery

### Content
- Testimonies

### Configuration
- Departments and Questions
- Settings

### Activity and Security
- Activity Log
- Security and Compliance

Remove `Reference Data` as a top-level module.

Move RCCG structure management under:

`Settings → Registration Configuration → RCCG Structure`

Use the freed top-level area for:

`Previous Participants`

Use a collapsible desktop sidebar and an accessible mobile Sheet.

Enforce visibility based on server-side permissions.

---

## Overview dashboard

Build an operational dashboard containing:

- Event status and compact countdown
- Registration state
- Application lifecycle metrics
- Migration metrics
- Communication metrics
- Testimony moderation metrics
- Needs Attention queue
- Recent Activity
- Volunteer distribution by department
- Country and region distribution
- Age distribution
- Application trends
- Migration activation progress
- Quick actions

Do not use department capacity limits.

There is no fixed maximum number of volunteers per department.

Show department distribution only.

Every actionable metric should link to a filtered management view.

---

## Applicants

Upgrade `/admin/applications`.

Preserve:

- CSV export
- Excel export
- Search
- Status filter
- Department filter
- Country filter
- RCCG region filter
- Age-range filter
- Pagination

Add:

- Reusable data table
- Saved views
- URL-persisted filters
- Reviewer assignment
- Bulk actions
- Column visibility
- Application completion
- Review ageing
- Note counts
- Detail drawer
- Full details page
- Status history
- Documents
- Permission-controlled health information
- Export confirmation
- Export audit logging

New 2027 registrations must use the active-year identifier format.

Do not rewrite historical IDs.

---

## Testimonies

Replace the long card list with an efficient moderation queue.

Add:

- Data table or queue
- Detail drawer
- Search
- Filters
- Sorting
- Pagination
- Moderator assignment
- Internal note timeline
- Public preview
- Duplicate detection
- Spam controls
- Test-data separation
- Bulk actions
- Categories and tags
- Featured testimony controls
- Moderation history
- Permission-controlled contact details
- Confirmation dialogs

Approved content must remain unpublished until approval succeeds.

---

## Messages

Transform messages into a lightweight helpdesk.

Implement:

- Inbox-style split layout
- Search
- Filters
- Pagination
- Read/unread
- Status
- Category
- Priority
- Assignment
- Tags
- Internal notes
- Activity timeline
- Duplicate grouping
- Spam handling
- Bulk actions
- Contact profile
- Related volunteer account
- Related application
- Response templates
- Integrated reply where supported
- `mailto:` fallback
- SLA/age indicators
- Analytics
- Test-data separation

---

## Announcements

Build a communication management module.

Implement:

- Announcement list
- Editor
- Preview
- Draft
- Scheduled
- Published
- Expired
- Archived
- Priority
- Publish now
- Schedule
- Expiry
- Dashboard notification
- Banner
- Email
- Test email
- Audience filters
- Multiple departments
- Application status targeting
- Country and RCCG region targeting
- Attachments
- Templates
- Clone
- Version history
- Delivery statistics
- Failed email handling
- Created-by and modified-by history

Use current event configuration dynamically.

---

## Departments and questions

Preserve conditional department-specific questions and safe retirement.

Add:

- Department active/inactive
- Department descriptions
- Question builder
- Drag-and-drop ordering
- Conditional logic builder
- Validation rules
- Draft and publish
- Preview
- Version history
- Copy and duplicate
- Import/export question sets
- Answer analytics
- More field types

Do not add:

- Capacity limits
- Full-department states
- Automatic department closure
- Capacity-based application blocking

There is no fixed volunteer limit per department.

---

## Previous Participants

Create the previous-edition migration module.

Implement:

- Batch list
- CSV upload wizard
- Source edition
- Column mapping
- Validation
- Preview
- Duplicate detection
- Existing-account matching
- Conflict resolution
- Background import
- Idempotency
- Progress tracking
- Result reports
- Failed-row downloads
- Invitation queue
- Delivery tracking
- Activation tracking
- Profile-review tracking
- Batch details
- Retry controls
- Audit history

Security rules:

- Never import passwords.
- Never generate a shared password.
- Never email passwords.
- Match primarily by normalised email.
- Do not overwrite verified current data silently.
- Store historical participation separately.
- Do not create a submitted 2027 application automatically.
- Prevent CSV formula injection.
- Store uploads privately.
- Delete temporary files according to retention policy.
- Use queues and idempotency.

Migrated-user flow:

1. Invitation email.
2. User opens login page.
3. User selects Forgot Password.
4. User sets a secure password.
5. User signs in.
6. User reviews and updates profile.
7. User completes current-edition registration separately.

Use generic password-reset responses to prevent account enumeration.

---

## Administrators and permissions

Preserve default roles:

- Registration Administrator
- Department Head
- Reviewer
- Medical Information Officer
- Communication Officer
- Super Administrator

Add:

- Administrator table
- Search
- Filters
- Active/disabled state
- Last login
- Assigned roles
- Department scopes
- Role descriptions
- Permission matrix
- Granular permissions
- Role assignment history
- Temporary access suspension
- Confirmation for sensitive changes
- Super-admin safeguards
- Audit history

Enforce permissions on the server.

Medical information must remain restricted.

---

## Settings

Convert Settings into a structured configuration centre.

Sections:

- General
- Event
- Registration
- Volunteer Configuration
- Communications
- RCCG Structure
- Migration
- Security
- Integrations

The Event section must be the shared source of truth for:

- Edition
- Year
- Duration
- Start date and time
- End time
- Timezone
- Venue
- Registration state
- Countdown
- Livestream
- Event status

Replace free-text date lines with appropriate date/time controls.

Add validation, preview, change history, and before/after audit records.

---

## Activity Log and Security Audit

Rename the top-level module to:

`Activity Log`

Inside it provide:

- All Activity
- Security and Compliance
- System Events

Convert technical event codes into human-readable labels.

Add:

- Search
- Actor filter
- Role filter
- Module filter
- Action category
- Entity type
- Result
- Date range
- Security-only filter
- Test-data filter
- Pagination
- Permission-controlled export
- Detail drawer
- Related-record links
- Raw technical details disclosure
- Retention controls

Keep sensitive security events in a restricted view.

---

## Shared design system

Use shadcn/ui appropriately:

- Sidebar
- Sheet
- Breadcrumb
- Card
- Badge
- Button
- Input
- Select
- Tabs
- Data Table
- Dropdown Menu
- Dialog
- Alert Dialog
- Drawer
- Tooltip
- Progress
- Skeleton
- Alert
- Calendar
- Date Picker
- Separator

Admin visual direction:

- Operational
- Compact
- Clear
- Accessible
- Consistent
- Responsive

Avoid:

- Excessive gradients
- Glassmorphism
- Oversized marketing typography
- Decorative clutter
- Continuous animation

Use GSAP only for restrained polish:

- Dashboard reveal
- Sidebar transition
- Wizard transitions
- Success confirmation
- Progress animation

Respect `prefers-reduced-motion`.

---

## States

Implement complete states for:

- Loading
- Empty
- Error
- Partial success
- Success
- Permission denied
- Queue unavailable
- Network failure
- Import validation failure
- Email failure
- No records
- No search matches

Every error should explain:

- What happened
- Whether data was saved
- What action is available next

---

## Accessibility

Meet WCAG 2.2.

Ensure:

- Keyboard navigation
- Visible focus
- Semantic headings
- Accessible tables
- Labels
- Error summaries
- ARIA live regions for progress
- Non-colour status indicators
- Touch-friendly controls
- Accessible dialogs and drawers
- Reduced-motion support

Test major breakpoints from 320px through 1920px.

---

## Security

Implement:

- Server-side authorisation
- CSRF protection where relevant
- Rate limiting
- Export permission controls
- Export auditing
- Medical-access auditing
- Secure CSV storage
- CSV injection prevention
- Queue idempotency
- Generic password-reset responses
- Safe bulk actions
- Confirmation for destructive actions
- Minimal sensitive-data exposure
- Configurable retention

---

## Tests

Add and run tests for:

- Application filtering and review
- Export permissions
- Testimony moderation
- Message assignment and resolution
- Announcement scheduling and delivery
- Department question publishing
- Role and permission enforcement
- Settings validation
- Event configuration
- Previous-participant import
- Duplicate matching
- Invitation delivery
- Password reset
- Profile review
- Activity logging
- Security audit
- Mobile navigation
- Keyboard accessibility

Run:

- Database migrations
- Lint
- Type checking
- Unit tests
- Integration tests
- End-to-end tests
- Production build

Fix all introduced errors before completion.

---

## Required implementation order

1. Inspect architecture.
2. Read the audit README.
3. Produce implementation plan.
4. Build shared admin shell.
5. Implement permissions foundation.
6. Upgrade overview.
7. Upgrade applicants.
8. Upgrade testimonies.
9. Upgrade messages.
10. Upgrade announcements.
11. Upgrade departments and questions.
12. Move RCCG reference data into settings.
13. Implement Previous Participants.
14. Upgrade administrators.
15. Upgrade settings.
16. Upgrade Activity Log and Security Audit.
17. Add responsive and accessibility refinements.
18. Add tests.
19. Run migrations, lint, type checks, tests, and build.
20. Fix all errors.
21. Provide final report.

---

## Final report

Provide:

1. Existing issues found
2. Information architecture changes
3. Database changes
4. Permissions
5. Page-by-page implementation
6. Migration workflow
7. Email workflow
8. Security controls
9. shadcn components
10. GSAP usage
11. Accessibility work
12. Responsive work
13. Files created
14. Files modified
15. Test results
16. Remaining organisational decisions

Do not claim completion if any critical flow, migration, test, lint check, type check, or production build fails.
