import Link from 'next/link'
import {
  BarChart3,
  Building2,
  ClipboardList,
  FileClock,
  Globe2,
  Megaphone,
  MessageSquareQuote,
  Settings,
  Users,
} from 'lucide-react'
import { AppHeader } from '@/components/layout/app-header'
import { can, requireAdmin, type Permission } from '@/lib/auth/rbac'

/**
 * Administration shell.
 *
 * Navigation is filtered by permission so an administrator is never shown a link
 * they cannot use. Each page re-checks its own permission — the nav is a
 * convenience, never the access control.
 */
const NAV: { href: string; label: string; icon: typeof Users; permission: Permission }[] = [
  { href: '/admin', label: 'Overview', icon: BarChart3, permission: 'application:review' },
  { href: '/admin/applications', label: 'Applicants', icon: Users, permission: 'application:review' },
  { href: '/admin/testimonies', label: 'Testimonies', icon: MessageSquareQuote, permission: 'application:review' },
  { href: '/admin/announcements', label: 'Announcements', icon: Megaphone, permission: 'announcement:manage' },
  { href: '/admin/departments', label: 'Departments & questions', icon: ClipboardList, permission: 'question:manage' },
  { href: '/admin/reference', label: 'Reference data', icon: Globe2, permission: 'reference:manage' },
  { href: '/admin/users', label: 'Administrators', icon: Building2, permission: 'user:manage' },
  { href: '/admin/settings', label: 'Settings', icon: Settings, permission: 'settings:manage' },
  { href: '/admin/audit', label: 'Audit log', icon: FileClock, permission: 'audit:view' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin()
  const items = NAV.filter((item) => can(user, item.permission))

  return (
    <div className="flex min-h-dvh flex-col bg-surface-sunken">
      <AppHeader user={user} />

      <div className="mx-auto flex w-full max-w-[100rem] flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        <nav aria-label="Administration" className="lg:w-60 lg:shrink-0">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-field px-3 py-2 text-sm font-semibold text-body hover:bg-surface"
                >
                  <item.icon aria-hidden className="size-4 shrink-0 text-primary" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}
