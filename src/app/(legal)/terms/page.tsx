import type { Metadata } from 'next'
import { getSettings } from '@/lib/settings'

export const metadata: Metadata = { title: 'Volunteer terms and code of conduct' }

/**
 * Placeholder legal text.
 * The MMPraise team should replace the wording below with their approved terms;
 * the structure and links elsewhere in the app do not need to change.
 */
export default async function TermsPage() {
  const settings = await getSettings()

  return (
    <>
      <h1 className="text-3xl">Volunteer terms and code of conduct</h1>
      <p className="text-muted">Applies to volunteering at {settings.event_name}.</p>

      <h2>1. Serving with us</h2>
      <p>
        Volunteering with MMPraise is unpaid service offered freely. Accepting a place means agreeing
        to serve the shifts assigned to you, to arrive on time, and to let your team lead know as
        early as possible if you can no longer attend.
      </p>

      <h2>2. Conduct</h2>
      <ul>
        <li>Treat every volunteer, attendee, minister and member of staff with courtesy and respect.</li>
        <li>Follow the instructions of your department head and the security and safety teams.</li>
        <li>Wear your volunteer identification while on duty and do not share it with anyone else.</li>
        <li>Do not consume alcohol or non-prescribed drugs before or during a shift.</li>
        <li>Harassment, discrimination, intimidation or violence of any kind will end your placement immediately.</li>
      </ul>

      <h2>3. Safeguarding</h2>
      <p>
        Volunteers under 18 may serve only with the documented consent of a parent or guardian, and
        will not be assigned to overnight shifts. Any safeguarding concern must be reported to the
        welfare team without delay.
      </p>

      <h2>4. Health and safety</h2>
      <p>
        Tell the welfare team about anything that affects your ability to serve safely. Follow all
        venue safety instructions, and report accidents, injuries and near misses immediately.
      </p>

      <h2>5. Media and images</h2>
      <p>
        Photography and filming take place throughout the event, and you may appear in recordings and
        published material. Tell the media team if you do not wish to be filmed.
      </p>

      <h2>6. Confidentiality</h2>
      <p>
        Some roles give access to personal information about other volunteers or attendees. Use it
        only for the task assigned to you, never share it outside the team, and never keep copies.
      </p>

      <h2>7. Ending a placement</h2>
      <p>
        You may withdraw at any time by contacting the volunteer team. MMPraise may end a placement
        where these terms are broken, or where it is necessary for the safety of others.
      </p>

      <h2>8. Contact</h2>
      <p>
        Questions about these terms can be sent to{' '}
        <a href={`mailto:${settings.support_email}`} className="text-primary underline underline-offset-4">
          {settings.support_email}
        </a>
        .
      </p>
    </>
  )
}
