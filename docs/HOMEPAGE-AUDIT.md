# Homepage audit and content inventory

Source crawled: **https://mmpraise.org/** (WordPress 7.0.2 · Elementor 4.2.1 · Contact Form 7 · Popup Builder · GiveWP).
Crawl covered the rendered DOM — header and submenus, popup, sliders, accordions, both forms, footer,
every link and image — not just visible text.

---

## 1. Content inventory

| # | Section | Current content | Purpose | Current CTAs | Media | Links | Interaction | Recommended improvement | Repeated / inconsistent |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Popup banner | "Call for Volunteers" image with QR code | Drive volunteer sign-ups | Image only | `CALL-LANDSCAPE-2.png` | none (image not linked) | Auto-opens on load | Replace with a dismissible announcement bar that links to registration | Image has no alt text and is not clickable |
| 2 | Header | Logo, Home, About, Resources▾, Share▾, Contact Us, Give, Volunteer | Navigation | Give, Volunteer | Logo | Resources▾ = Blog, Magazine(#), Radio(#), Gallery · Share▾ = Prayer Request, Share Your Testimony | Hover dropdowns, hamburger | Keep all items; give Magazine/Radio real destinations or hide | **Magazine and Radio point to `#`** |
| 3 | Hero | "Welcome to MMPraise – a community of faith and worship" / "Connecting hearts to God, one service at a time" | Identity | Volunteer | Full-bleed photo | mmpraise.tv | Static | Add edition, date, venue, online option, second CTA | **No H1 on the entire page** |
| 4 | Event intro | "84 Hours Marathon Messiah's Praise: a global worship experience" + 2 paragraphs incl. 2 March 2012 origin | Explain the event | Read More → /about-us | Photo | /about-us | Static | Keep verbatim; tighten hierarchy | — |
| 5 | Countdown | Timer + "The countdown to glory begins!" | Urgency | Give, Volunteer | Dark line-art background | donate, volunteer-units | Live JS timer | Drive from config; add live/completed states | **Shows 00:00:00:00 — target date already passed** |
| 6 | Activities | "An event for every heart and helping hand" — Praise, Worship, Volunteer | Explain participation | none | 3 images | none | Static | Add descriptions and links | Cards had headings but no body copy |
| 7 | Gospel artists | "Anointed voices leading global praise" + 7 portraits | Showcase ministers | none | 7 × `Frame-37*.png` | none | Static grid | Add names/country/role via data model | **Images with no names or alt text** |
| 8 | Global map | "Praise across nations" + 82 nations copy | Show reach | none | `Frame-109.jpg` | none | Static | Optimise, add text alternative | **Copy says "82 nations", map graphic says "80 Countries"** |
| 9 | Testimonies | 7 unique testimonies | Social proof | none | none | none | Repeating slider | Deduplicate, add read-more, label as personal accounts | **17 cards rendered for 7 unique testimonies** |
| 10 | Testimony form | Name, Email, Phone, Country, Testimony | Collect testimonies | Submit | none | CF7 + Turnstile | Client + server | Add real labels, validation, states, moderation | **No `<label>` on any field; none marked required** |
| 11 | Insights | "Insights and updates" + Blogs / Pictures / Videos / Magazines | Media hub | 4 tabs | none | — | Tabs | Show real preview cards; hide empty categories | Tabs render nothing |
| 12 | FAQ | 13 questions with answers | Answer objections | Show more | none | contact | Accordion | Keep all 13; make config-driven | **Intro says "82 Hours" while headings say "84 Hours"** |
| 13 | Volunteer CTA | "Be a part of something greater: volunteer with us" | Recruit | Volunteer | none | mmpraise.tv | Static | Add why/pathway/one-department rule | Volunteer links to 3 different URLs across the page |
| 14 | Newsletter | Bare email input | Collect emails | Submit | none | CF7 | Submit | Give it a heading, purpose, consent, states | **Unexplained, unlabelled email box** |
| 15 | Footer | About, Quick Links, Learn More, Get in Touch, Stay Connected | Navigation + contact | — | none | Address → Google Maps | Static | Rebuild with real links | **Social names are plain text, not links (0 social links on the page)** · **Phone is `+234 XXX-XXXX-XXX`** · **© 2025** |

---

## 2. Audit findings

### Content and information architecture
- **"82 Hours" vs "84 Hours"** — the FAQ intro says 82, three headings say 84. (The eight "80 Hours" mentions are testimonies about a *previous* edition and are correct history.)
- **"82 nations" vs "80 Countries"** — body copy and map graphic disagree.
- **Testimonies repeat** — 17 cards for 7 unique testimonies; "Gratitude To God" appears five times, once attributed to a different person than the other four.
- **Placeholder phone number** published live: `+234 XXX-XXXX-XXX`.
- **Copyright reads © 2025** — stale, and hardcoded.
- **Countdown expired** — sits at zero with no completed/live state.
- **Volunteer destination is inconsistent** — header and footer go to `mmpraise.tv/volunteer/account/home`, the countdown CTA goes to `/volunteer-units/`.
- **Broken link** `http://../../` in the markup.
- **Magazine and Radio menu items go to `#`.**
- Artist images carry no names, so the section communicates nothing to a first-time visitor.

### UI and visual design
Weak hierarchy (no H1); testimony slider padding inconsistent; artist grid is an unexplained image wall;
activity cards have headings but no copy; "Stay Connected" looks finished but does nothing; several
sections reuse the same three background photographs.

### User experience
A first-time visitor **cannot** determine from the homepage: the next edition's date, the venue, how to
attend physically, how to watch online, or how to register. Volunteering is visible; everything else is
buried or missing.

### Performance
Full-size WordPress uploads (`-scaled.jpeg`, up to 1920×1080) served unresized; jQuery + Elementor +
Popup Builder + slider libraries; render-blocking Google Fonts; no `width`/`height` on images (layout shift);
popup injected on load.

### Accessibility
- **No H1**; heading order jumps.
- **Form fields have no labels** — placeholder text only.
- **Submenu links expose empty accessible names** in the rendered menu.
- Popup opens automatically with no focus management and an unlabelled close button.
- Decorative and meaningful images alike have empty `alt`.
- Testimony slider auto-rotates with no pause control.

### SEO and social sharing
- **No meta description.**
- **No Open Graph or Twitter Card tags** — links shared to WhatsApp/Facebook render bare.
- **No structured data at all** (no Organization, Event or FAQPage).
- **No H1.**
- Title is generic: "MMPraise – Marathon Messiah Praise".
- Canonical is present and correct.

### Security and forms
Contact Form 7 with Cloudflare Turnstile (spam protection present — good). But: no visible required-field
marking, no accessible error messaging, no explicit privacy notice next to either form, and no stated
moderation before testimonies are published.

---

## 3. How each issue was handled in the rebuild

| Issue | Handling |
|---|---|
| 82 vs 84 Hours | Single source of truth: `eventConfig.durationHours` in `src/config/site.ts`. The duration rises by one hour per edition — 2026 ran for 84, so the **2027 edition is set to 85**. A unit test asserts the value matches `84 + (edition − 2026)` and that no FAQ contradicts it. |
| 82 nations vs 80 Countries | Body copy uses `event.nationsCount` (**82**, from the prose). The map graphic still reads "80 Countries" — flagged for re-export; not silently altered. |
| Repeated testimonies | Deduplicated to the 7 unique entries. The duplicate wrongly attributed to a second author was dropped, keeping the original attribution. |
| Placeholder phone | Omitted rather than published. `NEXT_PUBLIC_CONTACT_PHONE` exists and renders only when set. |
| © 2025 | Computed from the current year. |
| Expired countdown | Driven by config, with four states: *dates to be announced*, ticking, *live now* and *completed*. Never shows negative values. The 2027 date is unconfirmed, so the bar currently shows the announce state and the `Event` structured-data node is omitted (schema.org requires `startDate`; invalid markup is worse than none). |
| Inconsistent volunteer links | One `PUBLIC_VOLUNTEER_URL`, defaulting to this app's `/register`. |
| Magazine / Radio → `#` | Kept in the menu, marked `comingSoon`, rendered as non-links with a "Coming soon" note instead of dead links. |
| `http://../../` | Not carried over. |
| Unnamed artists | `artists.ts` carries `name`/`country`/`role` fields; images render with a neutral caption until names are supplied. Layout does not change when they are. |
| Unlabelled forms | Rebuilt with visible labels, required marking, inline errors, and privacy notices. |
| No moderation | Submissions land in a moderation queue and are never shown publicly until approved. |
