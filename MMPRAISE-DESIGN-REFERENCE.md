# MMPraise Design Reference

Design tokens and UI patterns extracted from the live sites on **2026-07-30** by reading
computed styles in the browser (not guessed from screenshots).

- **Design source of truth:** https://mmpraise.org (main WordPress/Astra + Elementor site)
- **Existing volunteer app:** https://www.mmpraise.tv/volunteer/account/ (Bootstrap 4, to be replaced/restyled)
- **Ready-to-use CSS:** [`mmpraise-theme.css`](mmpraise-theme.css) — all tokens below as CSS custom properties + component classes

---

## 1. Typography

Two Google Fonts, both already loaded on mmpraise.org:

```html
<link href="https://fonts.googleapis.com/css2?family=Afacad:wght@400;500;600;700&family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet">
```

| Role | Font | Notes |
|---|---|---|
| **Display** — all headings *and* all buttons | **Afacad**, sans-serif | Almost always **700** and **UPPERCASE** |
| **Body** — paragraphs, form labels, UI text | **Figtree**, sans-serif | Weight 400, colour `#353535` |

### Heading scale (as measured)

| Element | Size / line-height | Weight | Letter-spacing | Transform | Colour |
|---|---|---|---|---|---|
| Hero H2 ("Welcome to MMPraise…") | 42px / 50.4px | 700 | 0.1px | uppercase | `#FFFFFF` |
| Big statement H2 ("The Countdown to Glory Begins!") | 44px / 52.8px | 700 | 0.1px | uppercase | `#FFFFFF` |
| Section H2 (on light) | 38px / 45.6px | 700 | 0.1px | uppercase | `#1C0D0A` |
| Card / feature H3 ("Praise", "Worship", "Volunteer") | 26px / 26px | 700 | **-1px** | uppercase | `#1C0D0A` |
| Eyebrow pill H3 ("Timer", "Activities", "Testimonies") | 22px / 22px | 700 | 0.1px | uppercase | `#FFFFFF` |
| Hero subhead H3 | 24px / 24px | 500 | 0.5px | uppercase | `#FFFFFF` |
| Body copy | 16px / 1.4 | 400 | normal | none | `#353535` |

**Key characteristic:** headings are tight-leading, all-caps, and heavy. Feature/card
headings use *negative* letter-spacing (-1px), which gives them their compressed look.

---

## 2. Colour palette

### Brand
| Token | Hex | rgb | Used for |
|---|---|---|---|
| `--mmp-orange` | `#F34402` | 243, 68, 2 | **Primary CTA buttons**, eyebrow pill labels |
| `--mmp-orange-bright` | `#FF6210` | 255, 98, 16 | Secondary accent, hover state |
| `--mmp-orange-soft` | `#FEA06E` | 254, 160, 110 | Muted accent text, line-art texture |
| `--mmp-peach` | `#FFD3C2` | 255, 211, 194 | Soft fills |
| `--mmp-cream` | `#FEF1E4` | — | Section tint (Astra "secondary") |
| `--mmp-cream-30` | `rgba(255,240,235,.3)` | — | Very light section wash |
| `--mmp-sand` | `#E5D7D1` | — | Borders / dividers |

### Neutrals
| Token | Hex | Used for |
|---|---|---|
| `--mmp-ink` | `#1C0D0A` | Headings on light backgrounds (warm near-black) |
| `--mmp-body` | `#353535` | Body copy |
| `--mmp-black` | `#000000` | Dark feature sections |
| `--mmp-near-black` | `#140B06` | Alternate dark background |
| `--mmp-charcoal` | `#23282D` | Footer-ish surfaces |
| `--mmp-white` | `#FFFFFF` | Light background, text on dark |
| `--mmp-overlay` | `rgba(0,0,0,.48)` | Dark scrim over hero photography |

**Note:** the ink colour is a *warm* near-black (`#1C0D0A`), not neutral grey. Keep it warm —
it's what ties the type to the orange.

---

## 3. Components

### Buttons
Every button on the site is a **full pill** with identical geometry:

- `border-radius: 30px`
- `padding: 20px 40px`
- `font: 700 ~15px Afacad`, `text-transform: uppercase`

| Variant | Background | Text | Border | Example on site |
|---|---|---|---|---|
| Primary | `#F34402` | white | none | **VOLUNTEER** |
| Ghost on dark | transparent | white | 1px white | **GIVE** |
| Ghost on light | transparent | `#1C0D0A` | 1px ink | **READ MORE**, **SHOW MORE** |

### Eyebrow pill label
Small orange pill above section headings — e.g. `Testimonies`, `Timer`, `Activities`,
`Gospel Artists`. White uppercase Afacad 700 at 22px, orange background, pill radius,
roughly `10px 24px` padding. This is the site's signature section marker.

### Hero
Full-bleed photograph (live concert imagery) + `rgba(0,0,0,.48)` dark overlay, with
giant white uppercase Afacad headline, uppercase subhead below, and a pill CTA row.

### Dark feature section
Pure black background with a faint orange line-art texture image
(`/wp-content/uploads/2025/03/Line-2.png`) overlaid, `70px 0 100px` padding.
This is where the countdown timer and CTA pair live.

### Section rhythm
Alternating bands: white → cream wash (`rgba(255,240,235,.3)`) → black.
Vertical padding roughly `40–70px` top, `100–110px` bottom.

### Cards
White surface, subtle sand border, moderate radius (~12px), soft shadow, ~32px padding.

---

## 4. Current volunteer app (mmpraise.tv) — what it looks like today

Worth knowing because restyling it is a genuine visual shift, not a tweak.

| | Current (.tv volunteer app) | Target (mmpraise.org) |
|---|---|---|
| CSS framework | Bootstrap 4 + Font Awesome 4 | Astra + Elementor (custom) |
| Font | **Muli**, sans-serif | Afacad + Figtree |
| Body text | `#212529` (Bootstrap default) | `#353535` |
| Primary button | Bootstrap green `#28A745`, radius `4px`, weight 400 | Orange `#F34402`, pill `30px`, weight 700 uppercase |
| Links | Bootstrap blue `#007BFF` | Orange |
| Headings | Sentence case, 40px | ALL CAPS, heavy |
| Feel | Generic Bootstrap admin form | Bold, warm, editorial event branding |

Pages seen: `/volunteer/account/home` (redirects to a welcome screen with "I'm new" /
"I'm returning" cards when signed out) and `/volunteer/account/register` (a long Bootstrap
form: name, contact, username, password, confirm password, profile picture upload,
reCAPTCHA, green **Submit**, and an "I want to view my profile" link).

Stylesheets in use there:
`plugins/bootstrap/css/bootstrap.min.css`, `plugins/font-awesome/css/font-awesome.min.css`, `css/style.css`.

---

## 5. Applying this

Import the theme file and use the tokens:

```css
@import url('./mmpraise-theme.css');
```

Rules of thumb for anything new:

1. **Headings are always uppercase Afacad 700.** No sentence-case headings.
2. **Buttons are always pills** (`30px`) with `20px 40px` padding and uppercase Afacad 700.
3. **One orange** does the CTA work — `#F34402`. Don't introduce a second brand hue.
4. **Body copy is Figtree**, never Afacad.
5. **Warm neutrals only** — `#1C0D0A` for headings, `#353535` for text.
6. **Alternate light / cream / black** section bands for rhythm.
7. Photography always gets the `rgba(0,0,0,.48)` scrim before white type sits on it.
