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

# Behind a shared reverse proxy, the overlay attaches the app to that proxy's
# network under the name it proxies to, and the base file keeps its own Caddy
# behind the `standalone` profile so it cannot fight for port 80. PROXY_NETWORK
# lives in .env.production; unset means this stack owns the ports itself.
set -a; . "./$ENV_FILE"; set +a
COMPOSE=(docker compose --env-file "$ENV_FILE")
if [ -n "${PROXY_NETWORK:-}" ]; then
  echo "==> Fronted by ${PROXY_NETWORK}; including the proxy overlay"
  COMPOSE=(docker compose --env-file "$ENV_FILE" -f docker-compose.yml -f docker-compose.proxy.yml)
fi

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
  "${COMPOSE[@]}" pull app migrate
else
  # Fallback: no image supplied, so build here. Slow, and only viable if this
  # box has the memory for it — see docs/DEPLOYMENT.md.
  echo "==> No APP_IMAGE set; building locally instead"
  "${COMPOSE[@]}" build
fi

echo "==> Starting"
# Migrations run on the way up, through the `migrate` service.
"${COMPOSE[@]}" up -d

if [ -n "${PROXY_NETWORK:-}" ]; then
  # Assert the wiring rather than assume it. A container that is healthy but
  # invisible to the proxy serves 502s, and that reads as "the app is broken"
  # when the app is fine — which is exactly how the 2026-09-16 outage looked.
  echo "==> Checking the proxy can see the app"
  if docker inspect "$(${COMPOSE[@]} ps -q app)" \
       --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' \
       | grep -qw "$PROXY_NETWORK"; then
    echo "    attached to $PROXY_NETWORK"
  else
    echo "!!! app is NOT attached to $PROXY_NETWORK — the site will return 502" >&2
    exit 1
  fi
fi

if [ -n "${REGISTRY_TOKEN:-}" ]; then
  # Do not leave credentials in ~/.docker/config.json between deploys.
  docker logout ghcr.io >/dev/null 2>&1 || true
fi

echo "==> Reclaiming disk"
# Pulling a new image every deploy orphans the previous one; on a small VPS
# that fills the disk within weeks.
docker image prune -f

echo "==> Deployed $(git rev-parse --short HEAD)"
