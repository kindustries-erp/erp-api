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

  # 1. Try to read active DATABASE_URL (excluding comments)
  local line
  line="$(grep -E '^[[:space:]]*DATABASE_URL=' "$env_file" | tail -n1 || true)"
  if [[ -n "$line" ]]; then
    local value="${line#*DATABASE_URL=}"
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    value="$(echo "$value" | tr -d '[:space:]')"
    if [[ -n "$value" ]]; then
      printf '%s' "$value"
      return 0
    fi
  fi

  # 2. Fallback: Construct URL from DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_DATABASE, DB_SSL
  local host user pass port db ssl
  host="$(grep -E '^[[:space:]]*DB_HOST=' "$env_file" | tail -n1 | cut -d= -f2- | tr -d '\"'\'' ' || true)"
  user="$(grep -E '^[[:space:]]*DB_USER=' "$env_file" | tail -n1 | cut -d= -f2- | tr -d '\"'\'' ' || true)"
  pass="$(grep -E '^[[:space:]]*DB_PASSWORD=' "$env_file" | tail -n1 | cut -d= -f2- | tr -d '\"'\'' ' || true)"
  port="$(grep -E '^[[:space:]]*DB_PORT=' "$env_file" | tail -n1 | cut -d= -f2- | tr -d '\"'\'' ' || true)"
  db="$(grep -E '^[[:space:]]*DB_DATABASE=' "$env_file" | tail -n1 | cut -d= -f2- | tr -d '\"'\'' ' || true)"
  ssl="$(grep -E '^[[:space:]]*DB_SSL=' "$env_file" | tail -n1 | cut -d= -f2- | tr -d '\"'\'' ' || true)"

  if [[ -n "$host" && -n "$db" ]]; then
    user="${user:-postgres}"
    port="${port:-5432}"
    local ssl_param="?sslmode=disable"
    if [[ "$ssl" == "true" ]]; then
      ssl_param="?sslmode=require"
    fi
    echo "INFO: DATABASE_URL not set in $env_file. Constructed from DB_HOST=$host, DB_PORT=$port, DB_DATABASE=$db." >&2
    # Percent-encode credentials because PostgreSQL URLs cannot safely carry
    # raw passwords containing reserved characters such as @, :, /, or #.
    # Keep the resulting URL in-process only; never log it.
    local encoded_user encoded_pass
    encoded_user="$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$user")"
    encoded_pass="$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$pass")"
    printf 'postgresql://%s:%s@%s:%s/%s%s' "$encoded_user" "$encoded_pass" "$host" "$port" "$db" "$ssl_param"
    return 0
  fi

  die "Neither active DATABASE_URL nor DB_HOST/DB_DATABASE found in $env_file"
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
