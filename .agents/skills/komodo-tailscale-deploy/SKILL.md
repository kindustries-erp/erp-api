---
name: komodo-tailscale-deploy
description: >-
  Standardized CI/CD workflow generator, pre-flight infra checker, and multi-target
  Komodo deployment guide across Tailscale mesh IPs for any branch. Use this skill
  when writing or editing GitHub Actions workflows, checking infra/secrets prerequisites,
  or deploying stacks via Komodo API.
---

# Komodo Tailscale Deployment Skill Router

> **Wiki-First Authority**: This skill is a **ROUTER ONLY**. The complete, authoritative source of truth, pre-flight command checklists, YAML workflow templates, and auto-provisioning lifecycles are maintained in **Trilium Wiki**.

## Instructions for AG (Antigravity Agent)

When tasked with creating, editing, or auditing a GitHub Actions CI/CD workflow, or provisioning/deploying Stacks to Tailscale IPs via Komodo for any branch:

1. **Query Trilium Wiki First**:
   * Use MCP tool `call_mcp_tool` (server: `trilium`, tool: `search_notes` or `get_note`) to query note:
     **`8. AG CI/CD Pipeline & Multi-Node Dynamic Komodo Deployment Standard`** (under parent note `AG`).
2. **Execute 4-Phase Delivery Flow**:
   * **Phase 1: Target Node Pre-Flight Check**: Verify Tailscale connectivity, `npm-network` Docker network, `/root/.docker/config.json` (GHCR root pull auth), and port availability on the target host.
   * **Phase 2: Secrets & Variables Pre-Check**: Verify `KOMODO_URL` (vars), `KOMODO_API_KEY`, `KOMODO_API_SECRET`, `TS_OAUTH_*`, and branch API env secrets.
   * **Phase 3: Workflow & Compose Separation**: Separate Compose specs into `.github/compose/*.compose.yaml` (never embed multiline heredocs in YAML `run: |`), use `actions/checkout@v4` with `sed`, standard naming `[branch]-[short-host]-[service]`, and matrix targets.
   * **Phase 4: Governance & Verification**: Validate YAML syntax locally with Python `yaml.safe_load`, run local CI, push from child repo, monitor parallel matrix execution, verify endpoints, and record plan/tasks in Trilium Wiki (`1.`, `1.1.`, `1.2.`).
