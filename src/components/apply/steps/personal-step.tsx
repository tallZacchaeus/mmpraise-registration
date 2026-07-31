'use client'

import { useMemo } from 'react'
import { savePersonalAction } from '@/app/(volunteer)/apply/actions'
import { PhotoUpload } from '@/components/apply/photo-upload'
import { StepShell } from '@/components/apply/step-shell'
import { useStepForm } from '@/components/apply/use-step-form'
import { Combobox } from '@/components/ui/combobox'
import { Alert } from '@/components/ui/primitives'
import { Checkbox, Field, RadioGroup, TextInput } from '@/components/ui/form'
import { toE164 } from '@/lib/validation/common'
import {
  AGE_RANGES,
  ALWAYS_MINOR_RANGES,
  ASK_IF_MINOR_RANGES,
  personalSchema,
  type PersonalFormValues,
} from '@/lib/validation/registration'

type CountryOption = { id: string; iso2: string; name: string; phoneCode: string }

const LABELS: Record<string, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  gender: 'Gender',
  email: 'Email address',
  phoneLocal: 'Phone number',
  phoneDialCode: 'Country code',
  ageRange: 'Age range',
  isMinor: 'Age confirmation',
  guardianName: 'Parent or guardian name',
  guardianPhone: 'Parent or guardian phone',
  guardianConsent: 'Parental consent',
}

export function PersonalStep({
  initialValues,
  countries,
}: {
  initialValues: PersonalFormValues
  countries: CountryOption[]
}) {
  const form = useStepForm<PersonalFormValues>({
    step: 'personal',
    initialValues,
    schema: personalSchema,
    action: savePersonalAction,
    nextHref: '/apply/location',
    // The stored phone number is always the E.164 combination of the two inputs.
    prepare: (values) => ({ ...values, phone: toE164(values.phoneDialCode, values.phoneLocal) }),
  })

  const dialOptions = useMemo(
    () =>
      countries.map((country) => ({
        value: country.phoneCode,
        label: `${country.name} +${country.phoneCode}`,
        hint: country.iso2,
      })),
    [countries],
  )

  const ageRange = form.values.ageRange
  const mustAsk = ASK_IF_MINOR_RANGES.includes(ageRange ?? '')
  const isMinor = ALWAYS_MINOR_RANGES.includes(ageRange ?? '') || form.values.isMinor === true

  return (
    <StepShell
      stepNumber={1}
      title="Personal information"
      description="Tell us who you are and how we can reach you."
      errors={form.errors}
      errorLabels={LABELS}
      formError={form.formError}
      pending={form.pending}
      saveState={form.saveState}
      onSubmit={form.submit}
      onSaveAndExit={form.saveAndExit}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="First name" htmlFor="field-firstName" required error={form.errors.firstName}>
          <TextInput
            id="field-firstName"
            autoComplete="given-name"
            value={form.values.firstName ?? ''}
            onChange={(e) => form.setValue('firstName', e.target.value)}
            invalid={Boolean(form.errors.firstName)}
          />
        </Field>

        <Field label="Last name" htmlFor="field-lastName" required error={form.errors.lastName}>
          <TextInput
            id="field-lastName"
            autoComplete="family-name"
            value={form.values.lastName ?? ''}
            onChange={(e) => form.setValue('lastName', e.target.value)}
            invalid={Boolean(form.errors.lastName)}
          />
        </Field>
      </div>

      <Field label="Gender" required error={form.errors.gender} asFieldset>
        <RadioGroup
          name="gender"
          columns={2}
          value={form.values.gender ?? null}
          onChange={(value) => form.setValue('gender', value)}
          invalid={Boolean(form.errors.gender)}
          options={[
            { value: 'MALE', label: 'Male' },
            { value: 'FEMALE', label: 'Female' },
          ]}
        />
      </Field>

      <Field
        label="Email address"
        htmlFor="field-email"
        required
        error={form.errors.email}
        help="Changing this address means we will ask you to confirm the new one."
      >
        <TextInput
          id="field-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={form.values.email ?? ''}
          onChange={(e) => form.setValue('email', e.target.value)}
          invalid={Boolean(form.errors.email)}
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <Field label="Country code" htmlFor="field-phoneDialCode" required error={form.errors.phoneDialCode}>
          <Combobox
            id="field-phoneDialCode"
            options={dialOptions}
            value={form.values.phoneDialCode ?? null}
            onChange={(value) => form.setValue('phoneDialCode', value ?? '')}
            placeholder="Search country"
            invalid={Boolean(form.errors.phoneDialCode)}
            allowClear={false}
          />
        </Field>

        <Field
          label="Phone number"
          htmlFor="field-phoneLocal"
          required
          error={form.errors.phoneLocal}
          help="Without the country code or a leading zero — for example 8012345678."
        >
          <TextInput
            id="field-phoneLocal"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={form.values.phoneLocal ?? ''}
            onChange={(e) => form.setValue('phoneLocal', e.target.value)}
            invalid={Boolean(form.errors.phoneLocal)}
          />
        </Field>
      </div>

      <Field label="Age range" required error={form.errors.ageRange} asFieldset>
        <RadioGroup
          name="ageRange"
          columns={3}
          value={ageRange ?? null}
          onChange={(value) =>
            form.patch({ ageRange: value, isMinor: ALWAYS_MINOR_RANGES.includes(value) ? true : null })
          }
          invalid={Boolean(form.errors.ageRange)}
          options={AGE_RANGES.map((range) => ({ value: range.value, label: range.label }))}
        />
      </Field>

      {mustAsk && (
        <Field label="Are you under 18 years old?" required error={form.errors.isMinor} asFieldset>
          <RadioGroup
            name="isMinor"
            columns={2}
            value={form.values.isMinor === null || form.values.isMinor === undefined ? null : form.values.isMinor ? 'yes' : 'no'}
            onChange={(value) => form.setValue('isMinor', value === 'yes')}
            invalid={Boolean(form.errors.isMinor)}
            options={[
              { value: 'yes', label: 'Yes, I am under 18' },
              { value: 'no', label: 'No, I am 18 or older' },
            ]}
          />
        </Field>
      )}

      {isMinor && (
        <div className="space-y-6 rounded-card border border-primary-border bg-primary-subtle p-5">
          <Alert tone="info" title="Parental or guardian consent required">
            Volunteers under 18 need a parent or guardian to consent and to be reachable during the
            event. We contact them only about safeguarding and welfare.
          </Alert>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Parent or guardian full name" htmlFor="field-guardianName" required error={form.errors.guardianName}>
              <TextInput
                id="field-guardianName"
                value={form.values.guardianName ?? ''}
                onChange={(e) => form.setValue('guardianName', e.target.value)}
                invalid={Boolean(form.errors.guardianName)}
              />
            </Field>

            <Field
              label="Parent or guardian phone"
              htmlFor="field-guardianPhone"
              required
              error={form.errors.guardianPhone}
              help="Include the country code, for example +2348012345678."
            >
              <TextInput
                id="field-guardianPhone"
                type="tel"
                inputMode="tel"
                value={form.values.guardianPhone ?? ''}
                onChange={(e) => form.setValue('guardianPhone', e.target.value)}
                invalid={Boolean(form.errors.guardianPhone)}
              />
            </Field>
          </div>

          <Field label="" error={form.errors.guardianConsent} className="[&>label]:sr-only">
            <Checkbox
              checked={Boolean(form.values.guardianConsent)}
              onChange={(checked) => form.setValue('guardianConsent', checked)}
              invalid={Boolean(form.errors.guardianConsent)}
              label="My parent or guardian has given permission for me to volunteer at MMPraise."
            />
          </Field>
        </div>
      )}

      <Field
        label="Profile photograph"
        htmlFor="field-photoDocumentId"
        error={form.errors.photoDocumentId}
        help="Used on your volunteer pass so team leads can identify you."
      >
        <PhotoUpload
          documentId={form.values.photoDocumentId ?? null}
          onChange={(documentId) => form.setValue('photoDocumentId', documentId)}
          error={form.errors.photoDocumentId}
        />
      </Field>
    </StepShell>
  )
}
