import { AppHeader } from '@/components/layout/app-header'
import { requireUser } from '@/lib/auth/rbac'

export default async function VolunteerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()

  return (
    <div className="flex min-h-dvh flex-col bg-surface-sunken">
      <AppHeader user={user} />
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        {children}
      </main>
      <footer className="border-t border-line bg-surface px-4 py-5 text-center text-xs text-muted sm:px-6">
        © {new Date().getFullYear()} MMPraise · Need help?{' '}
        <a href="mailto:volunteers@mmpraise.org" className="text-primary underline underline-offset-4">
          volunteers@mmpraise.org
        </a>
      </footer>
    </div>
  )
}
