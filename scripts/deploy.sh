#!/usr/bin/env bash
#
# What runs on the VPS when main moves.
#
# Kept in the repository rather than inline in the workflow so the commands
# that touch production are reviewed like any other code, and so the same
# script can be run by hand over SSH when something needs doing outside a push.
#
# Piped to the server over stdin by .github/workflows/deploy.yml.
#
# The image is built in CI and pulled here, not built on this box. Building on
# the VPS took the better part of an hour — `npm ci` alone ran to 42 minutes —
# and it could never have succeeded anyway: .dockerignore keeps every .env file
# out of the build context, so the build stage had no APP_SECRET or
# DATABASE_URL and died at environment parsing. CI does the whole thing in
# about two minutes, and what lands here is the exact artefact the checks
# passed against.

set -euo pipefail

APP_DIR="${APP_DIR:-/home/mmp/app}"
ENV_FILE="${ENV_FILE:-.env.production}"

cd "$APP_DIR"

echo "==> Updating $APP_DIR"
git fetch --prune origin
# --ff-only deliberately: if the server has diverged — a hand-edit, a hotfix
# committed on the box — this fails loudly instead of destroying the evidence.
# Fix it on the server, then push again.
git merge --ff-only origin/main

if [ -n "${APP_IMAGE:-}" ]; then
  echo "==> Using prebuilt images"
  echo "    app:     $APP_IMAGE"
  echo "    migrate: ${APP_IMAGE_MIGRATE:-unset}"

  if [ -n "${REGISTRY_TOKEN:-}" ]; then
    # Read-only, and valid only for the workflow run that supplied it, so
    # nothing long-lived is left behind on the box.
    echo "$REGISTRY_TOKEN" | docker login ghcr.io -u "${REGISTRY_USER:-github}" --password-stdin
  fi

  export APP_IMAGE APP_IMAGE_MIGRATE

  echo "==> Pulling"
  docker compose --env-file "$ENV_FILE" pull app migrate
else
  # Fallback: no image supplied, so build here. Slow, and only viable if this
  # box has the memory for it — see docs/DEPLOYMENT.md.
  echo "==> No APP_IMAGE set; building locally instead"
  docker compose --env-file "$ENV_FILE" build
fi

echo "==> Starting"
# Migrations run on the way up, through the `migrate` service.
docker compose --env-file "$ENV_FILE" up -d

if [ -n "${REGISTRY_TOKEN:-}" ]; then
  # Do not leave credentials in ~/.docker/config.json between deploys.
  docker logout ghcr.io >/dev/null 2>&1 || true
fi

echo "==> Reclaiming disk"
# Pulling a new image every deploy orphans the previous one; on a small VPS
# that fills the disk within weeks.
docker image prune -f

echo "==> Deployed $(git rev-parse --short HEAD)"
