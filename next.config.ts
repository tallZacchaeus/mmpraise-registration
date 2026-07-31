import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /**
   * Emit a self-contained server in `.next/standalone` with only the modules it
   * actually imports. The Docker image then needs neither `node_modules` nor the
   * source tree, which takes the deployed image from roughly a gigabyte to a
   * couple of hundred megabytes — the difference between a comfortable and a
   * painful deploy on a small VPS.
   */
  output: 'standalone',

  /**
   * No `images.remotePatterns`: every homepage asset is served from
   * /public/landing, so the site never depends on the old WordPress host being
   * reachable. A unit test asserts that no image URL points at mmpraise.org.
   * Adding a pattern back would re-open that dependency.
   */
}

export default nextConfig
