#!/usr/bin/env bash
set -e

ACTION=$1

if [ -z "$ACTION" ]; then
  echo "Usage: bun run typeorm-runner.sh [generate|run|sync] [args...]"
  exit 1
fi

extract_db_url() {
  local env_file=$1
  if [ ! -f "$env_file" ]; then
    echo "Error: Env file $env_file not found."
    exit 1
  fi
  # Extract DATABASE_URL handling quotes
  local db_url=$(grep -v '^#' "$env_file" | grep 'DATABASE_URL' | cut -d '=' -f2- | tr -d '"' | tr -d "'")
  if [ -z "$db_url" ]; then
    echo "Error: DATABASE_URL not found in $env_file"
    exit 1
  fi
  echo "$db_url"
}

backup_db() {
  local db_url=$1
  echo "=> Backing up target database..."
  mkdir -p backups
  local timestamp=$(date +%Y%m%d_%H%M%S)
  local backup_file="backups/db_backup_${timestamp}.dump"
  
  # Using pg_dump to dump the DB. Requires pg_dump installed on the system.
  pg_dump "$db_url" -F c -f "$backup_file" || {
    echo "Error: Database backup failed."
    exit 1
  }
  echo "=> Backup completed: $backup_file"
}

if [ "$ACTION" == "generate" ]; then
  TARGET_ENV_FILE=$2
  MIGRATION_NAME=$3
  if [ -z "$TARGET_ENV_FILE" ] || [ -z "$MIGRATION_NAME" ]; then
    echo "Usage: bun run typeorm-runner.sh generate <TARGET_ENV_FILE> <MIGRATION_NAME>"
    exit 1
  fi

  export DATABASE_URL=$(extract_db_url "$TARGET_ENV_FILE")
  echo "=> Generating TypeORM migration for target: $TARGET_ENV_FILE"
  bunx typeorm-ts-node-commonjs migration:generate -d src/db/data-source.cli.ts "src/migrations/$MIGRATION_NAME"

elif [ "$ACTION" == "run" ]; then
  TARGET_ENV_FILE=$2
  if [ -z "$TARGET_ENV_FILE" ]; then
    echo "Usage: bun run typeorm-runner.sh run <TARGET_ENV_FILE>"
    exit 1
  fi

  TARGET_URL=$(extract_db_url "$TARGET_ENV_FILE")
  export DATABASE_URL=$TARGET_URL
  
  backup_db "$TARGET_URL"
  
  echo "=> Running TypeORM migrations on target: $TARGET_ENV_FILE"
  bun run migration:run

elif [ "$ACTION" == "sync" ]; then
  SOURCE_ENV_FILE=$2
  TARGET_ENV_FILE=$3
  if [ -z "$SOURCE_ENV_FILE" ] || [ -z "$TARGET_ENV_FILE" ]; then
    echo "Usage: bun run typeorm-runner.sh sync <SOURCE_ENV_FILE> <TARGET_ENV_FILE>"
    exit 1
  fi

  SOURCE_URL=$(extract_db_url "$SOURCE_ENV_FILE")
  TARGET_URL=$(extract_db_url "$TARGET_ENV_FILE")

  echo "=> Warning: This will OVERWRITE the target database ($TARGET_ENV_FILE) with data from source ($SOURCE_ENV_FILE)."
  backup_db "$TARGET_URL"

  echo "=> Dumping source database..."
  mkdir -p .tmp
  local_dump=".tmp/sync_source.sql"
  pg_dump "$SOURCE_URL" --clean --if-exists --no-owner --no-privileges -f "$local_dump" || {
    echo "Error: Failed to dump source database."
    exit 1
  }

  echo "=> Restoring to target database..."
  # using psql since we dumped raw SQL
  psql "$TARGET_URL" -f "$local_dump" || {
    echo "Error: Failed to restore to target database."
    exit 1
  }
  
  rm -f "$local_dump"
  echo "=> Sync completed successfully."

elif [ "$ACTION" == "sync-schema" ]; then
  TARGET_ENV_FILE=$2
  if [ -z "$TARGET_ENV_FILE" ]; then
    echo "Usage: bun run typeorm-runner.sh sync-schema <TARGET_ENV_FILE>"
    exit 1
  fi

  TARGET_URL=$(extract_db_url "$TARGET_ENV_FILE")
  export DATABASE_URL=$TARGET_URL

  echo "=> Warning: This will safely synchronize the target database schema ($TARGET_ENV_FILE) to match current Code entities (preserving data)."
  backup_db "$TARGET_URL"

  echo "=> Syncing schema to target database using TypeORM..."
  bunx typeorm-ts-node-commonjs schema:sync -d src/db/data-source.cli.ts || {
    echo "Error: Failed to sync schema."
    exit 1
  }
  
  echo "=> Sync-schema completed successfully."

else
  echo "Error: Unknown action $ACTION"
  exit 1
fi
