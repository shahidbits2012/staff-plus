#!/usr/bin/env bash
#
# promote.sh — promote dev → main via a GitHub pull request.
#
# Usage:
#   ./scripts/promote.sh [--merge]
#
# The script prompts for your GitHub PAT interactively (input is hidden).
#
# Options:
#   --merge      Auto-merge the PR after creation. Without this flag the
#                script creates the PR and prints its URL.
#
# Workflow:
#   1. Ensures local dev is pushed to origin/dev.
#   2. Creates a PR from dev → main (or finds an existing open one).
#   3. With --merge: waits for checks, then merges (squash).
#
# Repo details are read from config/site.json.
# The token is never written to the stored git remote.

set -euo pipefail

# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------
AUTO_MERGE=false
for arg in "$@"; do
  [[ "$arg" == "--merge" ]] && AUTO_MERGE=true
done

echo -n "GitHub PAT (input hidden): "
read -rs PAT
echo

if [[ -z "$PAT" ]]; then
  echo "PAT cannot be empty."
  exit 1
fi

# ---------------------------------------------------------------------------
# Resolve project root
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

CONFIG_FILE="config/site.json"
if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Missing $CONFIG_FILE"
  exit 1
fi

# ---------------------------------------------------------------------------
# Read config
# ---------------------------------------------------------------------------
OWNER="$(node -p "require('./$CONFIG_FILE').githubOwner")"
REPO="$(node -p "require('./$CONFIG_FILE').githubRepoName")"
TARGET="$(node -p "require('./$CONFIG_FILE').githubBranch || 'main'")"
SOURCE="dev"
API="https://api.github.com/repos/${OWNER}/${REPO}"

if [[ -z "$OWNER" || -z "$REPO" ]]; then
  echo "githubOwner / githubRepoName missing in $CONFIG_FILE"
  exit 1
fi

gh_api() {
  local method="$1" endpoint="$2" body="${3:-}"
  local args=(-s -H "Authorization: token ${PAT}" -H "Accept: application/vnd.github+json")
  if [[ -n "$body" ]]; then
    args+=(-X "$method" -d "$body")
  elif [[ "$method" != "GET" ]]; then
    args+=(-X "$method")
  fi
  curl "${args[@]}" "${API}${endpoint}"
}

echo "Repo:   ${OWNER}/${REPO}"
echo "PR:     ${SOURCE} -> ${TARGET}"

# ---------------------------------------------------------------------------
# 1. Ensure dev is pushed
# ---------------------------------------------------------------------------
CURRENT_BRANCH="$(git branch --show-current)"
if [[ "$CURRENT_BRANCH" != "$SOURCE" ]]; then
  echo "Not on ${SOURCE} branch (on ${CURRENT_BRANCH}). Switch first."
  exit 1
fi

git fetch -q origin
LOCAL="$(git rev-parse ${SOURCE})"
REMOTE="$(git rev-parse "origin/${SOURCE}" 2>/dev/null || echo "")"

if [[ "$LOCAL" != "$REMOTE" ]]; then
  echo "Pushing ${SOURCE} to origin..."
  git push -q origin "${SOURCE}"
fi

# ---------------------------------------------------------------------------
# 2. Check for commits ahead of target
# ---------------------------------------------------------------------------
AHEAD="$(git rev-list --count "origin/${TARGET}..origin/${SOURCE}")"
if [[ "$AHEAD" == "0" ]]; then
  echo "${SOURCE} is up to date with ${TARGET}. Nothing to promote."
  exit 0
fi
echo "Commits to promote: ${AHEAD}"

# ---------------------------------------------------------------------------
# 3. Create PR (or find existing)
# ---------------------------------------------------------------------------
EXISTING=$(gh_api GET "/pulls?head=${OWNER}:${SOURCE}&base=${TARGET}&state=open" | \
  node -p 'JSON.parse(require("fs").readFileSync("/dev/stdin","utf8"))[0]?.number || ""')

if [[ -n "$EXISTING" ]]; then
  PR_NUM="$EXISTING"
  echo "Found existing PR #${PR_NUM}"
else
  # Build title from commit subjects
  TITLE="Promote ${SOURCE} to ${TARGET}"
  BODY=$(git log --format='- %s' "origin/${TARGET}..origin/${SOURCE}")

  RESPONSE=$(gh_api POST "/pulls" "$(node -e "
    console.log(JSON.stringify({
      title: '${TITLE}',
      head: '${SOURCE}',
      base: '${TARGET}',
      body: $(node -p "JSON.stringify(\`## Changes\n${BODY}\`)")
    }))
  ")")

  PR_NUM=$(echo "$RESPONSE" | node -p 'JSON.parse(require("fs").readFileSync("/dev/stdin","utf8")).number || ""')

  if [[ -z "$PR_NUM" ]]; then
    echo "Failed to create PR:"
    echo "$RESPONSE" | node -p 'JSON.parse(require("fs").readFileSync("/dev/stdin","utf8")).message || "unknown error"'
    exit 1
  fi
  echo "Created PR #${PR_NUM}"
fi

PR_URL="https://github.com/${OWNER}/${REPO}/pull/${PR_NUM}"
echo "URL: ${PR_URL}"

# ---------------------------------------------------------------------------
# 4. Merge (if --merge)
# ---------------------------------------------------------------------------
if [[ "$AUTO_MERGE" == true ]]; then
  echo "Merging PR #${PR_NUM} (squash)..."

  # Wait for mergeable status (GitHub needs a moment after PR creation)
  for i in $(seq 1 10); do
    MERGEABLE=$(gh_api GET "/pulls/${PR_NUM}" | \
      node -p 'JSON.parse(require("fs").readFileSync("/dev/stdin","utf8")).mergeable ?? "null"')
    [[ "$MERGEABLE" != "null" ]] && break
    sleep 2
  done

  if [[ "$MERGEABLE" == "false" ]]; then
    echo "PR is not mergeable (conflicts or checks failing). Merge manually:"
    echo "  ${PR_URL}"
    exit 1
  fi

  MERGE_RESULT=$(gh_api PUT "/pulls/${PR_NUM}/merge" "{\"merge_method\":\"squash\"}")
  MERGED=$(echo "$MERGE_RESULT" | node -p 'JSON.parse(require("fs").readFileSync("/dev/stdin","utf8")).merged || false')

  if [[ "$MERGED" == "true" ]]; then
    echo "Merged PR #${PR_NUM} into ${TARGET}"
    # Update local main
    git fetch -q origin
    git checkout -q "${TARGET}"
    git pull -q origin "${TARGET}"
    git checkout -q "${SOURCE}"
    echo "Local ${TARGET} updated."
  else
    MSG=$(echo "$MERGE_RESULT" | node -p 'JSON.parse(require("fs").readFileSync("/dev/stdin","utf8")).message || "unknown error"')
    echo "Merge failed: ${MSG}"
    echo "  Merge manually: ${PR_URL}"
    exit 1
  fi
else
  echo "Review and merge: ${PR_URL}"
  echo "Or re-run with --merge to auto-merge."
fi
