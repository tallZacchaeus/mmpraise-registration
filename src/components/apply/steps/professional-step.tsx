'use client'

import { saveProfessionalAction } from '@/app/(volunteer)/apply/actions'
import { StepShell } from '@/components/apply/step-shell'
import { useStepForm } from '@/components/apply/use-step-form'
import { Combobox } from '@/components/ui/combobox'
import { Field, TextInput } from '@/components/ui/form'
import { professionalSchema, type ProfessionalFormValues } from '@/lib/validation/registration'

type Lookup = { value: string; label: string; requiresText: boolean }

const LABELS: Record<string, string> = {
  occupation: 'Occupation',
  occupationOther: 'Occupation (other)',
  education: 'Educational qualification',
  educationOther: 'Qualification (other)',
}

export function ProfessionalStep({
  initialValues,
  occupations,
  educationLevels,
}: {
  initialValues: ProfessionalFormValues
  occupations: Lookup[]
  educationLevels: Lookup[]
}) {
  const form = useStepForm<ProfessionalFormValues>({
    step: 'professional',
    initialValues,
    schema: professionalSchema,
    action: saveProfessionalAction,
    nextHref: '/apply/church',
  })

  const occupationNeedsText = occupations.find((o) => o.value === form.values.occupation)?.requiresText
  const educationNeedsText = educationLevels.find((o) => o.value === form.values.education)?.requiresText

  return (
    <StepShell
      stepNumber={3}
      title="Professional and educational information"
      description="This helps us place you where your skills are most useful."
      errors={form.errors}
      errorLabels={LABELS}
      formError={form.formError}
      pending={form.pending}
      saveState={form.saveState}
      onSubmit={form.submit}
      onSaveAndExit={form.saveAndExit}
    >
      <Field label="Occupation" htmlFor="field-occupation" required error={form.errors.occupation}>
        <Combobox
          id="field-occupation"
          options={occupations.map((o) => ({ value: o.value, label: o.label }))}
          value={form.values.occupation ?? null}
          onChange={(value) => form.patch({ occupation: value ?? '', occupationOther: '' })}
          placeholder="Search occupations"
          invalid={Boolean(form.errors.occupation)}
        />
      </Field>

      {occupationNeedsText && (
        <Field
          label="Please specify your occupation"
          htmlFor="field-occupationOther"
          required
          error={form.errors.occupationOther}
        >
          <TextInput
            id="field-occupationOther"
            maxLength={80}
            value={form.values.occupationOther ?? ''}
            onChange={(e) => form.setValue('occupationOther', e.target.value)}
            invalid={Boolean(form.errors.occupationOther)}
          />
        </Field>
      )}

      <Field label="Highest educational qualification" htmlFor="field-education" required error={form.errors.education}>
        <Combobox
          id="field-education"
          options={educationLevels.map((o) => ({ value: o.value, label: o.label }))}
          value={form.values.education ?? null}
          onChange={(value) => form.patch({ education: value ?? '', educationOther: '' })}
          placeholder="Select a qualification"
          invalid={Boolean(form.errors.education)}
        />
      </Field>

      {educationNeedsText && (
        <Field
          label="Please specify your qualification"
          htmlFor="field-educationOther"
          required
          error={form.errors.educationOther}
        >
          <TextInput
            id="field-educationOther"
            maxLength={80}
            value={form.values.educationOther ?? ''}
            onChange={(e) => form.setValue('educationOther', e.target.value)}
            invalid={Boolean(form.errors.educationOther)}
          />
        </Field>
      )}
    </StepShell>
  )
}
