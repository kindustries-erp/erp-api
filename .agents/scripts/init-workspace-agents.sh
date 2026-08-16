#!/usr/bin/env bash
# ==============================================================================
# Script: init-workspace-agents.sh
# Purpose: Khởi tạo/đồng bộ thư mục .agents ở workspace root để Antigravity IDE
#          tự động nhận diện và kết nối skills/rules từ erp-api và erp-web.
# Usage:
#   bash ./.agents/scripts/init-workspace-agents.sh
#   hoặc chạy từ bất kỳ thư mục nào trong workspace.
# ==============================================================================

set -euo pipefail

CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Tìm thư mục cha chứa cả erp-api hoặc erp-web
if [[ -d "$CURRENT_DIR/../../../erp-api" ]] && [[ -d "$CURRENT_DIR/../../../erp-web" ]]; then
    WORKSPACE_ROOT="$(cd "$CURRENT_DIR/../../.." && pwd)"
elif [[ -d "$CURRENT_DIR/../../erp-api" ]] && [[ -d "$CURRENT_DIR/../../erp-web" ]]; then
    WORKSPACE_ROOT="$(cd "$CURRENT_DIR/../.." && pwd)"
elif [[ -d "$CURRENT_DIR/../erp-api" ]] && [[ -d "$CURRENT_DIR/../erp-web" ]]; then
    WORKSPACE_ROOT="$(cd "$CURRENT_DIR/.." && pwd)"
elif [[ -d "./erp-api" ]] && [[ -d "./erp-web" ]]; then
    WORKSPACE_ROOT="$(pwd)"
else
    echo "❌ Không tìm thấy workspace root chứa cả erp-api và erp-web."
    exit 1
fi

echo "🚀 Khởi tạo Antigravity Router tại workspace root: $WORKSPACE_ROOT"

AGENTS_DIR="$WORKSPACE_ROOT/.agents"
WORKFLOWS_DIR="$AGENTS_DIR/workflows"

mkdir -p "$AGENTS_DIR"
mkdir -p "$WORKFLOWS_DIR"

# 1. Tạo skills.json liên kết các skills từ sub-repos
cat << 'EOF' > "$AGENTS_DIR/skills.json"
{
  "entries": [
    {
      "path": "erp-api/.agents/skills"
    },
    {
      "path": "erp-web/.agents/skills"
    }
  ]
}
EOF
echo "✅ Đã tạo $AGENTS_DIR/skills.json"

# 2. Tạo AGENTS.md router
cat << 'EOF' > "$AGENTS_DIR/AGENTS.md"
# Liouni ERP Workspace Router

**ROUTING ONLY:** This `.agents` directory is the **entry point and router**. Do NOT look for application-specific implementation rules here.

- When working on the **web app**, you **MUST** stop reading here and immediately load: `./erp-web/.agents/AGENTS.md`.
- When working on the **API**, you **MUST** stop reading here and immediately load: `./erp-api/.agents/AGENTS.md`.

## Strict Guardrails

- **NO ROOT PUSHING:** You are explicitly **FORBIDDEN** from running `git add`, `git commit`, or `git push` from the workspace root directory (e.g., `/home/dev/repos/erp/`). Always `cd` into the specific child repository (e.g., `erp-api`, `erp-web`).
- **LANE ORDER:** Always follow the delivery sequence: `DB -> API -> UI -> QC`.
- **BUN FIRST:** Use `bun` / `bunx` exclusively. Do NOT use `npm` or `yarn`.
- **LOCAL TESTING ONLY:** Do NOT build or run deployment containers manually on the local machine. Use local node scripts (`bun run start:dev` / `bun run dev`).

## Skills & Configuration
All execution skills, domain rules, and task artifacts are version-controlled inside `./erp-api/.agents` and `./erp-web/.agents` and registered via `./.agents/skills.json`.

## TypeORM Query Relations
When adding a relation using the `relations` array in TypeORM methods (such as `find`, `findAndCount`, etc.), you MUST verify that the relation is correctly mapped in the entity definition with appropriate decorators (`@OneToMany`, `@ManyToOne`, `@OneToOne`, `@ManyToMany`). Failure to define the relation in the entity will cause a 500 `EntityPropertyNotFoundError` at runtime.
EOF
echo "✅ Đã tạo $AGENTS_DIR/AGENTS.md"

# 3. Tạo workflows/routing.md
cat << 'EOF' > "$WORKFLOWS_DIR/routing.md"
---
description: Routing
---

# Workspace Routing Workflows

## Workflow 1 — API task
1. Start at workspace root `.agents/AGENTS.md`
2. Move into `./erp-api/.agents/AGENTS.md`
3. Follow API repo-local read order and task files there

## Workflow 2 — Web task
1. Start at workspace root `.agents/AGENTS.md`
2. Move into `./erp-web/.agents/AGENTS.md`
3. Follow Web repo-local read order and task files there

## Workflow 3 — Cross-repo ERP task
1. Start at workspace router
2. Keep mandatory sequence: DB -> API -> UI -> QC
3. Read API repo-local `.agents`
4. Read Web repo-local `.agents`
5. Apply/verify changes separately in each repo
EOF
echo "✅ Đã tạo $WORKFLOWS_DIR/routing.md"

# 4. Dọn dẹp các thư mục thừa nếu có
rm -rf "$AGENTS_DIR/skills" "$AGENTS_DIR/context" "$AGENTS_DIR/tasks" "$AGENTS_DIR/rules"

echo "🎉 Hoàn tất cấu hình Antigravity Routing Hub!"
