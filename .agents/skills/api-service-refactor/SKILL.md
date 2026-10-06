---
name: api-service-refactor
description: Trợ lý giúp Agent/Developer chia tách các NestJS Controller (> 300 dòng) và Service (> 500 dòng) quá lớn trong erp-api thành cấu trúc Sub-Controllers, Sub-Services (Facade) và Helper/Query Engines chuẩn mực.
---

# Kỹ Năng API Service & Controller Refactor (`erp-api`)

## 1. Mục Đích & Ngưỡng Kích Hoạt (Thresholds)

Đảm bảo backend NestJS không bị phình to thành các file ngàn dòng vi phạm nguyên lý Single Responsibility Principle (SRP), gây khó khăn cho việc viết unit test, review code và dễ phát sinh merge conflict.

### Ngưỡng quy định kích thước file:
| Loại File | Ngưỡng Cảnh báo (WARNING) | Ngưỡng Nghiêm trọng (CRITICAL) | Hành động đề xuất |
| :--- | :---: | :---: | :--- |
| **Controller** (`*.controller.ts`) | **> 300 dòng** | **>= 1,000 dòng** | Áp dụng **Pattern A** (Sub-Controllers) |
| **Service** (`*.service.ts`) | **> 500 dòng** | **>= 1,000 dòng** | Áp dụng **Pattern B** (Sub-Services & Facade) |
| **Khác** (Logic/Helpers/Engines) | **> 800 dòng** | **>= 1,000 dòng** | Áp dụng **Pattern C** (Engine / Query Builder) |

---

## 2. Nguyên Tắc An Toàn Bắt Buộc (Safety Guardrails)

> [!CAUTION]
> **KHÔNG ĐƯỢC TỰ Ý THAY ĐỔI CODE NẾU CHƯA CÓ YÊU CẦU**:
> 1. Script scan chỉ dừng ở mức độ **CẢNH BÁO (Warning / Audit Report)** cho developer biết file nào cần refactor.
> 2. Chỉ thực hiện refactor khi người dùng chỉ định rõ ràng hoặc có task refactor được duyệt.

### Các bất biến phải bảo toàn khi refactor:
1. **Bảo toàn REST API Contract**: Tuyệt đối không thay đổi route path (`@Get`, `@Post`), HTTP status, headers, query params hoặc DTO response.
2. **Bảo toàn Service Method Signatures (Backward Compatibility)**: Khi chia nhỏ Service, file Service gốc phải đóng vai trò **Facade**, delegate sang các Sub-Services để không làm gãy các Controller hoặc Module khác đang gọi tới.
3. **Quản lý Transaction an toàn**: Các thao tác ghi nhiều bảng cần transaction (`queryRunner` / `entityManager`) phải được đóng gói trọn vẹn trong 1 service hoặc truyền transaction context rõ ràng, tránh mở nhiều connection lồng nhau.
4. **Bảo toàn tính toàn vẹn của NestJS Dependency Injection (Clean Constructor Mandate)**:
   * **TUYỆT ĐỐI CẤM** sử dụng TypeScript Constructor Overloading hoặc Union Types (`arg1: SubService | Repository<Entity>`) trong các class `@Injectable()`.
   * **Lý do**: TypeScript `emitDecoratorMetadata` sinh `design:paramtypes` dựa trên signature thực thi. Union types làm metadata bị gán `undefined` / `Object`, gây crash NestJS runtime (`UnknownDependenciesException`) dù `tsc` và `build` đều pass.
   * **Quy chuẩn**: Luôn dùng clean DI constructor 1 signature duy nhất và cập nhật unit tests (`*.spec.ts`) để truyền mock sub-services thay vì dùng constructor overload fallback.

---

## 3. Công Cụ Quét Tự Động (Warning Scanner)

Để kiểm tra nhanh danh sách các file vượt ngưỡng trong toàn bộ `src/`:

```bash
bun .agents/skills/api-service-refactor/scripts/scan-oversized-files.ts
```

Script sẽ phân loại theo mức độ 🔴 `CRITICAL` / 🟡 `WARN`, đếm số dòng và gợi ý pattern xử lý phù hợp.

---

## 4. 3 Pattern Refactor Chuẩn Cho NestJS

### Pattern A: Phân rã Controller thành Sub-Controllers (REST Resource)

*Áp dụng cho:* Controller phình to (> 300 dòng) do gom nhiều nhóm endpoint của các sub-resource khác nhau vào chung một file (ví dụ: `kgara-api-core.controller.ts`).

#### Cấu trúc thư mục mục tiêu:
```
src/kgara-api-core/
├── kgara-api-core.module.ts            # Khai báo tất cả sub-controllers vào controllers: [...]
├── controllers/
│   ├── kgara-cases.controller.ts        # Endpoint quản lý Vụ việc / Sửa chữa
│   ├── kgara-customers.controller.ts    # Endpoint quản lý Hồ sơ & Công nợ Khách hàng
│   ├── kgara-suppliers.controller.ts    # Endpoint quản lý Công nợ Nhà cung cấp
│   └── kgara-sync.controller.ts         # Endpoint Quản lý Sync & Chi nhánh
```

#### Code mẫu Controller con:
```typescript
// src/kgara-api-core/controllers/kgara-customers.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CoreRbacGuard } from '../../auth/guards/core-rbac.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { KgaraCustomersService } from '../services/kgara-customers.service';

@UseGuards(JwtAuthGuard, CoreRbacGuard)
@Controller('greenway/customers')
export class KgaraCustomersController {
  constructor(private readonly customersService: KgaraCustomersService) {}

  @Get('debt')
  @RequirePermissions('garage.customers.read')
  async getCustomersDebt(@Query() query: any) {
    return this.customersService.getCustomersDebt(query);
  }
}
```

---

### Pattern B: Phân rã Service thành Sub-Services + Facade Pattern

*Áp dụng cho:* Service phình to (> 500 dòng) do ôm nhiều nghiệp vụ hoặc gom nhiều báo cáo/tính năng độc lập (ví dụ: `reports-core.service.ts`, `production-core.service.ts`).

*Mô hình tham chiếu xuất sắc đã triển khai:* Thư mục [`src/erp-invoices-core/services/`](file:///home/dev/repos-dev/erp/erp-api/src/erp-invoices-core/services).

#### Cấu trúc thư mục mục tiêu:
```
src/reports-core/
├── reports-core.module.ts              # Đăng ký các sub-services vào providers & exports
├── reports-core.service.ts             # FACADE: Inject sub-services và delegate
└── services/
    ├── sales-report.service.ts         # Logic báo cáo Bán hàng
    ├── purchasing-report.service.ts    # Logic báo cáo Mua hàng
    ├── vinfast-parts-report.service.ts # Logic báo cáo & tracking Phụ tùng VinFast
    └── settlement-report.service.ts    # Logic báo cáo Quyết toán
```

#### 1. Viết Sub-Service độc lập:
```typescript
// src/reports-core/services/sales-report.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SalesReportService {
  private readonly logger = new Logger(SalesReportService.name);

  constructor(private readonly dataSource: DataSource) {}

  async getSalesDashboard(query: { dateFrom?: string; dateTo?: string }) {
    // Logic tính toán báo cáo bán hàng...
  }
}
```

#### 2. Giữ Service gốc làm Facade (Bảo toàn Compatibility):
```typescript
// src/reports-core/reports-core.service.ts
import { Injectable } from '@nestjs/common';
import { SalesReportService } from './services/sales-report.service';
import { PurchasingReportService } from './services/purchasing-report.service';
import { VinfastPartsReportService } from './services/vinfast-parts-report.service';

@Injectable()
export class ReportsCoreService {
  constructor(
    private readonly salesReportService: SalesReportService,
    private readonly purchasingReportService: PurchasingReportService,
    private readonly vinfastPartsReportService: VinfastPartsReportService,
  ) {}

  // Forwarding method - Giữ nguyên chữ ký hàm để các nơi khác không bị gãy
  getSalesDashboard(query: { dateFrom?: string; dateTo?: string }) {
    return this.salesReportService.getSalesDashboard(query);
  }

  getPurchasingDashboard(query: { dateFrom?: string; dateTo?: string }) {
    return this.purchasingReportService.getPurchasingDashboard(query);
  }
}
```

> [!CAUTION]
> **Quy tắc Constructor của Facade:**
> * ❌ **CẤM:** Dùng constructor overload hoặc union types (`constructor(arg1: SubService | Repository<Entity>)`) để né việc cập nhật unit tests. Điều này làm hỏng reflection metadata của NestJS và crash container lúc runtime!
> * ✅ **ĐÚNG:** Luôn viết constructor DI rõ ràng với 1 signature duy nhất: `constructor(private readonly sub1: SubService1, private readonly sub2: SubService2) {}`.

#### 3. Cập nhật NestJS Module:
```typescript
// src/reports-core/reports-core.module.ts
import { Module } from '@nestjs/common';
import { ReportsCoreController } from './reports-core.controller';
import { ReportsCoreService } from './reports-core.service';
import { SalesReportService } from './services/sales-report.service';
import { PurchasingReportService } from './services/purchasing-report.service';
import { VinfastPartsReportService } from './services/vinfast-parts-report.service';

@Module({
  controllers: [ReportsCoreController],
  providers: [
    ReportsCoreService,
    SalesReportService,
    PurchasingReportService,
    VinfastPartsReportService,
  ],
  exports: [ReportsCoreService],
})
export class ReportsCoreModule {}
```

---

### Pattern C: Trích Xuất Pure Engine / Query Builder Helpers

*Áp dụng cho:* Các thuật toán phức tạp (FIFO lot matching, BOM multi-level explosion, P&L aggregation) hoặc các câu SQL thô dài trên 100 dòng.

#### Nguyên tắc Engine Helper:
1. Đặt trong `engines/` hoặc `helpers/` (ví dụ `fifo-ledger.engine.ts`, `aging-calculator.helper.ts`).
2. Sử dụng pure functions hoặc static methods nếu không phụ thuộc state.
3. Không inject NestJS DI trực tiếp vào engine thuần túy để dễ dàng viết unit test không cần mock container.

```typescript
// src/kgara-api-core/helpers/debt-aging.helper.ts
export interface AgingBucketResult {
  aging_0_30: number;
  aging_31_60: number;
  aging_61_90: number;
  aging_over_90: number;
}

export function calculateAgingBuckets(
  records: Array<{ amount: number; createdAt: Date }>
): AgingBucketResult {
  const now = new Date().getTime();
  const res = { aging_0_30: 0, aging_31_60: 0, aging_61_90: 0, aging_over_90: 0 };
  // Pure logic...
  return res;
}
```

---

### Pattern D: Tách biệt Tuyệt đối DTO & Entity (Zero-Entity Leaking)

*Áp dụng cho:* Mọi Controller và Service trong `erp-api` (theo chuẩn NestJS Best Practices 2026).

#### Nguyên tắc cốt lõi:
1. **DTOs** (`dto/*.dto.ts`): Xác định hình dạng dữ liệu đi vào và ra khỏi API, được validate qua `class-validator` và `class-transformer`.
2. **Entities** (`entities/*.entity.ts`): Mô hình hóa bảng CSDL vật lý (TypeORM decorators), chỉ dùng bên trong tầng Service / Repository.
3. **Tuyệt đối KHÔNG trả Entity trực tiếp từ Controller**:
   * Làm lộ các trường nội bộ (mật khẩu, hash, cờ hệ thống, audit fields).
   * Khóa chặt contract API vào cấu trúc database, khiến việc sửa đổi bảng CSDL gây gãy frontend.
   * Luôn map Entity sang Response DTO trước khi trả về client.

---

### Pattern E: Domain Handlers Pattern (Cho Gateway & Multi-Domain Modules)

*Áp dụng cho:* Các module đóng vai trò điều phối trung tâm hoặc tích hợp nhiều phân hệ (như `ai-hub-core`, `email-ingest`, `system-operations-core`).

#### Cấu trúc thư mục:
```
src/ai-hub-core/
├── ai-hub-core.module.ts              # Export CoreService và các Handlers
├── ai-hub-core.controller.ts          # Thin Controller (nhận DTO -> gọi Service -> trả DTO)
├── ai-hub-core.service.ts             # Orchestrator & Audit Logger
├── ai-hub-core.service.spec.ts        # Unit test co-located
├── clients/                           # Giao tiếp HTTP / External Gateway
│   ├── nine-router.client.ts
│   └── nine-router.client.spec.ts
└── handlers/                          # Business logic đóng gói theo từng phân hệ
    ├── invoice-ai.handler.ts          # Logic phân hệ hóa đơn
    ├── accounting-ai.handler.ts       # Logic phân hệ kế toán
    ├── purchasing-ai.handler.ts       # Logic phân hệ mua hàng
    ├── inventory-ai.handler.ts        # Logic phân hệ kho
    └── copilot-ai.handler.ts          # Logic trợ lý Copilot
```

---

## 5. Quy Trình Thực Hiện Từng Bước (Refactoring Checklist)

Khi được giao nhiệm vụ refactor một file lớn:

- [ ] **Bước 1: Quét và phân tích:** Chạy `bun .agents/skills/api-service-refactor/scripts/scan-oversized-files.ts` để nắm tổng quan.
- [ ] **Bước 2: Lập danh sách Public Methods:** Liệt kê các method công khai của Service/Controller cần refactor và nhóm chúng theo từng Domain.
- [ ] **Bước 3: Tạo thư mục & File con:** Tạo thư mục `services/`, `controllers/` hoặc `handlers/` tương ứng.
- [ ] **Bước 4: Di chuyển Logic:** Chuyển từng nhóm method sang Sub-Service / Handler tương ứng kèm theo private helpers và imports.
- [ ] **Bước 5: Thiết lập Facade / Orchestrator:** Biến file Service ban đầu thành Facade delegate. **Bắt buộc dùng Clean DI constructor, tuyệt đối không dùng constructor overload / union types.**
- [ ] **Bước 6: Cập nhật NestJS Module:** Khai báo toàn bộ Sub-Services / Handlers mới vào mảng `providers` và `exports` của module tương ứng.
- [ ] **Bước 7: Cập nhật & Tạo Unit Tests Co-located:**
  - Tạo các file `.spec.ts` đặt ngay cạnh từng Sub-Service / Handler con.
  - Cập nhật file `.spec.ts` của Facade Service: inject các mock sub-services thay vì truyền raw Repository.
- [ ] **Bước 8: Kiểm thử & Xác nhận:**
  ```bash
  bun run build      # Đảm bảo TypeScript và SWC/NestJS build thành công
  bun run test       # Đảm bảo toàn bộ test cases hiện tại đều PASS
  ```

