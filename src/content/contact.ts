import { contact, eventConfig, links } from '@/config/site'

/**
 * Contact-page content, modelled as data rather than inlined in JSX.
 *
 * The source page at https://mmpraise.org/contact-us/ is four things: a
 * heading, one generic form, a line of location text, and a stray email box
 * under a volunteer heading. Everything added here is either a route that
 * already exists in this application or a fact the current site publishes — no
 * email address, department or response time has been invented.
 *
 * See docs/CONTACT-AUDIT.md.
 */

// --- Hero -------------------------------------------------------------------

export const contactHero = {
  eyebrow: 'Contact',
  heading: 'Stay connected with MMPraise',
  standfirst:
    'Whether you have a question about the marathon, want to serve, need prayer or have something to share, there is a route below that goes straight to the right place.',
  /**
   * A congregation rather than a close-up of an individual. The hero image is
   * decorative wallpaper behind a heading, and putting a single identifiable
   * person — least of all a named church leader — in that role is a claim the
   * page is not making.
   */
  image: {
    src: '/landing/activity-praise.webp',
    width: 1000,
    height: 666,
    alt: '',
  },
} as const

// --- Communication channels -------------------------------------------------

export type ContactChannel = {
  id: string
  title: string
  description: string
  icon: 'message' | 'hands' | 'pray' | 'quote' | 'ticket' | 'gift' | 'play'
  /** Null while the destination is still behind a launch flag. */
  href: string | null
  linkLabel: string
  /** True when the destination is a section of this page rather than a route. */
  onThisPage?: boolean
}

/**
 * Every channel points at something that exists. Media and partnership are
 * deliberately routed through the form's category list rather than given
 * invented addresses like press@ or partners@ — see the audit.
 */
export const contactChannels: {
  eyebrow: string
  heading: string
  standfirst: string
  items: ContactChannel[]
} = {
  eyebrow: 'How can we help?',
  heading: 'Choose the right service',
  /*
   * Rewritten to address the reader.
   *
   * The previous line compared this page to the old WordPress site — a
   * comparison no visitor has any way to make, and one that says nothing about
   * what to do next.
   */
  standfirst:
    'Each route below goes straight to the team that handles it, so you are not waiting on a message being passed along.',
  items: [
    {
      id: 'general',
      title: 'Send a message',
      description:
        'Questions about the event, registration, media, partnership or anything else. Choose a subject and it reaches the right team.',
      icon: 'message',
      href: '#send-message',
      linkLabel: 'Go to the form',
      onThisPage: true,
    },
    {
      id: 'volunteer',
      title: 'Volunteer',
      description:
        'Apply to serve in one of ten departments. This is an application, not a message — you will be asked which team you want to join.',
      icon: 'hands',
      href: links.volunteer,
      linkLabel: 'Apply to volunteer',
    },
    {
      id: 'register',
      title: 'Register to attend',
      description: `Book your place at the ${eventConfig.edition} marathon. Attendance is free and open to everyone.`,
      icon: 'ticket',
      href: links.register,
      linkLabel: 'Register',
    },
    {
      id: 'testimony',
      title: 'Share a testimony',
      description:
        'Tell us what God has done. Testimonies are read by the team and reviewed before anything is published.',
      icon: 'quote',
      href: links.shareTestimony,
      linkLabel: 'Share a testimony',
    },
    {
      id: 'prayer',
      title: 'Request prayer',
      description: 'Send a request to the intercession team.',
      icon: 'pray',
      href: links.prayerRequest,
      linkLabel: 'Request prayer',
    },
    {
      id: 'give',
      title: 'Give',
      description: 'Support the marathon and help carry the gospel further.',
      icon: 'gift',
      href: links.donation,
      linkLabel: 'Give',
    },
    {
      id: 'watch',
      title: 'Watch online',
      description: 'Follow every hour of praise from anywhere in the world.',
      icon: 'play',
      href: links.livestream,
      linkLabel: 'Watch live',
    },
  ],
}

// --- Contact details --------------------------------------------------------

export type ContactDetail = {
  id: string
  title: string
  /** The value as it should be read. Null when not confirmed, so it is hidden. */
  value: string | null
  note: string
  href: string | null
  icon: 'pin' | 'phone' | 'mail' | 'share'
  external?: boolean
}

export const contactDetails: {
  eyebrow: string
  heading: string
  items: ContactDetail[]
} = {
  eyebrow: 'Contact details',
  heading: 'Where to find us',
  items: [
    {
      id: 'visit',
      title: 'Visit us',
      value: contact.visitAddress,
      note: 'Where the marathon is held. Open to everyone, free of charge.',
      href: contact.visitMapUrl,
      icon: 'pin',
      external: true,
    },
    {
      id: 'phone',
      title: 'Call us',
      value: contact.phone,
      note: 'Lines are answered by the MMPraise team.',
      href: null, // filled in by the page from phoneHref()
      icon: 'phone',
    },
    {
      id: 'email',
      title: 'Email us',
      value: contact.email,
      note: 'For anything you would rather put in writing.',
      href: `mailto:${contact.email}`,
      icon: 'mail',
    },
  ],
}

// --- Form categories --------------------------------------------------------

/**
 * Mirrors the `ContactCategory` enum in the Prisma schema. Keeping the labels
 * here means the inbox can be filtered by a stable value while the wording
 * shown to visitors stays editable.
 */
export const contactCategories = [
  { value: 'GENERAL', label: 'General enquiry' },
  { value: 'EVENT_INFORMATION', label: 'Event information' },
  { value: 'REGISTRATION_SUPPORT', label: 'Registration support' },
  { value: 'VOLUNTEER', label: 'Volunteer enquiry' },
  { value: 'MEDIA', label: 'Media enquiry' },
  { value: 'PARTNERSHIP', label: 'Partnership enquiry' },
  { value: 'DONATION', label: 'Donation question' },
  { value: 'OTHER', label: 'Something else' },
] as const

export type ContactCategoryValue = (typeof contactCategories)[number]['value']

// --- Volunteer section ------------------------------------------------------

export const contactVolunteer = {
  eyebrow: 'Volunteer',
  heading: 'Serve with MMPraise',
  paragraphs: [
    'Volunteers contribute their skills and their time to make the worship experience possible — from ushering and registration to media, welfare, medical cover, logistics and security.',
    'Volunteering is an application rather than a message. You apply once, to one department, so the team knows who to expect and you know where you are serving.',
  ],
  href: links.volunteer,
  ctaLabel: 'Apply to volunteer',
} as const

// --- FAQ --------------------------------------------------------------------

export type ContactFaq = { id: string; question: string; answer: string }

/**
 * Only questions this site can already answer. Nothing here promises a response
 * time, because the organisation has not published one.
 */
export const contactFaqs: ContactFaq[] = [
  {
    id: 'attend',
    question: 'How can I attend MMPraise?',
    answer: `Register to attend and come to ${eventConfig.venue.name}. Admission is ${eventConfig.admission.toLowerCase()}, and the ${eventConfig.edition} edition runs for ${eventConfig.durationHours} hours.`,
  },
  {
    id: 'volunteer',
    question: 'How can I volunteer?',
    answer:
      'Apply through the volunteer application. You choose one department, answer a few questions specific to that team, and the department reviews your application.',
  },
  {
    id: 'watch',
    question: 'How can I watch online?',
    answer:
      'The marathon is streamed, so you can join every hour of praise from anywhere. The link is published on the homepage before the event begins.',
  },
  {
    id: 'testimony',
    question: 'How can I share a testimony?',
    answer:
      'Use the testimony form. Every testimony is read and reviewed by an administrator before anything is published, and nothing appears publicly without your permission.',
  },
  {
    id: 'prayer',
    question: 'How can I request prayer?',
    answer:
      'Send a prayer request to the intercession team, who pray through the marathon and between editions.',
  },
  {
    id: 'response',
    question: 'What happens after I send a message?',
    answer:
      'Your message reaches the MMPraise team, who review it and reply to the address you gave. Messages are never published and are only visible to the team.',
  },
]

// --- Closing ----------------------------------------------------------------

export const contactClosing = {
  heading: 'Ready to take the next step?',
  body: `The ${eventConfig.edition} marathon runs for ${eventConfig.durationHours} hours. Join it in the room, from your own, or by serving on one of the teams that makes it possible.`,
} as const
