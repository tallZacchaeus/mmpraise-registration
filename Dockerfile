# MMPraise Volunteer Registration — production image
#
# Multi-stage so the shipped image carries the compiled server and nothing else:
# no source, no dev dependencies, no build toolchain.
#
#   docker compose --env-file .env.production build
#   docker compose --env-file .env.production up -d
#
# Migrations are NOT run from this image. They run from the `build` stage, which
# still has the Prisma CLI and its dependencies — see the `migrate` service in
# docker-compose.yml. The runtime image talks to PostgreSQL through the pg
# driver adapter, which is plain JavaScript, so it needs no Prisma engine binary.
#
# Node 22 matches the version the app is developed and tested against.

FROM node:22-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# --- Dependencies ------------------------------------------------------------
# `npm ci` runs the postinstall hook, which is `prisma generate` — so the schema
# and prisma.config.ts must be present before install, not after.
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

# --- Build -------------------------------------------------------------------
# Also serves as the `migrate` image: it has the Prisma CLI, tsx and the seed
# script, none of which belong in the runtime image.
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined into the browser bundle at build time, so they
# must be present here and not only at runtime. docker-compose passes them
# through as build arguments; see docker-compose.yml.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_EVENT_EDITION
ARG NEXT_PUBLIC_EVENT_DURATION_HOURS
ARG NEXT_PUBLIC_EVENT_STARTS_AT
ARG NEXT_PUBLIC_EVENT_VENUE
ARG NEXT_PUBLIC_EVENT_VENUE_ADDRESS
ARG NEXT_PUBLIC_CONTACT_EMAIL
ARG NEXT_PUBLIC_CONTACT_PHONE
ARG NEXT_PUBLIC_CONTACT_ADDRESS
ARG NEXT_PUBLIC_FACEBOOK_URL
ARG NEXT_PUBLIC_INSTAGRAM_URL
ARG NEXT_PUBLIC_X_URL
ARG NEXT_PUBLIC_TIKTOK_URL
ARG NEXT_PUBLIC_FEATURE_GIVE
ARG NEXT_PUBLIC_FEATURE_ABOUT
ARG NEXT_PUBLIC_FEATURE_BLOG
ARG NEXT_PUBLIC_FEATURE_GALLERY
ARG NEXT_PUBLIC_FEATURE_MAGAZINE
ARG NEXT_PUBLIC_FEATURE_RADIO
ARG NEXT_PUBLIC_FEATURE_PRAYER_REQUEST
ARG NEXT_PUBLIC_FEATURE_CONTACT
ARG NEXT_PUBLIC_FEATURE_LIVESTREAM
ARG NEXT_PUBLIC_FEATURE_SHARE_TESTIMONY
ARG NEXT_PUBLIC_FEATURE_NEWSLETTER
ARG NEXT_PUBLIC_REGISTRATION_URL
ARG NEXT_PUBLIC_VOLUNTEER_URL
ARG NEXT_PUBLIC_ABOUT_URL
ARG NEXT_PUBLIC_DONATION_URL
ARG NEXT_PUBLIC_LIVESTREAM_URL
ARG NEXT_PUBLIC_YOUTUBE_URL
ARG NEXT_PUBLIC_BLOG_URL
ARG NEXT_PUBLIC_GALLERY_URL
ARG NEXT_PUBLIC_PRAYER_REQUEST_URL
ARG NEXT_PUBLIC_CONTACT_URL
ARG NEXT_PUBLIC_RADIO_URL
ARG NEXT_PUBLIC_MAGAZINE_URL
ARG NEXT_PUBLIC_VISIT_ADDRESS
ARG NEXT_PUBLIC_VISIT_MAP_URL

# Server-side values the *build* needs, which is not the same as the values the
# running container needs.
#
# `src/lib/env.ts` parses the environment at module load and fails hard on a
# missing value, and prerendering /privacy reads the Setting model — so without
# these the build dies with "Invalid environment configuration" before it ever
# reaches the database. `.dockerignore` keeps every .env file out of the build
# context (correctly — secrets do not belong in an image), so they have to
# arrive as build arguments.
#
# These are throwaway build-time values. They are set in the `build` stage only
# and the runtime stage below starts from `base` again, so nothing here is
# carried into the shipped image; the running container gets its real
# configuration from the environment. Never pass production credentials here.
# No matching ENV: an ARG in scope is already exported into RUN, which is how
# the thirty-eight NEXT_PUBLIC_* arguments above reach the bundle. Adding ENV
# would only widen the scope and trip BuildKit's SecretsUsedInArgOrEnv warning.
ARG APP_SECRET
ARG DATABASE_URL

RUN npx prisma generate && npm run build

# --- Runtime -----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Run unprivileged. `node` (uid 1000) already exists in the base image.
RUN mkdir -p /app/storage && chown -R node:node /app

# The standalone output carries its own minimal node_modules with only the
# modules the server actually imports. Static assets and /public are not part of
# it and must be copied alongside.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

USER node
EXPOSE 3000

# Exec form, so SIGTERM reaches node directly and `docker stop` is a clean
# shutdown rather than a ten-second wait followed by SIGKILL.
CMD ["node", "server.js"]
