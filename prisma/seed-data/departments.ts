/**
 * Departments and their question sets.
 *
 * These records drive the dynamic question engine: the wizard renders whatever
 * is stored in the database for the selected department, and the server validates
 * against the same records. Adding or changing a department question is a data
 * change, not a code change.
 */

export type QuestionTypeSeed =
  | 'TEXT' | 'TEXTAREA' | 'EMAIL' | 'TEL' | 'NUMBER' | 'DATE'
  | 'RADIO' | 'CHECKBOX' | 'SELECT' | 'MULTISELECT' | 'FILE' | 'RATING'

export type OptionSeed = { value: string; label: string; requiresText?: boolean }

export type QuestionSeed = {
  key: string
  label: string
  helpText?: string
  type: QuestionTypeSeed
  isRequired?: boolean
  maxLength?: number
  minValue?: number
  maxValue?: number
  ratingMin?: number
  ratingMax?: number
  allowedMimeTypes?: string[]
  maxFileSizeKb?: number
  placeholder?: string
  pattern?: string
  patternMessage?: string
  /** Show this question only when the parent question's answer matches. */
  parentKey?: string
  parentOptionValues?: string[]
  options?: OptionSeed[]
}

export type DepartmentSeed = {
  slug: string
  name: string
  description: string
  questions: QuestionSeed[]
}

const YES_NO: OptionSeed[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
]

export const DEPARTMENTS: DepartmentSeed[] = [
  {
    slug: 'soteria',
    name: 'Soteria',
    description: 'Intercession and altar ministry supporting the praise marathon in prayer.',
    questions: [
      {
        key: 'existing_member',
        label: 'Are you an existing Soteria member?',
        type: 'RADIO',
        isRequired: true,
        options: YES_NO,
      },
      {
        key: 'soteria_group',
        label: 'Which Soteria group do you belong to?',
        helpText: 'Select the group you currently serve with.',
        type: 'SELECT',
        isRequired: true,
        parentKey: 'existing_member',
        parentOptionValues: ['yes'],
        options: Array.from({ length: 12 }, (_, i) => ({
          value: `group_${i + 1}`,
          label: `Group ${i + 1}`,
        })),
      },
    ],
  },
  {
    slug: 'ushering',
    name: 'Ushering',
    description: 'Welcoming and seating guests, managing aisles and directing attendees.',
    questions: [
      { key: 'ushered_before', label: 'Have you worked as an usher before?', type: 'RADIO', isRequired: true, options: YES_NO },
      {
        key: 'standing_ok',
        label: 'Are you comfortable standing for extended periods?',
        helpText: 'Ushering shifts involve long periods on your feet.',
        type: 'RADIO',
        isRequired: true,
        options: YES_NO,
      },
      { key: 'rotating_shifts_ok', label: 'Are you available for rotating shifts?', type: 'RADIO', isRequired: true, options: YES_NO },
    ],
  },
  {
    slug: 'praise-team',
    name: 'Volunteers Praise Team',
    description: 'Singers and instrumentalists leading worship across the marathon.',
    questions: [
      {
        key: 'first_time',
        label: 'Is this your first time joining the Volunteers Praise Team?',
        type: 'RADIO',
        isRequired: true,
        options: YES_NO,
      },
      {
        key: 'music_option',
        label: 'How would you like to serve?',
        type: 'RADIO',
        isRequired: true,
        options: [
          { value: 'singer', label: 'Singer' },
          { value: 'instrumentalist', label: 'Instrumentalist' },
        ],
      },
      {
        key: 'voice_role',
        label: 'Which voice part do you sing?',
        type: 'RADIO',
        isRequired: true,
        parentKey: 'music_option',
        parentOptionValues: ['singer'],
        options: [
          { value: 'soprano', label: 'Soprano' },
          { value: 'alto', label: 'Alto' },
          { value: 'tenor', label: 'Tenor' },
        ],
      },
      {
        key: 'instrument',
        label: 'Which instrument do you play?',
        type: 'SELECT',
        isRequired: true,
        parentKey: 'music_option',
        parentOptionValues: ['instrumentalist'],
        options: [
          { value: 'drummer', label: 'Drummer' },
          { value: 'talking_drummer', label: 'Talking Drummer' },
          { value: 'keyboardist', label: 'Keyboardist' },
          { value: 'bass_guitarist', label: 'Bass Guitarist' },
          { value: 'lead_guitarist', label: 'Lead Guitarist' },
          { value: 'saxophonist', label: 'Saxophonist' },
          { value: 'trumpeter', label: 'Trumpeter' },
          { value: 'other', label: 'Other', requiresText: true },
        ],
      },
    ],
  },
  {
    slug: 'registration-team',
    name: 'Registration Team',
    description: 'Checking in volunteers and guests, managing accreditation desks.',
    questions: [
      { key: 'worked_registration_before', label: 'Have you worked in event registration before?', type: 'RADIO', isRequired: true, options: YES_NO },
      {
        key: 'comfortable_with_tech',
        label: 'Are you comfortable using computers, tablets or registration software?',
        type: 'RADIO',
        isRequired: true,
        options: YES_NO,
      },
      {
        key: 'customer_service_level',
        label: 'Customer-service experience level',
        type: 'SELECT',
        isRequired: true,
        options: [
          { value: 'none', label: 'None' },
          { value: 'beginner', label: 'Beginner' },
          { value: 'intermediate', label: 'Intermediate' },
          { value: 'advanced', label: 'Advanced' },
        ],
      },
    ],
  },
  {
    slug: 'media',
    name: 'Media',
    description: 'Photography, video, live streaming, audio and social coverage.',
    questions: [
      {
        key: 'media_skills',
        label: 'Select your media skills',
        helpText: 'Choose every area you can contribute to.',
        type: 'MULTISELECT',
        isRequired: true,
        options: [
          { value: 'photography', label: 'Photography' },
          { value: 'videography', label: 'Videography' },
          { value: 'video_editing', label: 'Video editing' },
          { value: 'live_streaming', label: 'Live streaming' },
          { value: 'audio_engineering', label: 'Audio engineering' },
          { value: 'social_media', label: 'Social media management' },
          { value: 'graphic_design', label: 'Graphic design' },
          { value: 'motion_graphics', label: 'Motion graphics' },
          { value: 'content_writing', label: 'Content writing' },
          { value: 'technical_support', label: 'Technical support' },
          { value: 'other', label: 'Other', requiresText: true },
        ],
      },
      {
        key: 'experience_level',
        label: 'Experience level',
        type: 'SELECT',
        isRequired: true,
        options: [
          { value: 'beginner', label: 'Beginner' },
          { value: 'intermediate', label: 'Intermediate' },
          { value: 'advanced', label: 'Advanced' },
          { value: 'professional', label: 'Professional' },
        ],
      },
      {
        key: 'portfolio_link',
        label: 'Portfolio link',
        helpText: 'A link to your work — website, Behance, Instagram or Google Drive folder.',
        type: 'TEXT',
        maxLength: 300,
        placeholder: 'https://',
        pattern: '^https?://[^\\s]+\\.[^\\s]{2,}$',
        patternMessage: 'Enter a full link starting with http:// or https://',
      },
      {
        key: 'equipment_available',
        label: 'Equipment available',
        helpText: 'List any cameras, lenses, audio gear or laptops you can bring.',
        type: 'TEXTAREA',
        maxLength: 500,
      },
      { key: 'overnight_ok', label: 'Are you willing to work during overnight sessions?', type: 'RADIO', isRequired: true, options: YES_NO },
    ],
  },
  {
    slug: 'welfare',
    name: 'Welfare',
    description: 'Hospitality, refreshments and care for volunteers and ministers.',
    questions: [
      { key: 'volunteered_before', label: 'Have you volunteered in the Welfare Department before?', type: 'RADIO', isRequired: true, options: YES_NO },
      {
        key: 'welfare_experience',
        label: 'Briefly describe any relevant welfare or hospitality experience',
        type: 'TEXTAREA',
        maxLength: 1000,
        placeholder: 'For example: catering, event hospitality, care teams…',
      },
    ],
  },
  {
    slug: 'medical',
    name: 'Medical',
    description: 'First aid and medical cover for volunteers and attendees.',
    questions: [
      { key: 'volunteered_before', label: 'Have you volunteered in the Medical Department before?', type: 'RADIO', isRequired: true, options: YES_NO },
      {
        key: 'specialisation',
        label: 'Professional specialisation',
        type: 'SELECT',
        isRequired: true,
        options: [
          { value: 'nurse', label: 'Nurse' },
          { value: 'doctor', label: 'Medical Doctor or General Practitioner' },
          { value: 'red_cross_first_aid', label: 'Red Cross or First Aid' },
          { value: 'laboratory_scientist', label: 'Laboratory Scientist' },
          { value: 'pharmacist', label: 'Pharmacist' },
          { value: 'biologist', label: 'Biologist' },
          { value: 'other', label: 'Other', requiresText: true },
        ],
      },
      {
        key: 'licence_number',
        label: 'Professional registration or licence number',
        helpText: 'Where applicable. This is verified by the medical coordinator and is not shared.',
        type: 'TEXT',
        maxLength: 60,
      },
      { key: 'years_experience', label: 'Years of experience', type: 'NUMBER', minValue: 0, maxValue: 60 },
      { key: 'currently_certified', label: 'Are you currently certified to practise?', type: 'RADIO', isRequired: true, options: YES_NO },
      {
        key: 'certification_evidence',
        label: 'Upload evidence of certification',
        helpText: 'PDF or image, up to 5 MB. Stored privately and visible only to authorised medical reviewers.',
        type: 'FILE',
        parentKey: 'currently_certified',
        parentOptionValues: ['yes'],
        allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
        maxFileSizeKb: 5120,
      },
    ],
  },
  {
    slug: 'sanitation',
    name: 'Sanitation',
    description: 'Keeping the venue clean and safe throughout the marathon.',
    questions: [
      { key: 'volunteered_before', label: 'Have you volunteered in the Sanitation Department before?', type: 'RADIO', isRequired: true, options: YES_NO },
      { key: 'rotating_shifts_ok', label: 'Are you comfortable working in rotating sanitation shifts?', type: 'RADIO', isRequired: true, options: YES_NO },
    ],
  },
  {
    slug: 'security',
    name: 'Security',
    description: 'Crowd safety, access control and incident response.',
    questions: [
      { key: 'first_time_security', label: 'Is this your first time volunteering for Security at MMPraise?', type: 'RADIO', isRequired: true, options: YES_NO },
      {
        key: 'law_enforcement_experience',
        label: 'Have you participated in professional law-enforcement or security activities?',
        type: 'RADIO',
        isRequired: true,
        options: YES_NO,
      },
      {
        key: 'security_experience',
        label: 'Briefly describe your security experience',
        helpText: 'A short summary is enough. Please do not include confidential or classified details.',
        type: 'TEXTAREA',
        maxLength: 800,
      },
      {
        key: 'physical_fitness',
        label: 'Rate your physical fitness',
        helpText: '0 — Very weak, 1 — Weak, 2 — Fair, 3 — Good, 4 — Strong, 5 — Very strong',
        type: 'RATING',
        isRequired: true,
        ratingMin: 0,
        ratingMax: 5,
      },
    ],
  },
  {
    slug: 'logistics',
    name: 'Logistics',
    description: 'Transport, equipment, inventory and venue setup.',
    questions: [
      { key: 'worked_logistics_before', label: 'Have you worked in the Logistics Department at an event before?', type: 'RADIO', isRequired: true, options: YES_NO },
      { key: 'six_hour_shift', label: 'Are you available to work for up to six hours per shift?', type: 'RADIO', isRequired: true, options: YES_NO },
      {
        key: 'logistics_experience',
        label: 'Do you have experience with any of the following?',
        helpText: 'Select all that apply.',
        type: 'MULTISELECT',
        options: [
          { value: 'transportation', label: 'Transportation' },
          { value: 'inventory_management', label: 'Inventory management' },
          { value: 'equipment_handling', label: 'Equipment handling' },
          { value: 'venue_setup', label: 'Venue setup' },
          { value: 'crowd_coordination', label: 'Crowd coordination' },
          { value: 'procurement', label: 'Procurement' },
          { value: 'other', label: 'Other', requiresText: true },
        ],
      },
    ],
  },
]
