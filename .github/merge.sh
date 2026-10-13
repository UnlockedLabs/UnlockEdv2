#!/usr/bin/env bash
set -euo pipefail

if ! command -v gh &> /dev/null; then
  echo "❌ gh CLI is not installed."
  exit 1
fi

PR_NUMBER="${1:?Usage: $0 <pr-number>}"
REPO="UnlockedLabs/unlocked-core"
WORKFLOW_NAME="migration_check.yml"

echo "📦 Checking out PR #$PR_NUMBER..."
gh pr checkout "$PR_NUMBER"

echo "⬇️ Fetching latest main..."
git fetch origin main

echo "🔍 Checking for changed migration files..."
CHANGED_FILES=$(git diff --name-only origin/main...HEAD)

HAS_MIGRATIONS=$(echo "$CHANGED_FILES" | grep -E '^backend/migrations/.*\.sql' || true)

if [[ -n "$HAS_MIGRATIONS" ]]; then
  echo "🚨 Migration files found, running workflow..."

          echo "🛠️ Checking for duplicate migration files..."
          DUPLICATE_MIGRATIONS=$(ls -1 backend/migrations | grep '.*\.sql' | cut -c1-5 | sort | uniq -d)
          if [ -z "$DUPLICATE_MIGRATIONS" ]; then
            echo "✅ No duplicate migration files found."
	        gh pr merge "$PR_NUMBER" --repo "$REPO" --rebase --delete-branch
          else
            echo "🚨 Duplicate migration files found 🚨"
            echo "Migration number(s): $DUPLICATE_MIGRATIONS"
            exit 1
          fi
else
	echo "✅ No migration files found, merging PR #$PR_NUMBER..."
	gh pr merge "$PR_NUMBER" --repo "$REPO" --rebase --delete-branch
fi
