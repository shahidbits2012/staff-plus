#!/usr/bin/env bash
#
# promote.sh — publish the Staff Prep site to GitHub.
#
# Usage:
#   ./scripts/promote.sh <github_pat> [commit_message]
#
# Arguments:
#   github_pat       (required) GitHub Personal Access Token with `repo` scope.
#   commit_message   (optional) Commit message. Defaults to a timestamped message.
#
# Repo details (owner / name / branch) are read from config/site.json — the
# single source of truth for app configuration. Update that file, not this script.
#
# The token is never written to the stored git remote and is masked in output.

set -euo pipefail

# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------
PAT="${1:-}"
COMMIT_MSG="${2:-chore: publish site updates ($(date +%Y-%m-%d\ %H:%M:%S))}"

if [[ -z "$PAT" ]]; then
  echo "❌ GitHub PAT is required."
  echo "   Usage: ./scripts/promote.sh <github_pat> [commit_message]"
  exit 1
fi

# ---------------------------------------------------------------------------
# Resolve project root (script lives in <root>/scripts)
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

CONFIG_FILE="config/site.json"
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "❌ Missing $CONFIG_FILE"
  exit 1
fi

# ---------------------------------------------------------------------------
# Read config
# ---------------------------------------------------------------------------
OWNER="$(node -p "require('./$CONFIG_FILE').githubOwner")"
REPO="$(node -p "require('./$CONFIG_FILE').githubRepoName")"
BRANCH="$(node -p "require('./$CONFIG_FILE').githubBranch || 'main'")"

if [[ -z "$OWNER" || -z "$REPO" ]]; then
  echo "❌ githubOwner / githubRepoName missing in $CONFIG_FILE"
  exit 1
fi

CLEAN_URL="https://github.com/${OWNER}/${REPO}.git"
PUSH_URL="https://${OWNER}:${PAT}@github.com/${OWNER}/${REPO}.git"

echo "📦 Repo:   ${OWNER}/${REPO}"
echo "🌿 Branch: ${BRANCH}"

# ---------------------------------------------------------------------------
# Ensure git repo + identity + remote
# ---------------------------------------------------------------------------
if [[ ! -d .git ]]; then
  git init -q
  echo "✅ Initialized git repository"
fi

git config user.name  >/dev/null 2>&1 || git config user.name  "Staff Prep"
git config user.email >/dev/null 2>&1 || git config user.email "staff-prep@users.noreply.github.com"

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$CLEAN_URL"
else
  git remote add origin "$CLEAN_URL"
fi

# ---------------------------------------------------------------------------
# Stage & commit
# ---------------------------------------------------------------------------
git add -A
if git diff --cached --quiet; then
  echo "ℹ️  No staged changes — committing nothing."
else
  git commit -q -m "$COMMIT_MSG"
  echo "✅ Committed: $COMMIT_MSG"
fi

git branch -M "$BRANCH"

# ---------------------------------------------------------------------------
# Integrate any existing remote history (e.g. a GitHub-created README),
# then push. Token is kept out of the stored remote and masked in logs.
# ---------------------------------------------------------------------------
echo "🔄 Checking remote history..."
if git fetch -q "$PUSH_URL" "$BRANCH" 2>/dev/null; then
  if ! git rebase -q FETCH_HEAD; then
    echo "❌ Rebase onto remote ${BRANCH} hit conflicts."
    echo "   Resolve them, run 'git rebase --continue', then re-run promote.sh."
    exit 1
  fi
  echo "✅ Rebased local commits onto remote ${BRANCH}"
else
  echo "ℹ️  No existing remote branch — will create ${BRANCH}."
fi

echo "🚀 Pushing to ${OWNER}/${REPO} (${BRANCH})..."
if git push "$PUSH_URL" "HEAD:${BRANCH}" 2>&1 | sed "s/${PAT}/***/g"; then
  echo "✅ Published → ${CLEAN_URL}"
else
  echo "❌ Push failed."
  exit 1
fi
