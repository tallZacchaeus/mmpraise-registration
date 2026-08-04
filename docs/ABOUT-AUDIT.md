# About page audit and content inventory

Source crawled: **https://mmpraise.org/about-us/** (WordPress · Elementor · Contact Form 7 + Cloudflare Turnstile).
Crawl covered the rendered DOM — headings, copy, images and their attributes, the form, every link,
metadata and the footer — not just the visible text.

---

## 1. Content inventory

| # | Section | Existing heading | Existing copy | Media | Links | Purpose | Problems found | Handling in the rebuild |
|---|---|---|---|---|---|---|---|---|
| 1 | Page title | `H1` About Marathon Messiah's Praise | — | — | — | Identify the page | Followed immediately by an `H3`, skipping `H2` | Kept as the only `H1`; heading order now never skips a level |
| 2 | Overview | `H3` Overview → `H2` MMPraise: A Global Unending Worship | Three long sentences in one block: annual gospel event, "sole purpose" of praising God, people from different spheres of life, birthed 2 March 2012 for Pastor E. A. Adeboye of RCCG, objective to birth a new pattern of worship, 200 worship leaders and choral groups across 50 countries, millions live and tens of millions online | 1 photo | — | Explain what MMPraise is | Dense block; heading order inverted; statistics conflict with the homepage | Split into three readable paragraphs; statistics moved to their own section; every fact retained |
| 3 | Vision | `H3` Vision → `H2` The Vision: Spreading God's Glory Through Unceasing Praise | One paragraph | 1 photo | — | State the vision | **Body copy is byte-identical to the Mission section** | Rewritten as the future being sought; no sentence shared with the Mission |
| 4 | Mission | `H3` Mission → `H2` Our Mission: Spreading the Gospel Through WORSHIP | The same paragraph, word for word | 1 photo | — | State the mission | **Duplicate of the Vision**; "WORSHIP" in caps mid-heading | Rewritten as six activities the site says MMPraise already does |
| 5 | Volunteer / subscribe | `H3` Be a Part of Something Greater: Volunteer with Us | No body copy at all | — | none | Recruit volunteers | **Sits inside `<footer>`**; heading says volunteer but the only control is a bare email box; **no link to the volunteer platform anywhere on the page** | Split into two sections: a volunteer appeal that links to `/register`, and a separately labelled "Receive MMPraise updates" form |
| 6 | Footer | About / Quick Links / Learn More / Get in Touch / Stay Connected | Same as the homepage | — | Menu links, Google Maps | Navigation and contact | Placeholder phone `+234 XXX-XXXX-XXX`; © 2025 hardcoded; social names are plain text, not links; broken `http://../../` | Shared `SiteFooter` — already fixed during the homepage rebuild |

---

## 2. Audit findings

### Content and information architecture
- **Vision and Mission are the same paragraph.** Both sections carry identical body text under
  different headings, so neither communicates anything the other does not.
- **Three different country counts across the site.** The About page says **50 countries**, the
  homepage prose says **82 nations**, and the map graphic reads **80 Countries**.
- **"Sole purpose" appears twice** in short succession, once in the overview and once in the
  Vision/Mission paragraph.
- **No history beyond a single date.** 2 March 2012 is stated, but nothing about how the event grew.
- **No participation pathways.** The page never says how to attend, watch, give or request prayer.
- **No explanation of who makes it happen** — volunteers, media, medical and technical teams are
  invisible.
- **The event and the movement are used interchangeably** without ever distinguishing them.
- Grammar: a stray comma in "Marathon Messiah's Praise, brings together"; "worshipers" spelled
  inconsistently with "worshippers" elsewhere on the site.

### UI and visual design
Long unbroken text blocks with no visual hierarchy; three photographs presented identically with no
captions or context; Vision and Mission look the same as every other section despite being the
page's two most important statements; no visual treatment for the statistics; the volunteer heading
is stranded in the footer with no supporting copy or button.

### User experience
A first-time visitor **cannot** determine from this page: how to attend, how to watch online, how to
volunteer, how to give, how to make contact, or what happens between annual events. The single email
box gives no indication of what submitting it does.

### Accessibility
- **Heading order jumps** `H1 → H3 → H2 → H3 → H2` throughout.
- **All four images have `alt=""`**, including the three content photographs.
- **The email field has no `<label>`** — placeholder text only — and is not marked required.
- The broken `http://../../` link has no accessible name.
- No breadcrumb, so the page gives no sense of location.

### Performance
Full-size WordPress uploads served unresized (up to 720×480 JPEG at 388 KB); only one of four images
carries `loading="lazy"`; Elementor, jQuery and Contact Form 7 assets load on a page that needs
almost none of them.

### SEO
- **No meta description.**
- **No Open Graph or Twitter Card tags** — shared links render bare.
- **No structured data at all** (no `AboutPage`, `Organization` or `BreadcrumbList`).
- Canonical is present and correct.
- Title is `About Us – MMPraise`, which wastes the strongest keywords.

### Security and forms
Contact Form 7 with Cloudflare Turnstile, so spam protection exists. But there is no visible required
marking, no accessible error messaging, no privacy notice beside the field, and no statement of what
the address will be used for.

---

## 3. How each issue was handled

| Issue | Handling |
|---|---|
| Vision and Mission identical | Separated along the standard distinction — vision is the future sought, mission is the work done to reach it — using only ideas already in that shared paragraph. A unit test fails if the two ever share a sentence again. |
| 50 vs 80 vs 82 countries | **No number is published.** The reach figure states what all three sources agree on — worshippers from many nations — and the detail says the count is being confirmed. A unit test asserts none of the three disputed figures appears. |
| Other statistics | 200 worship leaders, millions live and tens of millions online are stated on the About page and contradicted nowhere, so they are kept — centralised in `src/content/about.ts` with a visible note that figures are being confirmed. |
| Thin history | A three-entry timeline carrying only what the site states: the founding, the growth into a movement, and the current edition. The `Milestone` type supports a full edition history so verified entries can be added as data. |
| No participation pathways | Reuses the homepage's `participationActions`, filtered to those whose destination is actually live. |
| Nobody explained | A "people behind it" section describing **groups** — worship ministers, volunteers, technical, media, medical, coordinators, worshippers. No individual is named, because the source site names none. |
| Unclear email box | Split in two: a volunteer section linking to `/register`, and a "Receive MMPraise updates" section that states explicitly that subscribing does not enter you as a volunteer. |
| Images with empty alt | All three re-encoded locally as WebP (820 KB → 110 KB) with descriptive alt text and captions. |
| Heading order | `H1 → H2 → H3` throughout, asserted by an end-to-end test. |
| No metadata | Unique title and description, canonical, Open Graph, Twitter Card, and `AboutPage` + `Organization` + `BreadcrumbList` structured data — each claim visible on the page. |
| Placeholder phone, © 2025 | Inherited from the shared footer, already fixed in the homepage rebuild. |

---

## 4. Awaiting organisational confirmation

Everything below is marked `TODO(verify)` in `src/content/about.ts` and is written so that supplying
the real value is a data change, not a code change.

| # | Item | Current state |
|---|---|---|
| 1 | **Number of participating countries** | Not published — the site's own three figures (50 / 80 / 82) disagree |
| 2 | Worship leaders and choral groups | Showing **200**, as published on the About page |
| 3 | Live attendance | Showing **millions**, as published |
| 4 | Online audience | Showing **tens of millions**, as published |
| 5 | Official Vision wording | Editorial rewrite, derived from existing copy — not board-approved |
| 6 | Official Mission wording | Editorial rewrite, derived from existing copy — not board-approved |
| 7 | Full edition history | Only three verified milestones; the timeline accepts more as data |
| 8 | Leadership and team profiles | None asserted; the section carries groups, not people |
| 9 | Whether "What defines MMPraise" may be called organisational values | Deliberately not labelled "Our values" |
| 10 | Official phone number | Hidden until `NEXT_PUBLIC_CONTACT_PHONE` is set |
| 11 | Social profile URLs | Only YouTube renders; the rest appear once their URL is supplied |
| 12 | The map graphic reading "80 Countries" | Carried over unaltered; needs re-exporting once the figure is settled. (The asset itself was mislabelled during migration and has been corrected — see docs/HOMEPAGE-AUDIT.md.) |
