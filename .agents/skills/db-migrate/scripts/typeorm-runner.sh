#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
cd "$REPO_ROOT"

TYPEORM_CMD=(node -r ts-node/register -r tsconfig-paths/register ./node_modules/typeorm/cli.js)
BACKUP_DIR="$REPO_ROOT/.agents/skills/db-migrate/backups"
mkdir -p "$BACKUP_DIR"

usage() {
  cat <<'EOF'
Usage:
  bash .agents/skills/db-migrate/scripts/typeorm-runner.sh generate <TARGET_ENV_FILE> <MIGRATION_NAME>
  bash .agents/skills/db-migrate/scripts/typeorm-runner.sh run <TARGET_ENV_FILE>
  bash .agents/skills/db-migrate/scripts/typeorm-runner.sh sync-schema <TARGET_ENV_FILE>
  bash .agents/skills/db-migrate/scripts/typeorm-runner.sh sync <SOURCE_ENV_FILE> <TARGET_ENV_FILE>
EOF
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || die "Missing required command: $cmd"
}

read_database_url_from_env() {
  local env_file="$1"
  [[ -f "$env_file" ]] || die "Env file not found: $env_file"

  local line
  line="$(grep -E '^DATABASE_URL=' "$env_file" | tail -n1 || true)"
  [[ -n "$line" ]] || die "DATABASE_URL not found in $env_file"

  local value="${line#DATABASE_URL=}"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"

  [[ -n "$value" ]] || die "DATABASE_URL is empty in $env_file"
  printf '%s' "$value"
}

normalize_neon_url_for_migration() {
  local raw_url="$1"
  local normalized="$raw_url"
  local changed=0

  if [[ "$normalized" == *"-pooler."* ]]; then
    normalized="${normalized/-pooler./.}"
    changed=1
  fi

  if [[ "$normalized" == *"channel_binding=require"* ]]; then
    normalized="$(printf '%s' "$normalized" | sed -E 's/([?&])channel_binding=require&/\1/g; s/[?&]channel_binding=require$//; s/\?&/?/g; s/[?&]$//')"
    changed=1
  fi

  if [[ $changed -eq 1 ]]; then
    echo "INFO: Normalized DATABASE_URL for migration/schema operations (Neon pooler guard)." >&2
  fi

  printf '%s' "$normalized"
}

typeorm() {
  DATABASE_URL="$1" "${TYPEORM_CMD[@]}" "$2" -d src/db/data-source.cli.ts ${3+"$3"}
}

backup_schema() {
  local db_url="$1"
  local env_name="$2"
  local ts
  ts="$(date +%Y%m%d-%H%M%S)"
  local backup_file="$BACKUP_DIR/${ts}-${env_name}-schema.sql"

  if command -v pg_dump >/dev/null 2>&1; then
    echo "INFO: Backing up schema to $backup_file"
    pg_dump --schema-only "$db_url" > "$backup_file"
  else
    echo "WARN: pg_dump is not available, skipping schema backup." >&2
  fi
}

run_generate() {
  local env_file="$1"
  local migration_name="$2"
  local target_url
  target_url="$(normalize_neon_url_for_migration "$(read_database_url_from_env "$env_file")")"

  [[ "$migration_name" == src/migrations/* ]] || migration_name="src/migrations/$migration_name"

  echo "INFO: Generating migration against $env_file"
  typeorm "$target_url" migration:generate "$migration_name"
}

run_migrations() {
  local env_file="$1"
  local target_url
  target_url="$(normalize_neon_url_for_migration "$(read_database_url_from_env "$env_file")")"

  backup_schema "$target_url" "$(basename "$env_file")"

  echo "INFO: Running migrations on $env_file"
  typeorm "$target_url" migration:run
}

run_sync_schema() {
  local env_file="$1"
  local target_url
  target_url="$(normalize_neon_url_for_migration "$(read_database_url_from_env "$env_file")")"

  backup_schema "$target_url" "$(basename "$env_file")"

  echo "INFO: Syncing schema on $env_file"
  typeorm "$target_url" schema:sync
}

run_sync_data() {
  local source_env="$1"
  local target_env="$2"

  require_cmd pg_dump
  require_cmd psql

  local source_url target_url
  source_url="$(normalize_neon_url_for_migration "$(read_database_url_from_env "$source_env")")"
  target_url="$(normalize_neon_url_for_migration "$(read_database_url_from_env "$target_env")")"

  echo "WARN: Full sync will overwrite data in target DB: $target_env"
  echo "INFO: Backing up target schema before sync"
  backup_schema "$target_url" "$(basename "$target_env")"

  echo "INFO: Syncing data from $source_env to $target_env"
  pg_dump --clean --if-exists --no-owner --no-privileges "$source_url" | psql "$target_url"
}

main() {
  [[ $# -ge 2 ]] || {
    usage
    exit 1
  }

  local mode="$1"
  shift

  case "$mode" in
    generate)
      [[ $# -eq 2 ]] || die "generate requires <TARGET_ENV_FILE> <MIGRATION_NAME>"
      run_generate "$1" "$2"
      ;;
    run)
      [[ $# -eq 1 ]] || die "run requires <TARGET_ENV_FILE>"
      run_migrations "$1"
      ;;
    sync-schema)
      [[ $# -eq 1 ]] || die "sync-schema requires <TARGET_ENV_FILE>"
      run_sync_schema "$1"
      ;;
    sync)
      [[ $# -eq 2 ]] || die "sync requires <SOURCE_ENV_FILE> <TARGET_ENV_FILE>"
      run_sync_data "$1" "$2"
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
