import { config } from 'dotenv'

// Load .env then .env.local so tests see the same configuration as the app.
config({ path: '.env' })
config({ path: '.env.local', override: true })

// Integration tests must never touch the development database.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
}

// NODE_ENV is typed read-only; assign through the object to keep TypeScript happy.
Object.assign(process.env, { NODE_ENV: 'test' })
process.env.APP_SECRET ??= 'test-secret-value-that-is-long-enough-for-validation'
