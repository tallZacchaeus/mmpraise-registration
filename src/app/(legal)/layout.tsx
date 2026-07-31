import Link from 'next/link'
import { Logo } from '@/components/ui/primitives'

/**
 * Standalone shell for the terms and privacy pages.
 * These open in a new tab from the consent checkboxes, so they must render
 * without any of the wizard's state.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-surface px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <Link href="/" aria-label="MMPraise Volunteers home">
            <Logo />
          </Link>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <article className="space-y-5 [&_h2]:mt-8 [&_h2]:text-xl [&_h3]:mt-6 [&_h3]:text-base [&_li]:mb-1 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
        </article>
      </main>

      <footer className="border-t border-line px-4 py-6 text-center text-xs text-muted sm:px-6">
        © {new Date().getFullYear()} MMPraise
      </footer>
    </div>
  )
}
