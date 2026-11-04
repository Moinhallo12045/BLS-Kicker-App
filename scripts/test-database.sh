#!/usr/bin/env bash
set -euo pipefail
: "${TEST_DATABASE_URL:?Use a disposable empty PostgreSQL database}"
overhaul_database="bls_overhaul_$$_${RANDOM}"
upgrade_database="bls_upgrade_$$_${RANDOM}"
cleanup() {
  psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$overhaul_database\";" -c "DROP DATABASE IF EXISTS \"$upgrade_database\";"
}
trap cleanup EXIT
for test in match_stats_bootstrap match_stats_removal match_achievements; do
  psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "supabase/tests/$test.sql"
done
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$overhaul_database\";" -c "CREATE DATABASE \"$upgrade_database\";"
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c "\\connect $overhaul_database" \
  -f supabase/tests/secure_tournaments.sql -f supabase/tests/player_deletion.sql -f supabase/tests/tournament_brackets_replay.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c "\\connect $overhaul_database" \
  -f supabase/migrations/20261103203000_delete_players_with_history.sql \
  -f supabase/migrations/20261103210000_audit_log.sql \
  -f supabase/migrations/20261103220000_add_match_achievement_tiers.sql \
  -f supabase/migrations/20261104130000_add_player_bio.sql \
  -f supabase/tests/player_history_deletion.sql -f supabase/tests/audit_log.sql \
  -f supabase/tests/new_match_achievements.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c "\\connect $upgrade_database" -f supabase/tests/secure_upgrade.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -c "\\connect $upgrade_database" -f supabase/tests/legacy_stats_deletes.sql
