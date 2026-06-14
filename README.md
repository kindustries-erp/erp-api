# Liouni ERP Core API (NestJS + Neon Postgres)

Backend cho lane `erp-core` — thuần **Postgres/Neon**, không phụ thuộc Directus runtime.

## Runtime hiện tại (2026-06-14)

| Item | Giá trị |
|---|---|
| Branch | `erp-core` |
| Stack | `/opt/stacks/liouni-erp-core-api` |
| Port | `10020` |
| DB | Neon PostgreSQL (`DATABASE_URL` trong stack `.env`) |
| Auth | Local JWT (`JWT_SECRET`, `JWT_EXPIRES_IN`) |
| Image | `ghcr.io/kindustries-erp/erp-api:<sha>` |
| CI/CD | GitHub Actions (trigger: `push.branches: [erp-core]`) |
| Public domain | `api.erp-core.liouni.com` → `http://100.75.67.115:10020` |

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
# Yêu cầu: Bun >= 1.x, Node >= 18, và Neon DATABASE_URL
cp .env.example .env
# Điền DATABASE_URL, JWT_SECRET, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD

bun install
bun run start:dev
```

API sẽ chạy tại: `http://localhost:10020/api/v1`

## 🔨 Build & Deploy

```bash
bun run build                 # Compile NestJS
bun run migration:run         # Chạy TypeORM migrations (cần DATABASE_URL)

# Deploy production (trên Elite host)
cd /opt/stacks/liouni-erp-core-api
docker compose up -d --build --force-recreate
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
