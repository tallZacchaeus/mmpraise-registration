import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { AttendingFrame } from '@/components/site/attending-frame'
import { SiteFooter } from '@/components/site/site-footer'
import { SiteHeader } from '@/components/site/site-header'
import { Eyebrow } from '@/components/ui/primitives'
import { eventConfig, eventStartsAt, formatEventDateTime, siteConfig } from '@/config/site'
import { isEnabled } from '@/config/features'
import { getSessionUser } from '@/lib/auth/session'

const TITLE = `I will be attending — ${eventConfig.editionName} ${eventConfig.edition}`
const DESCRIPTION =
  'Make your own “I will be attending” card for the 85 Hours Marathon Messiah’s Praise. Add a photo, position it, and download — all on your own device.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${siteConfig.url}/attending` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${siteConfig.url}/attending`,
    type: 'website',
  },
}

export default async function AttendingPage() {
  if (!isEnabled('attendingFrame')) notFound()

  const user = await getSessionUser()
  const startsAt = eventStartsAt()

  return (
    <>
      <SiteHeader isSignedIn={Boolean(user)} />
      <main id="main">
        <section className="container-content py-12 sm:py-16">
          <Eyebrow>Share the invitation</Eyebrow>
          <h1 className="mt-2 max-w-3xl text-4xl sm:text-5xl">I will be attending</h1>
          <p className="mt-4 max-w-2xl text-lg text-body">
            Add your photo to the {eventConfig.editionName} card and post it. Tell the people who
            follow you that you will be there
            {startsAt ? ` on ${formatEventDateTime(startsAt)}` : ''}.
          </p>

          <p className="mt-4 flex max-w-2xl items-start gap-2 text-sm text-muted">
            <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            Your photo never leaves your device. The card is assembled in your browser, so nothing
            is uploaded to us and nothing is stored.
          </p>

          <div className="mt-10">
            <AttendingFrame />
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
