# ERP Backend (NestJS + Directus)

Dự án Backend cho hệ thống ERP, được xây dựng bằng NestJS và kết nối với Directus làm hệ quản trị nội dung (CMS) và cơ sở dữ liệu.

## 🚀 Tính năng chính

- **Authentication**: Luồng Proxy đăng ký/đăng nhập trực tiếp qua Directus SDK.
- **Directus Integration**: Kết nối SDK toàn cục, hỗ trợ gọi API Directus từ NestJS.
- **Dockerized**: Sẵn sàng chạy trong container Docker.
- **Validation**: Kiểm tra dữ liệu đầu vào chặt chẽ với Class Validator.

## 📖 Tài liệu API

- [Full API Documentation](file:///C:/Users/home/.gemini/antigravity/brain/eb9c5b42-fdb6-482b-b2a1-5f5410361ea3/full_api_documentation.md)
- [Directus Pagination Standard](file:///C:/Users/home/.gemini/antigravity/brain/eb9c5b42-fdb6-482b-b2a1-5f5410361ea3/directus_pagination_standard.md) (Quy định về phân trang giữa Backend & Frontend)
- [RBAC API](docs/api-rbac.md)

---

## 🛠 Hướng dẫn khởi chạy khi Pull từ Repo về

### 1. Yêu cầu hệ thống

- **Node.js** (Phiên bản 24 trở lên khuyến nghị)
- **Docker & Docker Compose** (Nếu muốn chạy qua Docker)
- **Instance Directus** đã sẵn sàng.

### 2. Thiết lập môi trường (.env)

Dự án không lưu file `.env` lên Git vì lý do bảo mật. Bạn cần tạo file này dựa trên mẫu:

1. Copy file ví dụ:
   ```bash
   cp .env.example .env
   ```
2. Mở file `.env` và điền các thông tin sau:
   - `PORT`: Cổng chạy ứng dụng (Mặc định: 10000).
   - `DIRECTUS_URL`: URL của Directus (ví dụ: `https://db-production.liouni.com`).
   - `DIRECTUS_ADMIN_TOKEN`: Static Admin Token lấy từ Directus Admin UI.

### 3. Chạy ứng dụng

#### Cách 1: Chạy trực tiếp trên máy (Development)

```bash
# 1. Cài đặt thư viện
npm install

# 2. Chạy chế độ watch (tự động reload khi đổi code)
npm run start:dev
```

#### Cách 2: Chạy bằng Docker (Khuyên dùng)

```bash
# Build và khởi chạy container dưới nền
docker-compose up -d --build
```

Ứng dụng sẽ chạy tại: `http://localhost:10000/api/v1`

---

## 🔌 API Endpoints (Cơ bản)

| Method             | Endpoint                         | Mô tả                                                       |
| :----------------- | :------------------------------- | :---------------------------------------------------------- |
| `POST`             | `/api/v1/auth/register`          | Đăng ký tài khoản mới (Proxy qua Directus)                  |
| `POST`             | `/api/v1/auth/login`             | Đăng nhập lấy access_token của Directus                     |
| `POST`             | `/api/v1/auth/refresh`           | Làm mới access_token bằng refresh_token                     |
| `POST`             | `/api/v1/auth/logout`            | Đăng xuất (Vô hiệu hóa refresh_token)                       |
| `POST`             | `/api/v1/auth/change-password`   | Đổi mật khẩu cho user đang đăng nhập (Yêu cầu Bearer Token) |
| `GET`              | `/api/v1/me`                     | Lấy profile cá nhân (Yêu cầu Bearer Token)                  |
| `GET`              | `/api/v1/employees/:id`          | Lấy thông tin chi tiết nhân viên (Yêu cầu Bearer Token)     |
| `PATCH`            | `/api/v1/employees/:id`          | Cập nhật thông tin nhân viên (Yêu cầu Bearer Token)         |
| `---`              | `---`                            | `---`                                                       |
| `GET/POST`         | `/api/v1/departments`            | Quản lý danh mục phòng ban (`gw_departments`)               |
| `GET/PATCH/DELETE` | `/api/v1/departments/:id`        | Thao tác chi tiết phòng ban                                 |
| `GET/POST`         | `/api/v1/positions`              | Quản lý danh mục chức danh (`gw_positions`)                 |
| `GET/PATCH/DELETE` | `/api/v1/positions/:id`          | Thao tác chi tiết chức danh                                 |
| `GET/POST`         | `/api/v1/company-bank-accounts`  | Quản lý tài khoản ngân hàng công ty                         |
| `GET/POST`         | `/api/v1/business-partner-roles` | Quản lý vai trò đối tác kinh doanh                          |
| `GET/POST`         | `/api/v1/chart-of-accounts`      | Quản lý hệ thống tài khoản kế toán                          |
| `GET`              | `/api/v1/activity-logs`          | Lấy danh sách log hoạt động (từ `directus_activity`)        |

---

## 📁 Cấu trúc thư mục

- `src/directus`: Cấu hình kết nối Directus SDK.
- `src/auth`: Module xử lý xác thực và phân quyền.
- `src/auth/guards`: Chứa `DirectusAuthGuard` để bảo vệ các API.
- `Dockerfile` & `docker-compose.yml`: Cấu hình đóng gói ứng dụng.

---

## 📝 Giấy phép

Dự án thuộc bản quyền của **Liouni Production**.
