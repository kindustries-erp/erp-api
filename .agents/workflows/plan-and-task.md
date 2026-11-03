---
description: Quy trình chuẩn 5 giai đoạn lập Implementation Plan và chia tách Task 3 cấp (Atomic DoD, Scoped Verification, Session Checkpoint & Knowledge-Sync) chuyên nghiệp cho erp-api
---

# 📋 Plan & Task Engineering Workflow (`/plan-and-task`) - Backend API

Workflow chuẩn 5 giai đoạn bắt buộc khi lập Kế hoạch Triển khai (**Implementation Plan**) và Phân rã Công việc (**Task Breakdown**) cho mọi tính năng mới, refactoring, database migration hoặc bugfix trong **`erp-api`**.

---

## 🎯 6 Nguyên Tắc Cốt Lõi (Core Principles)

```mermaid
graph LR
    A["1. Discovery"] --> B["2. API & DB Plan"]
    B --> C["3. Task 3 Cấp (X.Y.Z)"]
    C --> D["4. Approval Gate"]
    D --> E["5. Execution & Checkpoint"]
    E --> F["6. Knowledge-Sync"]
```

1. **Plan-First (Strict Read-Only Discovery & Zero Execution)**: Không sửa code và **TUYỆT ĐỐI KHÔNG CHẠY TEST RUNNER** (`jest`, `bun run test`, `bun run check:ci`, build script) khi chưa có Plan được duyệt. Toàn bộ Phase 1 đến Phase 4 hoạt động ở **CHẾ ĐỘ READ-ONLY 100%**. Luôn đọc mã nguồn thực tế, kiểm tra đúng repo đích (`erp-api`), branch đích (`erp-master`) và cấu hình runtime thực tế (`.env`, DB theo `DATABASE_URL` trong `.env`; không dùng file env cục bộ khác).
2. **Delivery Sequence Bắt Buộc**: `Database (Phase 1)` ➔ `API Backend (Phase 2)` ➔ `QC & Security (Phase 3)`.
3. **Task Breakdown 3 Cấp (`X.Y.Z`) & Scoped DoD Verification**: Đánh số `Phase.Group.Task` (ví dụ `1.1.1`, `2.2.1`, `3.1.2`). Mỗi task nhỏ gọn (1–2 files), bắt buộc có **Definition of Done (DoD)** và **Verification Command thu hẹp (Scoped Test < 10s)**:
   - *Quy tắc Lập Plan (Zero Execution)*: Mã lệnh trong mục `Verification` chỉ là **ĐẶC TẢ VĂN BẢN (Text Specification)** để cam kết tiêu chí hoàn thành, **TUYỆT ĐỐI KHÔNG ĐƯỢC CHẠY** trong lúc lập Plan. Lệnh này CHỈ ĐƯỢC CHẠY ở Phase 5 sau khi User đã duyệt Plan.
   - *Test Runner Duy Nhất*: Trong `erp-api`, test runner duy nhất là **`jest`** (`bunx jest <spec>`, `bunx jest --findRelatedTests <file>`) hoặc `bunx tsc --noEmit`. **TUYỆT ĐỐI CẤM GÕ LỆNH `vitest` TRONG `erp-api`**.
   - *Atomic Task (`Z`)*: BẮT BUỘC dùng Scoped Test nhanh (< 5–10s). **TUYỆT ĐỐI CẤM** chạy full test suite (`bunx jest`, `bun run test`, `bun run check:ci`) ở từng task nhỏ để tránh nghẽn CPU.
   - *Final Gate (Phase 3)*: Commit (pre-commit chạy lint + `jest --findRelatedTests`) → `git pull --rebase` → `git push` (pre-push chạy `type:check`). Full test/build/check:ci chạy trên GitHub CI; xác nhận CI xanh ở Task 3.1.1. `bun run verify:final` là lệnh local tùy chọn.
4. **Real-time Tracking & Test-First Tick**: Tại mỗi thời điểm **chỉ có duy nhất 1 task** ở trạng thái `[/] In Progress`. Tuyệt đối không tick `[x]` nếu lệnh kiểm thử chưa PASS 100%. Cập nhật tiến độ vào file `implementation_plan.md` ngay sau mỗi task.
5. **Session Checkpoint Protocol (Pause & Resume)**: Hỗ trợ tạm dừng và tiếp tục mượt mà. Khi tạm dừng, bắt buộc ghi log vào mục `## ⏸️ Session Checkpoint`. Khi tiếp tục, Agent đọc lại Checkpoint để xác định chính xác task đang dang dở và bắt đầu làm tiếp ngay mà không phải hỏi lại từ đầu.
6. **Knowledge-Sync Guard (Cập nhật Tri thức / Skill Liền Tay)**: Ngay sau khi hoàn thành task hoặc feature có thay đổi về Database schema, API contracts hoặc business logic cốt lõi, Agent **BẮT BUỘC cập nhật lại Module Skill** tương ứng (tại `erp/erp-api/.agents/skills/modules/<module>/SKILL.md`) hoặc chạy skill `/scan-module-knowledge` để tạo mới/đồng bộ tri thức. Tuyệt đối không để tri thức trong skill bị lỗi thời.

---

## 🧩 Tầng Cơ Chế Plan Theo Agent (`/plan` Bridge)

Workflow này là chuẩn chung. Mỗi agent dùng cơ chế plan gốc của mình để chạy Giai đoạn 1–4, nhưng artifact đầu ra luôn giống nhau: `implementation_plan.md` và Task 3 cấp.

| Agent | Cơ chế plan | Cách dùng |
| :--- | :--- | :--- |
| Claude Code | Plan mode gốc: `/plan` (tool `EnterPlanMode`) | Vào plan mode để khảo sát read-only và trình plan trong hội thoại. Sau khi user `OK` mới `ExitPlanMode`, lưu bản chốt vào `.agents/plans/<task-slug>/implementation_plan.md`, rồi chuyển sang Giai đoạn 5. |
| Antigravity | `implementation_plan.md` + `walkthrough.md` (Brain) | Dùng trực tiếp mẫu trong workflow này. Hai file này là artifact chính. |
| Codex, Copilot, Trae, agent khác | Không có plan mode tùy chỉnh | Trình plan trong chat, lưu bản chốt vào `.agents/plans/<task-slug>/implementation_plan.md` trong repo, chờ `OK`. |

Quy tắc áp dụng cho mọi agent:
- Cổng `OK` của user là bắt buộc. Plan mode chỉ thay thế bước khảo sát read-only, không thay thế cổng duyệt.
- Giai đoạn plan không chạy test runner, không sửa code.
- Sau `OK`: tạo task trên Plane (project KINDU) theo skill `plane-work-items`. Task ERP luôn có Story/Task.
- Task mới phải đi qua chuỗi `/plan-and-task`. Đừng bỏ qua giai đoạn 4 chỉ vì agent có plan mode riêng.

---

## 🧭 Quy Trình 5 Giai Đoạn Chuẩn (5-Phase SOP)

### 🔹 GIAI ĐOẠN 1: Discovery & Deep Research (Khảo Sát & Ranh Giới)
- **Runtime Truth Verification**: Đọc trực tiếp `.env` để kiểm tra kết nối DB (theo `DATABASE_URL` trong `.env`). Chạy `SELECT current_database();` và báo tên DB trước khi ghi. Không suy ra DB từ tên file hay thông tin cũ.
- **Scan Codebase & Tri thức (READ-ONLY)**: Dùng `grep_search`, `view_file` rà soát Entities, Services, DTOs liên quan và đọc module SKILL (`erp/erp-api/.agents/skills/modules/...`). Tuyệt đối KHÔNG chạy test runner ở bước này.
- **Scope Boundaries**: Định rõ **In-Scope** (làm gì) và **Out-of-Scope** (không làm gì) để triệt tiêu Scope Creep.
- **Threat Model**: Đánh giá RBAC permissions, SQL injection, khóa bi quan (pessimistic lock khi trừ kho/sổ quỹ), và rủi ro cross-module.

---

### 🔹 GIAI ĐOẠN 2: Technical Architecture & Contract Design (Thiết Kế Kỹ Thuật)
Soạn thảo `implementation_plan.md`:
- **Architecture Flow**: Sơ đồ Mermaid luồng Controller ➔ Service ➔ QueryRunner Transaction ➔ PostgreSQL.
- **Database Contract**: Table schema, composite indexes, foreign keys, TypeORM migrations (có cả `up()` và `down()`).
- **API Contract**: REST endpoints, Request DTO (validation decorators), Response DTO, RBAC permission guards.
- **Security & Concurrency Checklist**:
  - [ ] `@RequirePermissions(...)` đã gắn với constants chuẩn?
  - [ ] Transaction số dư / tồn kho có bọc `setLock("pessimistic_write")`?
  - [ ] Audit trail ghi nhận vào `erp_audit_logs`?
- **Rollback Strategy**: Phương án hoàn tác DB migration và code an toàn khi có sự cố.

---

### 🔹 GIAI ĐOẠN 3: 3-Level Task Breakdown & Concrete DoD (Phân Rã Task 3 Cấp)
Phân chia toàn bộ công việc theo hệ thống đánh số 3 cấp **`X.Y.Z`**:
* **`X` - Phase (Tầng hệ thống)**:
  - `1`: Database & Migrations
  - `2`: API Backend (DTO, Service, Controller, RBAC)
  - `3`: QC, CI, Security Verification & Knowledge Sync
* **`Y` - Component Group (Nhóm chức năng)**:
  - `1.1`: Entities & Table Schemas | `1.2`: TypeORM Migrations & Seeders
  - `2.1`: DTOs & Validation Contracts | `2.2`: Service Core & Business Logic | `2.3`: Controller & RBAC
  - `3.1`: Unit Tests & Full CI Check | `3.2`: Module Skill & Knowledge Sync
* **`Z` - Atomic Task (Đơn vị thực thi nguyên tử & Scoped Verification)**:
  - Mỗi task giới hạn tác động trong 1–2 files.
  - Phải có mã lệnh **Verification** chạy độc lập thu hẹp (**Scoped Verification** < 10 giây). **NGHIÊM CẤM** chạy full test suite (`bunx jest`, `bun run check:ci`) ở từng task nhỏ.
  - ⚠️ **LƯU Ý QUAN TRỌNG**: Mã lệnh trong `Verification` ở đây chỉ là **đặc tả văn bản (Text Specification)**. **TUYỆT ĐỐI KHÔNG CHẠY LỆNH NÀY KHI ĐANG LẬP KẾ HOẠCH!**

#### ⚡ Chuẩn Lệnh Verification Cho `erp-api`:
| Loại Task | Verification Command Chuẩn (Nhanh < 5s) | Ghi chú quan trọng |
| :--- | :--- | :--- |
| **Entity / Schema / DTO** | `bunx tsc --noEmit` | Kiểm tra type nhanh |
| **TypeORM Migration** | `bun run migration:run` | Chỉ chạy ở Phase 5 sau khi được duyệt |
| **Service Logic / Spec** | `bunx jest src/modules/<path>/<file>.spec.ts` | **CẤM gõ `vitest`** |
| **File mã nguồn thay đổi** | `bunx jest --findRelatedTests src/modules/<path>/<file>.ts` | **CẤM gõ `vitest`** |
| **Controller & RBAC** | `bunx jest src/modules/<path>/<file>.controller.spec.ts` | **CẤM gõ `vitest`** |
| **Final Gate (Task 3.1.1)** | CI GitHub xanh: job check, test, build | Xác nhận sau khi push trên commit cuối; `verify:final` local là tùy chọn |

#### Cấu trúc một Task chuẩn:
```markdown
- [ ] **Task X.Y.Z: [Tên Task súc tích, rõ hành động]**
  - **Phân hệ**: `Backend API` | **Ưu tiên**: `[P0 / P1 / P2]`
  - **Runner**: `[Main Agent]` *(Mặc định là Main Agent cho mọi CLI đơn luồng như Codex/Claude. Chỉ ghi `Sub-agent (self)` khi Agent có hỗ trợ Sub-agent và task độc lập hoàn toàn)*
  - **Files**: `[NEW]` / `[MODIFY]` / `[DELETE]` [path/to/file](erp/erp-api/path/to/file)
  - **DoD**: Tiêu chí hoàn thành cụ thể (TypeScript pass, validation chặt chẽ, spec pass 100%).
  - **Verification**: `[Lệnh kiểm thử scoped cụ thể: bunx jest <spec> hoặc bunx tsc --noEmit]`
```

---

### 🔹 GIAI ĐOẠN 4: Review, Alignment & Approval Gate (Duyệt Kế Hoạch)

**Bước 0: Kiểm tra chéo (Consistency Check, read-only)**: làm trước khi hỏi `OK`.
1. Mỗi tiêu chí chấp nhận (`AC-n`) ánh xạ tới ít nhất một task; mỗi task truy về ít nhất một AC. Không có task mồ côi, không có AC bị bỏ sót. Điền bảng truy vết AC → Task → Verification trong mục Spec.
2. Verification của task thật sự kiểm được AC đó, không chỉ là type-check chung.
3. Mọi mục `[CẦN LÀM RÕ]` đã được trả lời, hoặc nằm trong Open Questions chờ user quyết. Không để mơ hồ ngầm.
4. Plan không mâu thuẫn với skill chuẩn liên quan (thứ tự DB → API → UI → QC, giới hạn 180 dòng, `erp-api-truth/references/security-baseline.md` khi đụng endpoint, auth, DTO, upload).
5. Ghi một dòng kết quả trong plan: `Consistency Check: đạt` hoặc liệt kê chỗ lệch kèm cách xử lý.

- Nêu rõ **Breaking Changes** và các **Open Questions** (Phương án A vs B).
- Đặt cờ `RequestFeedback: true` trên `implementation_plan.md`.
- **DỪNG LẠI (STOP) HOÀN TOÀN**: Khoanh tay chờ User phê duyệt (`OK` / `Confirm`). **TUYỆT ĐỐI KHÔNG tự ý thực thi task đầu tiên, KHÔNG chạy test runner, KHÔNG sửa file trước khi có xác nhận rõ ràng từ User.**

---

### 🔸 Sau `OK`: Xác nhận tích hợp Plane (`plane-work-items`)

Ngay sau khi User trả lời `OK` / `Confirm`, Agent **PHẢI HỎI** trước khi làm gì trên Plane:

> Bạn có muốn tôi tạo và theo dõi task này trên Plane (project KINDU, workspace k-industries) không? **Có / Không**

- **Có**: load skill `plane-work-items`, tạo Module, Cycle, Story và Task theo mục 3 của skill, rồi ghi identifier (ví dụ `KINDU-12`) vào `implementation_plan.md`. Khi task đổi trạng thái thì cập nhật trên Plane.
- **Không**: chỉ theo dõi trong `implementation_plan.md`, và ghi dòng `Plane: không theo dõi` vào plan.
- Với task ERP, lựa chọn khuyến nghị là **Có**, theo quy tắc ERP trong `AGENTS.md`. Câu hỏi vẫn phải được hỏi.
- Chưa có `OK` thì không tạo gì trên Plane. Không ghi plan hay task vào Trilium.

---

### 🔹 GIAI ĐOẠN 5: Real-time Execution, Pause/Resume & Walkthrough

#### 1. Quy tắc Thực thi & Tick Done Thời Gian Thực (Real-time Tracking)
- **Single Active Task**: Khi bắt đầu làm một task, đổi ngay `[ ]` thành `[/]`. Tại một thời điểm **chỉ có 1 task duy nhất** ở trạng thái `[/]`.
- **Test-Before-Tick Guard**: 
  - Chỉ được đổi `[/]` thành `[x]` khi và chỉ khi lệnh trong mục `Verification` trả về kết quả **PASS 100%**.
  - Nếu test fail hoặc type error: giữ nguyên `[/]`, tiếp tục sửa code cho đến khi test pass.
- **Live Sync**: Ngay khi hoàn tất một task, ghi nhận trạng thái vào `implementation_plan.md` ngay lập tức, không để dồn đến cuối mới tick.

#### 1.1 Cơ chế Thực thi Thống nhất (Single-Agent vs Sub-agent Delegation)
Để đảm bảo **bất kỳ AI Agent nào (Codex CLI, Claude Code, Gemini CLI, Antigravity) cũng đều thực thi và có hành động giống hệt nhau**, toàn bộ hệ thống tuân theo các nguyên tắc chuẩn hóa:
- **Chuẩn Mặc Định Cho Mọi Agent (Single-Agent Baseline)**:
  - Mọi Agent (dù đơn luồng hay đa nhiệm) đều có thể tự mình thực thi tuần tự từ trên xuống dưới (`[/]` ➔ sửa file ➔ chạy verification ➔ PASS ➔ tick `[x]`).
  - Khi chạy trên các công cụ không có Sub-agent (Codex CLI, Claude Code), Agent chính tự làm 100% các task mà không yêu cầu thêm công cụ nào khác.
- **Cơ Chế Ủy Quyền Sub-agent (Khi môi trường hỗ trợ, ví dụ Antigravity)**:
  - **Điều kiện ủy quyền**: Chỉ kích hoạt khi Agent có công cụ `invoke_subagent` VÀ task thỏa mãn tính độc lập (ví dụ service độc lập, hoặc khi User chỉ định / dùng `/teamwork`).
  - **Quy tắc Giao việc**: Agent chính gọi Sub-agent (`self`) bằng cách trích xuất chính xác: `Task X.Y.Z`, `Files được phép sửa`, `DoD`, và `Lệnh Verification`.
  - **Quy tắc Thực thi của Sub-agent**: Sub-agent khi nhận task **BẮT BUỘC tuân thủ đúng DoD và Verification của task đó**, tuyệt đối không sửa lan man ngoài scope.
  - **Nguyên tắc Gatekeeper (Trách nhiệm Người Giữ Cổng)**: Sub-agent **TUYỆT ĐỐI KHÔNG** tự ý tick `[x]` vào `implementation_plan.md`. Sub-agent chỉ thực thi, chạy verification, và báo cáo kết quả kèm bằng chứng test pass về cho Agent chính.
  - **Nghiệm thu & Cập nhật**: Agent chính nhận kết quả, xác minh lại lệnh Scoped Verification thực sự PASS 100%, sau đó Agent chính mới chuyển task sang `[x]` trên `implementation_plan.md`.
  - **Tính Nhất Quán**: Dù do Main Agent tự làm hay Sub-agent thực hiện, mã nguồn, commit log, test passing và tài liệu nghiệm thu (`walkthrough.md`) là **100% ĐỒNG NHẤT**.

#### 2. Giao thức Tạm dừng (Pause Protocol)
Khi người dùng yêu cầu tạm dừng, đổi context hoặc phiên làm việc bị ngắt quãng:
Agent **bắt buộc cập nhật** section `## ⏸️ Session Checkpoint` ở cuối file `implementation_plan.md`:
```markdown
## ⏸️ Session Checkpoint (Tạm dừng lúc: YYYY-MM-DD HH:mm)
- **Active Task**: `Task X.Y.Z: [Tên Task]` (`[/] In Progress`)
- **Tiến độ chi tiết**: Đã hoàn thành các phần nào, đang dừng tại dòng/hàm nào.
- **Việc chưa xong**: Cụ thể điều kiện biên hoặc test case nào đang xử lý dở.
- **Git Status**: Danh sách file đã sửa nhưng chưa commit.
- **Hành động tiếp theo khi Resume**: Lệnh hoặc bước cụ thể cần làm ngay khi bật lại session.
```

#### 3. Giao thức Tiếp tục (Resume Protocol)
Khi bắt đầu lại phiên làm việc (User gõ `tiếp tục`, `continue`, hoặc gửi prompt mới):
1. **Đọc Checkpoint**: Agent đọc `implementation_plan.md` và kiểm tra mục `## ⏸️ Session Checkpoint`.
2. **Xác định Task Active**: Tìm task có trạng thái `[/]` (nếu có) hoặc task `[ ]` đầu tiên theo thứ tự từ trên xuống.
3. **Báo cáo User**: Thông báo ngắn gọn vị trí đang tiếp tục:
   > *"Phiên làm việc trước đang tạm dừng tại **Task X.Y.Z: [Tên Task]** ([Mô tả tiến độ dở]). Em sẽ tiếp tục hoàn thiện task này ngay bây giờ."*
4. **Thực thi liền mạch**: Bắt tay làm tiếp ngay từ đúng bước trong checkpoint mà không làm lại từ đầu.

#### 4. Nghiệm thu, Cập nhật Tri thức & Báo cáo (Walkthrough & Knowledge Sync)
- **Nghiệm thu cuối cùng (Final Gate)**: Sau khi commit và `git pull --rebase`, push (pre-push chạy `type:check`) rồi xác nhận CI GitHub xanh trên commit cuối.
- **Knowledge & Skill Sync (Bắt buộc kiểm tra & cập nhật liền sau khi xong task)**:
  - Nếu có thay đổi Schema, DTOs, endpoints, relations: cập nhật vào Module Skill (`erp/erp-api/.agents/skills/modules/<module-name>/SKILL.md`) hoặc chạy `/scan-module-knowledge`.
  - Nếu là module hoàn toàn mới: tạo file skill mới tại `erp/erp-api/.agents/skills/modules/<module-name>/SKILL.md` và gắn link vào `erp-api-truth`.
  - Tuyệt đối không để tri thức chỉ nằm trong commit hoặc đầu óc mà không ghi vào skill.
- **Tạo Báo cáo Nghiệm thu**: Tạo file `walkthrough.md` đính kèm bằng chứng test logs và trạng thái đồng bộ skill.

---

## 📑 MẪU IMPLEMENTATION PLAN CHUẨN (`implementation_plan.md`)

```markdown
# [Tên Feature / Refactor / Migration]: Kế Hoạch Kỹ Thuật (erp-api)

Tóm tắt mục tiêu bài toán và giá trị mang lại.

## 📝 Spec (Mục tiêu & Tiêu chí chấp nhận)
- **Mục tiêu**: một hai câu nói rõ việc này giải quyết vấn đề gì cho ai.
- **Phạm vi và ngoài phạm vi**: liệt kê rõ để tránh task lan ra ngoài yêu cầu.
- **Tiêu chí chấp nhận** (mã `AC-1`, `AC-2`, ...; mỗi tiêu chí phải kiểm chứng được bằng test, lệnh hoặc quan sát cụ thể):
  - [ ] `AC-1`: ...
- **Bảng truy vết** (điền ở Giai đoạn 4 khi Consistency Check):

| AC | Task | Verification |
| :--- | :--- | :--- |
| `AC-1` | `1.1.1` | ... |

## ⚠️ User Review Required
> [!IMPORTANT]
> - **Quyết định nghiệp vụ**: [Nội dung cần User xác nhận]
> - **Breaking changes**: [Cảnh báo nếu có thay đổi hợp đồng API hoặc schema]

## ❓ Open Questions
> Mỗi điểm mơ hồ ghi thành một mục gắn nhãn `[CẦN LÀM RÕ]`. Không tự giả định thay user; nếu user bỏ qua thì ghi giả định đã chọn vào đây.
- [ ] **Câu hỏi 1**: [Phương án kỹ thuật A vs B?]

---

## 🏛️ Kiến Trúc & Hợp Đồng Dữ Liệu

### 1. Database Schema
- **Bảng**: `erp_[table_name]` | **Cột mới**: `column_name` (`type`, constraint) | **Index**: `CREATE INDEX ...`

### 2. API Contract
- `POST /api/v1/[module]/[action]`
  - **Body DTO**: `{ "field": "string", "amount": 1000 }`
  - **Response 200**: `{ "success": true, "data": { "id": "uuid" } }`

### 3. Security & Concurrency Checklist
- [ ] `@RequirePermissions(...)` đã được gắn trên toàn bộ endpoint mới.
- [ ] Giao dịch tài chính / kho bọc trong transaction với `pessimistic_write`.
- [ ] Log thao tác người dùng vào `erp_audit_logs`.

---

## 📋 Task Breakdown 3 Cấp & Definition of Done (DoD)

### Phase 1: Database & Migrations
#### 1.1 Entities & Table Schema
- [ ] **Task 1.1.1: Tạo Entity & Enum cho bảng mới**
  - **Phân hệ**: `DB` | **Ưu tiên**: `P0`
  - **Files**: `[NEW]` [src/database/entities/custom.entity.ts](erp/erp-api/src/database/entities/custom.entity.ts)
  - **DoD**: Khai báo đủ decorator TypeORM, relations và indexes.
  - **Verification**: `bunx tsc --noEmit`

#### 1.2 Migrations
- [ ] **Task 1.2.1: Tạo file Migration TypeORM**
  - **Phân hệ**: `DB` | **Ưu tiên**: `P0`
  - **Files**: `[NEW]` [src/migrations/1780000000000-CreateCustomTable.ts](erp/erp-api/src/migrations/1780000000000-CreateCustomTable.ts)
  - **DoD**: Có cả `up()` và `down()`.
  - **Verification**: `bun run migration:run`

### Phase 2: Backend API
#### 2.1 DTOs & Validation
- [ ] **Task 2.1.1: Tạo Create & Update DTOs**
  - **Phân hệ**: `API` | **Ưu tiên**: `P0`
  - **Files**: `[NEW]` `src/modules/.../dto/create-item.dto.ts`
  - **DoD**: Đầy đủ `class-validator` decorators.
  - **Verification**: `bunx jest src/modules/.../dto.spec.ts`

#### 2.2 Service & Business Logic
- [ ] **Task 2.2.1: Implement Service Method với Transaction Lock**
  - **Phân hệ**: `API` | **Ưu tiên**: `P0`
  - **Files**: `[MODIFY]` `src/modules/.../custom.service.ts`
  - **DoD**: Xử lý logic đúng, khóa bi quan chống race condition.
  - **Verification**: `bunx jest src/modules/.../custom.service.spec.ts -t "processTransaction"`

#### 2.3 Controller & RBAC Guard
- [ ] **Task 2.3.1: Expose Endpoints & Gắn Guard**
  - **Phân hệ**: `API` | **Ưu tiên**: `P0`
  - **Files**: `[MODIFY]` `src/modules/.../custom.controller.ts`
  - **DoD**: Gắn `@RequirePermissions`, OpenAPI decorators.
  - **Verification**: `bunx jest src/modules/.../custom.controller.spec.ts`

### Phase 3: QC & Knowledge Sync
#### 3.1 Automated Tests & CI Check
- [ ] **Task 3.1.1: Xác nhận CI GitHub xanh trên commit cuối**
  - **Phân hệ**: `QC` | **Ưu tiên**: `P0`
  - **DoD**: CI xanh (job check, test, build): 100% test pass, không lỗi ESLint, Prettier và TypeScript.
  - **Verification**: CI GitHub của nhánh đích xanh; tùy chọn `bun run verify:final` local.

#### 3.2 Knowledge & Skill Sync
- [ ] **Task 3.2.1: Cập nhật Module Skill & Current-Truth**
  - **Phân hệ**: `Docs/Skill` | **Ưu tiên**: `P1`
  - **Files**: `[MODIFY]` / `[NEW]` [path/to/SKILL.md](erp/erp-api/.agents/skills/modules/<module>/SKILL.md) (hoặc chạy `/scan-module-knowledge`)
  - **DoD**: Bổ sung chính xác schema, API contracts mới vào Module Skill.
  - **Verification**: `view_file` kiểm tra nội dung skill chuẩn xác, không còn thông tin cũ/sai lệch.

---

## ⏸️ Session Checkpoint
*(Mục này sẽ được cập nhật khi phiên làm việc cần tạm dừng hoặc đổi ngữ cảnh)*
- **Active Task**: `None`
- **Tiến độ chi tiết**: Chưa bắt đầu
- **Git Status**: Clean
- **Hành động tiếp theo khi Resume**: Bắt đầu Task 1.1.1
```

---

## 📦 MẪU BÁO CÁO NGHIỆM THU (`walkthrough.md`)

```markdown
# 🚀 Walkthrough & Verification Report: [Tên Tính Năng]

## 📝 Tóm Tắt Thay Đổi
| Phân hệ | File | Loại | Mô tả |
| :--- | :--- | :---: | :--- |
| **DB**  | `src/migrations/...` | `NEW` | Migration mới |
| **API** | `src/modules/.../service.ts` | `MODIFY` | Logic nghiệp vụ & Transaction |

## 🧪 Bằng Chứng Xác Thực (Test Evidence)
- **Unit Tests**: `bunx jest` ➔ `PASS (100% test suites)`
- **CI Check**: `bun run check:ci` ➔ `PASS (0 errors)`

## 🧠 Tri Thức & Skill Đồng Bộ (Knowledge Sync)
- **Module Skill**: Đã cập nhật `[path/to/SKILL.md]` (hoặc: *Không có thay đổi schema/contract*).
- **Current Truth**: Đã liên kết vào `erp-api-truth`.
```
