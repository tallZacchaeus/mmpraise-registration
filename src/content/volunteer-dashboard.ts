import { contact, eventConfig, links } from '@/config/site'

/**
 * Dashboard copy, modelled as data rather than inlined in JSX.
 *
 * Two rules held throughout:
 *
 *  1. Nothing is invented. Every answer below is something this application
 *     already does, or something the site already publishes. Where the
 *     organisation has not decided — a handbook, a code of conduct,
 *     accommodation — the entry is marked as a placeholder rather than given a
 *     plausible-looking link that would 404.
 *  2. No response times are promised. The organisation has not published one,
 *     so the FAQ says what happens, not when.
 */

// --- Resources --------------------------------------------------------------

export type ResourceItem = {
  id: string
  label: string
  description: string
  icon: 'book' | 'shield' | 'info' | 'play' | 'ticket' | 'mail' | 'map'
  /** Null when the destination does not exist yet. */
  href: string | null
  /** Render as "Coming soon" instead of hiding the row. */
  placeholder?: boolean
}

export const volunteerResources: ResourceItem[] = [
  {
    id: 'handbook',
    label: 'Volunteer handbook',
    description: 'What is expected of you on the day, and who to go to.',
    icon: 'book',
    // TODO(content): the organisation has not published a handbook. Set
    // NEXT_PUBLIC_VOLUNTEER_HANDBOOK_URL once it exists and drop `placeholder`.
    href: null,
    placeholder: true,
  },
  {
    id: 'conduct',
    label: 'Code of conduct',
    description: 'The standards every volunteer agrees to serve by.',
    icon: 'shield',
    // TODO(content): consent to a code of conduct is collected during
    // registration, but the document itself is not published anywhere yet.
    href: null,
    placeholder: true,
  },
  {
    id: 'about',
    label: 'About the marathon',
    description: 'What MMPraise is, and how it began.',
    icon: 'info',
    href: links.about,
  },
  {
    id: 'watch',
    label: 'Watch online',
    description: 'Follow every hour of praise from anywhere in the world.',
    icon: 'play',
    href: links.livestream,
  },
  {
    id: 'venue',
    label: 'Find the venue',
    description: eventConfig.venue.fullAddress,
    icon: 'map',
    href: eventConfig.venue.mapUrl,
  },
  {
    id: 'register',
    label: 'Register someone to attend',
    description: 'Admission is free and open to everyone.',
    icon: 'ticket',
    href: links.register,
  },
  {
    id: 'contact',
    label: 'Contact MMPraise',
    description: 'Media, partnership, prayer and general enquiries.',
    icon: 'mail',
    href: links.contact,
  },
]

// --- FAQ --------------------------------------------------------------------

export type DashboardFaq = { id: string; question: string; answer: string }

/**
 * Only questions this application can already answer, worded for someone who
 * is signed in and looking at their own dashboard.
 */
export const dashboardFaqs: DashboardFaq[] = [
  {
    id: 'edit',
    question: 'Can I change my answers after submitting?',
    answer:
      'Yes, until a reviewer reaches a decision. Use “Edit your details” on this page. Once your application has been reviewed it is locked, and the volunteer team has to reopen it for you.',
  },
  {
    id: 'timing',
    question: 'How long does the review take?',
    answer:
      'Every application is read individually by the department you applied to, so there is no fixed turnaround. The decision is emailed to you and appears in your notifications on this page as soon as it is made.',
  },
  {
    id: 'department',
    question: 'Can I change department?',
    answer:
      'You apply to one department, and it is part of what the reviewers assess. If you need to change it, contact the volunteer team rather than starting a second application.',
  },
  {
    id: 'shifts',
    question: 'When will I know my shifts?',
    answer:
      'Shifts are assigned after approval, department by department. They appear in “Your shifts” on this page and you are emailed when they are published.',
  },
  {
    id: 'accommodation',
    question: 'Is accommodation provided?',
    answer:
      'Accommodation is arranged by the volunteer team and is not managed through this dashboard. Contact them directly if you need somewhere to stay.',
  },
  {
    id: 'withdraw',
    question: 'What if I can no longer serve?',
    answer: `Tell the volunteer team as early as you can at ${contact.email}, so your department can plan the rota around it. There is nothing to cancel on this page.`,
  },
]

// --- Accommodation ----------------------------------------------------------

/**
 * The accommodation card's copy.
 *
 * The platform stores no accommodation record of any kind — there is no table,
 * no field and no import. So the card states the position plainly and points at
 * the people who do know, rather than showing an empty "your accommodation"
 * panel that implies data is on its way.
 */
export const accommodationNotice = {
  heading: 'Accommodation',
  body: 'Accommodation for volunteers is arranged directly by the volunteer team. It is not booked or tracked through this dashboard.',
  action: 'Ask about accommodation',
} as const
