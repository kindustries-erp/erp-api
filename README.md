# Liouni ERP API (NestJS + Neon Postgres)

Backend cho lane ERP active hiện tại (`erp-master`) — thuần **Postgres/Neon**, không phụ thuộc Directus runtime.

## Runtime hiện tại (2026-06-14)

| Item | Giá trị |
|---|---|
| Branch | `erp-master` |
| Stack | _xem runtime/deploy contract hiện hành trong docs canonical; README này không còn là source of truth cho stack path_ |
| Port | _xem runtime/deploy contract hiện hành_ |
| DB | Neon PostgreSQL (`ERP_MASTER_DATABASE_URL` trong stack `.env`) |
| Auth | Local JWT (`JWT_SECRET`, `JWT_EXPIRES_IN`) |
| Image | `ghcr.io/kindustries-erp/erp-api:<sha>` |
| CI/CD | GitHub Actions (trigger branch active: `erp-master`) |
| Public domain | _xem docs canonical / runtime hiện hành_ |

## 🚀 API Endpoints (core)

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Đăng nhập → JWT |
| `POST` | `/api/v1/auth/refresh` | Refresh token |
| `GET` | `/api/v1/auth/profile` | Profile (yêu cầu Bearer) |
| `GET` | `/api/v1/basic-masters` | Lookup masters (JWT only, no RBAC) |
| `GET/POST` | `/api/v1/purchase-orders` | Đơn mua hàng |
| `GET/POST` | `/api/v1/goods-receipts` | Nhập kho |
| `GET/POST` | `/api/v1/sales-orders` | Đơn bán hàng |
| `GET/POST` | `/api/v1/goods-issues` | Xuất kho |
| `GET/POST` | `/api/v1/bom` | Định mức vật tư (BOM) |
| `POST` | `/api/v1/production/execute` | Thực hiện sản xuất |
| `GET/POST` | `/api/v1/inventory/items` | Danh mục hàng hóa |
| `GET` | `/api/v1/inventory/stock` | Tồn kho tổng hợp |
| `GET` | `/api/v1/inventory/movements` | Lịch sử nhập xuất |
| `GET/POST` | `/api/v1/business-partners` | Đối tác (khách hàng/nhà cung cấp) |
| `GET/POST` | `/api/v1/admin/users` | Quản lý người dùng (RBAC) |
| `GET` | `/api/v1/audit-logs` | Audit logs |

## 📁 Cấu trúc thư mục

```
src/
├── auth/                     # JWT local auth (không dùng Directus)
├── users-admin/              # User management với RBAC
├── rbac-core/                # Role-Based Access Control (core lane)
├── audit-core/               # Audit logging
├── basic-masters-core/       # Lookup endpoint (JWT only)
├── business-partners-core/   # Đối tác (VENDOR/CUSTOMER)
├── purchase-orders-core/     # Mua hàng
├── goods-receipts-core/      # Nhập kho
├── sales-orders-core/        # Bán hàng
├── goods-issues-core/        # Xuất kho
├── bom-core/                 # BOM / Định mức
├── production-core/          # Sản xuất
├── inventory-core/           # Danh mục hàng hóa + stock summary
├── inventory-stock-core/     # Stock balance queries
├── employees-core/           # Nhân sự core
├── branches-core/            # Chi nhánh core
├── common/                   # Utils: sort, resolveSortOrder, etc.
├── db/                       # TypeORM DataSource + migration CLI
└── migrations/               # TypeORM migration files
```

## 🛠 Khởi chạy dev

```bash
# Yêu cầu: Bun >= 1.x, Node >= 18, và Neon ERP_MASTER_DATABASE_URL
cp .env.example .env
# Điền ERP_MASTER_DATABASE_URL, JWT_SECRET, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD

bun install
bun run start:dev
```

API local dev chạy theo `PORT` trong `.env`/runtime; dùng giá trị hiện tại của repo/stack thay vì tin cứng README này.

## 🔨 Build & Deploy

```bash
bun run build                 # Compile NestJS
bun run migration:run         # Chạy TypeORM migrations (cần ERP_MASTER_DATABASE_URL)

# Deploy runtime
Theo contract canonical hiện hành trong `/opt/docs/ai/liouni-erp/` và repo-local `AGENTS.md`; không dùng README này làm deploy runbook cứng.
```

## ✅ Validation gates

```bash
bun run build                 # Type-check + compile
bun run lint:check            # ESLint (max-warnings=0)
bun run type:check            # tsc --noEmit
bun test                      # Jest unit tests
```

## 📝 Giấy phép

Dự án thuộc bản quyền của **Liouni Production**.
