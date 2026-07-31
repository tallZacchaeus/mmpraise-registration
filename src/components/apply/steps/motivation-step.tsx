'use client'

import { saveMotivationAction } from '@/app/(volunteer)/apply/actions'
import { StepShell } from '@/components/apply/step-shell'
import { useStepForm } from '@/components/apply/use-step-form'
import { Field, RadioGroup, TextArea, TextInput } from '@/components/ui/form'
import { discoverySchema, type MotivationFormValues } from '@/lib/validation/registration'

type Lookup = { value: string; label: string; requiresText: boolean }

const LABELS: Record<string, string> = {
  discoverySource: 'How you heard about us',
  discoveryOther: 'How you heard about us (other)',
  whyVolunteer: 'Why you want to volunteer',
  skillsExperience: 'Skills and experience',
  additionalInfo: 'Additional information',
}

export function MotivationStep({
  initialValues,
  discoverySources,
}: {
  initialValues: MotivationFormValues
  discoverySources: Lookup[]
}) {
  const form = useStepForm<MotivationFormValues>({
    step: 'motivation',
    initialValues,
    schema: discoverySchema,
    action: saveMotivationAction,
    nextHref: '/apply/review',
  })

  const needsOther = discoverySources.find((s) => s.value === form.values.discoverySource)?.requiresText

  return (
    <StepShell
      stepNumber={7}
      title="Discovery and motivation"
      description="A little about why you want to serve with us."
      errors={form.errors}
      errorLabels={LABELS}
      formError={form.formError}
      pending={form.pending}
      saveState={form.saveState}
      onSubmit={form.submit}
      onSaveAndExit={form.saveAndExit}
    >
      <Field
        label="How did you hear about MMPraise volunteering?"
        required
        error={form.errors.discoverySource}
        asFieldset
      >
        <RadioGroup
          name="discoverySource"
          columns={2}
          value={form.values.discoverySource ?? null}
          onChange={(value) => form.patch({ discoverySource: value, discoveryOther: '' })}
          invalid={Boolean(form.errors.discoverySource)}
          options={discoverySources.map((s) => ({ value: s.value, label: s.label }))}
        />
      </Field>

      {needsOther && (
        <Field label="Please tell us where" htmlFor="field-discoveryOther" required error={form.errors.discoveryOther}>
          <TextInput
            id="field-discoveryOther"
            maxLength={120}
            value={form.values.discoveryOther ?? ''}
            onChange={(e) => form.setValue('discoveryOther', e.target.value)}
            invalid={Boolean(form.errors.discoveryOther)}
          />
        </Field>
      )}

      <Field
        label="Why do you want to volunteer at MMPraise?"
        htmlFor="field-whyVolunteer"
        required
        error={form.errors.whyVolunteer}
        help="A few sentences is plenty."
      >
        <TextArea
          id="field-whyVolunteer"
          maxLength={1000}
          value={form.values.whyVolunteer ?? ''}
          onChange={(e) => form.setValue('whyVolunteer', e.target.value)}
          invalid={Boolean(form.errors.whyVolunteer)}
        />
      </Field>

      <Field
        label="Relevant skills or experience"
        htmlFor="field-skillsExperience"
        error={form.errors.skillsExperience}
        help="Anything that might help us place you well."
      >
        <TextArea
          id="field-skillsExperience"
          maxLength={1000}
          value={form.values.skillsExperience ?? ''}
          onChange={(e) => form.setValue('skillsExperience', e.target.value)}
          invalid={Boolean(form.errors.skillsExperience)}
        />
      </Field>

      <Field
        label="Anything else we should know?"
        htmlFor="field-additionalInfo"
        error={form.errors.additionalInfo}
      >
        <TextArea
          id="field-additionalInfo"
          maxLength={1000}
          value={form.values.additionalInfo ?? ''}
          onChange={(e) => form.setValue('additionalInfo', e.target.value)}
          invalid={Boolean(form.errors.additionalInfo)}
        />
      </Field>
    </StepShell>
  )
}
