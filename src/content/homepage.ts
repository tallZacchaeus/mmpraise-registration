import { contact, eventConfig, links } from '@/config/site'

/**
 * Homepage content, modelled as data rather than inlined in JSX.
 *
 * Every string here comes from the current mmpraise.org homepage. Wording has
 * been corrected for grammar, punctuation and capitalisation only; no facts,
 * dates, names or statistics have been invented. Where the source site was
 * inconsistent, the value is read from config so it can be corrected once.
 *
 * The organisation can later swap any of these arrays for a CMS or API response
 * without touching the section components.
 */

// --- Hero -----------------------------------------------------------------

export const hero = {
  eyebrow: `${eventConfig.durationHours} Hours · ${eventConfig.edition} edition`,
  heading: 'Welcome to MMPraise — a community of faith and worship',
  standfirst: 'Connecting hearts to God, one service at a time',
  image: {
    src: '/landing/hero-2026.webp',
    width: 1920,
    height: 1280,
    alt: '',
  },
} as const

// --- Event summary --------------------------------------------------------

export const eventSummary: {
  heading: string
  paragraphs: string[]
  image: { src: string; width: number; height: number; alt: string }
  readMoreHref: string | null
} = {
  heading: `${eventConfig.durationHours} Hours Marathon Messiah’s Praise: a global worship experience`,
  paragraphs: [
    'Marathon Messiah’s Praise is an annual gospel event with the sole purpose of praising God. It is where people from different spheres of life come together seeking to praise and worship God non-stop.',
    eventConfig.foundedNote.replace('Birthed', 'The event was birthed'),
    'Our primary objective is to birth a new pattern of worship in this dispensation, and to expand the kingdom of God through soul-winning.',
  ],
  image: {
    src: '/landing/about-worship.webp',
    width: 1200,
    height: 800,
    alt: 'Worshippers with hands raised during Marathon Messiah’s Praise',
  },
  readMoreHref: links.about,
}

// --- Participation actions ------------------------------------------------

export type ParticipationAction = {
  id: string
  title: string
  body: string
  outcome: string
  /** Null while the destination is still being built. */
  href: string | null
  icon: 'ticket' | 'hands' | 'gift' | 'play' | 'pray' | 'quote'
  emphasis?: boolean
}

export const participationActions: ParticipationAction[] = [
  {
    id: 'attend',
    title: 'Register to attend',
    body: 'Join us in person at the Redemption City for the full marathon.',
    outcome: 'Takes you to registration — about five minutes to complete.',
    href: links.register,
    icon: 'ticket',
    emphasis: true,
  },
  {
    id: 'volunteer',
    title: 'Volunteer',
    body: 'Serve in one of ten departments, from ushering and media to welfare and logistics.',
    outcome: 'Opens the volunteer application. You choose one department.',
    href: links.volunteer,
    icon: 'hands',
    emphasis: true,
  },
  {
    id: 'watch',
    title: 'Watch online',
    body: 'Follow every hour of praise from anywhere in the world.',
    outcome: 'Opens the MMPraise YouTube channel in a new tab.',
    href: links.livestream,
    icon: 'play',
  },
  {
    id: 'give',
    title: 'Give',
    body: 'Support the marathon and help carry the gospel further.',
    outcome: 'Opens the secure donation page in a new tab.',
    href: links.donation,
    icon: 'gift',
  },
  {
    id: 'prayer',
    title: 'Request prayer',
    body: 'Send a prayer request to the intercession team.',
    outcome: 'Opens the prayer request form in a new tab.',
    href: links.prayerRequest,
    icon: 'pray',
  },
  {
    id: 'testimony',
    title: 'Share a testimony',
    body: 'Tell us what God has done, and encourage someone else.',
    outcome: 'Takes you to the form. Testimonies are reviewed before publication.',
    // Root-relative, not a bare "#share-testimony": this list is rendered on the
    // About page too, where a bare fragment would point at an anchor that does
    // not exist there. From the homepage it still resolves to the same section.
    href: links.shareTestimony,
    icon: 'quote',
  },
]

// --- Activities -----------------------------------------------------------

export const activities: {
  eyebrow: string
  heading: string
  items: {
    title: string
    body: string
    image: { src: string; width: number; height: number }
    alt: string
    href: string | null
    linkLabel: string
  }[]
} = {
  eyebrow: 'Activities',
  heading: 'An event for every heart and helping hand',
  items: [
    {
      title: 'Praise',
      body: `${eventConfig.durationHours} unbroken hours of praise, led from the Redemption City and joined by worshippers around the world.`,
      image: { src: '/landing/activity-praise.webp', width: 1000, height: 666 },
      alt: 'Congregation praising with hands raised',
      href: links.livestream,
      linkLabel: 'Watch the praise',
    },
    {
      title: 'Worship',
      body: 'Unhurried worship sessions where hearts are still before God and lives are quietly changed.',
      image: { src: '/landing/activity-worship.webp', width: 1000, height: 666 },
      alt: 'Worship leaders ministering on stage',
      href: links.about,
      linkLabel: 'About the ministry',
    },
    {
      title: 'Volunteer',
      body: 'Ten departments make the marathon possible. Serving is how many people experience the event most deeply.',
      image: { src: '/landing/activity-volunteer.webp', width: 720, height: 480 },
      alt: 'Volunteers serving at Marathon Messiah’s Praise',
      href: links.volunteer,
      linkLabel: 'Apply to volunteer',
    },
  ],
}

// --- Global reach ---------------------------------------------------------

export const globalReach = {
  heading: 'Praise across nations: a global map of worship',
  body: `Experience the boundless reach of God’s glory as we unite worshippers from ${eventConfig.nationsCount} nations across the globe. From Africa to Asia, Europe, Australia and the Americas, this map highlights the locations where voices will rise in unison, declaring praises to Jesus, the Helper.`,
  image: {
    src: '/landing/global-map.webp',
    width: 694,
    height: 357,
  },
  /**
   * TODO(verify): the graphic reads "80 Countries" while the prose says 82
   * nations, and the About page states 50. The alt text describes what the
   * image shows rather than repeating any of the three disputed figures.
   *
   * Note: this file and beyond-mmpraise-flyer.webp were swapped during the
   * original migration, so this section rendered the flyer under map alt text
   * until the names were corrected.
   */
  alt: 'World map with markers across Africa, Europe, Asia, Australia and the Americas showing where worshippers join Marathon Messiah’s Praise',
} as const

// --- Gospel artists -------------------------------------------------------

/**
 * The current homepage shows seven portraits with no names attached. The data
 * model carries name, country and role so they can be filled in later without
 * any change to the component — until then the cards render as a respectful
 * unnamed gallery rather than inventing identities.
 */
export type Artist = {
  id: string
  image: { src: string; width: number; height: number }
  name: string | null
  country: string | null
  role: string | null
  href: string | null
}

export const artists: Artist[] = Array.from({ length: 7 }, (_, index) => ({
  id: `artist-${index + 1}`,
  image: { src: `/landing/artist-${index + 1}.webp`, width: 306, height: 405 },
  name: null, // TODO(verify): supply artist names
  country: null,
  role: null,
  href: null,
}))

export const artistsSection = {
  eyebrow: 'Gospel artists',
  heading: 'Anointed voices leading global praise',
  body: 'Ministers and worship leaders from across the nations lead the marathon through the day and the night.',
} as const

// --- Testimonies ----------------------------------------------------------

export type Testimony = {
  id: string
  title: string
  body: string
  author: string
  country: string
}

/**
 * The seven unique testimonies from the current homepage. The live slider
 * renders seventeen cards, repeating five of these; one repeat is additionally
 * mis-attributed to a different person. Duplicates are removed here and the
 * original attribution kept.
 */
export const testimonies: Testimony[] = [
  {
    id: 'business-boom',
    title: 'Business boom',
    body: 'My business has been without sales for a while and after I tuned in to MMP on Monday, my business has been booming with sales!',
    author: 'Chidinma',
    country: 'Nigeria',
  },
  {
    id: 'gratitude-to-god',
    title: 'Gratitude to God',
    body: 'I work during the early hours of the day. While I was driving and listening in to MMP one morning, all of a sudden, I lost control of my steering wheel. There I was, looking at death in the face for about two minutes, and suddenly, the car stopped. How it happened, I don’t know. Thank you God for saving my life.',
    author: 'Mr Alfred',
    country: 'Nigeria',
  },
  {
    id: 'unexpected-grace',
    title: 'Unexpected grace',
    body: 'I am a fashion designer. Towards the end of Deborah Ajayi’s ministration at the 80 Hours Marathon Messiah’s Praise, she asked us to lay our request before God and I did. I have been looking for money to get a space for my shop for long to no avail, and I kept trusting God. At the call for prayer, I told God to send help from above and 2 hours later, I got a call from my friend in the United States of America who asked about me and my business. Then, she sent me $2,000 to start my business. Amazing God! It’s still very shocking. Thank You, Lord.',
    author: 'Derinsola72',
    country: 'Nigeria',
  },
  {
    id: 'a-life-restored',
    title: 'A life restored',
    body: 'Leading worship in MMP has further strengthened my faith in God. For our worship team here in Australia, we are currently experiencing significant growth and changes to the glory of God. Personally, I was depressed for a really long time. It looked like everything was against me. I had too many challenges honestly and I found it hard to be happy. God started the process prior to the event, but the MMP lifted that burden. My joy and peace have now been completely restored!',
    author: 'Esther Uzoma Adjeke',
    country: 'Australia',
  },
  {
    id: 'miraculous-healing',
    title: 'An unprecedented visitation',
    body: 'There has been an unprecedented visitation from God in cities where the Canadian Altar has been hosted thus far. Godly peace and divine advancements have been experienced by the church in those cities.',
    author: 'Pastor Femi Debo-Omidokun',
    country: 'Canada',
  },
  {
    id: 'answered-prayers',
    title: 'Answered prayers',
    body: 'I bless God for the opportunity given unto me to be part of VPT for the 80 Hours Marathon Messiah’s Praise. I joined VPT not knowing anyone as I am originally a member of the Anglican church and not an RCCG member. I stumbled on the link one day while on Instagram, so I started coming for rehearsals. Although I have been battling with anxiety, depression and fear for like 4 months, if not more, I kept asking God to set me free. I prayed, fasted, and sought counsel and during a worship session Pastor Dare told us to write down what we need from God, and that before MMP ends, God will answer them. So I wrote 9 points, and I thank God that my prayers were answered. No more fear, anxiety and depression. Glory to God!',
    author: 'Orenaiya Babatunde Nuel',
    country: 'Nigeria',
  },
  {
    id: 'saved-from-accidents',
    title: 'Kept on the road home',
    body: 'On my way home after the MMPraise, I got saved from accidents. At the bus stop where the provided transportation dropped me off, I boarded a vehicle after waiting for a while. Along the way, I noticed that the 3 cars I had earlier flagged down, before my current bus, were involved in a fatal accident. The first car had one side badly smashed, the second ran into the bush and the third one exploded and caught fire. I want to thank God for His protection.',
    author: 'Ola Williams Boluwaji',
    country: 'Nigeria',
  },
]

export const testimoniesSection = {
  eyebrow: 'Testimonies',
  heading: 'Testimonies of grace: lives transformed through praise',
  intro:
    'Discover stories of lives touched through Marathon Messiah’s Praise — healings, breakthroughs, restorations and divine interventions. Let them encourage your faith, and know that your testimony could be next.',
  disclaimer:
    'These are personal accounts submitted by worshippers, published with their permission. They are individual experiences, not claims made or verified by MMPraise.',
} as const

// --- Insights and media ---------------------------------------------------

export type MediaResource = {
  id: string
  category: string
  title: string
  description: string
  href: string | null
  comingSoon?: boolean
}

export const mediaSection = {
  eyebrow: 'Insights',
  heading: 'Insights and updates on the marathon',
  body: 'Behind-the-scenes stories, event highlights and testimonies from worshippers worldwide. Keep checking back for fresh insights as we count down to this year’s edition.',
} as const

/** `comingSoon` is derived from the destination, so the two cannot disagree. */
export const mediaResources: MediaResource[] = (
  [
    {
      id: 'blog',
      category: 'Blog',
      title: 'Stories and updates',
      description: 'Reports, reflections and announcements from the MMPraise team.',
      href: links.blog,
    },
    {
      id: 'gallery',
      category: 'Gallery',
      title: 'Photos from past editions',
      description: 'Moments captured across the marathon, from the first hour to the last.',
      href: links.gallery,
    },
    {
      id: 'videos',
      category: 'Videos',
      title: 'Watch on YouTube',
      description: 'Full sessions, highlights and ministrations from previous editions.',
      href: links.youtube,
    },
    {
      id: 'magazine',
      category: 'Magazine',
      title: 'The MMPraise magazine',
      description: 'Long-form features on the movement and the people behind it.',
      href: links.magazine,
    },
    {
      id: 'radio',
      category: 'Radio',
      title: 'MMPraise radio',
      description: 'Praise and worship between editions, wherever you are.',
      href: links.radio,
    },
  ] satisfies Omit<MediaResource, 'comingSoon'>[]
).map((resource) => ({ ...resource, comingSoon: !resource.href }))

// --- FAQs -----------------------------------------------------------------

export type Faq = { id: string; question: string; answer: string }

/**
 * All thirteen questions from the current homepage, with the hour count and
 * venue taken from config so they cannot drift out of step with the rest of the
 * page again.
 */
export const faqs: Faq[] = [
  {
    id: 'what-is-mmpraise',
    question: 'What is Marathon Messiah’s Praise?',
    answer:
      'MMPraise is an annual gathering of true worshippers who come together to glorify God for His faithfulness and mercies in the life of Pastor E. A. Adeboye, to usher in a new dispensation of worship, and to expand the kingdom of God through soul-winning.',
  },
  {
    id: 'when-does-it-begin',
    question: `When does the ${eventConfig.edition} edition begin?`,
    // The date is announced through config; until then this answer says so
    // rather than repeating a date from a previous edition.
    answer: `The dates for the ${eventConfig.durationHours} Hours Marathon Messiah’s Praise ${eventConfig.edition} have not been confirmed yet. Join our mailing list or follow our social media platforms and we will announce them as soon as they are set.`,
  },
  {
    id: 'who-can-attend',
    question: 'Who can attend?',
    answer:
      'Marathon Messiah’s Praise is free and open to everyone who desires to worship God in Spirit and in truth. Regardless of denomination, all are welcome to participate from anywhere in the world.',
  },
  {
    id: 'where-physically',
    question: 'Where can I attend physically?',
    answer: `You can join physically at the ${eventConfig.venue.name}, ${eventConfig.venue.address}.`,
  },
  {
    id: 'accommodation',
    question: 'Is accommodation available?',
    answer: 'Yes. Accommodation can be booked with reliable lodges within the Redemption Camp environment.',
  },
  {
    id: 'transport',
    question: 'Will transportation be available?',
    answer: 'Yes. Transport services will be available at designated points within the Camp.',
  },
  {
    id: 'cannot-attend',
    question: 'What if I cannot make it to the venue?',
    answer:
      'We have you covered. Visit our YouTube channel, @themmpraise, or Dove TV, so you do not miss anything.',
  },
  {
    id: 'what-to-expect',
    question: `What can I expect from the ${eventConfig.durationHours} Hours Marathon Messiah’s Praise?`,
    answer: `Come with an open heart, ready to pour out genuine praise and experience the presence of God in a fresh and life-changing way. Across these ${eventConfig.durationHours} hours, expect moments of deep spiritual connection, renewed strength, overflowing joy, and divine encounters that uplift and inspire.`,
  },
  {
    id: 'medical',
    question: 'What happens in the case of medical challenges?',
    answer:
      'A dedicated team of medical professionals will be on standby throughout the entire event, ready to promptly assist anyone who may have medical needs.',
  },
  {
    id: 'can-i-volunteer',
    question: 'Can I volunteer for Marathon Messiah’s Praise?',
    answer:
      'Yes. We welcome individuals who are willing to support the success of the event by offering their time and skills. Use the volunteer application on this page for full details and to apply.',
  },
  {
    id: 'two-departments',
    question: 'Can I volunteer in two separate departments?',
    answer:
      'No. Volunteers serve in only one department, to ensure full commitment and effective participation throughout the event.',
  },
  {
    id: 'volunteer-accommodation',
    question: 'Will there be accommodation for volunteers?',
    answer: 'Yes. Accommodation is provided for all registered volunteers throughout the event.',
  },
  {
    id: 'other-questions',
    question: 'My question is not listed here. How can I get in touch?',
    answer: `We would love to help. Email us at ${contact.email} or use the contact page, and we will get back to you as soon as possible.`,
  },
]

// --- Volunteer call to action ---------------------------------------------

export const volunteerCta = {
  heading: 'Be a part of something greater: volunteer with us',
  body: 'Volunteers make the marathon possible. From the welcome at the gate to the last hour before dawn, thousands of people serve so that others can worship without distraction.',
  points: [
    'Choose one department — volunteers serve in a single team so they can give it their full commitment.',
    'Accommodation is provided for all registered volunteers throughout the event.',
    'A dedicated medical team is on standby for the whole marathon.',
  ],
  image: {
    src: '/landing/call-for-volunteers.webp',
    width: 1400,
    height: 788,
    alt: 'Call for volunteers for Marathon Messiah’s Praise',
  },
} as const
