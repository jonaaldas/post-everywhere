#!/bin/bash
# Setup script for worktrees: copies env files and installs dependencies

MAIN_REPO="/Users/aldas/Documents/CODE/post-everywhere"

# Copy env files
if [ -f "$MAIN_REPO/apps/api/.env" ]; then
  cp "$MAIN_REPO/apps/api/.env" apps/api/.env
  echo "Copied apps/api/.env"
fi

if [ -f "$MAIN_REPO/apps/web/.env" ]; then
  cp "$MAIN_REPO/apps/web/.env" apps/web/.env
  echo "Copied apps/web/.env"
fi

# Install dependencies
pnpm install
echo "Done!"
