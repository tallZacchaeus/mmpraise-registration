import { expect, test } from '@playwright/test'
import { clearRateLimits, unlockAccounts } from './rate-limit'
import { continueStep, expectStep, newVolunteer, pickFromCombobox, signIn, signOut, signUp } from './helpers'

/**
 * The full volunteer journey, exercised the way an applicant would.
 * Covers account creation, every wizard step, conditional department questions,
 * draft persistence across a reload, consent enforcement and submission.
 */
test.describe('volunteer registration', () => {
  // Rate limiting is per IP; the whole suite shares one.
  test.beforeEach(async () => {
    await clearRateLimits()
    await unlockAccounts()
  })

  test('completes registration from account creation to submission', async ({ page }) => {
    const volunteer = newVolunteer('journey')
    await signUp(page, volunteer)

    // --- Step 1: personal -------------------------------------------------
    await page.goto('/apply/personal')
    await page.locator('input[name="gender"][value="FEMALE"]').check()
    await page.locator('#field-phoneLocal').fill(volunteer.phoneLocal)
    await page.locator('input[name="ageRange"][value="AGE_21_25"]').check()
    await continueStep(page)
    await expectStep(page, 'location')

    // --- Step 2: location, with a dependent state list --------------------
    await pickFromCombobox(page, 'field-countryId', 'Nigeria')
    await pickFromCombobox(page, 'field-stateId', 'Lagos')
    await page.locator('#field-city').fill('Ikeja')
    await continueStep(page)
    await expectStep(page, 'professional')

    // --- Step 3: professional --------------------------------------------
    await pickFromCombobox(page, 'field-occupation', 'Technology')
    await pickFromCombobox(page, 'field-education', "Bachelor's Degree")
    await continueStep(page)
    await expectStep(page, 'church')

    // --- Step 4: church, RCCG branch --------------------------------------
    await page.locator('input[name="denomination"][value="RCCG"]').check()
    await pickFromCombobox(page, 'field-churchRegionId', 'Region 1')
    await pickFromCombobox(page, 'field-churchProvinceId', 'Lagos Province 1')
    await pickFromCombobox(page, 'field-parishId', 'City of David')
    await continueStep(page)
    await expectStep(page, 'department')

    // --- Step 5: department and its conditional questions -----------------
    await page.locator('input[name="departmentId"]').first().waitFor()
    await page
      .locator('label', { hasText: 'Volunteers Praise Team' })
      .locator('input[name="departmentId"]')
      .check()

    await expect(page.getByText(/how would you like to serve/i)).toBeVisible()

    // Choosing Instrumentalist reveals the instrument question, not voice part.
    await page.locator('input[name="music_option"][value="instrumentalist"]').check()
    await expect(page.getByText(/which instrument do you play/i)).toBeVisible()
    await expect(page.getByText(/which voice part do you sing/i)).toHaveCount(0)

    // Switching to Singer swaps the branch and discards the other answer.
    await page.locator('input[name="music_option"][value="singer"]').check()
    await expect(page.getByText(/which voice part do you sing/i)).toBeVisible()
    await expect(page.getByText(/which instrument do you play/i)).toHaveCount(0)

    await page.locator('input[name="first_time"][value="no"]').check()
    await page.locator('input[name="voice_role"][value="alto"]').check()
    await continueStep(page)
    await expectStep(page, 'availability')

    // --- Step 6: availability and health ----------------------------------
    await page.locator('input[name="availableDates"]').first().check()
    await page.locator('input[name="preferredPeriods"][value="MORNING"]').check()
    await page.locator('input[name="availableOvernight"][value="no"]').check()
    await page.locator('#field-emergencyName').fill('Tunde Adeyemi')
    await page.locator('#field-emergencyRelationship').fill('Father')
    await page.locator('#field-emergencyPhone').fill('+2348039876543')
    await page.locator('input[name="hasMedicalCondition"][value="no"]').check()
    await continueStep(page)
    await expectStep(page, 'motivation')

    // --- Step 7: motivation ------------------------------------------------
    await page.locator('input[name="discoverySource"][value="church_announcement"]').check()
    await page
      .locator('#field-whyVolunteer')
      .fill('I want to serve on the praise team and support the marathon.')
    await continueStep(page)
    await expectStep(page, 'review')

    // --- Step 8: review and consent ---------------------------------------
    // The address also appears in the "confirm your email" banner, so scope
    // the assertion to the review table's own cell.
    await expect(page.getByText(volunteer.email, { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Volunteers Praise Team').first()).toBeVisible()

    // Submitting without consent must be refused.
    await page.getByRole('button', { name: /submit registration/i }).click()
    await expect(page.getByRole('alert').first()).toContainText(/confirm your information is accurate/i)

    for (const checkbox of await page.locator('form input[type="checkbox"]').all()) await checkbox.check()
    await page.getByRole('button', { name: /submit registration/i }).click()

    await expect(page).toHaveURL(/\/apply\/submitted/, { timeout: 30_000 })
    await expect(page.getByRole('heading', { name: /registration submitted/i })).toBeVisible()

    /*
     * The confirmation shows the volunteer's permanent MMP number, not the
     * per-edition `MMP-2027-000123` reference it used to show.
     *
     * A volunteer registers once and returns each edition to mark availability,
     * so the number that identifies them never changes — and it is the only one
     * they should ever be asked to quote. Showing two identifiers that both
     * begin "MMP" is how a check-in desk looks up the wrong one.
     */
    await expect(page.getByText(/MMP\d{7}/)).toBeVisible()
    await expect(page.locator('main')).not.toContainText(/MMP-\d{4}-\d{6}/)
  })

  test('shows the two-step journey rather than a bare step count', async ({ page }) => {
    await page.goto('/register')

    const stepper = page.getByRole('navigation', { name: /registration progress/i })
    await expect(stepper).toBeVisible()
    await expect(stepper.getByText('Account')).toBeVisible()
    await expect(stepper.getByText('Registration')).toBeVisible()
    // The current step is announced, not only coloured.
    await expect(stepper.locator('[aria-current="step"]')).toContainText('Account')
  })

  test('reports username availability live and offers alternatives', async ({ page }) => {
    const taken = newVolunteer('dupe')
    await signUp(page, taken)
    await signOut(page)

    await page.goto('/register')
    await page.locator('#signup-username').fill(taken.username)

    // Debounced, so allow for the wait before the verdict lands.
    await expect(page.getByText(/already taken/i)).toBeVisible({ timeout: 15_000 })

    // A rejection must come with a way forward, not just a refusal.
    const suggestion = page.getByRole('button', { name: new RegExp(`^${taken.username}\\d$`) }).first()
    await expect(suggestion).toBeVisible()
    const chosen = await suggestion.innerText()
    await suggestion.click()
    await expect(page.locator('#signup-username')).toHaveValue(chosen)
    await expect(page.getByText(/that username is available/i)).toBeVisible({ timeout: 15_000 })
  })

  test('generates a password that satisfies every rule', async ({ page }) => {
    await page.goto('/register')

    await page.getByRole('button', { name: /generate a secure password/i }).click()

    const value = await page.locator('#signup-password').inputValue()
    expect(value.length).toBeGreaterThanOrEqual(12)
    // Revealed on generation — nobody can save a password they never saw.
    await expect(page.locator('#signup-password')).toHaveAttribute('type', 'text')

    const meter = page.getByRole('progressbar', { name: /password strength/i })
    await expect(meter).toBeVisible()
    expect(Number(await meter.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(3)
  })

  test('confirms the two passwords match as you type', async ({ page }) => {
    await page.goto('/register')

    await page.locator('#signup-password').fill('Praise2027!Strong')
    await page.locator('#signup-confirmPassword').fill('Praise2027!Wrong')
    await expect(page.getByText(/both passwords must match/i)).toBeVisible()

    await page.locator('#signup-confirmPassword').fill('Praise2027!Strong')
    await expect(page.getByText(/both passwords match/i)).toBeVisible()
  })

  test('keeps a draft after a page reload', async ({ page }) => {
    const volunteer = newVolunteer('draft')
    await signUp(page, volunteer)

    await page.goto('/apply/personal')
    await page.locator('input[name="gender"][value="MALE"]').check()
    await page.locator('#field-phoneLocal').fill(volunteer.phoneLocal)
    // Wait past the autosave debounce.
    await page.waitForTimeout(2500)

    await page.reload()
    await expect(page.locator('input[name="gender"][value="MALE"]')).toBeChecked()
    await expect(page.locator('#field-phoneLocal')).toHaveValue(volunteer.phoneLocal)
  })

  test('shows guardian consent fields only for volunteers under 18', async ({ page }) => {
    await signUp(page, newVolunteer('minor'))
    await page.goto('/apply/personal')

    await expect(page.getByText(/parental or guardian consent required/i)).toHaveCount(0)

    await page.locator('input[name="ageRange"][value="AGE_00_15"]').check()
    await expect(page.getByText(/parental or guardian consent required/i)).toBeVisible()
    await expect(page.locator('#field-guardianName')).toBeVisible()

    // The 16–20 band straddles 18, so it must ask and start unanswered.
    await page.locator('input[name="ageRange"][value="AGE_16_20"]').check()
    await expect(page.getByText(/are you under 18 years old/i)).toBeVisible()
    await expect(page.locator('input[name="isMinor"][value="yes"]')).not.toBeChecked()
    await expect(page.locator('input[name="isMinor"][value="no"]')).not.toBeChecked()

    await page.locator('input[name="ageRange"][value="AGE_26_30"]').check()
    await expect(page.getByText(/are you under 18 years old/i)).toHaveCount(0)
    await expect(page.getByText(/parental or guardian consent required/i)).toHaveCount(0)
  })

  test('reports validation errors and does not lose entered values', async ({ page }) => {
    await signUp(page, newVolunteer('validation'))
    await page.goto('/apply/personal')

    await page.locator('#field-phoneLocal').fill('123')
    await continueStep(page)

    const summary = page.getByRole('alert').first()
    await expect(summary).toBeVisible()
    await expect(summary).toContainText(/fix the following/i)
    // The value the volunteer typed is still there.
    await expect(page.locator('#field-phoneLocal')).toHaveValue('123')
    await expect(page).toHaveURL(/\/apply\/personal/)
  })

  test('rejects a duplicate email address at sign-up', async ({ page }) => {
    const volunteer = newVolunteer('duplicate')
    await signUp(page, volunteer)
    await signOut(page)

    await page.goto('/register')
    await page.locator('#signup-firstName').fill(volunteer.firstName)
    await page.locator('#signup-lastName').fill(volunteer.lastName)
    await page.locator('#signup-email').fill(volunteer.email)
    await page.locator('#signup-username').fill(`${volunteer.username}b`)
    await page.locator('#signup-password').fill(volunteer.password)
    await page.locator('#signup-confirmPassword').fill(volunteer.password)
    await page.locator('form input[type="checkbox"]').first().check()
    await page.getByRole('button', { name: /continue to volunteer registration/i }).click()

    await expect(page.getByRole('alert').first()).toContainText(/already registered/i)
  })

  test('gives the same message for an unknown account and a wrong password', async ({ page }) => {
    await signIn(page, 'definitely-not-a-user@example.com', 'WrongPassword1')
    const unknown = (await page.getByRole('alert').first().textContent())?.trim()

    const volunteer = newVolunteer('enumeration')
    await signUp(page, volunteer)
    await signOut(page)

    await signIn(page, volunteer.email, 'WrongPassword1')
    const known = (await page.getByRole('alert').first().textContent())?.trim()

    expect(known).toBe(unknown)
  })
})
