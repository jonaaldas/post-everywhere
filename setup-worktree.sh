#!/bin/bash

# Get the main worktree path (parent of current worktree)
MAIN_WORKTREE="${1:-$(git worktree list | head -1 | awk '{print $1}')}"

echo "Setting up worktree..."
echo "Main worktree: $MAIN_WORKTREE"

# Copy .env files from main worktree
if [ -f "$MAIN_WORKTREE/.env" ]; then
    cp "$MAIN_WORKTREE/.env" ./.env
    echo "Copied .env"
fi

if [ -f "$MAIN_WORKTREE/.env.local" ]; then
    cp "$MAIN_WORKTREE/.env.local" ./.env.local
    echo "Copied .env.local"
fi

# Install dependencies
echo "Installing dependencies..."
bun install

echo "Setup complete! Run 'bun dev' to start the dev server."
echo "Run 'npx convex dev' in a separate terminal for the Convex backend."
