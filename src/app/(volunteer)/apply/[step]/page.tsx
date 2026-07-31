import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { ProgressSteps } from '@/components/apply/progress-steps'
import { AvailabilityStep } from '@/components/apply/steps/availability-step'
import { ChurchStep } from '@/components/apply/steps/church-step'
import { DepartmentStep } from '@/components/apply/steps/department-step'
import { LocationStep } from '@/components/apply/steps/location-step'
import { MotivationStep } from '@/components/apply/steps/motivation-step'
import { PersonalStep } from '@/components/apply/steps/personal-step'
import { ProfessionalStep } from '@/components/apply/steps/professional-step'
import { ReviewStep } from '@/components/apply/steps/review-step'
import { Alert } from '@/components/ui/primitives'
import { requireUser } from '@/lib/auth/rbac'
import { loadWizardState } from '@/lib/applications/service'
import { buildReviewSections } from '@/lib/applications/review'
import {
  getChurchRegions,
  getCountries,
  getDepartmentQuestions,
  getDepartmentsWithLoad,
  getLookupOptions,
} from '@/lib/reference'
import { getSettings } from '@/lib/settings'
import { stepBySlug, WIZARD_STEPS } from '@/lib/validation/registration'

export const metadata: Metadata = { title: 'Volunteer registration' }

/**
 * One page renders every wizard step.
 *
 * Initial values are the persisted record with the autosaved draft layered on
 * top, so a volunteer who refreshes mid-step sees exactly what they had typed —
 * including values that were not yet valid enough to save properly.
 */
export default async function WizardStepPage({ params }: { params: Promise<{ step: string }> }) {
  const { step: slug } = await params
  const step = stepBySlug(slug)
  if (!step) notFound()

  const user = await requireUser()
  const state = await loadWizardState(user.id)

  if (state.application.status !== 'DRAFT') redirect('/dashboard')

  const draft = state.draft as Record<string, Record<string, unknown> | undefined>
  const merge = <T,>(persisted: T, key: string): T => ({ ...persisted, ...(draft[key] ?? {}) }) as T

  const profile = state.profile
  const furthest = Math.max(state.application.currentStep, step.number)

  const body = await renderStep()

  return (
    <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10">
      <div className="mb-6 lg:mb-0">
        <div className="lg:sticky lg:top-6">
          <ProgressSteps current={step.number} furthest={furthest} />
        </div>
      </div>

      <div className="min-w-0">
        {!user.emailVerified && (
          <Alert tone="warning" title="Confirm your email address" className="mb-6">
            We sent a link to {user.email}. You can carry on registering, but please confirm it before
            your application is reviewed.
          </Alert>
        )}
        {body}
      </div>
    </div>
  )

  async function renderStep() {
    switch (step!.slug) {
      case 'personal': {
        const countries = await getCountries()
        const defaultCountry = countries.find((c) => c.iso2 === 'NG') ?? countries[0]
        const phone = profile?.phone ?? ''
        const dialCode = profile?.phoneCountry ?? defaultCountry?.phoneCode ?? ''

        return (
          <PersonalStep
            countries={countries}
            initialValues={merge(
              {
                firstName: profile?.firstName ?? '',
                lastName: profile?.lastName ?? '',
                gender: profile?.gender ?? '',
                email: state.user?.email ?? '',
                phoneDialCode: dialCode,
                phoneLocal: phone && dialCode ? phone.replace(`+${dialCode}`, '') : '',
                phone,
                ageRange: profile?.ageRange ?? '',
                isMinor: profile?.isMinor ?? null,
                photoDocumentId: profile?.photoDocumentId ?? null,
                guardianName: profile?.guardianName ?? '',
                guardianPhone: profile?.guardianPhone ?? '',
                guardianConsent: profile?.guardianConsent ?? false,
              },
              'personal',
            )}
          />
        )
      }

      case 'location': {
        const countries = await getCountries()
        return (
          <LocationStep
            countries={countries}
            initialValues={merge(
              {
                countryId: profile?.countryId ?? '',
                countryHasStates: Boolean(countries.find((c) => c.id === profile?.countryId)?.hasStates),
                stateId: profile?.stateId ?? null,
                stateNameOther: profile?.stateNameOther ?? '',
                city: profile?.city ?? '',
                addressLine: profile?.addressLine ?? '',
              },
              'location',
            )}
          />
        )
      }

      case 'professional': {
        const [occupations, educationLevels] = await Promise.all([
          getLookupOptions('OCCUPATION'),
          getLookupOptions('EDUCATION'),
        ])
        return (
          <ProfessionalStep
            occupations={occupations}
            educationLevels={educationLevels}
            initialValues={merge(
              {
                occupation: profile?.occupation ?? '',
                occupationOther: profile?.occupationOther ?? '',
                education: profile?.education ?? '',
                educationOther: profile?.educationOther ?? '',
              },
              'professional',
            )}
          />
        )
      }

      case 'church': {
        const regions = await getChurchRegions()
        return (
          <ChurchStep
            regions={regions}
            initialValues={merge(
              {
                denomination: profile?.denomination ?? '',
                churchRegionId: profile?.churchRegionId ?? null,
                churchProvinceId: profile?.churchProvinceId ?? null,
                parishId: profile?.parishId ?? null,
                parishNameOther: profile?.parishNameOther ?? '',
                churchName: profile?.churchName ?? '',
              },
              'church',
            )}
          />
        )
      }

      case 'department': {
        const departments = await getDepartmentsWithLoad()
        const questions = state.application.departmentId
          ? await getDepartmentQuestions(state.application.departmentId)
          : []

        return (
          <DepartmentStep
            departments={departments}
            initialQuestions={questions}
            initialAnswers={state.answers}
            initialValues={merge({ departmentId: state.application.departmentId ?? '' }, 'department')}
          />
        )
      }

      case 'availability': {
        const settings = await getSettings()
        const dates = [...new Set(state.availability.map((a) => a.date.toISOString().slice(0, 10)))]
        const periods = [...new Set(state.availability.map((a) => a.period))]

        return (
          <AvailabilityStep
            eventDates={settings.event_dates}
            initialValues={merge(
              {
                availableDates: dates,
                preferredPeriods: periods,
                availableOvernight: state.application.availableOvernight,
                emergencyName: state.emergency?.name ?? '',
                emergencyRelationship: state.emergency?.relationship ?? '',
                emergencyPhone: state.emergency?.phone ?? '',
                hasMedicalCondition: state.health ? state.health.hasCondition : null,
                medicalDetails: state.health?.details ?? '',
              },
              'availability',
            )}
          />
        )
      }

      case 'motivation': {
        const discoverySources = await getLookupOptions('DISCOVERY_SOURCE')
        return (
          <MotivationStep
            discoverySources={discoverySources}
            initialValues={merge(
              {
                discoverySource: state.application.discoverySource ?? '',
                discoveryOther: state.application.discoveryOther ?? '',
                whyVolunteer: state.application.whyVolunteer ?? '',
                skillsExperience: state.application.skillsExperience ?? '',
                additionalInfo: state.application.additionalInfo ?? '',
              },
              'motivation',
            )}
          />
        )
      }

      case 'review': {
        const sections = await buildReviewSections(state)
        return <ReviewStep sections={sections} />
      }

      default:
        notFound()
    }
  }
}

export function generateStaticParams() {
  return WIZARD_STEPS.map((step) => ({ step: step.slug }))
}
