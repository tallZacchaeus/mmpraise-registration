# MMPraise Admin Platform — Product Audit and Upgrade Specification

## 1. Purpose

This document records the product, UI/UX, security, data-management, and workflow findings from the review of the MMPraise administration platform.

It should be read before implementing the accompanying Claude Code master prompt.

The objective is to transform the current administration area from a collection of basic CRUD pages into a scalable operational platform for managing:

- Volunteer applications
- Previous-edition participants
- Testimonies
- Contact messages
- Announcements
- Departments and department-specific questions
- Administrators, roles, and permissions
- Event and registration configuration
- Activity, security, and compliance records

The public website, volunteer portal, authentication pages, and administration platform must share one design system and one source of truth for the current event.

---

## 2. Confirmed Current Event

The current event configuration is:

- Event: Marathon Messiah’s Praise
- Edition: 85 Hours Marathon Messiah’s Praise
- Year: 2027
- Duration: 85 hours
- Start: Monday, 1 March 2027 at 2:00 AM WAT
- Timezone: Africa/Lagos
- ISO timestamp: `2027-03-01T02:00:00+01:00`
- Venue: RCCG Prayer Foyer, New Arena, Redemption City, Nigeria

All active pages, emails, dashboards, metadata, registration identifiers, and reports must use the same shared event configuration.

Legitimate historical references to previous editions must remain unchanged.

---

## 3. Global Admin Findings

### Current strengths

- The platform already has clear modules.
- Application exports are available in CSV and Excel.
- Role-based administration exists.
- Sensitive medical information has a dedicated role.
- Testimonies require moderation before publication.
- Messages have basic lifecycle states.
- Announcements support audience targeting and optional email delivery.
- Department-specific questions support conditional display.
- Questions with existing answers are retired instead of destructively deleted.
- Security-relevant actions are recorded.

### Main weaknesses

- Navigation is a flat horizontal list and will not scale.
- Most pages use long card lists rather than efficient operational tables or split views.
- Search, filters, sorting, assignment, bulk actions, and pagination are inconsistent.
- Test and automated data are mixed with real operational records.
- Admin pages display technical values and raw JSON without human-readable summaries.
- The overview reports totals but does not clearly show what requires action.
- The platform has outdated `2026` registration identifiers and past edition references.
- Reference Data occupies a top-level navigation slot despite being low-frequency configuration.
- Previous-edition participant migration is not yet a first-class workflow.
- Settings are too limited to serve as the platform’s source of truth.
- The audit log is technically useful but not suitable as a daily operational Activity Log.
- Department capacity must not be enforced because there is no fixed volunteer limit per department.

---

## 4. Recommended Admin Information Architecture

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
  - General
  - Event
  - Registration
  - Volunteer Configuration
  - Communications
  - RCCG Structure
  - Security
  - Integrations

### Activity and Security
- Activity Log
- Security and Compliance

The existing top-level **Reference Data** navigation item should be removed.

RCCG regions, provinces, and parishes should move to:

`Settings → Registration Configuration → RCCG Structure`

The freed top-level position should be used for:

`Previous Participants`

---

## 5. Admin Overview

### Current state

The overview currently shows:

- Total applications
- Submitted this week
- Awaiting review
- Approved
- Status distribution
- Department distribution
- Countries
- Age ranges

### Required upgrade

The overview should become an operational command centre.

It should contain:

#### Event status
- Current edition
- Start date and time
- Compact countdown
- Registration status
- Volunteer application status

#### Executive metrics
- Total applications
- Draft applications
- Submitted applications
- Under review
- Approved
- Waitlisted
- Rejected
- Assigned
- Checked in
- Completed
- Previous participants imported
- Previous participants activated
- Profiles reviewed
- New messages
- Pending testimonies
- Failed emails

#### Needs attention
- Applications awaiting review
- Failed imports
- Duplicate migration rows
- Failed invitations
- Unassigned messages
- Pending testimony moderation
- Incomplete migrated profiles
- Security warnings

#### Operational activity
- Recent registrations
- Review decisions
- Announcement publication
- Import activity
- Email delivery failures
- Role changes
- Settings changes

#### Analytics
- Applications over time
- Application lifecycle distribution
- Volunteer distribution by department
- Country and region distribution
- Age distribution
- Profile completion
- Migration activation progress

Do not implement department capacity progress bars or limits. Show distribution only.

---

## 6. Applicants Page

### Current route

`/admin/applications`

### Current capabilities

- 98 matching applications during review
- CSV export
- Excel export
- Search
- Status filter
- Department filter
- Country filter
- RCCG region filter
- Age-range filter
- Paginated table

### Current columns

- Volunteer
- Registration ID
- Department
- Location
- Age
- Submitted
- Status

### Issues

- Registration IDs use outdated `MMP-2026-...` formatting.
- No visible bulk actions.
- No saved filters.
- No configurable columns.
- No assigned reviewer.
- No review-age indicator.
- No visible note count.
- No application-completion indicator.
- No quick preview drawer.
- Exports need permission controls and audit records.
- Large country and region selects are difficult to use.

### Recommended upgrade

- Use a reusable data table.
- Add searchable filter controls.
- Persist filters in URL parameters.
- Add bulk review and assignment actions.
- Add saved views.
- Add column visibility.
- Add reviewer assignment.
- Add row selection.
- Add detail drawer and full detail page.
- Add notes, history, documents, health-access restrictions, and review timeline.
- Add export confirmation and permission checks.
- Update new registration IDs to the active event year while preserving historical IDs.
- Keep medical information restricted to the Medical Information Officer role.

---

## 7. Testimonies Moderation

### Current route

`/admin/testimonies`

### Current state

- Awaiting review: 103
- Approved: 0
- Not published: 0

Each card contains:

- Title
- Submitter
- Country
- Date
- Status
- Testimony
- Contact email
- Anonymous-publication preference
- Internal note
- Approve action
- Do-not-publish action

### Issues

- Very long unpaginated card list.
- Test data is mixed with real submissions.
- No search, sorting, assignment, or filters.
- No bulk moderation.
- An internal note input appears on every record.
- No public rendering preview.
- No duplicate or spam detection.
- No moderation history.
- No featured-testimony management.
- Contact details are visible without an explicit permission model.

### Recommended upgrade

Use a moderation table or queue plus a detail drawer.

Support:

- Search
- Status
- Country
- Date
- Anonymous preference
- Assigned moderator
- Test/production source
- Spam status
- Duplicate status
- Featured status
- Bulk assignment
- Bulk reject for confirmed test data
- Public preview
- Internal notes timeline
- Moderation history
- Categories and tags
- Homepage-feature selection
- Permission-controlled contact details
- Confirmation dialogs
- Clear success and error states

Automated test submissions should be tagged and filterable, with safe cleanup options in non-production environments.

---

## 8. Messages

### Current route

`/admin/messages`

### Current state

- New: 70
- In progress: 0
- Resolved: 0

Each message currently includes:

- Subject
- Sender
- Category
- Date
- Status
- Message
- Reply email
- Phone
- Internal note
- Mark in progress
- Mark resolved

### Issues

- Long repeated card list.
- No proper inbox workflow.
- No search or pagination.
- No assignment.
- No priority.
- No duplicate detection.
- No spam controls.
- No conversation history.
- No integrated response tracking.
- Internal note input appears on every card.
- Repeated automated messages dominate the page.

### Recommended upgrade

Use a helpdesk-style split layout:

- Message list
- Message detail panel
- Contact profile
- Activity timeline

Support:

- Search
- Filters
- Pagination
- Read/unread
- Status
- Category
- Priority
- Assigned admin
- Tags
- Internal notes
- Duplicate grouping
- Spam handling
- Bulk actions
- Response templates
- Integrated reply where email infrastructure supports it
- `mailto:` fallback
- SLA or ageing indicators
- Related volunteer account and application
- Message analytics
- Automated acknowledgement
- Test-data separation

---

## 9. Announcements

### Current route

`/admin/announcements`

### Current capabilities

- Title
- Message
- Audience
- Publish immediately
- Save as draft
- Optional email delivery

### Issues

- No announcement management table.
- No schedule or expiry.
- No preview.
- Limited audience targeting.
- No priority.
- No templates.
- No delivery statistics.
- No version history.
- No duplication or republishing.
- No attachments.
- No approval flow.

### Recommended upgrade

Create a communication centre with:

- Announcement list
- Editor
- Preview
- Delivery statistics

Support:

- Draft
- Scheduled
- Published
- Expired
- Archived
- Publish now
- Schedule
- Expiry
- Priority
- Dashboard notification
- Banner
- Email
- Test email
- Audience filters
- Multiple departments
- Application status
- Country
- RCCG region
- Attachments
- Templates
- Clone
- Version history
- Created by
- Delivery status
- Failed emails
- Editable email subject and sender details

All event wording must come from the active event configuration.

---

## 10. Departments and Questions

### Current behaviour

Department-specific questions:

- Appear only for the selected department.
- Can be required or optional.
- Support conditional display.
- Are retired instead of deleted once they have answers.
- Take effect on the next registration page load.

### Confirmed business rule

There is **no fixed limit on the number of volunteers needed in any department**.

The platform must not:

- Enforce department capacity.
- Close a department automatically.
- Show a department as full.
- Prevent applications because a count has been reached.

### Recommended upgrade

Focus on configuration and quality:

- Department active/inactive state
- Department descriptions
- Question builder
- Question order
- Conditional logic builder
- Validation rules
- Preview
- Draft/publish changes
- Version history
- Copy questions
- Duplicate questions
- Import/export question sets
- Supported field types
- Safe retirement
- Answer analytics

Possible field types:

- Short text
- Long text
- Number
- Date
- Single select
- Multi-select
- Radio
- Checkbox
- File upload
- Yes/no
- Consent

---

## 11. Reference Data

### Current route

`/admin/reference`

### Current purpose

Manage RCCG regions, provinces, and parishes.

### Decision

Remove it as a top-level admin module.

Move RCCG structure management under:

`Settings → Registration Configuration → RCCG Structure`

Repurpose the top-level navigation slot for:

`Previous Participants`

---

## 12. Previous Participants Migration

### Purpose

Upload previous-edition participant records through CSV and migrate them safely into the new platform.

### Required workflow

1. Upload CSV.
2. Select source edition.
3. Map columns.
4. Validate.
5. Preview.
6. Detect duplicates.
7. Match existing accounts.
8. Resolve conflicts.
9. Import through background jobs.
10. Send invitations.
11. Track delivery.
12. User visits login.
13. User selects Forgot Password.
14. User creates password.
15. User signs in.
16. User reviews and updates profile.
17. User completes current-edition registration separately.

### Security rules

- Never import passwords.
- Never generate a shared password.
- Never email passwords.
- Never expose whether an account exists through password reset.
- Match primarily by normalised email.
- Preserve verified current data.
- Store previous participation separately.
- Do not create a submitted 2027 application automatically.
- Use queues and idempotency.
- Protect uploaded files.
- Delete temporary files according to retention policy.
- Prevent CSV formula injection.

### Required admin views

- Migration batches
- Import wizard
- Validation report
- Duplicate resolution
- Import progress
- Results
- Previous participant table
- Invitation tracking
- Activation tracking
- Profile-review tracking
- Failed rows
- Downloadable reports

---

## 13. Administrators

### Current roles

- Registration Administrator
- Department Head
- Reviewer
- Medical Information Officer
- Communication Officer
- Super Administrator

### Strengths

- Roles are assigned to existing volunteer accounts.
- Medical data has a dedicated restricted role.
- Department Heads can be scoped.

### Required upgrade

Preserve default roles, but add granular permission management.

Support:

- Administrator table
- Search
- Filters
- Active/disabled state
- Last login
- Assigned roles
- Scoped departments
- Role descriptions
- Permission matrix
- Assignment history
- Temporary access suspension
- Sensitive-change confirmation
- Super-admin protection
- Audit history
- Optional custom roles in future

Examples of permissions:

- View applications
- Review applications
- Decide application outcome
- Export applications
- View medical information
- Manage testimonies
- Manage messages
- Publish announcements
- Send email
- Manage departments
- Manage event settings
- Run migrations
- Export migration data
- Manage administrators
- View activity log
- View security audit

Permissions must be enforced on the server.

---

## 14. Settings

### Current capabilities

- Registration open/closed
- Closed-registration message
- Event name
- Event dates
- Support email

### Issues

The page is too limited to be the platform’s source of truth.

### Recommended structure

#### General
- Organisation name
- Support email
- Contact phone
- Default timezone

#### Event
- Edition
- Year
- Duration
- Start date and time
- Calculated end
- Venue
- Registration status
- Livestream URL
- Countdown
- Event status

#### Registration
- Open/closed
- Opening and closing dates
- Closed message
- Draft saving
- Editing after submission
- Required email verification
- Required fields
- Documents
- Consent requirements

#### Volunteer Configuration
- Welcome text
- Code of conduct
- Handbook
- Profile requirements
- Dashboard resources

#### Communications
- Sender name
- Sender email
- Reply-to
- Email footer
- Provider status
- Queue status
- Test email

#### RCCG Structure
- Regions
- Provinces
- Parishes
- Import official structure
- Activate/deactivate records

#### Migration
- CSV limits
- Matching rules
- Invitation template
- Retention policy
- Allowed fields

#### Security
- Session policy
- Login rate limits
- Password policy
- Two-factor authentication readiness
- Audit retention

#### Integrations
- Email
- SMS
- YouTube
- Maps
- Storage
- Analytics

Settings changes must be validated, previewed where useful, and recorded with before/after values.

---

## 15. Activity Log and Security Audit

### Current route

`/admin/audit`

### Current state

- 2,261 entries
- Raw action codes
- Raw JSON details
- Pagination
- Action filtering

### Decision

Rename the top-level module to:

`Activity Log`

Inside it, separate:

#### All Activity
Human-readable operational events.

#### Security and Compliance
Restricted security-sensitive events.

#### System Events
Automated jobs, email processing, imports, and technical events.

### Required upgrade

Support:

- Human-readable event labels
- Actor
- Role
- Module
- Action category
- Entity
- Result
- Date range
- Search
- Security-only filter
- Test-data filter
- Pagination
- Export with permission
- Detail drawer
- Related-record links
- Raw technical details for authorised users
- Retention policy

Examples:

Instead of:

`application.exported`

show:

`Super Admin exported 98 volunteer applications.`

Instead of displaying raw JSON in the table, show structured details and keep raw JSON under a Technical Details disclosure.

Sensitive events include:

- Failed login
- Password reset
- Role changes
- Permission changes
- Data exports
- Medical information access
- Migration execution
- Bulk email sends
- Settings changes

---

## 16. Shared Admin Design System

Use shadcn/ui where it improves consistency:

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

### Visual principles

- Operational, not promotional
- Strong information hierarchy
- Compact but readable
- Consistent status badges
- No excessive gradients
- No glassmorphism
- Minimal decorative motion
- Accessible contrast
- Clear empty states
- Responsive tables and drawers

### GSAP

Use only for:

- Initial dashboard card reveal
- Sidebar transition
- Wizard step transition
- Success confirmation
- Progress animation

Do not animate tables continuously.

Respect `prefers-reduced-motion`.

---

## 17. Security and Compliance

Required controls:

- Server-side permissions
- CSRF protection where applicable
- Rate limiting
- Secure exports
- Export audit logs
- Medical-data access logs
- Confirmation for destructive actions
- Queue idempotency
- Safe CSV handling
- Encrypted secrets
- Minimal data exposure
- Restricted contact details
- Restricted health information
- Session controls
- Generic password-reset responses
- Audit retention
- Data retention settings

---

## 18. Testing Requirements

Run and pass:

- Database migrations
- Lint
- Type checking
- Unit tests
- Integration tests
- End-to-end tests
- Accessibility checks
- Responsive checks
- Production build

Critical flows:

- Application review
- Export
- Testimony moderation
- Message assignment and resolution
- Announcement scheduling and delivery
- Department question publishing
- Role changes
- Settings changes
- CSV migration
- Invitation email
- Password reset
- Profile review
- Activity logging
- Permission enforcement

---

## 19. Final Product Outcome

The final admin platform should allow authorised administrators to:

- Understand the event’s operational state within seconds.
- See urgent work immediately.
- Review volunteers efficiently.
- Manage communications centrally.
- Moderate public submissions safely.
- Configure the event without code changes.
- Import previous participants securely.
- Track account activation and profile updates.
- Manage roles and permissions safely.
- Understand day-to-day activity.
- Investigate security-sensitive actions.
- Maintain a consistent, accessible, responsive interface.
