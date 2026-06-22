#!/bin/sh
# Usage: ./cycle.sh              # today
#        ./cycle.sh 2026-12-01   # any date
#        ./cycle.sh +5           # 5 days from now

# ---------- 1. Input ----------
date="${1:-$(date -u '+%F')}"
if [ "${date#\+}" != "$date" ]; then
  days_offset="${date#+}"
  date=$(date -u -d "$days_offset days" '+%F')
fi

# ---------- 2. Days since genesis ----------
genesis="2025-11-15"
genesis_s=$(date -u -d "$genesis" '+%s')
today_s=$(date -u -d "$date" '+%s')
days=$(( (today_s - genesis_s) / 86400 ))

# ---------- 3. Human output ----------
if [ "$days" -lt 0 ]; then
  printf '{"future": %d}\n' "$(( -days ))"
  exit 0
fi

cycle=$(( days / 28 ))
cycle_day=$(( days % 28 ))
cycle_week=$(( cycle_day / 7 ))
week_day=$(( cycle_day % 7 ))
epoch=$(( cycle / 13 ))
epoch_cycle=$(( cycle % 13 ))
epoch_day=$(( days % 364 ))
epoch_week=$(( epoch_day / 7 ))
iso_week=$(date -u -d "$date" '+%V')

cat <<EOF
{
  "epoch": $epoch,
  "epoch_cycle": $epoch_cycle,
  "cycle_day": $cycle_day,
  "week_day": $week_day,
  "cycle_week": $cycle_week,
  "iso": "$date",
  "iso_week": $iso_week,
  "epoch_week": $epoch_week,
  "cycle": $cycle,
}
EOF
