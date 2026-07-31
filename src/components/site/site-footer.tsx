import Link from 'next/link'
import { Mail, MapPin, Phone } from 'lucide-react'
import { Logo } from '@/components/ui/primitives'
import { contact, isExternal, links, siteConfig, socialLinks } from '@/config/site'

/**
 * Site footer.
 *
 * Preserves every grouping from the current WordPress footer (About, Quick
 * Links, Learn More, Get in Touch, Stay Connected) but with working links: the
 * live site renders the social network names as plain text, and publishes a
 * placeholder telephone number. Only verified details are rendered here.
 */
const quickLinks = [
  { label: 'Home', href: '/' },
  { label: 'About us', href: links.about },
  { label: 'Volunteer', href: links.volunteer },
  { label: 'Give', href: links.donation },
  { label: 'Blog', href: links.blog },
  { label: 'Contact us', href: links.contact },
]

const learnMore = [
  { label: 'Watch live', href: links.livestream },
  { label: 'Gallery', href: links.gallery },
  { label: 'Prayer request', href: links.prayerRequest },
  { label: 'Share your testimony', href: '#share-testimony' },
]

export function SiteFooter() {
  return (
    <footer className="bg-night text-white">
      <div className="container-content py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo inverted subtitle={null} />
            <p className="mt-4 max-w-xs text-sm text-white/70">
              {siteConfig.name} is a global worship movement dedicated to lifting up the name of Jesus
              through boundless praise.
            </p>
          </div>

          <FooterNav title="Quick links" items={quickLinks} />
          <FooterNav title="Participate" items={learnMore} />

          <div>
            <h2 className="text-base text-white">Get in touch</h2>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              <li className="flex items-start gap-2">
                <Mail aria-hidden className="mt-0.5 size-4 shrink-0" />
                <a href={`mailto:${contact.email}`} className="underline-offset-4 hover:text-white hover:underline">
                  {contact.email}
                </a>
              </li>

              {/* Rendered only when a real number is configured — the current
                  site publishes "+234 XXX-XXXX-XXX". */}
              {contact.phone && (
                <li className="flex items-start gap-2">
                  <Phone aria-hidden className="mt-0.5 size-4 shrink-0" />
                  <a
                    href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`}
                    className="underline-offset-4 hover:text-white hover:underline"
                  >
                    {contact.phone}
                  </a>
                </li>
              )}

              <li className="flex items-start gap-2">
                <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
                <a
                  href={contact.addressMapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-4 hover:text-white hover:underline"
                >
                  {contact.address}
                  <span className="sr-only"> (opens Google Maps in a new tab)</span>
                </a>
              </li>
            </ul>

            {socialLinks.length > 0 && (
              <>
                <h2 className="mt-8 text-base text-white">Stay connected</h2>
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                  {socialLinks.map((social) => (
                    <li key={social.label}>
                      <a
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/70 underline-offset-4 hover:text-white hover:underline"
                      >
                        {social.label}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/15 pt-6 text-sm text-white/60 sm:flex-row">
          {/* Year is computed, not hardcoded — the live site still reads 2025. */}
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <nav aria-label="Legal" className="flex gap-5">
            <Link href="/terms" className="underline-offset-4 hover:text-white hover:underline">
              Terms of service
            </Link>
            <Link href="/privacy" className="underline-offset-4 hover:text-white hover:underline">
              Privacy policy
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}

function FooterNav({
  title,
  items,
}: {
  title: string
  items: { label: string; href: string | null }[]
}) {
  return (
    <nav aria-label={title}>
      <h2 className="text-base text-white">{title}</h2>
      <ul className="mt-4 space-y-2 text-sm">
        {items.map((item) => {
          if (!item.href) {
            // Not built yet: say so plainly instead of linking nowhere.
            return (
              // Dimmer than a link so it does not read as clickable, but still
              // above the 4.5:1 contrast floor against the footer's ink.
              <li key={item.label} className="text-white/70">
                {item.label} <span className="text-xs">(coming soon)</span>
              </li>
            )
          }

          const external = isExternal(item.href)
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="text-white/70 underline-offset-4 hover:text-white hover:underline"
              >
                {item.label}
                {external && <span className="sr-only"> (opens in a new tab)</span>}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
