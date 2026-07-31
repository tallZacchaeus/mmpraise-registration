/** Admin-manageable option lists used by the core registration steps. */

type Lookup = { value: string; label: string; requiresText?: boolean }

export const OCCUPATIONS: Lookup[] = [
  { value: 'student', label: 'Student' },
  { value: 'entrepreneur', label: 'Entrepreneur' },
  { value: 'media', label: 'Media' },
  { value: 'musician', label: 'Musician' },
  { value: 'fashion_designer', label: 'Fashion Designer' },
  { value: 'technology', label: 'Technology' },
  { value: 'financial_services', label: 'Financial Services' },
  { value: 'legal_services', label: 'Legal Services' },
  { value: 'customer_service', label: 'Customer Service' },
  { value: 'human_resources', label: 'Human Resources' },
  { value: 'artisan', label: 'Artisan' },
  { value: 'office_administration', label: 'Office Administration' },
  { value: 'graduate_trainee', label: 'Graduate Trainee' },
  { value: 'education', label: 'Education' },
  { value: 'accounting', label: 'Accounting' },
  { value: 'medical', label: 'Medical' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'catering_services', label: 'Catering Services' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'civil_service', label: 'Civil Service' },
  { value: 'unemployed', label: 'Unemployed' },
  { value: 'clergy', label: 'Clergy' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'law_enforcement', label: 'Law Enforcement' },
  { value: 'other', label: 'Other', requiresText: true },
]

export const EDUCATION_LEVELS: Lookup[] = [
  { value: 'phd', label: 'PhD' },
  { value: 'masters', label: "Master's Degree" },
  { value: 'bachelors', label: "Bachelor's Degree" },
  { value: 'hnd', label: 'HND' },
  { value: 'nd', label: 'ND' },
  { value: 'ssce', label: 'SSCE' },
  { value: 'other', label: 'Other', requiresText: true },
]

export const DISCOVERY_SOURCES: Lookup[] = [
  { value: 'word_of_mouth', label: 'Word of mouth' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'mmpraise_website', label: 'MMPraise website' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
  { value: 'church_announcement', label: 'Church announcement' },
  { value: 'previous_volunteer', label: 'Previous volunteer' },
  { value: 'other', label: 'Other', requiresText: true },
]
