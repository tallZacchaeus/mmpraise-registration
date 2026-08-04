# Contact page audit and content inventory

Source crawled: **https://mmpraise.org/contact-us/** (WordPress · Elementor · Contact Form 7 +
Cloudflare Turnstile). Crawl covered the rendered DOM — headings, both forms and every field
attribute, links, metadata and the footer.

---

## 1. Content inventory

| # | Section | Purpose | Existing content | Functionality | Problems found | Handling | Kept? |
|---|---|---|---|---|---|---|---|
| 1 | Page title | Identify the page | `H1` Contact us | — | Followed by an `H3`, skipping `H2` | Kept as the only `H1`; heading order now never skips | Yes |
| 2 | Get in touch | Invite contact | `H3` Get in touch → `H2` Stay Connected: Reach Out to MMPraise | — | Two headings, no body copy at all | Became the hero, with a standfirst that says what the page is for | Yes |
| 3 | Contact form | Collect messages | Name, Email, Subject, Message | CF7 + Turnstile → email | **No `<label>` on any field**; **nothing marked required**; **the textarea is named `prayer-request`**, so a general enquiry and a prayer request are the same submission; no category; no success or error state described | Rebuilt: labelled fields, required marking, a category selector, inline errors, an error summary that takes focus, loading and success states | Yes |
| 4 | Location | Say where to come | "Visit us at MMPraise Redemption Camp, Ogun State, Nigeria" · "Mobile: +234 703 385 3817" | Static text | Contradicts the footer **on the same page** (see below); no map; not a link; number not dialable | Contact cards with a `tel:` link, a maps link, and a click-to-load map | Yes |
| 5 | Volunteer | Recruit volunteers | `H3` Be a Part of Something Greater: Volunteer with Us | A single unlabelled email box | Heading promises volunteering, control collects an email; **no link to the volunteer platform anywhere on the page**; identical to the stray block on the About page | Split out: a volunteer section that links to `/register`, and no email box | Yes |
| 6 | Footer | Navigation and contact | Shared footer | Static | Placeholder phone, © 2025, `http://../../` | Shared `SiteFooter`, already fixed | Yes |

---

## 2. Audit findings

### The page contradicts itself
The body says **`+234 703 385 3817`**; the footer, on the same page, says **`+234 XXX-XXXX-XXX`**.
The body says **Redemption Camp, Ogun State**; the footer says **Marathon Messiah's Praise HQ,
Lagos**. A visitor has no way to know which is right.

### Content and information architecture
- **No contact categories.** Everyone is funnelled through one box regardless of why they are
  writing — media, partnership, registration support and prayer all land in the same place.
- **The message field is named `prayer-request`.** Whatever the form was originally, contact
  messages and prayer requests are the same record.
- **No email address on the page** — `info@mmpraise.org` appears only in the footer.
- **No response expectation**, and nothing published that would let one be stated honestly.
- **No FAQ**, so every routine question becomes a message someone has to answer by hand.
- **No pathway** to prayer, testimony, giving, watching or registering.

### User experience
The page answers "how do I send a message" and nothing else. A visitor cannot tell where to go for
anything specific, and the one thing the page shouts about — volunteering — is the one thing it does
not link to.

### Accessibility
- **No `<label>` on any of the six fields** across both forms; placeholder text only.
- **Nothing marked required**, on either form.
- **Heading order jumps** `H1 → H3 → H2 → H3`.
- No error summary, no programmatic association between a field and its error.
- The broken `http://../../` link has no accessible name.

### Performance
Elementor, jQuery and two Contact Form 7 instances load on a page whose entire content is a heading,
a form and two lines of text.

### SEO
- **No meta description.**
- **No Open Graph or Twitter Card tags.**
- **No structured data** — no `ContactPage`, `Organization` or `ContactPoint`, which is precisely the
  page where that markup matters most.
- Canonical present and correct.

### Security
Turnstile is present on both forms, which is good. But there is no visible required marking, no
server-side error surface, no privacy notice beside either form, and no statement of what happens to
a message after it is sent.

---

## 3. How each issue was handled

| Issue | Handling |
|---|---|
| Two phone numbers on one page | One value in `src/config/site.ts`, used by every page. A unit test asserts it is the real number and contains no `X`; an end-to-end test asserts the rendered page contains exactly one distinct `+234` number. |
| Two addresses on one page | Modelled as what they appear to be — `visitAddress` (Redemption Camp, where the marathon is held) and `address` (the Lagos HQ from the footer) — rather than one silently overwriting the other. Both flagged for confirmation. |
| One generic form | A `category` selector with eight values, stored as a Prisma enum so the inbox can be filtered without parsing subject lines. |
| Message field named `prayer-request` | Contact messages have their own `ContactMessage` model. Prayer requests keep their own route. |
| No labels, nothing required | Every field labelled through the shared `Field` component, required fields marked in the accessible name, errors linked to their field, and an error summary that takes focus on failure. |
| Volunteer heading over an email box | Two separate sections. The volunteer section links to `/register`; there is no email field in it, asserted by a test. |
| Submissions exposed | Messages are stored, never rendered publicly. `/admin/messages` is the only way to read one and requires `application:review`. |
| No map | A click-to-load facade. Nothing is requested from Google until the visitor presses the button — asserted by a test that fails if the page makes any third-party request on load. The address and a plain maps link are always present. |
| No structured data | `ContactPage`, `Organization` with a `ContactPoint`, `BreadcrumbList` and `FAQPage` — the last generated from the questions actually rendered. |
| No response expectation | None invented. The FAQ says a message reaches the team and is replied to; a unit test fails if any answer starts promising "within 24 hours" or similar. |

---

## 4. Security of the new form

The same protections the other public forms carry:

- Server Actions are origin-checked by Next.js, so cross-site POSTs are rejected.
- Fixed-window rate limiting, five messages per IP per hour.
- A honeypot field real users never see; hits are accepted silently so bots get no signal, and
  nothing is stored.
- Full server-side validation with the shared Zod schemas — the client cannot be trusted, and the
  browser's own validation is bypassed with `noValidate` so the server is always the authority.
- IP and user agent recorded for abuse handling, nothing more.
- Every message write is recorded in the audit log.

---

## 5. Awaiting organisational confirmation

| # | Item | Current state |
|---|---|---|
| 1 | **Official telephone number** | Using `+234 703 385 3817`, as published on the contact page |
| 2 | **Which address is correct** | Both shown, labelled "visit us" (Redemption Camp) and the footer's Lagos HQ |
| 3 | **Official email address** | Using `info@mmpraise.org`, as published in the footer |
| 4 | Media enquiry contact | No dedicated address invented — routed through the form's Media category |
| 5 | Partnership contact | Same — routed through the Partnership category |
| 6 | Response time | None published, so none promised |
| 7 | Who monitors `/admin/messages` | Needs an owner before the page is announced |
| 8 | Social profile URLs | Only YouTube renders; the rest appear once supplied |
