import { eventConfig, links } from '@/config/site'

/**
 * About-page content, modelled as data rather than inlined in JSX.
 *
 * Every fact here traces back to https://mmpraise.org/about-us/ or to the
 * homepage. Wording has been corrected for grammar, repetition and sentence
 * structure; no history, statistic, programme or leadership detail has been
 * invented. Where the source pages contradicted each other, the value is either
 * read from config or stated qualitatively — see docs/ABOUT-AUDIT.md.
 *
 * Anything marked TODO(verify) is awaiting organisational confirmation and is
 * deliberately written so that supplying the real value is a data change, not a
 * component change.
 */

// --- Hero -------------------------------------------------------------------

export const aboutHero = {
  eyebrow: 'About MMPraise',
  heading: 'A global movement of unending worship',
  standfirst:
    'Marathon Messiah’s Praise is an annual gospel event with one purpose: to praise God without stopping. It gathers people from different spheres of life, denominations and nations into a single, continuous act of worship.',
  image: {
    src: '/landing/about-2016-praise.webp',
    width: 720,
    height: 480,
    alt: 'Worshippers with hands raised during a Marathon Messiah’s Praise gathering',
  },
} as const

// --- Overview ---------------------------------------------------------------

/**
 * The source page carries this as one dense block of three long sentences. The
 * meaning is unchanged; it is split so the lines stay readable.
 */
export const aboutOverview = {
  heading: 'MMPraise: a global unending worship',
  paragraphs: [
    'Marathon Messiah’s Praise is an annual gospel event with the sole purpose of praising God. It is where people from different spheres of life come together seeking to praise and worship God non-stop.',
    'It brings together skilful people from different walks of life and continents for a common cause. Communities have been built, lives transformed, and generations groomed to bring glory to God creatively, using every means possible.',
    'Worshippers join both in person and online, so the gathering is never limited to the people who can travel to the venue.',
  ],
  image: {
    src: '/landing/about-2016-worship.webp',
    width: 600,
    height: 400,
    alt: 'Worship leaders ministering on stage at Marathon Messiah’s Praise',
  },
} as const

// --- Origin and history -----------------------------------------------------

export type Milestone = {
  id: string
  /** Displayed as given; a year alone is fine when the exact date is unknown. */
  date: string
  title: string
  body: string
}

/**
 * Only milestones the current website actually states. The structure supports
 * an edition-by-edition history — duration, participating countries, a
 * photograph — but inventing entries to fill the timeline would be fabricating
 * the organisation's history, so it carries what is verified and no more.
 *
 * TODO(verify): the organisation can supply the full edition history here.
 */
export const milestones: Milestone[] = [
  {
    id: 'founded',
    date: '2 March 2012',
    title: 'The first Marathon Messiah’s Praise',
    body: 'The event was birthed as a means to celebrate God’s faithfulness in the life of Pastor E. A. Adeboye, General Overseer of the Redeemed Christian Church of God, and has been held annually since.',
  },
  {
    id: 'movement',
    date: 'Since 2012',
    title: 'From an annual event to a worship movement',
    body: 'What began as a celebration has grown into a platform that connects worship leaders, choral groups, volunteers and online congregations across many nations.',
  },
  {
    id: 'current',
    date: `${eventConfig.edition} edition`,
    title: `${eventConfig.durationHours} hours of unbroken praise`,
    body: `The marathon lengthens by one hour with each edition. The ${eventConfig.edition} gathering runs for ${eventConfig.durationHours} hours, in person at ${eventConfig.venue.name} and online.`,
  },
]

export const historySection = {
  eyebrow: 'Our story',
  heading: 'How Marathon Messiah’s Praise began',
  standfirst:
    'The movement started as a thanksgiving, and grew into an annual gathering that reaches far beyond the room it is held in.',
} as const

// --- Vision -----------------------------------------------------------------

/**
 * On the source site the Vision and Mission sections carry byte-identical body
 * copy under different headings, so neither says anything the other does not.
 *
 * They are separated here along the standard distinction — the vision is the
 * future being sought, the mission is the work done to reach it — using only
 * ideas already present in that shared paragraph: uniting the body of Christ,
 * ushering in a new dispensation of worship, and praising God without ceasing.
 *
 * TODO(verify): this wording is editorial, not board-approved. Replace it with
 * the organisation's official statements when they are issued.
 */
export const vision = {
  eyebrow: 'Vision',
  heading: 'Spreading God’s glory through unceasing praise',
  statement:
    'A united body of Christ, drawn from every nation and generation, giving God unbroken praise.',
  paragraphs: [
    'Marathon Messiah’s Praise looks towards a church that worships together across the lines that usually divide it — denomination, nationality, language and background.',
    'The aim is to usher the family of God into a new dispensation of worship, in which praise is not an event on a calendar but a continuing way of life.',
  ],
} as const

// --- Mission ----------------------------------------------------------------

export const mission = {
  eyebrow: 'Mission',
  heading: 'Spreading the gospel through worship',
  statement:
    'To gather worshippers for continuous praise, and to open every possible door for people to take part in it.',
  /**
   * Each of these is an activity the current site says MMPraise already does.
   * No programme, partnership or initiative has been added.
   */
  points: [
    {
      title: 'Hold the gathering every year',
      body: 'Organise an annual marathon of non-stop praise that anyone can attend, free of charge.',
    },
    {
      title: 'Bring worshippers together',
      body: 'Draw people from different spheres of life, denominations and continents into one act of worship.',
    },
    {
      title: 'Give worship leaders a platform',
      body: 'Host worship leaders and choral groups, and provide the stage on which they minister.',
    },
    {
      title: 'Extend it through media',
      body: 'Use streaming and media so that worshippers who cannot travel still take part.',
    },
    {
      title: 'Make room for service',
      body: 'Create opportunities for people to serve God with their gifts and skills as volunteers.',
    },
    {
      title: 'Carry the gospel',
      body: 'Spread the gospel through worship, and expand the kingdom of God through soul-winning.',
    },
  ],
} as const

// --- Commitments ------------------------------------------------------------

export type Commitment = {
  id: string
  title: string
  body: string
  icon: 'infinity' | 'users' | 'globe' | 'sparkles' | 'book' | 'heart'
}

/**
 * Labelled "What defines MMPraise" rather than "Our values": these are drawn
 * from the existing copy, not from an approved statement of organisational
 * values, and presenting them as the latter would overstate what is verified.
 */
export const commitments: {
  eyebrow: string
  heading: string
  standfirst: string
  items: Commitment[]
} = {
  eyebrow: 'What defines MMPraise',
  heading: 'The convictions the marathon is built on',
  standfirst:
    'These are drawn from how the organisation describes itself and what it does, rather than from a formal statement of values.',
  items: [
    {
      id: 'unceasing-praise',
      title: 'Unceasing praise',
      body: 'Praise that does not stop for the length of the marathon, and does not stop when it ends.',
      icon: 'infinity',
    },
    {
      id: 'unity',
      title: 'Unity of the body of Christ',
      body: 'One gathering for believers from different denominations and backgrounds, with nothing asked of them but worship.',
      icon: 'users',
    },
    {
      id: 'global-worship',
      title: 'Global worship',
      body: 'Worshippers from many continents take part, in the room and online, in the same hours.',
      icon: 'globe',
    },
    {
      id: 'creative-service',
      title: 'Creative service',
      body: 'Generations groomed to bring glory to God creatively, using every means possible.',
      icon: 'sparkles',
    },
    {
      id: 'gospel-impact',
      title: 'Gospel impact',
      body: 'Worship as the means through which the gospel is carried and the kingdom expanded.',
      icon: 'book',
    },
    {
      id: 'community',
      title: 'Community transformation',
      body: 'Communities built and lives transformed, as a result of the gathering rather than a slogan about it.',
      icon: 'heart',
    },
  ],
}

// --- Impact -----------------------------------------------------------------

export type ImpactStat = {
  id: string
  /**
   * The figure to display. Null when the sources disagree — the label then
   * carries the qualitative statement instead, so nothing contradicted is ever
   * published as fact.
   */
  value: string | null
  label: string
  detail: string
}

/**
 * The country count is the one figure the site cannot agree with itself on:
 * the About page says 50, the homepage prose says 82 and the map graphic reads
 * 80. Rather than silently picking one, the reach entry states the fact all
 * three support — that worshippers come from many nations — and the conflict is
 * recorded in docs/ABOUT-AUDIT.md for the organisation to settle.
 *
 * TODO(verify): every figure below needs organisational confirmation.
 */
export const impact: {
  eyebrow: string
  heading: string
  standfirst: string
  stats: ImpactStat[]
  image: { src: string; width: number; height: number; alt: string }
  note: string
} = {
  eyebrow: 'Global reach',
  heading: 'What the marathon has gathered',
  standfirst:
    'Marathon Messiah’s Praise has grown from a single celebration into a gathering that reaches worshippers on several continents, in person and online.',
  stats: [
    {
      id: 'worship-leaders',
      value: '200',
      label: 'Worship leaders and choral groups',
      detail: 'Ministers and choirs who have led praise across the editions held so far.',
    },
    {
      id: 'nations',
      value: null,
      label: 'Many nations',
      detail:
        'Worshippers join from Africa, Europe, Asia, Australia and the Americas. The exact number of countries is being confirmed.',
    },
    {
      id: 'live',
      value: 'Millions',
      label: 'Live worshippers',
      detail: 'Recorded attendance of people worshipping in person across the editions.',
    },
    {
      id: 'online',
      value: 'Tens of millions',
      label: 'Online worshippers',
      detail: 'People who have joined the marathon through the stream rather than the venue.',
    },
  ],
  image: {
    src: '/landing/global-map.webp',
    width: 694,
    height: 357,
    alt: 'World map with markers across Africa, Europe, Asia, Australia and the Americas showing where worshippers join Marathon Messiah’s Praise',
  },
  note: 'Figures are as published by MMPraise and are being confirmed for the current edition.',
}

// --- The people behind the movement ----------------------------------------

export type ContributorGroup = {
  id: string
  title: string
  body: string
}

/**
 * Groups, not people. The source site names nobody except Pastor E. A. Adeboye,
 * who is named as the reason the event began rather than as a member of its
 * team, so no leadership profile is asserted here.
 *
 * TODO(verify): when leadership details are supplied, this section can carry
 * name, role, photo, biography and a social link. Empty profile cards are worse
 * than none, so it stays as groups until then.
 */
export const contributors: {
  eyebrow: string
  heading: string
  standfirst: string
  groups: ContributorGroup[]
} = {
  eyebrow: 'The people behind it',
  heading: 'It takes a great many hands',
  standfirst:
    'The marathon runs on the work of people serving in a dozen different capacities, most of whom are never seen from the auditorium.',
  groups: [
    {
      id: 'worship-ministers',
      title: 'Worship ministers and choral groups',
      body: 'The worship leaders and choirs who carry the hours of praise from the platform.',
    },
    {
      id: 'volunteers',
      title: 'Volunteers',
      body: 'Ten departments, from ushering and registration to welfare, sanitation and security.',
    },
    {
      id: 'technical',
      title: 'Technical and media teams',
      body: 'Sound, lighting, photography, video and streaming — the reason anyone can join from elsewhere.',
    },
    {
      id: 'medical',
      title: 'Medical and welfare teams',
      body: 'First aid, medical cover and care for volunteers, ministers and attendees through every hour.',
    },
    {
      id: 'coordinators',
      title: 'Coordinators and logistics',
      body: 'Transport, equipment, inventory and venue setup, plus the people who hold the schedule together.',
    },
    {
      id: 'worshippers',
      title: 'Worshippers',
      body: 'The congregation in the room and the congregation online, without whom there is no marathon.',
    },
  ],
}

// --- Story gallery ----------------------------------------------------------

export type GalleryImage = {
  id: string
  src: string
  width: number
  height: number
  alt: string
  caption: string
}

/**
 * The three photographs published on the About page, re-encoded locally. The
 * source page serves all three with an empty `alt`, so the descriptions here
 * are written from what each photograph shows.
 */
export const gallery: {
  eyebrow: string
  heading: string
  standfirst: string
  images: GalleryImage[]
} = {
  eyebrow: 'From the gathering',
  heading: 'Moments from the marathon',
  standfirst: 'Photographs published by MMPraise from previous editions of the event.',
  images: [
    {
      id: 'praise',
      src: '/landing/about-2016-praise.webp',
      width: 720,
      height: 480,
      alt: 'A packed auditorium of worshippers with hands raised during the praise marathon',
      caption: 'The auditorium during the hours of praise',
    },
    {
      id: 'worship',
      src: '/landing/about-2016-worship.webp',
      width: 600,
      height: 400,
      alt: 'Worship leaders ministering on stage under stage lighting',
      caption: 'Worship leaders ministering from the platform',
    },
    {
      id: 'congregation',
      src: '/landing/about-2016-congregation.webp',
      width: 600,
      height: 400,
      alt: 'Worshippers gathered together in the congregation, singing',
      caption: 'The congregation joining in',
    },
  ],
}

// --- Volunteer call to action ----------------------------------------------

/**
 * On the source page the heading "Be a part of something greater: volunteer
 * with us" sits in the footer above a bare email box, with no link to the
 * volunteer platform anywhere on the page. Volunteering and subscribing are
 * separated here: this section links to the application, and the newsletter
 * form is its own clearly labelled section.
 */
export const aboutVolunteerCta = {
  eyebrow: 'Volunteer',
  heading: 'Be a part of something greater',
  paragraphs: [
    'The marathon is carried by volunteers. Whether you sing, play, cook, drive, film, steward a door or give first aid, there is a department that needs what you can do.',
    'Applications are made once, to one department, so the teams know who they are expecting and volunteers know where they are serving.',
  ],
  href: links.volunteer,
  ctaLabel: 'Apply to volunteer',
  image: {
    src: '/landing/about-2016-congregation.webp',
    width: 600,
    height: 400,
    alt: 'Volunteers and worshippers gathered together during the event',
  },
} as const

// --- Closing call to action -------------------------------------------------

export const aboutClosing = {
  heading: 'Come and be part of the next edition',
  body: `The ${eventConfig.edition} marathon runs for ${eventConfig.durationHours} hours. You can join it in the room, from your own, or by serving on one of the teams that makes it possible.`,
} as const
