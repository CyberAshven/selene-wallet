#!/bin/bash
#
# gitlab-sync.sh - Fetches GitLab state and generates gitlab-state.md
#
# Usage: ./scripts/gitlab-sync.sh [--quiet]
#
# This script queries the GitLab API to fetch:
# - Active milestones with due dates
# - Critical/high priority issues
# - Recent completions
# - Label counts
#
# Output is written to .claude/gitlab-state.md

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_FILE="$PROJECT_ROOT/.claude/gitlab-state.md"
REPO="selene.cash/selene-wallet"
QUIET=${1:-""}

log() {
    if [[ "$QUIET" != "--quiet" ]]; then
        echo "$1" >&2
    fi
}

log "Fetching GitLab state..."

# Get current timestamp
TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
TODAY=$(date "+%Y-%m-%d")

# Fetch active milestones
log "  - Fetching milestones..."
MILESTONES=$(glab api "projects/selene.cash%2Fselene-wallet/milestones?state=active&per_page=50" 2>/dev/null || echo "[]")

# Fetch critical/high priority issues
log "  - Fetching critical issues..."
CRITICAL_ISSUES=$(glab api "projects/selene.cash%2Fselene-wallet/issues?state=opened&labels=Critical&per_page=20" 2>/dev/null || echo "[]")

log "  - Fetching high priority issues..."
HIGH_PRIORITY_ISSUES=$(glab api "projects/selene.cash%2Fselene-wallet/issues?state=opened&labels=High%20Priority&per_page=20" 2>/dev/null || echo "[]")

log "  - Fetching bugs..."
BUG_ISSUES=$(glab api "projects/selene.cash%2Fselene-wallet/issues?state=opened&labels=Bug&per_page=30" 2>/dev/null || echo "[]")

# Fetch recently closed issues (last 7 days)
log "  - Fetching recent completions..."
SEVEN_DAYS_AGO=$(date -v-7d "+%Y-%m-%dT00:00:00Z" 2>/dev/null || date -d "7 days ago" "+%Y-%m-%dT00:00:00Z" 2>/dev/null || echo "")
if [[ -n "$SEVEN_DAYS_AGO" ]]; then
    RECENT_CLOSED=$(glab api "projects/selene.cash%2Fselene-wallet/issues?state=closed&updated_after=$SEVEN_DAYS_AGO&per_page=20" 2>/dev/null || echo "[]")
else
    RECENT_CLOSED="[]"
fi

# Fetch all open issues for counts
log "  - Fetching open issues count..."
OPEN_COUNT=$(glab api "projects/selene.cash%2Fselene-wallet/issues?state=opened&per_page=1" 2>/dev/null | jq length 2>/dev/null || echo "0")
TOTAL_OPEN=$(glab api "projects/selene.cash%2Fselene-wallet/issues_statistics?scope=all" 2>/dev/null | jq '.statistics.counts.opened // 0' 2>/dev/null || echo "?")

# Generate the markdown file
log "  - Generating gitlab-state.md..."

cat > "$OUTPUT_FILE" << 'HEADER'
# GitLab State

> Auto-generated snapshot of the GitLab repository state.
> Do not edit manually - run `./scripts/gitlab-sync.sh` to refresh.

HEADER

echo "**Last Updated:** $TIMESTAMP" >> "$OUTPUT_FILE"
echo "**Total Open Issues:** $TOTAL_OPEN" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Overdue Milestones
echo "## ⚠️ Overdue Milestones" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

OVERDUE=$(echo "$MILESTONES" | jq -r --arg today "$TODAY" '
    .[] |
    select(.due_date != null and .due_date != "" and .due_date < $today and .due_date > "2000-01-01") |
    "- **\(.title)** (Due: \(.due_date)) - [View](\(.web_url))"
' 2>/dev/null || echo "")

if [[ -n "$OVERDUE" ]]; then
    echo "$OVERDUE" >> "$OUTPUT_FILE"
else
    echo "_No overdue milestones_" >> "$OUTPUT_FILE"
fi
echo "" >> "$OUTPUT_FILE"

# Upcoming Milestones (next 60 days)
echo "## 📅 Upcoming Milestones" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

SIXTY_DAYS=$(date -v+60d "+%Y-%m-%d" 2>/dev/null || date -d "+60 days" "+%Y-%m-%d" 2>/dev/null || echo "2099-12-31")

UPCOMING=$(echo "$MILESTONES" | jq -r --arg today "$TODAY" --arg future "$SIXTY_DAYS" '
    [.[] |
    select(.due_date != null and .due_date != "" and .due_date >= $today and .due_date <= $future and .due_date > "2000-01-01")] |
    sort_by(.due_date) |
    .[] |
    "- **\(.title)** (Due: \(.due_date)) - [View](\(.web_url))"
' 2>/dev/null || echo "")

if [[ -n "$UPCOMING" ]]; then
    echo "$UPCOMING" >> "$OUTPUT_FILE"
else
    echo "_No milestones in next 60 days_" >> "$OUTPUT_FILE"
fi
echo "" >> "$OUTPUT_FILE"

# Critical Issues
echo "## 🔴 Critical Issues" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

CRITICAL_LIST=$(echo "$CRITICAL_ISSUES" | jq -r '
    .[] |
    "- **#\(.iid)** - \(.title) ([View](\(.web_url)))"
' 2>/dev/null || echo "")

if [[ -n "$CRITICAL_LIST" ]]; then
    echo "$CRITICAL_LIST" >> "$OUTPUT_FILE"
else
    echo "_No critical issues_" >> "$OUTPUT_FILE"
fi
echo "" >> "$OUTPUT_FILE"

# High Priority Issues
echo "## 🟠 High Priority Issues" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

HIGH_LIST=$(echo "$HIGH_PRIORITY_ISSUES" | jq -r '
    .[] |
    "- **#\(.iid)** - \(.title) ([View](\(.web_url)))"
' 2>/dev/null | head -15 || echo "")

if [[ -n "$HIGH_LIST" ]]; then
    echo "$HIGH_LIST" >> "$OUTPUT_FILE"
else
    echo "_No high priority issues_" >> "$OUTPUT_FILE"
fi
echo "" >> "$OUTPUT_FILE"

# Bugs
echo "## 🐛 Open Bugs" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

BUG_LIST=$(echo "$BUG_ISSUES" | jq -r '
    .[] |
    "- **#\(.iid)** - \(.title)"
' 2>/dev/null | head -20 || echo "")

if [[ -n "$BUG_LIST" ]]; then
    echo "$BUG_LIST" >> "$OUTPUT_FILE"
else
    echo "_No open bugs_" >> "$OUTPUT_FILE"
fi
echo "" >> "$OUTPUT_FILE"

# Recent Completions
echo "## ✅ Recent Completions (7 days)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

RECENT_LIST=$(echo "$RECENT_CLOSED" | jq -r '
    .[] |
    "- **#\(.iid)** - \(.title) (closed: \(.closed_at | split("T")[0]))"
' 2>/dev/null | head -15 || echo "")

if [[ -n "$RECENT_LIST" ]]; then
    echo "$RECENT_LIST" >> "$OUTPUT_FILE"
else
    echo "_No issues closed in last 7 days_" >> "$OUTPUT_FILE"
fi
echo "" >> "$OUTPUT_FILE"

# Quick Stats
echo "## 📊 Quick Stats" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

CRITICAL_COUNT=$(echo "$CRITICAL_ISSUES" | jq 'length' 2>/dev/null || echo "0")
HIGH_COUNT=$(echo "$HIGH_PRIORITY_ISSUES" | jq 'length' 2>/dev/null || echo "0")
BUG_COUNT=$(echo "$BUG_ISSUES" | jq 'length' 2>/dev/null || echo "0")
RECENT_COUNT=$(echo "$RECENT_CLOSED" | jq 'length' 2>/dev/null || echo "0")

echo "| Metric | Count |" >> "$OUTPUT_FILE"
echo "|--------|-------|" >> "$OUTPUT_FILE"
echo "| Total Open | $TOTAL_OPEN |" >> "$OUTPUT_FILE"
echo "| Critical | $CRITICAL_COUNT |" >> "$OUTPUT_FILE"
echo "| High Priority | $HIGH_COUNT |" >> "$OUTPUT_FILE"
echo "| Bugs | $BUG_COUNT |" >> "$OUTPUT_FILE"
echo "| Closed (7 days) | $RECENT_COUNT |" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

log "GitLab state written to $OUTPUT_FILE"

log "Done!"
