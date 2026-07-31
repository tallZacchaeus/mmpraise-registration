import Link from 'next/link'
import { Logo } from '@/components/ui/primitives'
import { getSettings } from '@/lib/settings'

/**
 * Shell for the signed-out screens.
 * Two columns on desktop (brand panel + form), single column on mobile with the
 * form first — the panel is decorative and must not push the task off-screen.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings()

  return (
    <div className="flex min-h-dvh flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="order-2 bg-night px-6 py-10 text-white lg:order-1 lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-14">
        <Logo inverted />

        <div className="mt-10 hidden lg:block">
          <h1 className="text-4xl text-white">Serve at {settings.event_name}</h1>
          <p className="mt-4 max-w-md text-white/75">
            Join thousands of volunteers across more than 80 nations. Register once, choose a
            department, and manage everything from your volunteer dashboard.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-white/75">
            <li className="flex gap-3">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
              Answer only the questions that apply to your department
            </li>
            <li className="flex gap-3">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
              Save your progress and finish later on any device
            </li>
            <li className="flex gap-3">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
              Track your application status and shift assignments
            </li>
          </ul>
        </div>

        <p className="mt-10 hidden text-xs text-white/50 lg:block">
          © {new Date().getFullYear()} MMPraise. All rights reserved.
        </p>
      </aside>

      <main id="main" className="order-1 flex flex-1 items-start justify-center px-4 py-10 sm:px-6 lg:order-2 lg:items-center lg:py-14">
        <div className="w-full max-w-lg">
          <div className="mb-6 lg:hidden">
            <Link href="/" aria-label="MMPraise Volunteers home">
              <Logo />
            </Link>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
