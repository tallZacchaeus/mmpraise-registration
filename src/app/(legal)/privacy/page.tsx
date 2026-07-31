import type { Metadata } from 'next'
import { getSettings } from '@/lib/settings'

export const metadata: Metadata = { title: 'Privacy notice' }

/**
 * Placeholder privacy notice describing what the application actually does.
 * MMPraise should have this reviewed before launch, but the technical
 * statements below match the implementation.
 */
export default async function PrivacyPage() {
  const settings = await getSettings()

  return (
    <>
      <h1 className="text-3xl">Privacy notice</h1>
      <p className="text-muted">How MMPraise handles the information you give us when you volunteer.</p>

      <h2>What we collect</h2>
      <ul>
        <li>Your name, gender, age range, email address, phone number and profile photograph.</li>
        <li>Where you are based: country, state or province, city, and optionally your address.</li>
        <li>Your occupation, education and church information.</li>
        <li>Your chosen department and your answers to that department&apos;s questions.</li>
        <li>Your availability, emergency contact, and any health information you choose to share.</li>
        <li>Technical information recorded for security: IP address and browser, at sign-in and submission.</li>
      </ul>

      <h2>Why we collect it</h2>
      <p>
        To assess your application, place you in a suitable department and shift, keep you safe while
        you serve, and contact you about your volunteering. We do not sell your information or use it
        for advertising.
      </p>

      <h2>Health information</h2>
      <p>
        Any medical condition you declare is stored separately from the rest of your application and
        is visible only to the Medical Information Officer and Super Administrators. It never appears
        in volunteer lists, exported files or emails, and every access is recorded in an audit log.
        Please share only what is relevant to volunteering safely.
      </p>

      <h2>Who can see your information</h2>
      <ul>
        <li><strong>Registration administrators</strong> — your full application, excluding health information.</li>
        <li><strong>Department heads</strong> — applications for their own department only.</li>
        <li><strong>Reviewers</strong> — applications they are asked to assess.</li>
        <li><strong>Medical Information Officer</strong> — health information, for welfare planning.</li>
        <li><strong>Communication officers</strong> — contact details, to send volunteer announcements.</li>
      </ul>

      <h2>How we protect it</h2>
      <ul>
        <li>Passwords are stored only as salted scrypt hashes and are never readable by anyone.</li>
        <li>Uploaded files are stored privately and served only to people authorised to see them.</li>
        <li>Access to administrative functions is role-based and recorded in an audit log.</li>
        <li>Traffic is encrypted in transit, and session cookies are HTTP-only and same-site.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        Applications are retained for the event they relate to and for up to 24 months afterwards, so
        returning volunteers do not have to start again. Audit logs are kept for 24 months.
      </p>

      <h2>Your choices</h2>
      <p>
        You can view and correct your information from your dashboard at any time. You can ask us to
        delete your account and personal data by contacting{' '}
        <a href={`mailto:${settings.support_email}`} className="text-primary underline underline-offset-4">
          {settings.support_email}
        </a>
        . We will confirm within 30 days. Some records may be retained where we are required to keep
        them for safeguarding or legal reasons.
      </p>
    </>
  )
}
