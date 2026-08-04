'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { db } from '@/lib/db'
import { audit } from '@/lib/audit'
import { clientIp } from '@/lib/auth/session'
import { fail, ok, parseOrFail, type ActionResult } from '@/lib/actions/result'
import { ipKey, rateLimit } from '@/lib/security/rate-limit'
import { emailSchema, multilineText, nameSchema, trimmedText } from '@/lib/validation/common'

/**
 * Public form submissions from the homepage.
 *
 * Both are unauthenticated, so they carry the protections that implies:
 *  - Server Actions are origin-checked by Next.js (cross-site POSTs are rejected)
 *  - fixed-window rate limiting per IP
 *  - a honeypot field that real users never see and never fill
 *  - full server-side validation and sanitisation with the shared Zod schemas
 *
 * Testimonies are stored as PENDING and are never rendered publicly until an
 * administrator approves them.
 */

/** Bots fill every field they find; humans never see this one. */
const honeypot = z.string().max(0, 'Submission rejected').optional()

const testimonySchema = z.object({
  title: trimmedText(120).optional().or(z.literal('')),
  body: multilineText(4000).pipe(z.string().min(30, 'Please share a little more (at least 30 characters)')),
  authorName: nameSchema,
  email: emailSchema,
  phone: z.string().max(30).optional().or(z.literal('')),
  country: trimmedText(60).pipe(z.string().min(2, 'Enter your country')),
  isAnonymous: z.boolean().default(false),
  consentToPublish: z.literal(true, {
    message: 'We need your permission before we can publish your testimony',
  }),
  website: honeypot,
})

export async function submitTestimonyAction(input: unknown): Promise<ActionResult> {
  const limit = await rateLimit(await ipKey('testimony'), 3, 60)
  if (!limit.allowed) {
    return fail(
      `Thank you — you have already sent us a testimony recently. Please try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
      undefined,
      'rate_limited',
    )
  }

  const parsed = parseOrFail(testimonySchema, input)
  if (!parsed.ok) return parsed.result

  // Silently accept honeypot hits so bots get no signal, but store nothing.
  if (parsed.data.website) return ok()

  const headerList = await headers()

  const submission = await db.testimonySubmission.create({
    data: {
      title: parsed.data.title || null,
      body: parsed.data.body,
      authorName: parsed.data.authorName,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      country: parsed.data.country,
      isAnonymous: parsed.data.isAnonymous,
      consentToPublish: true,
      status: 'PENDING',
      ip: clientIp(headerList),
      userAgent: headerList.get('user-agent')?.slice(0, 500) ?? null,
    },
  })

  await audit({
    action: 'application.note_added',
    entityType: 'TestimonySubmission',
    entityId: submission.id,
    metadata: { source: 'homepage' },
  })

  return ok()
}

const newsletterSchema = z.object({
  email: emailSchema,
  consentGiven: z.literal(true, { message: 'Please confirm you are happy to receive updates' }),
  website: honeypot,
})

export async function subscribeAction(input: unknown): Promise<ActionResult> {
  const limit = await rateLimit(await ipKey('newsletter'), 5, 60)
  if (!limit.allowed) {
    return fail('Too many attempts. Please try again shortly.', undefined, 'rate_limited')
  }

  const parsed = parseOrFail(newsletterSchema, input)
  if (!parsed.ok) return parsed.result
  if (parsed.data.website) return ok()

  const headerList = await headers()

  // Re-subscribing is idempotent and must not reveal whether an address is
  // already on the list.
  await db.newsletterSubscriber.upsert({
    where: { email: parsed.data.email },
    update: { unsubscribedAt: null, consentGiven: true },
    create: {
      email: parsed.data.email,
      consentGiven: true,
      source: 'homepage',
      ip: clientIp(headerList),
    },
  })

  return ok()
}

const contactSchema = z.object({
  category: z.enum([
    'GENERAL',
    'EVENT_INFORMATION',
    'REGISTRATION_SUPPORT',
    'VOLUNTEER',
    'MEDIA',
    'PARTNERSHIP',
    'DONATION',
    'OTHER',
  ]),
  name: nameSchema,
  email: emailSchema,
  phone: z.string().max(30).optional().or(z.literal('')),
  subject: trimmedText(150).pipe(z.string().min(3, 'Enter a short subject')),
  message: multilineText(4000).pipe(
    z.string().min(20, 'Please tell us a little more (at least 20 characters)'),
  ),
  website: honeypot,
})

/**
 * A message from the public contact page.
 *
 * Stored rather than forwarded by email so nothing is lost if mail delivery
 * fails, and so the team has a record of what was asked. Messages are never
 * rendered publicly — the admin inbox is the only way to read one.
 */
export async function submitContactAction(input: unknown): Promise<ActionResult> {
  const limit = await rateLimit(await ipKey('contact'), 5, 60)
  if (!limit.allowed) {
    return fail(
      `You have sent us several messages recently. Please try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
      undefined,
      'rate_limited',
    )
  }

  const parsed = parseOrFail(contactSchema, input)
  if (!parsed.ok) return parsed.result

  // Silently accept honeypot hits so bots get no signal, but store nothing.
  if (parsed.data.website) return ok()

  const headerList = await headers()

  const created = await db.contactMessage.create({
    data: {
      category: parsed.data.category,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      subject: parsed.data.subject,
      message: parsed.data.message,
      status: 'NEW',
      ip: clientIp(headerList),
      userAgent: headerList.get('user-agent')?.slice(0, 500) ?? null,
    },
  })

  await audit({
    action: 'application.note_added',
    entityType: 'ContactMessage',
    entityId: created.id,
    metadata: { category: parsed.data.category },
  })

  return ok()
}
