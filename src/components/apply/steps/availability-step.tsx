'use client'

import { ShieldCheck } from 'lucide-react'
import { saveAvailabilityAction } from '@/app/(volunteer)/apply/actions'
import { StepShell } from '@/components/apply/step-shell'
import { useStepForm } from '@/components/apply/use-step-form'
import { Alert } from '@/components/ui/primitives'
import { CheckboxGroup, Field, RadioGroup, TextArea, TextInput } from '@/components/ui/form'
import { formatDate } from '@/lib/utils'
import { availabilitySchema, SHIFT_PERIODS, type AvailabilityFormValues } from '@/lib/validation/registration'

const LABELS: Record<string, string> = {
  availableDates: 'Preferred dates',
  preferredPeriods: 'Preferred shifts',
  availableOvernight: 'Overnight availability',
  emergencyName: 'Emergency contact name',
  emergencyRelationship: 'Emergency contact relationship',
  emergencyPhone: 'Emergency contact phone',
  hasMedicalCondition: 'Medical condition',
  medicalDetails: 'Medical details',
}

export function AvailabilityStep({
  initialValues,
  eventDates,
}: {
  initialValues: AvailabilityFormValues
  eventDates: string[]
}) {
  const form = useStepForm<AvailabilityFormValues>({
    step: 'availability',
    initialValues,
    schema: availabilitySchema,
    action: saveAvailabilityAction,
    nextHref: '/apply/motivation',
  })

  return (
    <StepShell
      stepNumber={6}
      title="Availability and health information"
      description="When can you serve, and who should we contact in an emergency?"
      errors={form.errors}
      errorLabels={LABELS}
      formError={form.formError}
      pending={form.pending}
      saveState={form.saveState}
      onSubmit={form.submit}
      onSaveAndExit={form.saveAndExit}
    >
      <Field
        label="Which dates can you serve?"
        required
        error={form.errors.availableDates}
        help="Select every date you are available."
        asFieldset
      >
        {eventDates.length === 0 ? (
          <Alert tone="info">Event dates have not been published yet. You can update this later from your dashboard.</Alert>
        ) : (
          <CheckboxGroup
            name="availableDates"
            columns={2}
            values={form.values.availableDates ?? []}
            onToggle={(value) => form.toggleInArray('availableDates', value)}
            invalid={Boolean(form.errors.availableDates)}
            options={eventDates.map((date) => ({ value: date, label: formatDate(date) }))}
          />
        )}
      </Field>

      <Field
        label="Preferred shifts"
        required
        error={form.errors.preferredPeriods}
        help="We use this as a preference, not a guarantee."
        asFieldset
      >
        <CheckboxGroup
          name="preferredPeriods"
          columns={2}
          values={form.values.preferredPeriods ?? []}
          onToggle={(value) => form.toggleInArray('preferredPeriods', value)}
          invalid={Boolean(form.errors.preferredPeriods)}
          options={SHIFT_PERIODS.map((period) => ({
            value: period.value,
            label: period.label,
            description: period.hint,
          }))}
        />
      </Field>

      <Field label="Are you available for overnight sessions?" required error={form.errors.availableOvernight} asFieldset>
        <RadioGroup
          name="availableOvernight"
          columns={2}
          value={
            form.values.availableOvernight === null || form.values.availableOvernight === undefined
              ? null
              : form.values.availableOvernight
                ? 'yes'
                : 'no'
          }
          onChange={(value) => form.setValue('availableOvernight', value === 'yes')}
          invalid={Boolean(form.errors.availableOvernight)}
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]}
        />
      </Field>

      <section className="space-y-6 rounded-card border border-line bg-surface-sunken p-5">
        <h3 className="text-base">Emergency contact</h3>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Full name" htmlFor="field-emergencyName" required error={form.errors.emergencyName}>
            <TextInput
              id="field-emergencyName"
              value={form.values.emergencyName ?? ''}
              onChange={(e) => form.setValue('emergencyName', e.target.value)}
              invalid={Boolean(form.errors.emergencyName)}
            />
          </Field>

          <Field
            label="Relationship to you"
            htmlFor="field-emergencyRelationship"
            required
            error={form.errors.emergencyRelationship}
          >
            <TextInput
              id="field-emergencyRelationship"
              placeholder="Parent, spouse, sibling, friend…"
              value={form.values.emergencyRelationship ?? ''}
              onChange={(e) => form.setValue('emergencyRelationship', e.target.value)}
              invalid={Boolean(form.errors.emergencyRelationship)}
            />
          </Field>
        </div>

        <Field
          label="Phone number"
          htmlFor="field-emergencyPhone"
          required
          error={form.errors.emergencyPhone}
          help="Include the country code, for example +2348012345678."
        >
          <TextInput
            id="field-emergencyPhone"
            type="tel"
            inputMode="tel"
            value={form.values.emergencyPhone ?? ''}
            onChange={(e) => form.setValue('emergencyPhone', e.target.value)}
            invalid={Boolean(form.errors.emergencyPhone)}
          />
        </Field>
      </section>

      <section className="space-y-6">
        <Alert tone="info" title="How we handle health information" icon={<ShieldCheck className="size-5" />}>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              <strong>Why we ask:</strong> so the welfare and medical teams can keep you safe during long shifts.
            </li>
            <li>
              <strong>Who can see it:</strong> only the Medical Information Officer and Super Administrators. It never
              appears in volunteer lists, exports or emails.
            </li>
            <li>
              <strong>How it is protected:</strong> stored separately from your application, access-controlled and
              logged whenever it is viewed.
            </li>
            <li>
              <strong>What to share:</strong> only what is relevant to volunteering safely — for example asthma,
              epilepsy, diabetes, mobility needs or severe allergies.
            </li>
          </ul>
        </Alert>

        <Field
          label="Do you have a medical condition the volunteer coordinator should know about?"
          required
          error={form.errors.hasMedicalCondition}
          asFieldset
        >
          <RadioGroup
            name="hasMedicalCondition"
            columns={2}
            value={
              form.values.hasMedicalCondition === null || form.values.hasMedicalCondition === undefined
                ? null
                : form.values.hasMedicalCondition
                  ? 'yes'
                  : 'no'
            }
            onChange={(value) => form.patch({ hasMedicalCondition: value === 'yes', medicalDetails: value === 'yes' ? form.values.medicalDetails : '' })}
            invalid={Boolean(form.errors.hasMedicalCondition)}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]}
          />
        </Field>

        {form.values.hasMedicalCondition && (
          <Field
            label="What should we know?"
            htmlFor="field-medicalDetails"
            required
            error={form.errors.medicalDetails}
            help="Kept private and shared only with authorised medical staff."
          >
            <TextArea
              id="field-medicalDetails"
              maxLength={1000}
              value={form.values.medicalDetails ?? ''}
              onChange={(e) => form.setValue('medicalDetails', e.target.value)}
              invalid={Boolean(form.errors.medicalDetails)}
            />
          </Field>
        )}
      </section>
    </StepShell>
  )
}
