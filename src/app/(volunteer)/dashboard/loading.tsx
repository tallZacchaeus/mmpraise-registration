import { Card, CardBody, Skeleton } from '@/components/ui/primitives'

/**
 * What the dashboard looks like while its queries run.
 *
 * The shapes match the real layout — dark hero, full-width journey rail, then
 * the two columns — so the page does not jump when the content lands. The whole
 * thing is one `role="status"` region with a visually hidden sentence, because
 * a screen reader hearing nothing at all cannot tell a slow page from a broken
 * one; the boxes themselves are `aria-hidden` inside `Skeleton`.
 */
export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading your dashboard…</span>

      <div className="rounded-card bg-night texture-grain px-5 py-7 sm:px-8 sm:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-center">
          <div className="space-y-4">
            <Skeleton className="h-6 w-52 bg-white/10" />
            <Skeleton className="h-8 w-64 bg-white/10" />
            <Skeleton className="h-10 w-full max-w-xl bg-white/10" />
            <Skeleton className="h-11 w-56 rounded-pill bg-white/10" />
          </div>
          <Skeleton className="h-36 w-full rounded-card bg-white/10" />
        </div>
      </div>

      <Card>
        <CardBody className="space-y-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex gap-4">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <Skeleton className="h-8 flex-1" />
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardBody className="space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-2 w-full rounded-pill" />
              <Skeleton className="h-32 w-full" />
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Skeleton className="h-40 w-full" />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardBody>
                <Skeleton className="h-32 w-full" />
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
