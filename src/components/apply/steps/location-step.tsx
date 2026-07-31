'use client'

import { useMemo } from 'react'
import { saveLocationAction } from '@/app/(volunteer)/apply/actions'
import { StepShell } from '@/components/apply/step-shell'
import { useReferenceList } from '@/components/apply/use-reference'
import { useStepForm } from '@/components/apply/use-step-form'
import { Combobox } from '@/components/ui/combobox'
import { Alert } from '@/components/ui/primitives'
import { Field, TextArea, TextInput } from '@/components/ui/form'
import { locationSchema, type LocationFormValues } from '@/lib/validation/registration'

type CountryOption = { id: string; iso2: string; name: string; hasStates: boolean }

const LABELS: Record<string, string> = {
  countryId: 'Country',
  stateId: 'State or province',
  stateNameOther: 'State or province',
  city: 'City or town',
  addressLine: 'Residential address',
}

export function LocationStep({
  initialValues,
  countries,
}: {
  initialValues: LocationFormValues
  countries: CountryOption[]
}) {
  const form = useStepForm<LocationFormValues>({
    step: 'location',
    initialValues,
    schema: locationSchema,
    action: saveLocationAction,
    nextHref: '/apply/professional',
  })

  const selectedCountry = countries.find((c) => c.id === form.values.countryId) ?? null
  const hasStates = Boolean(selectedCountry?.hasStates)

  // Only requested once a country is selected — the state list is never part of
  // the initial page payload.
  const { items: states, loading: statesLoading, error: statesError } = useReferenceList(
    'states',
    hasStates ? form.values.countryId : null,
  )

  const countryOptions = useMemo(
    () => countries.map((country) => ({ value: country.id, label: country.name })),
    [countries],
  )

  return (
    <StepShell
      stepNumber={2}
      title="Location information"
      description="Where will you be travelling from?"
      errors={form.errors}
      errorLabels={LABELS}
      formError={form.formError}
      pending={form.pending}
      saveState={form.saveState}
      onSubmit={form.submit}
      onSaveAndExit={form.saveAndExit}
    >
      <Field
        label="Country"
        htmlFor="field-countryId"
        required
        error={form.errors.countryId}
        help="Start typing to search the list."
      >
        <Combobox
          id="field-countryId"
          options={countryOptions}
          value={form.values.countryId ?? null}
          onChange={(value) => {
            const country = countries.find((c) => c.id === value)
            // Changing country invalidates any state already chosen.
            form.patch({
              countryId: value ?? '',
              countryHasStates: Boolean(country?.hasStates),
              stateId: null,
              stateNameOther: '',
            })
          }}
          placeholder="Search for your country"
          invalid={Boolean(form.errors.countryId)}
        />
      </Field>

      {form.values.countryId && hasStates && (
        <Field label="State or province" htmlFor="field-stateId" required error={form.errors.stateId}>
          {statesError ? (
            <Alert tone="danger">{statesError}</Alert>
          ) : (
            <Combobox
              id="field-stateId"
              options={states.map((state) => ({ value: state.id, label: state.name }))}
              value={form.values.stateId ?? null}
              onChange={(value) => form.setValue('stateId', value)}
              placeholder={statesLoading ? 'Loading…' : 'Search for your state'}
              loading={statesLoading}
              invalid={Boolean(form.errors.stateId)}
              emptyMessage="No matching state"
            />
          )}
        </Field>
      )}

      {form.values.countryId && !hasStates && (
        <Field
          label="State, province or region"
          htmlFor="field-stateNameOther"
          required
          error={form.errors.stateNameOther}
          help="We do not hold a list for this country, so please type it in."
        >
          <TextInput
            id="field-stateNameOther"
            value={form.values.stateNameOther ?? ''}
            onChange={(e) => form.setValue('stateNameOther', e.target.value)}
            invalid={Boolean(form.errors.stateNameOther)}
          />
        </Field>
      )}

      <Field label="City or town" htmlFor="field-city" required error={form.errors.city}>
        <TextInput
          id="field-city"
          autoComplete="address-level2"
          value={form.values.city ?? ''}
          onChange={(e) => form.setValue('city', e.target.value)}
          invalid={Boolean(form.errors.city)}
        />
      </Field>

      <Field
        label="Residential address"
        htmlFor="field-addressLine"
        error={form.errors.addressLine}
        help="Optional. Helpful if you need transport or accommodation support."
      >
        <TextArea
          id="field-addressLine"
          maxLength={200}
          autoComplete="street-address"
          value={form.values.addressLine ?? ''}
          onChange={(e) => form.setValue('addressLine', e.target.value)}
          invalid={Boolean(form.errors.addressLine)}
        />
      </Field>
    </StepShell>
  )
}
