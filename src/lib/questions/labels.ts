/** Small display helpers shared by client components (no server imports). */

export function humanFileSizeLabel(maxFileSizeKb: number | null | undefined, fallbackMb = 5): string {
  if (!maxFileSizeKb) return `${fallbackMb} MB`
  if (maxFileSizeKb < 1024) return `${maxFileSizeKb} KB`
  return `${(maxFileSizeKb / 1024).toFixed(maxFileSizeKb % 1024 === 0 ? 0 : 1)} MB`
}
