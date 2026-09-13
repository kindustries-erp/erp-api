---
name: app-config
description: Module tri thức Quản lý Cấu hình Ứng dụng & Tùy chọn Người dùng (App Config & User Preferences) trong erp-api (app-config & users). Chứa toàn bộ database schema (core_user_preferences), DTOs, API endpoints, logic nhận diện môi trường động (APP_ENV), lưu trữ theme, language, table configs và tích hợp đồng bộ hai chiều với frontend.
---

# ⚙️ Module Tri Thức: App Config & User Preferences - Backend (`erp-api`)

## 1. Tổng quan Nghiệp vụ

Module `app-config` chịu trách nhiệm cung cấp cấu hình hệ thống công khai (Public App Config) và quản lý tùy chọn cá nhân hóa của người dùng (User Preferences) trên toàn bộ hệ sinh thái Liouni ERP.

Các nghiệp vụ trọng tâm:
- **Cấu hình Môi trường Động (Dynamic `APP_ENV`)**: Cung cấp API công khai `GET /api/v1/app/config` để Frontend tự động nhận diện môi trường Backend đang chạy (`development`, `klotus-staging`, `klotus-production`, `greenway-staging`, `greenway-production`) mà không cần thay đổi file cấu hình `.env` ở Frontend.
- **Lưu trữ Tùy chọn Cá nhân Người dùng (`core_user_preferences`)**:
  - Giao diện người dùng (`theme`): `classic`, `shell`, `orcaq`, `midnight`.
  - Ngôn ngữ hệ thống (`language`): `vi`, `en`.
  - Cấu hình bảng dữ liệu (`tableConfigs`): Lưu thứ tự cột (`columnOrder`), trạng thái ẩn/hiện (`columnVisibility`), độ rộng cột (`columnSizing`) cho từng bảng dữ liệu (`tableId`) ở tất cả các module.
  - Cấu hình mở rộng UI (`uiConfigs`): Thu gọn thanh menu sidebar, filter panel, v.v.
- **Đồng bộ Hai Chiều Mượt mà (Two-way Smooth Sync)**:
  - Tích hợp trả kèm `preferences` ngay trong response của `/api/v1/auth/login` và `/api/v1/auth/profile` để Frontend nạp ngay khi đăng nhập.
  - Cập nhật ngầm với cơ chế **Debounce (500ms)** và cờ `_silentSuccess: true` để tránh spam request hoặc hiện thông báo toast phiền toái khi người dùng kéo giãn cột.

---

## 2. Database Schema & Quan hệ Dữ liệu

### Bảng `core_user_preferences` (Tùy Chọn Cá Nhân Của Người Dùng)
| Cột | Kiểu dữ liệu | Nullable | Default | Mô tả / Ràng buộc |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Khóa chính (PK) |
| `user_id` | `uuid` | NO | — | Khóa ngoại tham chiếu `core_users(id)`, `ON DELETE CASCADE`, `UNIQUE INDEX` |
| `theme` | `varchar(50)` | NO | `'classic'` | Giao diện (`classic`, `shell`, `orcaq`, `midnight`) |
| `language` | `varchar(10)` | NO | `'vi'` | Ngôn ngữ (`vi`, `en`) |
| `table_configs` | `jsonb` | NO | `'{}'::jsonb` | Cấu hình cột bảng theo từng `tableId` |
| `ui_configs` | `jsonb` | NO | `'{}'::jsonb` | Cấu hình giao diện bổ sung khác |
| `created_at` | `timestamptz` | NO | `now()` | Thời điểm tạo bản ghi |
| `updated_at` | `timestamptz` | NO | `now()` | Thời điểm cập nhật bản ghi |

---

## 3. Cấu trúc Source Code Backend

```text
src/app-config/
├── dto/
│   ├── app-config.dto.ts               # DTO response cho public config
│   ├── query-changelog.dto.ts          # DTO phân trang & tìm kiếm server-side cho changelog
│   └── update-user-preference.dto.ts   # DTO cập nhật theme, language, tableConfigs, uiConfigs
├── data/
│   └── changelog-data.ts               # Bộ dữ liệu master các phiên bản phát hành ERP
├── app-config.controller.ts            # Controller định nghĩa /app/config, /app/changelog và /app/preferences
├── app-config.service.ts               # Service đọc APP_ENV, merge preferences và lọc phân trang changelog
└── app-config.module.ts                # NestJS Module đăng ký Controller, Service & Repository

src/users/entities/
└── core-user-preference.entity.ts      # TypeORM Entity cho core_user_preferences

src/migrations/
└── 1787300000000-CreateCoreUserPreferences.ts # Migration tạo bảng core_user_preferences
```

---

## 4. Danh sách API Endpoints & RBAC Contract

Controller Base Route: `/api/v1/app`

| Method | Endpoint | Auth Guard | Tham số / Body | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/app/config` | *Public (Không cần Auth)* | — | Lấy cấu hình môi trường công khai (`appEnv`, `appName`, `version`) |
| `GET` | `/api/v1/app/changelog` | *Public (Không cần Auth)* | Query: `QueryChangelogDto` (`search`, `page`, `limit`) | Lấy danh sách nhật ký phát hành phân trang và tìm kiếm server-side |
| `GET` | `/api/v1/app/preferences` | `JwtAuthGuard` | Header Bearer Token | Lấy toàn bộ tùy chọn cá nhân của user đang đăng nhập |
| `PATCH`| `/api/v1/app/preferences` | `JwtAuthGuard` | Body: `UpdateUserPreferenceDto` | Cập nhật tùy chọn cá nhân (deep merge JSONB `tableConfigs`, `uiConfigs`) |

### Tích hợp Authentication Endpoints:
- `POST /api/v1/auth/login`: Trả kèm `preferences: { theme, language, tableConfigs, uiConfigs }`
- `POST /api/v1/auth/impersonate`: Trả kèm `preferences` của user được impersonate
- `GET /api/v1/auth/profile`: Trả kèm `preferences` của user hiện tại

---

## 5. Logic Nghiệp vụ Trọng tâm

### 5.1. Nhận diện 5 Môi trường `APP_ENV`
Module đọc biến môi trường `APP_ENV` từ `process.env.APP_ENV` (hoặc `ConfigService`) và trả về cho Frontend:
1. `development`: Môi trường dev chung / local test.
2. `klotus-staging`: Môi trường demo khách hàng Klotus (`KLOTUS DEMO` - tím).
3. `klotus-production`: Môi trường sản xuất chính thức của Klotus (ẩn badge).
4. `greenway-staging`: Môi trường demo khách hàng Greenway (`GREENWAY DEMO` - xanh lá).
5. `greenway-production`: Môi trường sản xuất chính thức của Greenway (ẩn badge).

### 5.2. Deep Merge `tableConfigs` & `uiConfigs`
Khi cập nhật tùy chọn bảng từ Frontend, service thực hiện merge cấp độ 1 trên JSON object để bảo toàn cấu hình của các bảng module khác:
```typescript
if (dto.tableConfigs !== undefined) {
  pref.tableConfigs = {
    ...(pref.tableConfigs || {}),
    ...dto.tableConfigs,
  };
}
```

### 5.3. Tự Động Khởi Tạo Preferences Mặc Định
Nếu user chưa từng có bản ghi trong `core_user_preferences`, service sẽ tự động tạo một bản ghi mặc định (`theme: 'classic'`, `language: 'vi'`, `tableConfigs: {}`, `uiConfigs: {}`) và lưu lại vào database.

---

## 6. Tích hợp Liên Module & Frontend

- **`auth`**: `AuthService` inject `AppConfigService` để nạp kèm `preferences` trong payload đăng nhập và profile.
- **`users`**: Khóa ngoại `user_id` liên kết chặt chẽ với `core_users(id)`, tự động xóa khi user bị xóa (`CASCADE`).
- **Frontend (`erp-web`)**:
  - `useEnvStore`: Gọi `getAppConfigApi()` khi khởi động để nhận diện môi trường và điều khiển component `EnvStamp`.
  - `useUserPreferences`: Zustand store quản lý `tableConfigs`, tích hợp debounce 500ms sync lên `PATCH /api/v1/app/preferences`.
  - `appStore`: Gọi `updateUserPreferencesApi({ theme })` hoặc `updateUserPreferencesApi({ language })` khi người dùng đổi giao diện/ngôn ngữ.
  - `authStore`: Tự động gọi `applyUserPreferences()` khi đăng nhập và bootstrap để nạp lại toàn bộ cấu hình cá nhân.

---

## 7. Quy tắc Kiểm thử & QC Mandate

Khi chỉnh sửa module `app-config`:
1. **Type-check**:
   ```bash
   bun run type:check
   ```
2. **Check CI (Lint + Format)**:
   ```bash
   bun run check:ci
   ```
3. **Database Migration**: Áp dụng runner chuẩn qua `.agents/skills/db-migrate/scripts/typeorm-runner.sh run <ENV_FILE>`.
