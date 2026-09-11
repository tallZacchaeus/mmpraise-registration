#!/usr/bin/env bash
#
# What runs on the VPS when main moves.
#
# Kept in the repository rather than inline in the workflow so the commands
# that touch production are reviewed like any other code, and so the same
# script can be run by hand over SSH when something needs doing outside a push.
#
# Piped to the server over stdin by .github/workflows/deploy.yml.

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

echo "==> Building"
# --env-file is required. Compose substitutes ${VAR} from .env by default, and
# every NEXT_PUBLIC_* value is compiled into the browser bundle at build time,
# so omitting it ships a bundle built against the wrong values.
docker compose --env-file "$ENV_FILE" build

echo "==> Starting"
# Migrations run on the way up, through the `migrate` service.
docker compose --env-file "$ENV_FILE" up -d

echo "==> Reclaiming disk"
# A build a day fills a small VPS with dangling layers within weeks.
docker image prune -f

echo "==> Deployed $(git rev-parse --short HEAD)"
