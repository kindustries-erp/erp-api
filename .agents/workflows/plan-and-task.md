---
description: Quy trình chuẩn 5 giai đoạn lập Implementation Plan và chia tách Task (Atomic DoD & Verification) chuyên nghiệp cho erp-api
---

# 📋 Plan & Task Engineering Workflow (`/plan-and-task`) - Backend API

Workflow chuẩn 5 giai đoạn bắt buộc khi lập Kế hoạch Triển khai (**Implementation Plan**) và Phân rã Công việc (**Task Breakdown**) cho mọi tính năng mới, refactoring, database migration hoặc bugfix trong **`erp-api`**.

---

## 🎯 Nguyên Tắc Cốt Lõi (Core Principles)

```mermaid
graph LR
    A["1. Discovery"] --> B["2. API & DB Plan"]
    B --> C["3. Atomic Task"]
    C --> D["4. User Approval"]
    D --> E["5. Test & QC"]
```

1. **Plan-First (Zero-Assumption)**: Không sửa code khi chưa có Plan được duyệt. Luôn đối chiếu code thực tế.
2. **Strict Sequence**: `Database (Schema/Migration)` ➔ `API (DTO/Service/Controller/RBAC)` ➔ `QC & Jest Tests`.
3. **Atomic Task & Scoped DoD Verification**: Mỗi task (1–2 files), có mã lệnh kiểm thử thu hẹp (**Scoped Verification Command** < 10s: `bunx jest <spec>`, `bunx jest --findRelatedTests <file>`, `bunx tsc --noEmit`). **TUYỆT ĐỐI CẤM** chạy full test suite (`bunx jest`, `bun run check:ci`) ở từng task nhỏ để tránh nghẽn CPU và mất thời gian vô lý.
4. **Brain Artifacts**: Lưu trữ qua `implementation_plan.md` (kế hoạch) và `walkthrough.md` (nghiệm thu).
5. **Knowledge-Sync Guard (Cập nhật Tri thức / Skill Liền Tay)**: Ngay sau khi hoàn thành task hoặc feature có thay đổi về Database schema, API contracts hoặc business logic cốt lõi, Agent **BẮT BUỘC cập nhật lại Module Skill** tương ứng (tại `.agents/skills/modules/<module>/SKILL.md`) hoặc chạy skill `/scan-module-knowledge` để tạo mới/đồng bộ tri thức. Tuyệt đối không để tri thức trong skill bị lỗi thời.

---

## 🧭 Quy Trình 5 Giai Đoạn Chuẩn (5-Phase SOP)

### 🔹 GIAI ĐOẠN 1: Discovery & Deep Research (Khảo Sát & Ranh Giới)
- **Codebase Scan**: Dùng `grep_search`, `view_file` rà soát Entities, Services, DTOs liên quan và đọc module SKILL (`.agents/skills/modules/...`).
- **Scope**: Phân định rõ **In-Scope** vs **Out-of-Scope**.
- **Threat Model**: Đánh giá RBAC permissions, SQL injection, khóa bi quan (pessimistic lock khi trừ kho/sổ quỹ), và rủi ro cross-module.

### 🔹 GIAI ĐOẠN 2: Architecture & Contract Design (Thiết Kế Kỹ Thuật)
Soạn thảo `implementation_plan.md`:
- **Architecture Flow**: Sơ đồ Mermaid luồng Controller ➔ Service ➔ QueryRunner Transaction ➔ PostgreSQL.
- **Database Contract**: Table schema, indexes composite, foreign keys, TypeORM migration.
- **API Contract**: REST endpoints, Request DTO (validation decorators), Response DTO, RBAC permission guards.
- **Rollback Strategy**: Phương án hoàn tác migration và code nếu có lỗi.

### 🔹 GIAI ĐOẠN 3: Atomic Task Breakdown & DoD (Phân Rã Task)
Phân chia task theo thứ tự: `Phase 1: DB & Migration` ➔ `Phase 2: API & Logic` ➔ `Phase 3: QC & Unit Tests`:
- **Cấu trúc mỗi Task**:
  ```markdown
  - [ ] **Task [ID]: [Tên Task]**
    - **Phân hệ**: `Backend API` | **Ưu tiên**: `[P0 / P1 / P2]`
    - **Files**: `[NEW]` / `[MODIFY]` / `[DELETE]` [path/to/file](file:///absolute/path/to/file)
    - **DoD**: Code sạch TypeScript, validation chặt chẽ, unit test pass 100%.
    - **Verification**: `bunx jest src/modules/.../service.spec.ts` hoặc `bunx jest --findRelatedTests src/modules/.../service.ts` (Dưới 5s, KHÔNG chạy full test hay check:ci ở đây).
  ```
- **Trạng thái**: `[ ] Pending` ➔ `[/] In Progress` ➔ `[x] Completed & Verified` ➔ `[-] Skipped`.

### 🔹 GIAI ĐOẠN 4: Review & User Approval Gate (Duyệt Kế Hoạch)
- Nêu rõ **Open Questions** & phương án trade-off (Phương án A vs B).
- Đặt cờ `RequestFeedback: true` trên `implementation_plan.md`.
- **DỪNG LẠI** chờ User phê duyệt trước khi viết code.

### 🔹 GIAI ĐOẠN 5: Execution, Test-First & Walkthrough (Thực Thi & Nghiệm Thu)
- Thực thi tuần tự, chuyển `[/]`, chạy Scoped Verification Command đạt 100% trước khi tick `[x]`.
- **Knowledge-Sync on Task Completion**: Nếu task làm thay đổi Schema, DTO hay API Endpoint, cập nhật ngay vào Module Skill liên quan trước khi kết thúc task.
- **Nghiệm thu cuối cùng (Final Gate)**: Chạy full check DUY NHẤT một lần ở cuối toàn bộ kế hoạch: `bun run check:ci && bunx jest --forceExit`.
- **Nghiệm thu & Đồng bộ Tri thức**: Cập nhật Module Skill (`.agents/skills/modules/<module-name>/SKILL.md`) hoặc chạy `/scan-module-knowledge`.
- Tạo báo cáo nghiệm thu `walkthrough.md` đính kèm test logs và trạng thái đồng bộ skill.

---

## 📑 MẪU IMPLEMENTATION PLAN CHUẨN (`implementation_plan.md`)

```markdown
# [Tên Feature / Refactor / Migration]: Kế Hoạch Kỹ Thuật (erp-api)

## ⚠️ User Review Required
> [!IMPORTANT]
> - **Quyết định nghiệp vụ**: [Nội dung cần User xác nhận]

## ❓ Open Questions
- [ ] **Câu hỏi 1**: [Phương án kỹ thuật A vs B?]

---

## 🏛️ Kiến Trúc & Hợp Đồng Dữ Liệu

### 1. Database Schema
- **Bảng**: `erp_[table_name]` | **Cột mới**: `column_name` (`type`, constraint) | **Index**: `CREATE INDEX ...`

### 2. API Contract
- `POST /api/v1/[module]/[action]`
  - **Body DTO**: `{ "field": "string", "amount": 1000 }`
  - **Response 200**: `{ "success": true, "data": { "id": "uuid" } }`

---

## 📋 Task Breakdown & Definition of Done (DoD)

### Phase 1: Database & Migrations
- [ ] **Task 1.1: Tạo Migration & Entity**
  - **Files**: `[NEW]` `src/database/migrations/xxx.ts`, `[MODIFY]` `src/modules/.../entity.ts`
  - **DoD**: Migration chạy mượt, schema khớp DB. | **Verification**: `bun run typeorm migration:run`

### Phase 2: Backend API & Logic
- [ ] **Task 2.1: DTOs & Validation** | **Files**: `[NEW]` `src/modules/.../dto.ts` | **DoD**: Chặn payload rác.
- [ ] **Task 2.2: Service Logic & Unit Test**
  - **Files**: `[MODIFY]` `src/modules/.../service.ts`
  - **DoD**: Unit test pass 100%. | **Verification**: `bunx jest src/modules/.../service.spec.ts`
- [ ] **Task 2.3: Controller Endpoints & RBAC Guards**
  - **Files**: `[MODIFY]` `src/modules/.../controller.ts`

### Phase 3: QC & Knowledge Sync
- [ ] **Task 3.1: Full Check CI & Tests** | **Verification**: `bun run check:ci && bun run test`
- [ ] **Task 3.2: Đồng bộ Module Skill**
  - **Files**: `[MODIFY]` `.agents/skills/modules/<module>/SKILL.md` (hoặc chạy `/scan-module-knowledge`)
  - **DoD**: Cập nhật DTOs, endpoints, tables mới vào Module Skill.
```

---

## 📦 MẪU BÁO CÁO NGHIỆM THU (`walkthrough.md`)

```markdown
# 🚀 Walkthrough & Verification Report: [Tên Tính Năng]

## 📝 Tóm Tắt Thay Đổi
| Phân hệ | File | Loại | Mô tả |
| :--- | :--- | :---: | :--- |
| **DB**  | `src/database/migrations/...` | `NEW` | Migration mới |
| **API** | `src/modules/.../service.ts` | `MODIFY` | Logic nghiệp vụ & Transaction |

## 🧪 Bằng Chứng Xác Thực (Test Evidence)
- **Unit Tests**: `bunx jest` ➔ `PASS (100% test suites)`
- **CI Check**: `bun run check:ci` ➔ `PASS (0 errors)`

## 🧠 Tri Thức & Skill Đồng Bộ (Knowledge Sync)
- **Module Skill**: Đã cập nhật `[path/to/SKILL.md]` (hoặc: *Không có thay đổi schema/contract*).
- **Current Truth**: Đã liên kết vào `liouni-erp-api-current-truth`.
```
