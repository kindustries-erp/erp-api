# Task: Agent contract hardening for ERP API repo

## Request Input (bạn chỉ cần điền phần này)
- Type: ENHANCE
- Mục tiêu: Chuẩn hóa rule / skill / workflow của agent trong repo API để teamwork tốt hơn, modular hơn, scale tốt hơn và maintain được lâu dài.
- Bối cảnh/ngữ cảnh: Repo API đã có `.agents`, `AGENTS.md`, `docs/ai/technical-instructions.md` nhưng còn dead reference, command gate chưa nhất quán, và thiếu contract rõ giữa enforced standard với preferred direction.

## Goal
Làm sạch và nâng chuẩn agent contract của repo API theo hướng current-truth, team-scalable, evidence-first, Bun-first.

## Scope
- In-scope:
  - fix dead reference trong `.agents/rules` và local skill
  - thống nhất read order / canonical source of truth
  - chuẩn hóa command gates (`lint:check`, `build`, `test`, smoke)
  - bổ sung definition-of-done, anti-drift, teamwork/modularity guardrails trong docs agent
  - cập nhật task template sang Bun-first
- Out-of-scope:
  - thay đổi source business logic API
  - thay đổi DB schema/runtime
  - thay đổi CI workflow

## Relevant Files
- `.agents/rules/liouni-erp-api.md` - repo rule chính cho agent
- `.agents/skills/liouni-erp-api-current-truth/SKILL.md` - local skill current-truth
- `docs/ai/technical-instructions.md` - canonical workflow instructions
- `docs/tasks/_template.md` - task template cần Bun-first và current workflow wording

## Gate 0 — DB Precheck (bắt buộc)
- Collections/fields liên quan: N/A — docs/process-only change
- Data nền cần có: N/A
- Constraint/index/default cần có: N/A
- Kết quả: `DB_READY`
- Nếu `DB_GAP_FOUND`: N/A

## Coordination Impact
- [ ] Directus staging schema affected
- [x] ERP Web contract affected
- [x] No cross-system impact

## Checklist (cập nhật realtime)
- [x] 1.0 Gate 0 DB Precheck done
- [x] 2.0 Backend workflow/API gate done
- [x] 3.0 UI handoff gate done
- [x] 4.0 Validate
  - [x] 4.1 `bun run lint:check`
  - [x] 4.2 `bun run build`
  - [x] 4.3 `bunx jest --forceExit`
- [x] 5.0 Close
  - [x] 5.1 Lessons learned entry (if issue)
  - [x] 5.2 Commit + push code (web/api)
  - [x] 5.3 Summary with evidence

## Validation Evidence
- DB precheck result: `DB_READY`
- `bun run lint:check`: PASS
- Build: `bun run build` PASS
- Test: `bunx jest --forceExit` PASS (`5 suites`, `18 tests`)
- Smoke: N/A (docs/process-only)

## Lessons Learned
- Link: No issue

## Commit/Push Status
- API repo: committed `09f0332`, pushed `github-industries/erp-master`
- Web repo (if affected): coordinated separately in sibling repo task
- DB/directus staging: N/A
