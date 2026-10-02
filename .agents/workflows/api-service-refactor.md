---
description: Quy trình chi tiết 5 giai đoạn quét ngưỡng kích thước, phân rã kiến trúc NestJS Sub-Controllers, Sub-Services Facade, Pure Engines, Clean DI Constructor và Zero-Regression Testing trong erp-api
---

# ⚙️ NestJS API Service & Controller Refactoring Workflow (`/api-service-refactor`)

Workflow này hướng dẫn Developer và Agent quy trình chuẩn 5 giai đoạn khi **phân rã (refactor)** các Controller (`> 300` LoC), Service (`> 500` LoC) hoặc Engines (`> 800` LoC) quá lớn trong `erp-api` nhằm tuân thủ nguyên lý **Single Responsibility Principle (SRP)**, đảm bảo khả năng mở rộng, dễ viết unit test và tránh xung đột mã nguồn.

---

## 🎯 4 Nguyên Tắc Sống Còn (Core Directives)

```mermaid
graph LR
    A["1. Threshold Scan & Audit"] --> B["2. Pattern Selection"]
    B --> C["3. Clean DI Constructor"]
    C --> D["4. Co-located Test"]
    D --> E["5. Zero-Regression Gate"]
```

1. **Tuân Thủ Ngưỡng Kích Thước File**:
   | Loại File | Cảnh Báo (WARNING) | Nghiêm Trọng (CRITICAL) | Pattern Đề Xuất |
   | :--- | :---: | :---: | :--- |
   | **Controller** (`*.controller.ts`) | **> 300 dòng** | **>= 1,000 dòng** | **Pattern A** (Sub-Controllers) |
   | **Service** (`*.service.ts`) | **> 500 dòng** | **>= 1,000 dòng** | **Pattern B** (Sub-Services & Facade) |
   | **Logic / Helper / Engine** | **> 800 dòng** | **>= 1,000 dòng** | **Pattern C** (Pure Engine / Query Builder) |

2. **Bảo Toàn REST Contract & Backward Compatibility**:
   - Tuyệt đối **KHÔNG** làm thay đổi endpoint route path (`@Get`, `@Post`), query parameters, HTTP status, headers hoặc cấu trúc DTO response.
   - Khi chia nhỏ Service, file Service gốc đóng vai trò **Facade**, delegate sang các Sub-Services để không làm gãy các Controller hoặc Module khác đang gọi tới.

3. **Clean Constructor Mandate (TUYỆT ĐỐI CẤM Constructor Overload / Union Types)**:
   - Trong mọi class NestJS `@Injectable()`, **TUYỆT ĐỐI CẤM** dùng TypeScript Constructor Overloading hoặc Union Types (`arg: SubService | Repository<Entity>`).
   - **Lý do**: TypeScript `emitDecoratorMetadata` sinh `design:paramtypes` dựa trên signature thực thi. Union types làm metadata bị gán `undefined` / `Object`, gây crash NestJS runtime (`UnknownDependenciesException`) dù `tsc` và `build` đều pass.
   - **Quy chuẩn**: Luôn dùng Clean DI Constructor với 1 signature duy nhất và cập nhật unit tests (`*.spec.ts`) để truyền mock sub-services.

4. **Co-located Testing & Zero-Entity Leaking**:
   - Unit test `.spec.ts` nằm ngay cạnh file được test (co-located).
   - Controller chỉ trả về DTOs đã qua sanitize/mapping, tuyệt đối không trả TypeORM Entities trực tiếp ra client.

---

## 🧭 Quy Trình 5 Giai Đoạn Chuẩn (5-Phase SOP)

### 🔹 GIAI ĐOẠN 1: Quét Ngưỡng & Phân Tích Hiện Trạng (Scan & Audit)

Trước khi can thiệp mã nguồn:
1. Chạy script quét toàn bộ hệ thống để nắm danh sách file cần refactor:
   ```bash
   bun .agents/skills/api-service-refactor/scripts/scan-oversized-files.ts
   ```
2. Đọc file mục tiêu, liệt kê:
   - Danh sách các public methods và private helpers.
   - Danh sách các dependency được inject vào constructor hiện tại (`DataSource`, repositories, other services).
   - Các controller / service khác đang phụ thuộc vào service này.

---

### 🔹 GIAI ĐOẠN 2: Lựa Chọn Pattern Kiến Trúc Phù Hợp

```
File cần refactor là gì?
├── 1. Controller > 300 dòng gom nhiều sub-resource?
│   └── 👉 Pattern A: Phân rã thành Sub-Controllers trong thư mục `controllers/`
│
├── 2. Service > 500 dòng ôm đồm nhiều nghiệp vụ/báo cáo?
│   └── 👉 Pattern B: Phân rã thành Sub-Services trong `services/` + Service gốc làm Facade Delegate
│
├── 3. Thuật toán tính toán nặng (FIFO, BOM explosion, P&L aggregation, Aging)?
│   └── 👉 Pattern C: Trích xuất Pure Engine / Query Builder trong `engines/` hoặc `helpers/`
│
├── 4. Controller/Service trả thẳng TypeORM Entity?
│   └── 👉 Pattern D: Chuẩn hóa Response DTOs & Mapping Engine (Zero-Entity Leaking)
│
└── 5. Module Gateway tích hợp đa phân hệ (AI Hub, Integrations)?
    └── 👉 Pattern E: Phân rã theo Domain Handlers trong `handlers/` + Clients trong `clients/`
```

---

### 🔹 GIAI ĐOẠN 3: Triển Khai Phân Rã & Thiết Lập Clean DI Facade

#### 1. Triển khai Pattern A: Sub-Controllers
```
src/[module-name]/
├── [module-name].module.ts
├── controllers/
│   ├── [resource-a].controller.ts
│   └── [resource-b].controller.ts
```

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

#### 2. Triển khai Pattern B: Sub-Services + Facade
```
src/[module-name]/
├── [module-name].module.ts
├── [module-name].service.ts             # FACADE DELEGATE
└── services/
    ├── [domain-a].service.ts
    ├── [domain-a].service.spec.ts        # Co-located test
    ├── [domain-b].service.ts
    └── [domain-b].service.spec.ts        # Co-located test
```

```typescript
// Sub-Service độc lập
@Injectable()
export class SalesReportService {
  private readonly logger = new Logger(SalesReportService.name);
  constructor(private readonly dataSource: DataSource) {}

  async getSalesDashboard(query: SalesReportQueryDto): Promise<SalesReportResponseDto> {
    // Logic tính toán chuyên biệt...
  }
}

// Facade Service (Giữ nguyên public signature)
@Injectable()
export class ReportsCoreService {
  constructor(
    private readonly salesReportService: SalesReportService,
    private readonly purchasingReportService: PurchasingReportService,
  ) {}

  getSalesDashboard(query: SalesReportQueryDto) {
    return this.salesReportService.getSalesDashboard(query);
  }

  getPurchasingDashboard(query: PurchasingReportQueryDto) {
    return this.purchasingReportService.getPurchasingDashboard(query);
  }
}
```

#### 3. Triển khai Pattern C: Pure Engines & Helpers
- Đặt tại `engines/` hoặc `helpers/`.
- Sử dụng pure functions hoặc static methods (không inject NestJS DI) để test độc lập nhanh chóng:
```typescript
// src/kgara-api-core/helpers/debt-aging.helper.ts
export interface AgingBucketResult {
  aging_0_30: number;
  aging_31_60: number;
  aging_61_90: number;
  aging_over_90: number;
}

export function calculateAgingBuckets(
  records: Array<{ amount: number; createdAt: Date }>,
): AgingBucketResult {
  // Pure logic...
}
```

---

### 🔹 GIAI ĐOẠN 4: Cập Nhật NestJS Module & Co-located Unit Tests

#### 1. Đăng ký Module:
Khai báo toàn bộ Sub-Controllers, Sub-Services mới vào `[module-name].module.ts`:
```typescript
@Module({
  controllers: [
    ReportsCoreController,
    SalesReportController,
  ],
  providers: [
    ReportsCoreService, // Facade
    SalesReportService, // Sub-service
    PurchasingReportService, // Sub-service
  ],
  exports: [ReportsCoreService, SalesReportService],
})
export class ReportsCoreModule {}
```

#### 2. Cập nhật Unit Tests Co-located:
- Tạo `[sub-service].service.spec.ts` ngay bên cạnh sub-service.
- Cập nhật file test của Facade Service: Sử dụng mock của Sub-Services:
```typescript
describe('ReportsCoreService (Facade)', () => {
  let service: ReportsCoreService;
  let salesReportService: Partial<SalesReportService>;

  beforeEach(async () => {
    salesReportService = {
      getSalesDashboard: jest.fn().mockResolvedValue({ totalRevenue: 1000 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsCoreService,
        { provide: SalesReportService, useValue: salesReportService },
      ],
    }).compile();

    service = module.get<ReportsCoreService>(ReportsCoreService);
  });

  it('should delegate getSalesDashboard to SalesReportService', async () => {
    const query = { dateFrom: '2026-01-01' };
    await service.getSalesDashboard(query);
    expect(salesReportService.getSalesDashboard).toHaveBeenCalledWith(query);
  });
});
```

---

### 🔹 GIAI ĐOẠN 5: Zero-Regression Quality Gate & Verification

```bash
# 1. Build Verification (đảm bảo TypeScript và metadata DI hợp lệ)
bun run build

# 2. Chạy toàn bộ Unit Tests liên quan
bunx jest --forceExit

# 3. Chạy CI check toàn diện
bun run check:ci

# 4. Quét lại xem file đã xuống dưới ngưỡng chưa
bun .agents/skills/api-service-refactor/scripts/scan-oversized-files.ts
```

---

## 📋 Checklist Kiểm Tra Hoàn Thành (Backend Refactor DoD)

- [ ] **Bảo toàn REST Contract**: 100% routes, query params, DTOs không bị thay đổi.
- [ ] **Bảo toàn Facade Signatures**: Tất cả callers cũ gọi vào Service gốc vẫn hoạt động bình thường.
- [ ] **Tuân thủ Clean Constructor**: 0 constructor overload, 0 union types trong `@Injectable()`.
- [ ] **Kích thước file đạt chuẩn**: Controller $< 300\text{ dòng}$, Service $< 500\text{ dòng}$, Engines $< 800\text{ dòng}$.
- [ ] **Zero-Entity Leaking**: Controller chỉ trả về DTOs.
- [ ] **Module Registration**: Đã khai báo đầy đủ providers, controllers và exports trong NestJS Module.
- [ ] **Co-located Tests**: Mọi Sub-Service đều có file `.spec.ts` đi kèm và test Facade delegate pass 100%.
- [ ] **Build & Test Pass**: `bun run build`, `bunx jest --forceExit`, `bun run check:ci` hoàn toàn không có lỗi.
