import 'server-only'
import { eventConfig } from '@/config/site'
import { db } from '@/lib/db'

/**
 * Who an announcement's audience is *today*.
 *
 * One query, used both to email the audience and to tell the publisher how
 * many people that means — so the number in the publish dialog can never
 * disagree with the number of emails sent.
 *
 * Department targeting goes through the current edition's participation:
 * department is a per-edition choice, and the application-level column this
 * used to filter on no longer exists.
 */
export async function announcementRecipients(announcement: {
  audience: string
  departmentId: string | null
}) {
  return db.volunteerApplication.findMany({
    where: {
      status:
        announcement.audience === 'APPROVED_ONLY'
          ? { in: ['APPROVED', 'ASSIGNED', 'CHECKED_IN'] }
          : { not: 'DRAFT' },
      ...(announcement.audience === 'DEPARTMENT' && announcement.departmentId
        ? {
            participations: {
              some: { edition: eventConfig.edition, departmentId: announcement.departmentId },
            },
          }
        : {}),
    },
    select: { user: { select: { email: true, profile: { select: { firstName: true } } } } },
  })
}
